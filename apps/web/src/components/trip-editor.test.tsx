// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TripEditor } from './trip-editor';
import type { TripEditorData, TripPoint } from '@/lib/trip-editor-types';

vi.mock('./lazy-trip-map', () => ({
  LazyTripMap: ({
    onSelect,
    onAddCoordinates,
    onMoveCoordinates,
  }: {
    onSelect: (id: string) => void;
    onAddCoordinates: (latitude: number, longitude: number) => void;
    onMoveCoordinates: (latitude: number, longitude: number) => void;
  }) => (
    <div>
      <button onClick={() => onSelect('first')}>Select map marker</button>
      <button onClick={() => onAddCoordinates(40, -8)}>Click map</button>
      <button onClick={() => onMoveCoordinates(41, -7)}>Drag marker</button>
    </div>
  ),
}));

const initialData: TripEditorData = {
  trip: { id: 'test', name: 'Test trip' },
  categories: ['Food', 'Culture', 'Outdoors', 'Stay'],
  pendingImports: [
    {
      id: 'pending',
      name: 'Social place',
      address: 'Saved address',
      latitude: 39,
      longitude: -9,
      source: 'Instagram',
    },
  ],
  points: [
    {
      id: 'first',
      name: 'First place',
      address: 'Old address',
      latitude: 38,
      longitude: -9,
      category: 'Food',
    },
  ],
};

describe('TripEditor', () => {
  let points: TripPoint[];

  beforeEach(() => {
    points = structuredClone(initialData.points);
    let createdId = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/api/geocode?latitude=')) {
          const params = new URL(url, 'http://localhost').searchParams;
          return Response.json({
            name: 'Dropped pin',
            address: 'New address',
            latitude: Number(params.get('latitude')),
            longitude: Number(params.get('longitude')),
          });
        }
        if (url.includes('/api/geocode?q=')) {
          return Response.json([
            {
              name: 'Museum',
              address: 'Museum address',
              latitude: 37,
              longitude: -8,
            },
          ]);
        }
        if (url.endsWith('/points') && !init?.method) {
          return Response.json({ ...initialData, points });
        }
        if (url.endsWith('/points') && init?.method === 'POST') {
          const created = {
            ...(JSON.parse(String(init.body)) as TripPoint),
            id: `created-${createdId++}`,
            category: 'Outdoors',
          };
          points.push(created);
          return Response.json(created, { status: 201 });
        }
        const id = url.split('/').at(-1)!;
        if (init?.method === 'PATCH') {
          const updated = {
            ...points.find((point) => point.id === id)!,
            ...JSON.parse(String(init.body)),
          };
          points = points.map((point) => (point.id === id ? updated : point));
          return Response.json(updated);
        }
        if (init?.method === 'DELETE') {
          points = points.filter((point) => point.id !== id);
          return new Response(null, { status: 204 });
        }
        return new Response(null, { status: 404 });
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('adds searched, map, and pending points', async () => {
    const user = userEvent.setup();
    render(<TripEditor tripId="test" />);
    await screen.findByText('First place');

    await user.type(screen.getByLabelText('Search for an address'), 'museum');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.click(await screen.findByRole('button', { name: /Museum/ }));
    await user.click(screen.getByRole('button', { name: 'Save place' }));
    expect(
      await screen.findByText('Museum', { selector: 'strong' }),
    ).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Click map' }));
    await screen.findByDisplayValue('New address');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('button', { name: 'Add to trip' }));
    expect(
      await screen.findByText('Social place', { selector: 'strong' }),
    ).toBeTruthy();
  });

  it('selects, categorizes, moves with save/cancel, and deletes a point', async () => {
    const user = userEvent.setup();
    render(<TripEditor tripId="test" />);
    await screen.findByText('First place');

    await user.click(screen.getByRole('button', { name: 'Select map marker' }));
    expect(
      screen
        .getByRole('button', { name: /First place/ })
        .getAttribute('aria-pressed'),
    ).toBe('true');

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Category' }),
      'Culture',
    );
    await waitFor(() => expect(points[0]?.category).toBe('Culture'));

    await user.click(screen.getByRole('button', { name: 'Move' }));
    await user.click(screen.getByRole('button', { name: 'Drag marker' }));
    await screen.findByText('New position ready. Save or cancel the move.');
    await user.click(screen.getByRole('button', { name: 'Cancel move' }));
    expect(points[0]?.latitude).toBe(38);

    await user.click(screen.getByRole('button', { name: 'Move' }));
    fireEvent.change(screen.getByLabelText('New latitude'), {
      target: { value: '42' },
    });
    await user.click(screen.getByRole('button', { name: 'Look up address' }));
    await user.click(screen.getByRole('button', { name: 'Save move' }));
    await waitFor(() => expect(points[0]?.latitude).toBe(42));

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('First place')).toBeNull());
  });
});
