import { and, desc, eq, gt, isNull, ne } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as schema from './schema';

type Database = NodePgDatabase<typeof schema>;

export function createAuthRepository(database: Database) {
  return {
    async findUserByEmail(email: string) {
      return (
        (await database.query.users.findFirst({
          where: eq(schema.users.email, email),
        })) ?? null
      );
    },
    async findUserById(id: string) {
      return (
        (await database.query.users.findFirst({
          where: eq(schema.users.id, id),
        })) ?? null
      );
    },
    async createUser(
      email: string,
      displayName: string,
      passwordHash?: string,
    ) {
      const [user] = await database
        .insert(schema.users)
        .values({ email, displayName, passwordHash })
        .returning();
      return user!;
    },
    async saveChallenge(input: {
      kind: string;
      challengeHash: string;
      userId?: string;
      email?: string;
      expiresAt: Date;
    }) {
      const [challenge] = await database
        .insert(schema.authChallenges)
        .values(input)
        .returning();
      return challenge!;
    },
    async consumeChallenge(id: string, kind: string, challengeHash: string) {
      const [challenge] = await database
        .update(schema.authChallenges)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(schema.authChallenges.id, id),
            eq(schema.authChallenges.kind, kind),
            eq(schema.authChallenges.challengeHash, challengeHash),
            isNull(schema.authChallenges.usedAt),
            gt(schema.authChallenges.expiresAt, new Date()),
          ),
        )
        .returning();
      return challenge ?? null;
    },
    async consumeChallengeByHash(kind: string, challengeHash: string) {
      const [challenge] = await database
        .update(schema.authChallenges)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(schema.authChallenges.kind, kind),
            eq(schema.authChallenges.challengeHash, challengeHash),
            isNull(schema.authChallenges.usedAt),
            gt(schema.authChallenges.expiresAt, new Date()),
          ),
        )
        .returning();
      return challenge ?? null;
    },
    async listPasskeys(userId: string) {
      return database.query.passkeyCredentials.findMany({
        where: eq(schema.passkeyCredentials.userId, userId),
        orderBy: [desc(schema.passkeyCredentials.createdAt)],
      });
    },
    async findPasskey(id: string) {
      return (
        (await database.query.passkeyCredentials.findFirst({
          where: eq(schema.passkeyCredentials.id, id),
        })) ?? null
      );
    },
    async addPasskey(input: typeof schema.passkeyCredentials.$inferInsert) {
      const [credential] = await database
        .insert(schema.passkeyCredentials)
        .values(input)
        .onConflictDoNothing()
        .returning();
      return credential ?? null;
    },
    async updatePasskeyCounter(id: string, counter: number) {
      await database
        .update(schema.passkeyCredentials)
        .set({ counter, lastUsedAt: new Date() })
        .where(eq(schema.passkeyCredentials.id, id));
    },
    async deletePasskey(userId: string, id: string) {
      const [credential] = await database
        .delete(schema.passkeyCredentials)
        .where(
          and(
            eq(schema.passkeyCredentials.userId, userId),
            eq(schema.passkeyCredentials.id, id),
          ),
        )
        .returning();
      return credential ?? null;
    },
    async createSession(input: typeof schema.sessions.$inferInsert) {
      const [session] = await database
        .insert(schema.sessions)
        .values(input)
        .returning();
      return session!;
    },
    async sessionByHash(tokenHash: string) {
      return (
        (
          await database
            .select({ session: schema.sessions, user: schema.users })
            .from(schema.sessions)
            .innerJoin(
              schema.users,
              eq(schema.users.id, schema.sessions.userId),
            )
            .where(
              and(
                eq(schema.sessions.tokenHash, tokenHash),
                gt(schema.sessions.expiresAt, new Date()),
              ),
            )
            .limit(1)
        )[0] ?? null
      );
    },
    async listSessions(userId: string) {
      return database.query.sessions.findMany({
        where: and(
          eq(schema.sessions.userId, userId),
          gt(schema.sessions.expiresAt, new Date()),
        ),
        orderBy: [desc(schema.sessions.lastSeenAt)],
      });
    },
    async revokeSession(userId: string, id: string) {
      await database
        .delete(schema.sessions)
        .where(
          and(eq(schema.sessions.userId, userId), eq(schema.sessions.id, id)),
        );
    },
    async revokeOtherSessions(userId: string, id: string) {
      await database
        .delete(schema.sessions)
        .where(
          and(eq(schema.sessions.userId, userId), ne(schema.sessions.id, id)),
        );
    },
    async findAppleAccount(subject: string) {
      return (
        (await database.query.appleAccounts.findFirst({
          where: eq(schema.appleAccounts.subject, subject),
        })) ?? null
      );
    },
    async findAppleAccountForUser(userId: string) {
      return (
        (await database.query.appleAccounts.findFirst({
          where: eq(schema.appleAccounts.userId, userId),
        })) ?? null
      );
    },
    async linkApple(input: typeof schema.appleAccounts.$inferInsert) {
      const [account] = await database
        .insert(schema.appleAccounts)
        .values(input)
        .onConflictDoNothing()
        .returning();
      return account ?? null;
    },
    async unlinkApple(userId: string) {
      await database
        .delete(schema.appleAccounts)
        .where(eq(schema.appleAccounts.userId, userId));
    },
    async recordAuditEvent(
      action: string,
      actorUserId?: string,
      subjectId?: string,
    ) {
      await database
        .insert(schema.auditEvents)
        .values({ action, actorUserId, subjectId });
    },
    async deleteUser(userId: string) {
      const [user] = await database
        .delete(schema.users)
        .where(eq(schema.users.id, userId))
        .returning();
      return user ?? null;
    },
    async canAccessTrip(userId: string, tripId: string, edit: boolean) {
      const repository = (await import('./repository')).createTripRepository(
        database,
      );
      if (!edit) return Boolean(await repository.getTrip(userId, tripId));
      const [trip] = await database
        .select({ id: schema.trips.id })
        .from(schema.trips)
        .where(
          and(
            eq(schema.trips.id, tripId),
            (await import('./repository')).tripEditCondition(userId),
          ),
        )
        .limit(1);
      return Boolean(trip);
    },
  };
}
