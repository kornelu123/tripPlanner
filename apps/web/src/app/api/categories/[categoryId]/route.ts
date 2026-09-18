import { NextResponse } from 'next/server';

import { categoryColorPattern } from '../../../../lib/category-validation';
import { authorizeTrip } from '../../../../lib/auth';
import {
  allowedCategoryIcons,
  deleteCategory,
  listCategories,
  loadTripEditorData,
  persistTripEditorData,
  updateCategory,
} from '../../../../lib/trip-editor-store';

interface Context {
  params: Promise<{ categoryId: string }>;
}

export async function PATCH(request: Request, { params }: Context) {
  const tripId = new URL(request.url).searchParams.get('tripId');
  const { categoryId } = await params;
  const input = (await request.json()) as Record<string, unknown>;
  if (!tripId)
    return NextResponse.json(
      { message: 'tripId is required.' },
      { status: 400 },
    );
  const auth = await authorizeTrip(request, tripId, true);
  if (auth.error) return auth.error;
  await loadTripEditorData(tripId);
  const update: {
    name?: string;
    color?: string;
    icon?: string;
    position?: number;
  } = {};
  if (input.name !== undefined) {
    if (
      typeof input.name !== 'string' ||
      !input.name.trim() ||
      input.name.trim().length > 100
    )
      return NextResponse.json(
        { message: 'Invalid category name.' },
        { status: 400 },
      );
    update.name = input.name.trim();
  }
  if (input.color !== undefined) {
    if (
      typeof input.color !== 'string' ||
      !categoryColorPattern.test(input.color)
    )
      return NextResponse.json(
        { message: 'Invalid category color.' },
        { status: 400 },
      );
    update.color = input.color.toLowerCase();
  }
  if (input.icon !== undefined) {
    if (
      typeof input.icon !== 'string' ||
      !allowedCategoryIcons.includes(input.icon as never)
    )
      return NextResponse.json(
        { message: 'Invalid category icon.' },
        { status: 400 },
      );
    update.icon = input.icon;
  }
  if (input.position !== undefined) {
    if (!Number.isInteger(input.position) || Number(input.position) < 0)
      return NextResponse.json(
        { message: 'Invalid category position.' },
        { status: 400 },
      );
    update.position = Number(input.position);
  }
  const category = updateCategory(tripId, categoryId, update);
  if (category) await persistTripEditorData(tripId);
  return category
    ? NextResponse.json(category)
    : NextResponse.json({ message: 'Category not found.' }, { status: 404 });
}

export async function DELETE(request: Request, { params }: Context) {
  const url = new URL(request.url);
  const tripId = url.searchParams.get('tripId');
  const { categoryId } = await params;
  if (!tripId) return new Response(null, { status: 400 });
  const auth = await authorizeTrip(request, tripId, true);
  if (auth.error) return auth.error;
  await loadTripEditorData(tripId);
  const replacementId = url.searchParams.get('reassignTo') ?? undefined;
  const exists = listCategories(tripId).some(({ id }) => id === categoryId);
  if (!exists) return new Response(null, { status: 404 });
  const deleted = deleteCategory(tripId, categoryId, replacementId);
  if (deleted) await persistTripEditorData(tripId);
  return new Response(null, { status: deleted ? 204 : 409 });
}
