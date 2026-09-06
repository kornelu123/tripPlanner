import { expect, test } from '@playwright/test';

test('edits trip points with accessible controls', async ({
  page,
}, testInfo) => {
  const tripId = `browser-${testInfo.project.name}`;
  await page.goto(`/trips/${tripId}`);

  await expect(
    page.getByRole('heading', { name: 'Lisbon long weekend' }),
  ).toBeVisible();
  await expect(page.getByLabel('Trip points map')).toBeVisible();

  await page.getByLabel('Search for an address').fill('Jerónimos');
  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByRole('button', { name: /Jerónimos Monastery/ }).click();
  await page.getByRole('button', { name: 'Save place' }).click();
  await expect(
    page.getByText('Jerónimos Monastery', { exact: true }),
  ).toBeVisible();

  const firstCard = page.locator('#point-miradouro');
  await firstCard.getByRole('button', { name: /Miradouro da Senhora/ }).click();
  await expect(firstCard).toHaveClass(/selected/);
  await firstCard
    .getByRole('combobox', { name: 'Category' })
    .selectOption('Culture');
  await expect(
    firstCard.getByRole('combobox', { name: 'Category' }),
  ).toHaveValue('Culture');

  await firstCard.getByRole('button', { name: 'Move' }).click();
  await page.getByLabel('New latitude').fill('38.72');
  await page.getByLabel('New longitude').fill('-9.14');
  await page.getByRole('button', { name: 'Look up address' }).click();
  await expect(page.getByRole('status')).toContainText('New position ready');
  await page.getByRole('button', { name: 'Cancel move' }).click();

  await firstCard.getByRole('button', { name: 'Move' }).click();
  await page.getByLabel('New latitude').fill('38.72');
  await page.getByRole('button', { name: 'Look up address' }).click();
  await page.getByRole('button', { name: 'Save move' }).click();
  await expect(page.getByRole('status')).toContainText('Point position saved');

  await firstCard.getByRole('button', { name: 'Delete' }).click();
  await expect(firstCard).toHaveCount(0);
});

test('adds current location and a pending social import', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: 38.71, longitude: -9.13 },
  });
  const page = await context.newPage();
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
  await context.close();
});
