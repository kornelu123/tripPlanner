import { NextResponse } from 'next/server';

const places = [
  {
    name: 'Jerónimos Monastery',
    address: 'Praça do Império, 1400-206 Lisboa',
    latitude: 38.6979,
    longitude: -9.206,
  },
  {
    name: 'Lisbon Cathedral',
    address: 'Largo da Sé, 1100-585 Lisboa',
    latitude: 38.71,
    longitude: -9.133,
  },
  {
    name: 'National Tile Museum',
    address: 'R. Me. Deus 4, 1900-312 Lisboa',
    latitude: 38.7243,
    longitude: -9.1137,
  },
];

export function GET(request: Request) {
  const url = new URL(request.url);
  const latitudeValue = url.searchParams.get('latitude');
  const longitudeValue = url.searchParams.get('longitude');
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  if (
    latitudeValue !== null &&
    longitudeValue !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  ) {
    return NextResponse.json({
      name: 'Dropped pin',
      address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      latitude,
      longitude,
    });
  }
  const query = (url.searchParams.get('q') ?? '').trim().toLowerCase();
  return NextResponse.json(
    query
      ? places.filter((place) =>
          `${place.name} ${place.address}`.toLowerCase().includes(query),
        )
      : [],
  );
}
