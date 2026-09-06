'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import { LazyTripMap } from './lazy-trip-map';
import type {
  PendingImport,
  PointDraft,
  TripEditorData,
  TripPoint,
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

  useEffect(() => {
    fetch(`/api/trips/${tripId}/points`)
      .then((response) => {
        if (!response.ok) throw new Error('Could not load this trip.');
        return response.json() as Promise<TripEditorData>;
      })
      .then(setData)
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
    void addPoint({
      ...item,
      category: 'Outdoors',
      pendingImportId: item.id,
    });
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
    setStatus(`${point.name} deleted.`);
  }

  if (!data) {
    return <main className="editor-loading">{status || 'Loading trip…'}</main>;
  }

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

          <ol className="point-list">
            {data.points.map((point, index) => (
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
                      className={`category-dot category-${point.category.toLowerCase()}`}
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
                      value={point.category}
                      onChange={(event) =>
                        void updatePoint(point.id, {
                          category: event.target.value,
                        })
                      }
                    >
                      {data.categories.map((category) => (
                        <option key={category}>{category}</option>
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
            points={data.points}
            selectedId={selectedId}
            movingPoint={movingPoint}
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
