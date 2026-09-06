import { describe, expect, it } from 'vitest';

import { DELETE, PATCH } from './[categoryId]/route';
import { GET, POST } from './route';

const context = (categoryId: string) => ({
  params: Promise.resolve({ categoryId }),
});
const request = (
  url: string,
  method = 'GET',
  body?: unknown,
  user = 'demo-user',
) =>
  new Request(url, {
    method,
    headers: {
      Authorization: `Bearer ${user}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

describe('category API', () => {
  it('requires authentication and verifies trip ownership', async () => {
    expect(
      (await GET(new Request('http://test/api/categories?tripId=owned')))
        .status,
    ).toBe(401);
    expect(
      (
        await POST(
          request(
            'http://test/api/categories?tripId=owned',
            'POST',
            {
              name: 'Mine',
              color: '#112233',
              icon: 'pin',
            },
            'stranger',
          ),
        )
      ).status,
    ).toBe(404);
  });

  it('validates colors and icon identifiers', async () => {
    expect(
      (
        await POST(
          request('http://test/api/categories?tripId=valid', 'POST', {
            name: 'Bad color',
            color: 'red',
            icon: 'pin',
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await POST(
          request('http://test/api/categories?tripId=valid', 'POST', {
            name: 'Bad icon',
            color: '#112233',
            icon: 'script',
          }),
        )
      ).status,
    ).toBe(400);
  });

  it('creates, updates, and deletes with Uncategorized reassignment', async () => {
    const createdResponse = await POST(
      request('http://test/api/categories?tripId=lifecycle', 'POST', {
        name: 'Shopping',
        color: '#AABBCC',
        icon: 'pin',
      }),
    );
    expect(createdResponse.status).toBe(201);
    const created = (await createdResponse.json()) as { id: string };
    const updated = await PATCH(
      request(
        `http://test/api/categories/${created.id}?tripId=lifecycle`,
        'PATCH',
        { name: 'Shops', position: 1 },
      ),
      context(created.id),
    );
    expect(await updated.json()).toMatchObject({ name: 'Shops', position: 1 });
    expect(
      (
        await DELETE(
          request(
            `http://test/api/categories/${created.id}?tripId=lifecycle`,
            'DELETE',
          ),
          context(created.id),
        )
      ).status,
    ).toBe(204);
  });
});
