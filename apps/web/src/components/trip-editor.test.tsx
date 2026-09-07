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
    points,
    onSelect,
    onAddCoordinates,
    onMoveCoordinates,
  }: {
    points: TripPoint[];
    onSelect: (id: string) => void;
    onAddCoordinates: (latitude: number, longitude: number) => void;
    onMoveCoordinates: (latitude: number, longitude: number) => void;
  }) => (
    <div>
      <output aria-label="Visible map points">
        {points.map(({ id }) => id).join(',')}
      </output>
      <button onClick={() => onSelect('first')}>Select map marker</button>
      <button onClick={() => onAddCoordinates(40, -8)}>Click map</button>
      <button onClick={() => onMoveCoordinates(41, -7)}>Drag marker</button>
    </div>
  ),
}));

vi.mock('./place-search', () => ({
  PlaceSearch: ({ onChoose }: { onChoose: (place: unknown) => void }) => (
    <>
      <input aria-label="Search for an address" />
      <button type="button">Search</button>
      <button
        type="button"
        onClick={() =>
          onChoose({
            name: 'Museum',
            address: 'Museum address',
            latitude: 37,
            longitude: -8,
            googlePlaceId: 'museum-place-id',
          })
        }
      >
        Museum
      </button>
    </>
  ),
}));

const initialData: TripEditorData = {
  trip: { id: 'test', name: 'Test trip' },
  categories: [
    {
      id: 'uncategorized',
      name: 'Uncategorized',
      color: '#687c76',
      icon: 'pin',
      position: 0,
    },
    {
      id: 'food',
      name: 'Food',
      color: '#dc6941',
      icon: 'fork-knife',
      position: 1,
    },
    {
      id: 'culture',
      name: 'Culture',
      color: '#735da5',
      icon: 'landmark',
      position: 2,
    },
    {
      id: 'outdoors',
      name: 'Outdoors',
      color: '#397a65',
      icon: 'tree',
      position: 3,
    },
    { id: 'stay', name: 'Stay', color: '#3573a5', icon: 'bed', position: 4 },
  ],
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
      categoryId: 'food',
      price: {
        status: 'success',
        minimumAmount: 8,
        maximumAmount: 24,
        currency: 'EUR',
        unit: 'typical_meal',
        confidence: 0.8,
        lastCheckedAt: '2026-09-01T10:00:00Z',
        stale: true,
        sources: [
          {
            url: 'https://cafe.example/menu',
            type: 'official_structured_data',
          },
        ],
      },
    },
  ],
};

describe('TripEditor', () => {
  let points: TripPoint[];

  beforeEach(() => {
    window.history.replaceState(null, '', '/');
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
            categoryId: 'outdoors',
          };
          points.push(created);
          return Response.json(created, { status: 201 });
        }
        if (url.endsWith('/price') && init?.method === 'POST') {
          return Response.json({ status: 'queued' }, { status: 202 });
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
    window.localStorage.clear();
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

  it('distinguishes sourced estimates, stale data, loading, and unavailable prices', async () => {
    const user = userEvent.setup();
    render(<TripEditor tripId="test" />);
    const section = await screen.findByLabelText(
      'Estimated price for First place',
    );
    expect(section.textContent).toContain('8–24 EUR');
    expect(section.textContent).toContain('typical meal');
    expect(section.textContent).toContain('80% confidence');
    expect(section.textContent).toContain('Stale estimate');
    expect(section.textContent).toContain('Actual prices may differ');
    expect(
      screen
        .getByRole('link', { name: 'official structured data' })
        .getAttribute('href'),
    ).toBe('https://cafe.example/menu');
    await user.click(screen.getByRole('button', { name: 'Refresh price' }));
    expect(await screen.findByText('Researching current prices…')).toBeTruthy();
    expect(
      await screen.findByText(
        'Price research queued. It runs in the background.',
      ),
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
      'culture',
    );
    await waitFor(() => expect(points[0]?.categoryId).toBe('culture'));

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

  it('filters the itinerary and map with the same category selection', async () => {
    const user = userEvent.setup();
    render(<TripEditor tripId="test" />);
    await screen.findByText('First place');
    await user.selectOptions(
      screen.getByLabelText('Filter categories'),
      'culture',
    );
    expect(screen.queryByText('First place')).toBeNull();
    expect(screen.getByLabelText('Visible map points').textContent).toBe('');
    await user.selectOptions(
      screen.getByLabelText('Filter categories'),
      'food',
    );
    expect(screen.getByText('First place')).toBeTruthy();
    expect(screen.getByLabelText('Visible map points').textContent).toBe(
      'first',
    );
  });

  it('prevents selecting the same fixed start and end', async () => {
    const user = userEvent.setup();
    render(<TripEditor tripId="test" />);
    await screen.findByText('First place', {
      selector: '.point-select strong',
    });

    await user.selectOptions(screen.getByLabelText('Fixed start'), 'first');

    expect(
      screen
        .getByLabelText('Fixed end')
        .querySelector<HTMLOptionElement>('option[value="first"]')?.disabled,
    ).toBe(true);
  });

  it('restores an unsaved place draft from local storage', async () => {
    const user = userEvent.setup();
    const view = render(<TripEditor tripId="test" />);
    await screen.findByText('First place');
    await user.click(screen.getByRole('button', { name: /Add place/ }));
    await user.type(screen.getByLabelText('Name'), 'Offline café');
    await waitFor(() =>
      expect(window.localStorage.getItem('roamly-point-draft:test')).toContain(
        'Offline café',
      ),
    );

    view.unmount();
    render(<TripEditor tripId="test" />);
    expect(await screen.findByDisplayValue('Offline café')).toBeTruthy();
  });
});
