import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  const categories = [
    {
      id: 'trip-uncategorized',
      name: 'Uncategorized',
      color: '#687c76',
      icon: 'pin',
      position: 0,
    },
    {
      id: 'trip-food',
      name: 'Food',
      color: '#dc6941',
      icon: 'fork-knife',
      position: 1,
    },
    {
      id: 'trip-culture',
      name: 'Culture',
      color: '#735da5',
      icon: 'landmark',
      position: 2,
    },
    {
      id: 'trip-outdoors',
      name: 'Outdoors',
      color: '#397a65',
      icon: 'tree',
      position: 3,
    },
  ];
  let points = [
    {
      id: 'miradouro',
      name: 'Miradouro da Senhora',
      address: 'Largo Monte, Lisboa',
      latitude: 38.7191,
      longitude: -9.1328,
      categoryId: 'trip-outdoors',
    },
    {
      id: 'market',
      name: 'Time Out Market',
      address: 'Lisboa',
      latitude: 38.707,
      longitude: -9.1457,
      categoryId: 'trip-food',
    },
  ];
  await page.route('**/api/geocode?*', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.has('q')) {
      await route.fulfill({
        json: [
          {
            name: 'Jerónimos Monastery',
            address: 'Praça do Império, Lisboa',
            latitude: 38.6979,
            longitude: -9.206,
          },
        ],
      });
      return;
    }
    const latitude = Number(url.searchParams.get('latitude'));
    const longitude = Number(url.searchParams.get('longitude'));
    await route.fulfill({
      json: {
        name: 'Dropped pin',
        address: `${latitude}, ${longitude}`,
        latitude,
        longitude,
      },
    });
  });
  await page.route('**/api/trips/*/points', async (route) => {
    if (route.request().method() === 'POST') {
      const draft = route.request().postDataJSON();
      const point = {
        ...draft,
        id: `created-${points.length}`,
        categoryId: draft.categoryId ?? 'trip-uncategorized',
      };
      points.push(point);
      await route.fulfill({ status: 201, json: point });
      return;
    }
    await route.fulfill({
      json: {
        trip: { id: 'trip', name: 'Lisbon long weekend' },
        categories,
        points,
        pendingImports: [
          {
            id: 'social',
            name: 'Pastéis de Belém',
            address: 'Belém',
            latitude: 38.6975,
            longitude: -9.2032,
            source: 'Saved from Instagram',
          },
        ],
      },
    });
  });
  await page.route('**/api/trips/*/points/*', async (route) => {
    const id = route.request().url().split('/').at(-1)!;
    if (route.request().method() === 'DELETE') {
      points = points.filter((point) => point.id !== id);
      await route.fulfill({ status: 204 });
      return;
    }
    const update = route.request().postDataJSON();
    const point = { ...points.find((item) => item.id === id)!, ...update };
    points = points.map((item) => (item.id === id ? point : item));
    await route.fulfill({ json: point });
  });
  await page.route('**/api/categories/*?*', async (route) => {
    const update = route.request().postDataJSON();
    const category = {
      ...categories.find((item) => route.request().url().includes(item.id))!,
      ...update,
    };
    await route.fulfill({ json: category });
  });
});

test('edits trip points with accessible controls', async ({
  page,
}, testInfo) => {
  const tripId = `browser-${testInfo.project.name}`;
  await page.goto(`/trips/${tripId}`);

  await expect(
    page.getByRole('heading', { name: 'Lisbon long weekend' }),
  ).toBeVisible();
  await expect(page.getByLabel('Trip points map')).toBeVisible();
  await expect(page.getByLabel('Trip points map')).toHaveAttribute(
    'data-route-segments',
    '1',
  );

  await page.getByLabel('Search for an address').fill('Jerónimos');
  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByRole('button', { name: /Jerónimos Monastery/ }).click();
  await page.getByRole('button', { name: 'Save place' }).click();
  await expect(
    page.getByText('Jerónimos Monastery', { exact: true }),
  ).toBeVisible();

  const firstCard = page.locator('#point-miradouro');
  await firstCard.getByRole('button', { name: /Miradouro da Senhora/ }).click();
  await firstCard
    .getByRole('combobox', { name: 'Category' })
    .selectOption({ label: 'Culture' });
  await expect(
    firstCard.getByRole('combobox', { name: 'Category' }),
  ).toHaveValue(/-culture$/);

  await firstCard.getByRole('button', { name: 'Move' }).click();
  await page.getByLabel('New latitude').fill('38.72');
  await page.getByLabel('New longitude').fill('-9.14');
  await page.getByRole('button', { name: 'Look up address' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.sr-status')).toContainText('New position ready');
  await page.getByRole('button', { name: 'Cancel move' }).click();

  await firstCard.getByRole('button', { name: 'Move' }).click();
  await page.getByLabel('New latitude').fill('38.72');
  await page.getByRole('button', { name: 'Look up address' }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Save move' }).click();
  await expect(page.locator('.sr-status')).toContainText(
    'Point position saved',
  );

  await firstCard.getByRole('button', { name: 'Delete' }).click();
  await expect(firstCard).toHaveCount(0);
});

test('adds current location and a pending social import', async ({
  page,
  context,
}, testInfo) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 38.71, longitude: -9.13 });
  await page.goto(`/trips/location-${testInfo.project.name}`);

  await page.getByRole('button', { name: 'Use my location' }).click();
  await expect(page.getByLabel('Latitude')).toHaveValue('38.71');
  await page.getByLabel('Name').fill('My location');
  await page.getByRole('button', { name: 'Save place' }).click();
  await expect(page.getByText('My location', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Add to trip' }).first().click();
  await expect(
    page.getByText('Pastéis de Belém', { exact: true }),
  ).toBeVisible();
});

test('uses dedicated map and places views on narrow iPhones', async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('iphone'));
  await page.route('**/api/trips/*/points', (route) =>
    route.fulfill({
      json: {
        trip: { id: 'narrow', name: 'Narrow viewport trip' },
        categories: [],
        points: [],
        pendingImports: [],
      },
    }),
  );
  await page.goto(`/trips/narrow-${testInfo.project.name}`);

  const map = page.getByLabel('Trip points map');
  const places = page.getByRole('region', { name: 'Places' });
  await expect(map).toBeVisible();
  await expect(places).toBeHidden();

  await page.getByRole('button', { name: /Places/ }).click();
  await expect(places).toBeVisible();
  await expect(map).toBeHidden();

  const addPlace = page.getByRole('button', { name: /Add place/ });
  const box = await addPlace.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );

  await page.keyboard.press('Tab');
  await expect(page.locator(':focus-visible')).toHaveCount(1);
});

test('shows dedicated map and places views with clear price states', async ({
  page,
}) => {
  await page.route('**/api/trips/*/points', (route) =>
    route.fulfill({
      json: {
        trip: { id: 'prices', name: 'Price states' },
        categories: [
          {
            id: 'food',
            name: 'Food',
            color: '#dc6941',
            icon: 'fork-knife',
            position: 0,
          },
        ],
        pendingImports: [],
        points: [
          {
            id: 'loading',
            name: 'Loading café',
            address: 'One',
            latitude: 1,
            longitude: 1,
            categoryId: 'food',
            price: { status: 'loading' },
          },
          {
            id: 'missing',
            name: 'Unknown café',
            address: 'Two',
            latitude: 2,
            longitude: 2,
            categoryId: 'food',
            price: { status: 'unavailable' },
          },
          {
            id: 'stale',
            name: 'Old café',
            address: 'Three',
            latitude: 3,
            longitude: 3,
            categoryId: 'food',
            price: {
              status: 'success',
              minimumAmount: 10,
              maximumAmount: 20,
              currency: 'EUR',
              unit: 'typical_meal',
              confidence: 0.5,
              stale: true,
              lastCheckedAt: '2026-01-01T00:00:00Z',
              sources: [
                {
                  url: 'https://example.com/menu',
                  type: 'official_structured_data',
                },
              ],
            },
          },
          {
            id: 'fresh',
            name: 'Fresh café',
            address: 'Four',
            latitude: 4,
            longitude: 4,
            categoryId: 'food',
            price: {
              status: 'success',
              minimumAmount: 12,
              maximumAmount: 25,
              currency: 'EUR',
              unit: 'typical_meal',
              confidence: 0.9,
              lastCheckedAt: '2026-09-06T00:00:00Z',
              sources: [
                { url: 'https://example.com/menu', type: 'official_api' },
              ],
            },
          },
        ],
      },
    }),
  );
  await page.goto('/trips/prices');
  await expect(
    page.getByRole('heading', { name: 'Price states' }),
  ).toBeAttached();
  if ((page.viewportSize()?.width ?? 1000) <= 800)
    await page.getByRole('button', { name: /Places/ }).click();
  await expect(page.getByText('Researching current prices…')).toBeVisible();
  await expect(page.getByText('Price unavailable')).toBeVisible();
  await expect(page.getByText('Stale estimate')).toBeVisible();
  await expect(page.getByText('12–25 EUR')).toBeVisible();
  await expect(
    page.getByText(/Actual prices may differ/).first(),
  ).toBeVisible();
  if (test.info().project.name === 'chromium')
    await page.getByLabel('Estimated price for Fresh café').screenshot({
      path: 'test-results/price-states.png',
    });
});
