import { createTripRepository, getDatabase } from '@trip-planner/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { authenticated, authRepository, normalizeEmail } from '@/lib/auth';

const shareSchema = z.object({
  email: z.string().trim().pipe(z.email()),
  role: z.enum(['editor', 'viewer']),
});

type Context = { params: Promise<{ tripId: string }> };

export async function GET(request: Request, { params }: Context) {
  const auth = await authenticated(request);
  if (auth.error) return auth.error;
  const { tripId } = await params;
  const members = await createTripRepository(getDatabase()).listMembers(
    auth.user.id,
    tripId,
  );
  return members
    ? NextResponse.json(members)
    : NextResponse.json({ message: 'Map not found.' }, { status: 404 });
}

export async function POST(request: Request, { params }: Context) {
  const auth = await authenticated(request);
  if (auth.error) return auth.error;
  const parsed = shareSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { message: 'Enter a registered email and select a role.' },
      { status: 400 },
    );
  const user = await authRepository().findUserByEmail(
    normalizeEmail(parsed.data.email),
  );
  if (!user || user.id === auth.user.id)
    return NextResponse.json(
      {
        message: user
          ? 'You already own this map.'
          : 'No account uses that email.',
      },
      { status: 404 },
    );
  try {
    const membership = await createTripRepository(getDatabase()).addMember(
      auth.user.id,
      (await params).tripId,
      user.id,
      parsed.data.role,
    );
    return membership
      ? NextResponse.json(
          {
            userId: user.id,
            email: user.email,
            displayName: user.displayName,
            role: membership.role,
          },
          { status: 201 },
        )
      : NextResponse.json({ message: 'Map not found.' }, { status: 404 });
  } catch (error) {
    if ((error as { code?: string }).code === '23505')
      return NextResponse.json(
        { message: 'This map is already shared with that user.' },
        { status: 409 },
      );
    throw error;
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const auth = await authenticated(request);
  if (auth.error) return auth.error;
  const userId = new URL(request.url).searchParams.get('userId');
  if (!userId)
    return NextResponse.json({ message: 'Select a member.' }, { status: 400 });
  const removed = await createTripRepository(getDatabase()).removeMember(
    auth.user.id,
    (await params).tripId,
    userId,
  );
  return removed
    ? new Response(null, { status: 204 })
    : NextResponse.json({ message: 'Member not found.' }, { status: 404 });
}
