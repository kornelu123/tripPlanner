// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MapDashboard } from './map-dashboard';

const user = {
  id: 'owner-id',
  displayName: 'Taylor',
  email: 'taylor@example.com',
};

describe('MapDashboard', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('creates any additional map and links to its editor', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(
        Response.json(
          {
            id: 'new-map',
            name: 'Japan 2027',
            ownerId: user.id,
            role: 'owner',
            updatedAt: '2026-09-14T00:00:00.000Z',
          },
          { status: 201 },
        ),
      );
    vi.stubGlobal('fetch', fetch);
    render(<MapDashboard user={user} />);

    await screen.findByRole('heading', { name: 'Create your first map' });
    fireEvent.change(screen.getByLabelText('New map name'), {
      target: { value: 'Japan 2027' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create map' }));

    expect(
      await screen.findByRole('heading', { name: 'Japan 2027' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Open map' }).getAttribute('href'),
    ).toBe('/trips/new-map');
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/trips',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('shares an owned map with multiple registered users', async () => {
    const map = {
      id: 'shared-map',
      name: 'Lisbon',
      ownerId: user.id,
      role: 'owner',
      updatedAt: '2026-09-14T00:00:00.000Z',
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json([map]))
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(
        Response.json(
          {
            userId: 'friend-id',
            email: 'friend@example.com',
            displayName: 'Friend',
            role: 'editor',
          },
          { status: 201 },
        ),
      );
    vi.stubGlobal('fetch', fetch);
    render(<MapDashboard user={user} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Share' }));
    await screen.findByRole('dialog', { name: 'Share this map' });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'friend@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Share map' }));

    expect(await screen.findByText('friend@example.com · editor')).toBeTruthy();
    await waitFor(() =>
      expect(fetch).toHaveBeenLastCalledWith(
        '/api/trips/shared-map/members',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });
});
