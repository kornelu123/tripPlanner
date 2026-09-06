import { NextResponse } from 'next/server';

import type { SocialImport } from '@trip-planner/domain';
import { enqueueSocialImport } from '../../../../../lib/social-import-worker';
import { listSocialImports } from '../../../../../lib/social-import-store';
import {
  UnsafeUrlError,
  validateSocialUrl,
} from '../../../../../lib/social-url-security';
import { authorizeTrip } from '../../../../../lib/auth';
import { importSchema, parseJson } from '../../../../../lib/api-schemas';

interface Context {
  params: Promise<{ tripId: string }>;
}

export async function GET(request: Request, { params }: Context) {
  const { tripId } = await params;
  const auth = await authorizeTrip(request, tripId);
  if (auth.error) return auth.error;
  return NextResponse.json(listSocialImports(tripId));
}

export async function POST(request: Request, { params }: Context) {
  const { tripId } = await params;
  const auth = await authorizeTrip(request, tripId, true);
  if (auth.error) return auth.error;
  const sourceUrl = (await parseJson(request, importSchema))?.url;
  try {
    if (typeof sourceUrl !== 'string')
      throw new UnsafeUrlError('A post URL is required.');
    const validated = validateSocialUrl(sourceUrl);
    const now = new Date().toISOString();
    const item: SocialImport = {
      id: crypto.randomUUID(),
      tripId,
      sourceUrl: validated.canonicalUrl,
      platform: validated.platform,
      status: 'queued',
      candidates: [],
      createdAt: now,
      updatedAt: now,
    };
    enqueueSocialImport(item);
    return NextResponse.json(item, { status: 202 });
  } catch (error) {
    if (error instanceof UnsafeUrlError)
      return NextResponse.json(
        { code: 'unsupported_link', message: error.message },
        { status: 400 },
      );
    throw error;
  }
}
