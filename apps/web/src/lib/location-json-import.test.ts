import { describe, expect, it } from 'vitest';

import { parseLocationJson } from './location-json-import';

describe('parseLocationJson', () => {
  it('converts Polish location fields into point drafts', () => {
    expect(
      parseLocationJson(`[
        {
          "nazwa": " Wieża Eiffla ",
          "adres": " Champ de Mars, Paris ",
          "lokalizacja_geograficzna": {
            "szerokosc_geograficzna": 48.85837,
            "dlugosc_geograficzna": 2.294481
          }
        }
      ]`),
    ).toEqual([
      {
        name: 'Wieża Eiffla',
        address: 'Champ de Mars, Paris',
        latitude: 48.85837,
        longitude: 2.294481,
      },
    ]);
  });

  it.each([
    ['malformed JSON', '{'],
    ['an empty list', '[]'],
    [
      'an invalid coordinate',
      '[{"nazwa":"A","adres":"B","lokalizacja_geograficzna":{"szerokosc_geograficzna":91,"dlugosc_geograficzna":2}}]',
    ],
  ])('rejects %s', (_description, contents) => {
    expect(() => parseLocationJson(contents)).toThrow();
  });
});
