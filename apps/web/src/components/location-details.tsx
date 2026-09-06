import type { Category, PointDraft, TripPoint } from '@/lib/trip-editor-types';

export function LocationDetails({
  location,
  category,
  pending,
  onAdd,
  onRemove,
  onRoute,
}: {
  location: TripPoint | PointDraft | null;
  category?: Category;
  pending?: boolean;
  onAdd?: () => void;
  onRemove?: () => void;
  onRoute?: () => void;
}) {
  if (!location)
    return (
      <aside className="location-details empty">
        <h2>Location details</h2>
        <p>Select a marker, itinerary stop, search result, or social save.</p>
      </aside>
    );
  const google = location.google;
  return (
    <aside
      className="location-details"
      aria-label={`Details for ${location.name}`}
    >
      <p className="eyebrow">
        {pending
          ? 'Confirm Google place'
          : (category?.name ?? google?.category ?? 'Uncategorized')}
      </p>
      <h2>{location.name}</h2>
      <p>{location.address || 'Address unavailable'}</p>
      {!google && (
        <p className="missing-google-data">
          Google details are unavailable or need refreshing.
        </p>
      )}
      {google?.openNow !== undefined && (
        <p>
          <strong>{google.openNow ? 'Open now' : 'Closed now'}</strong>
        </p>
      )}
      {google?.weekdayDescriptions && (
        <details>
          <summary>Opening hours</summary>
          <ul>
            {google.weekdayDescriptions.map((day) => (
              <li key={day}>{day}</li>
            ))}
          </ul>
        </details>
      )}
      {google?.website && (
        <a href={google.website} target="_blank" rel="noreferrer">
          Website
        </a>
      )}
      {google?.phoneNumber && (
        <a href={`tel:${google.phoneNumber}`}>{google.phoneNumber}</a>
      )}
      {google?.rating !== undefined && (
        <p>
          {google.rating} Google rating · {google.reviewCount ?? 0} reviews
        </p>
      )}
      {'price' in location && location.price?.status === 'success' && (
        <p>
          Estimated price: {location.price.minimumAmount ?? '—'}–
          {location.price.maximumAmount ?? '—'} {location.price.currency}
        </p>
      )}
      <div className="details-actions">
        {pending && onAdd && (
          <button type="button" onClick={onAdd}>
            Add to trip
          </button>
        )}
        {!pending && onRemove && (
          <button type="button" onClick={onRemove}>
            Remove
          </button>
        )}
        {!pending && <button type="button">Edit category</button>}
        {onRoute && (
          <button type="button" onClick={onRoute}>
            Route here
          </button>
        )}
      </div>
      {google?.googlePlaceId && <small>Place details provided by Google</small>}
    </aside>
  );
}
