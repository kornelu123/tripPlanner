import type { PointDraft } from './trip-editor-types';

interface ImportedLocation {
  nazwa: string;
  adres: string;
  lokalizacja_geograficzna: {
    szerokosc_geograficzna: number;
    dlugosc_geograficzna: number;
  };
}

export function parseLocationJson(contents: string): PointDraft[] {
  let value: unknown;
  try {
    value = JSON.parse(contents);
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }

  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('The JSON file must contain a non-empty list of places.');
  }

  return value.map((item, index) => {
    if (!isImportedLocation(item)) {
      throw new Error(`Place ${index + 1} has missing or invalid data.`);
    }
    return {
      name: item.nazwa.trim(),
      address: item.adres.trim(),
      latitude: item.lokalizacja_geograficzna.szerokosc_geograficzna,
      longitude: item.lokalizacja_geograficzna.dlugosc_geograficzna,
    };
  });
}

function isImportedLocation(value: unknown): value is ImportedLocation {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ImportedLocation>;
  const location = item.lokalizacja_geograficzna;
  return (
    typeof item.nazwa === 'string' &&
    item.nazwa.trim().length > 0 &&
    typeof item.adres === 'string' &&
    item.adres.trim().length > 0 &&
    !!location &&
    typeof location.szerokosc_geograficzna === 'number' &&
    Number.isFinite(location.szerokosc_geograficzna) &&
    location.szerokosc_geograficzna >= -90 &&
    location.szerokosc_geograficzna <= 90 &&
    typeof location.dlugosc_geograficzna === 'number' &&
    Number.isFinite(location.dlugosc_geograficzna) &&
    location.dlugosc_geograficzna >= -180 &&
    location.dlugosc_geograficzna <= 180
  );
}
