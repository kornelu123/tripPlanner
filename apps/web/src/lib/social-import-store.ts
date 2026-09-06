import type { SocialImport } from '@trip-planner/domain';

const imports = new Map<string, SocialImport>();

export function saveSocialImport(item: SocialImport) {
  imports.set(item.id, item);
  return item;
}
export function getSocialImport(tripId: string, importId: string) {
  const item = imports.get(importId);
  return item?.tripId === tripId ? item : undefined;
}
export function listSocialImports(tripId: string) {
  return [...imports.values()].filter((item) => item.tripId === tripId);
}
