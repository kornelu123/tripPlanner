import { allowedCategoryIcons } from './trip-editor-store';

export const categoryColorPattern = /^#[0-9a-fA-F]{6}$/;

export function categoryInput(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const input = value as Record<string, unknown>;
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (
    !name ||
    name.length > 100 ||
    typeof input.color !== 'string' ||
    !categoryColorPattern.test(input.color) ||
    typeof input.icon !== 'string' ||
    !allowedCategoryIcons.includes(
      input.icon as (typeof allowedCategoryIcons)[number],
    )
  )
    return undefined;
  return { name, color: input.color.toLowerCase(), icon: input.icon };
}

export function authenticatedUserId(request: Request) {
  const authorization = request.headers.get('authorization');
  return authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim() || undefined
    : undefined;
}
