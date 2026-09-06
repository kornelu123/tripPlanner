'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import { LazyTripMap } from './lazy-trip-map';
import type {
  PendingImport,
  Category,
  PointDraft,
  TripEditorData,
  TripPoint,
  RoutePlan,
  TravelMode,
} from '@/lib/trip-editor-types';

const emptyDraft: PointDraft = {
  name: '',
  address: '',
  latitude: 38.716,
  longitude: -9.145,
};

async function reverseGeocode(latitude: number, longitude: number) {
  const response = await fetch(
    `/api/geocode?latitude=${latitude}&longitude=${longitude}`,
  );
  if (!response.ok) throw new Error('Could not look up that location.');
  return (await response.json()) as PointDraft;
}

export function TripEditor({ tripId }: { tripId: string }) {
  const [data, setData] = useState<TripEditorData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PointDraft | null>(null);
  const [movingPoint, setMovingPoint] = useState<TripPoint | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PointDraft[]>([]);
  const [status, setStatus] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [newCategory, setNewCategory] = useState({
    name: '',
    color: '#397a65',
    icon: 'pin',
  });
  const [routeOrder, setRouteOrder] = useState<string[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [travelMode, setTravelMode] = useState<TravelMode>('walking');
  const [roundTrip, setRoundTrip] = useState(false);
  const [fixedStartId, setFixedStartId] = useState('');
  const [fixedEndId, setFixedEndId] = useState('');

  useEffect(() => {
    fetch(`/api/trips/${tripId}/points`)
      .then((response) => {
        if (!response.ok) throw new Error('Could not load this trip.');
        return response.json() as Promise<TripEditorData>;
      })
      .then((loaded) => {
        setData(loaded);
        setRouteOrder(
          loaded.routePlan?.pointIds ?? loaded.points.map(({ id }) => id),
        );
        if (loaded.routePlan) {
          setTravelMode(loaded.routePlan.mode);
          setRoundTrip(loaded.routePlan.roundTrip);
          setFixedStartId(loaded.routePlan.fixedStartId ?? '');
          setFixedEndId(loaded.routePlan.fixedEndId ?? '');
        }
      })
      .catch((error: Error) => setStatus(error.message));
  }, [tripId]);

  const selectPoint = useCallback((id: string) => {
    setSelectedId(id);
    document.getElementById(`point-${id}`)?.focus();
  }, []);

  const beginDraftAt = useCallback(
    async (latitude: number, longitude: number) => {
      setStatus('Looking up address…');
      try {
        setDraft(await reverseGeocode(latitude, longitude));
        setStatus('Location ready to add.');
      } catch (error) {
        setStatus((error as Error).message);
        setDraft({ ...emptyDraft, latitude, longitude });
      }
    },
    [],
  );

  async function addPoint(pointDraft: PointDraft) {
    const response = await fetch(`/api/trips/${tripId}/points`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pointDraft),
    });
    if (!response.ok) {
      setStatus('Could not add point.');
      return;
    }
    const point = (await response.json()) as TripPoint;
    setData(
      (current) =>
        current && {
          ...current,
          points: [...current.points, point],
          pendingImports: current.pendingImports.filter(
            ({ id }) => id !== pointDraft.pendingImportId,
          ),
        },
    );
    setDraft(null);
    setResults([]);
    setSelectedId(point.id);
    setRouteOrder((current) => [...current, point.id]);
    setStatus(`${point.name} added.`);
  }

  async function search(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
    setResults(response.ok ? ((await response.json()) as PointDraft[]) : []);
  }

  function useLocation() {
    if (!navigator.geolocation) {
      setStatus('Geolocation is not available in this browser.');
      return;
    }
    setStatus('Finding your location…');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => void beginDraftAt(coords.latitude, coords.longitude),
      () => setStatus('Location permission was not granted.'),
    );
  }

  function addPending(item: PendingImport) {
    const outdoors = data?.categories.find(({ name }) => name === 'Outdoors');
    void addPoint({
      ...item,
      categoryId: outdoors?.id,
      pendingImportId: item.id,
    });
  }

  async function createCategory(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch(
      `/api/categories?tripId=${encodeURIComponent(tripId)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-user',
        },
        body: JSON.stringify(newCategory),
      },
    );
    if (!response.ok) return setStatus('Could not create category.');
    const category = (await response.json()) as Category;
    setData(
      (current) =>
        current && {
          ...current,
          categories: [...current.categories, category],
        },
    );
    setNewCategory({ ...newCategory, name: '' });
    setStatus(`${category.name} created.`);
  }

  async function updateCategory(category: Category, update: Partial<Category>) {
    const response = await fetch(
      `/api/categories/${category.id}?tripId=${encodeURIComponent(tripId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-user',
        },
        body: JSON.stringify(update),
      },
    );
    if (!response.ok) return;
    const updated = (await response.json()) as Category;
    setData(
      (current) =>
        current && {
          ...current,
          categories: current.categories
            .map((item) => (item.id === updated.id ? updated : item))
            .sort((a, b) => a.position - b.position),
        },
    );
  }

  async function removeCategory(category: Category) {
    const response = await fetch(
      `/api/categories/${category.id}?tripId=${encodeURIComponent(tripId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: 'Bearer demo-user' },
      },
    );
    if (!response.ok) return setStatus('Could not delete category.');
    const uncategorized = data?.categories.find(
      ({ name }) => name === 'Uncategorized',
    );
    setData(
      (current) =>
        current && {
          ...current,
          categories: current.categories.filter(({ id }) => id !== category.id),
          points: current.points.map((point) =>
            point.categoryId === category.id && uncategorized
              ? { ...point, categoryId: uncategorized.id }
              : point,
          ),
        },
    );
    if (categoryFilter === category.id) setCategoryFilter('all');
  }

  async function updatePoint(pointId: string, update: Partial<TripPoint>) {
    const response = await fetch(`/api/trips/${tripId}/points/${pointId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    });
    if (!response.ok) return false;
    const updated = (await response.json()) as TripPoint;
    setData(
      (current) =>
        current && {
          ...current,
          points: current.points.map((point) =>
            point.id === updated.id ? updated : point,
          ),
        },
    );
    return true;
  }

  async function moveCoordinates(latitude: number, longitude: number) {
    if (!movingPoint) return;
    setStatus('Looking up new address…');
    try {
      const place = await reverseGeocode(latitude, longitude);
      setMovingPoint({
        ...movingPoint,
        latitude,
        longitude,
        address: place.address,
      });
      setStatus('New position ready. Save or cancel the move.');
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function saveMove() {
    if (!movingPoint) return;
    if (await updatePoint(movingPoint.id, movingPoint)) {
      setMovingPoint(null);
      setStatus('Point position saved.');
    }
  }

  async function deletePoint(point: TripPoint) {
    const response = await fetch(`/api/trips/${tripId}/points/${point.id}`, {
      method: 'DELETE',
    });
    if (!response.ok) return;
    setData(
      (current) =>
        current && {
          ...current,
          points: current.points.filter(({ id }) => id !== point.id),
        },
    );
    if (selectedId === point.id) setSelectedId(null);
    setRouteOrder((current) => current.filter((id) => id !== point.id));
    setStatus(`${point.name} deleted.`);
  }

  async function calculateRoute(optimize: boolean) {
    setStatus('Calculating route…');
    const response = await fetch(`/api/trips/${tripId}/routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pointIds: routeOrder,
        mode: travelMode,
        roundTrip,
        fixedStartId: fixedStartId || undefined,
        fixedEndId: roundTrip ? undefined : fixedEndId || undefined,
        optimize,
      }),
    });
    const result = (await response.json()) as RoutePlan | { message: string };
    if (!response.ok) {
      setStatus(
        'message' in result ? result.message : 'Could not calculate route.',
      );
      return;
    }
    const routePlan = result as RoutePlan;
    setData(
      (current) =>
        current && {
          ...current,
          previousRoutePlan: current.routePlan,
          routePlan,
        },
    );
    setRouteOrder(routePlan.pointIds);
    setStatus('Route saved.');
  }

  async function restoreRoute() {
    const response = await fetch(`/api/trips/${tripId}/routes`, {
      method: 'PATCH',
    });
    if (!response.ok) return setStatus('There is no previous saved route.');
    const routePlan = (await response.json()) as RoutePlan;
    setData(
      (current) =>
        current && {
          ...current,
          previousRoutePlan: current.routePlan,
          routePlan,
        },
    );
    setRouteOrder(routePlan.pointIds);
    setTravelMode(routePlan.mode);
    setRoundTrip(routePlan.roundTrip);
    setFixedStartId(routePlan.fixedStartId ?? '');
    setFixedEndId(routePlan.fixedEndId ?? '');
    setStatus('Previous saved route restored.');
  }

  function dropBefore(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    setRouteOrder((current) => {
      const next = current.filter((id) => id !== draggedId);
      next.splice(next.indexOf(targetId), 0, draggedId);
      return next;
    });
    setDraggedId(null);
    setStatus('Manual order changed. Recalculate to save it.');
  }

  if (!data) {
    return <main className="editor-loading">{status || 'Loading trip…'}</main>;
  }
  const visiblePoints =
    categoryFilter === 'all'
      ? data.points
      : data.points.filter(({ categoryId }) => categoryId === categoryFilter);

  return (
    <main className="trip-editor">
      <header className="editor-header">
        <Link className="brand" href="/" aria-label="Roamly home">
          <span className="brand-mark" aria-hidden="true">
            R
          </span>
          Roamly
        </Link>
        <div>
          <p className="eyebrow">Trip editor</p>
          <h1>{data.trip.name}</h1>
        </div>
        <span className="point-count">{data.points.length} places</span>
      </header>

      <div className="editor-grid">
        <section className="point-panel" aria-labelledby="places-heading">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Build your route</p>
              <h2 id="places-heading">Places</h2>
            </div>
            <button
              className="primary-button compact"
              type="button"
              onClick={() => setDraft(emptyDraft)}
            >
              Add place <span aria-hidden="true">+</span>
            </button>
          </div>

          <form className="search-form" onSubmit={search}>
            <label htmlFor="address-search">Search for an address</label>
            <div>
              <input
                id="address-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Museum, café, or address"
              />
              <button type="submit">Search</button>
            </div>
          </form>
          {results.length > 0 && (
            <ul className="search-results" aria-label="Address results">
              {results.map((result) => (
                <li key={`${result.latitude}-${result.longitude}`}>
                  <button type="button" onClick={() => setDraft(result)}>
                    <strong>{result.name}</strong>
                    <span>{result.address}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="add-actions">
            <button type="button" onClick={useLocation}>
              Use my location
            </button>
            <button type="button" onClick={() => setDraft(emptyDraft)}>
              Enter coordinates
            </button>
          </div>

          <section
            className="category-manager"
            aria-labelledby="categories-heading"
          >
            <div className="category-toolbar">
              <h3 id="categories-heading">Categories</h3>
              <label>
                Filter
                <select
                  aria-label="Filter categories"
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                >
                  <option value="all">All categories</option>
                  {data.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <details>
              <summary>Manage categories</summary>
              <ul>
                {data.categories.map((category, index) => (
                  <li key={category.id}>
                    <input
                      aria-label={`Color for ${category.name}`}
                      type="color"
                      value={category.color}
                      onChange={(event) =>
                        void updateCategory(category, {
                          color: event.target.value,
                        })
                      }
                    />
                    <input
                      aria-label={`Edit category ${category.name}`}
                      value={category.name}
                      disabled={category.name === 'Uncategorized'}
                      onChange={(event) =>
                        void updateCategory(category, {
                          name: event.target.value,
                        })
                      }
                    />
                    <select
                      aria-label={`Icon for ${category.name}`}
                      value={category.icon}
                      onChange={(event) =>
                        void updateCategory(category, {
                          icon: event.target.value,
                        })
                      }
                    >
                      <option value="pin">Pin</option>
                      <option value="fork-knife">Food</option>
                      <option value="landmark">Landmark</option>
                      <option value="tree">Outdoors</option>
                      <option value="bed">Stay</option>
                    </select>
                    <button
                      type="button"
                      aria-label={`Move ${category.name} up`}
                      disabled={index === 0}
                      onClick={() =>
                        void updateCategory(category, { position: index - 1 })
                      }
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${category.name} down`}
                      disabled={index === data.categories.length - 1}
                      onClick={() =>
                        void updateCategory(category, { position: index + 1 })
                      }
                    >
                      ↓
                    </button>
                    {category.name !== 'Uncategorized' && (
                      <button
                        type="button"
                        aria-label={`Delete ${category.name}`}
                        onClick={() => void removeCategory(category)}
                      >
                        ×
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <form className="new-category" onSubmit={createCategory}>
                <input
                  aria-label="Category title"
                  required
                  maxLength={100}
                  placeholder="New category"
                  value={newCategory.name}
                  onChange={(event) =>
                    setNewCategory({ ...newCategory, name: event.target.value })
                  }
                />
                <input
                  aria-label="New category color"
                  type="color"
                  value={newCategory.color}
                  onChange={(event) =>
                    setNewCategory({
                      ...newCategory,
                      color: event.target.value,
                    })
                  }
                />
                <select
                  aria-label="New category icon"
                  value={newCategory.icon}
                  onChange={(event) =>
                    setNewCategory({ ...newCategory, icon: event.target.value })
                  }
                >
                  <option value="pin">Pin</option>
                  <option value="fork-knife">Food</option>
                  <option value="landmark">Landmark</option>
                  <option value="tree">Outdoors</option>
                  <option value="bed">Stay</option>
                </select>
                <button type="submit">Add category</button>
              </form>
            </details>
          </section>

          {draft && (
            <form
              className="point-form"
              aria-label="Add point"
              onSubmit={(event) => {
                event.preventDefault();
                void addPoint(draft);
              }}
            >
              <h3>Add this place</h3>
              <label>
                Name
                <input
                  required
                  value={draft.name}
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                />
              </label>
              <label>
                Address
                <input
                  required
                  value={draft.address}
                  onChange={(event) =>
                    setDraft({ ...draft, address: event.target.value })
                  }
                />
              </label>
              <div className="coordinate-fields">
                <label>
                  Latitude
                  <input
                    aria-label="Latitude"
                    type="number"
                    step="any"
                    value={draft.latitude}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        latitude: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Longitude
                  <input
                    aria-label="Longitude"
                    type="number"
                    step="any"
                    value={draft.longitude}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        longitude: Number(event.target.value),
                      })
                    }
                  />
                </label>
              </div>
              <div className="form-actions">
                <button type="submit">Save place</button>
                <button type="button" onClick={() => setDraft(null)}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          <section className="route-planner" aria-labelledby="route-heading">
            <div className="route-title">
              <div>
                <p className="eyebrow">Directions</p>
                <h2 id="route-heading">Route plan</h2>
              </div>
              {data.routePlan && (
                <strong>
                  {(data.routePlan.totalDistanceMeters / 1000).toFixed(1)} km ·{' '}
                  {Math.round(data.routePlan.totalDurationSeconds / 60)} min
                </strong>
              )}
            </div>
            <div className="route-options">
              <label>
                Travel mode
                <select
                  value={travelMode}
                  onChange={(event) =>
                    setTravelMode(event.target.value as TravelMode)
                  }
                >
                  <option value="walking">Walking</option>
                  <option value="driving">Driving</option>
                </select>
              </label>
              <label>
                Fixed start
                <select
                  value={fixedStartId}
                  onChange={(event) => {
                    const pointId = event.target.value;
                    setFixedStartId(pointId);
                    if (pointId === fixedEndId) setFixedEndId('');
                  }}
                >
                  <option value="">Any stop</option>
                  {data.points.map((point) => (
                    <option key={point.id} value={point.id}>
                      Start — {point.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Fixed end
                <select
                  disabled={roundTrip}
                  value={fixedEndId}
                  onChange={(event) => setFixedEndId(event.target.value)}
                >
                  <option value="">Any stop</option>
                  {data.points.map((point) => (
                    <option
                      key={point.id}
                      value={point.id}
                      disabled={point.id === fixedStartId}
                    >
                      End — {point.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="round-trip">
                <input
                  type="checkbox"
                  checked={roundTrip}
                  onChange={(event) => setRoundTrip(event.target.checked)}
                />
                Return to start
              </label>
            </div>
            <ol className="route-order" aria-label="Route stop order">
              {routeOrder.map((id, index) => {
                const point = data.points.find((item) => item.id === id);
                if (!point) return null;
                return (
                  <li
                    key={id}
                    draggable
                    onDragStart={() => setDraggedId(id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => dropBefore(id)}
                  >
                    <span>{index + 1}</span>
                    <span>
                      <strong>Route stop: {point.name}</strong>
                      <small>Drag to reorder</small>
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="route-actions">
              <button
                type="button"
                disabled={routeOrder.length < 2}
                onClick={() => void calculateRoute(true)}
              >
                Optimize route
              </button>
              <button
                type="button"
                disabled={routeOrder.length < 2}
                onClick={() => void calculateRoute(false)}
              >
                Recalculate order
              </button>
              <button
                type="button"
                disabled={!data.previousRoutePlan}
                onClick={() => void restoreRoute()}
              >
                Restore previous
              </button>
            </div>
            {data.routePlan && (
              <ol className="leg-list" aria-label="Route legs">
                {data.routePlan.legs.map((leg, index) => (
                  <li key={`${leg.fromPointId}-${leg.toPointId}`}>
                    <span>Leg {index + 1}</span>
                    <strong>
                      {(leg.distanceMeters / 1000).toFixed(1)} km ·{' '}
                      {Math.round(leg.durationSeconds / 60)} min
                    </strong>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <ol className="point-list">
            {visiblePoints.map((point, index) => (
              <li key={point.id}>
                <article
                  id={`point-${point.id}`}
                  tabIndex={-1}
                  className={
                    selectedId === point.id
                      ? 'point-card selected'
                      : 'point-card'
                  }
                >
                  <button
                    className="point-select"
                    type="button"
                    onClick={() => selectPoint(point.id)}
                    aria-pressed={selectedId === point.id}
                  >
                    <span
                      className="category-dot"
                      style={{
                        background: data.categories.find(
                          ({ id }) => id === point.categoryId,
                        )?.color,
                      }}
                      aria-hidden="true"
                    />
                    <span>
                      <small>Stop {index + 1}</small>
                      <strong>{point.name}</strong>
                      <span>{point.address}</span>
                    </span>
                  </button>
                  <label>
                    Category
                    <select
                      value={point.categoryId}
                      onChange={(event) =>
                        void updatePoint(point.id, {
                          categoryId: event.target.value,
                        })
                      }
                    >
                      {data.categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="card-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(point.id);
                        setMovingPoint({ ...point });
                      }}
                    >
                      Move
                    </button>
                    <button
                      type="button"
                      onClick={() => void deletePoint(point)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              </li>
            ))}
          </ol>

          {data.pendingImports.length > 0 && (
            <section
              className="pending-imports"
              aria-labelledby="imports-heading"
            >
              <h2 id="imports-heading">Pending social saves</h2>
              {data.pendingImports.map((item) => (
                <article key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.source}</span>
                  </div>
                  <button type="button" onClick={() => addPending(item)}>
                    Add to trip
                  </button>
                </article>
              ))}
            </section>
          )}
        </section>

        <section className="map-panel" aria-label="Map and map controls">
          <LazyTripMap
            points={visiblePoints}
            categories={data.categories}
            selectedId={selectedId}
            movingPoint={movingPoint}
            routePlan={data.routePlan}
            onSelect={selectPoint}
            onAddCoordinates={beginDraftAt}
            onMoveCoordinates={(latitude, longitude) =>
              void moveCoordinates(latitude, longitude)
            }
          />
          <p className="map-hint">
            Click the map to add a place. Select a marker to open its card.
          </p>
          {movingPoint && (
            <form
              className="move-controls"
              aria-label={`Move ${movingPoint.name}`}
              onSubmit={(event) => {
                event.preventDefault();
                void moveCoordinates(
                  movingPoint.latitude,
                  movingPoint.longitude,
                );
              }}
            >
              <strong>Moving {movingPoint.name}</strong>
              <span>Drag the orange marker or enter coordinates.</span>
              <div className="coordinate-fields">
                <label>
                  Latitude
                  <input
                    aria-label="New latitude"
                    type="number"
                    step="any"
                    value={movingPoint.latitude}
                    onChange={(event) =>
                      setMovingPoint({
                        ...movingPoint,
                        latitude: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Longitude
                  <input
                    aria-label="New longitude"
                    type="number"
                    step="any"
                    value={movingPoint.longitude}
                    onChange={(event) =>
                      setMovingPoint({
                        ...movingPoint,
                        longitude: Number(event.target.value),
                      })
                    }
                  />
                </label>
              </div>
              <button type="submit">Look up address</button>
              <button type="button" onClick={() => void saveMove()}>
                Save move
              </button>
              <button
                type="button"
                onClick={() => {
                  setMovingPoint(null);
                  setStatus('Move canceled.');
                }}
              >
                Cancel move
              </button>
            </form>
          )}
        </section>
      </div>
      <p className="sr-status" role="status" aria-live="polite">
        {status}
      </p>
    </main>
  );
}
