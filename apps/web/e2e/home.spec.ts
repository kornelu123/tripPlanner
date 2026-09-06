import { expect, test } from '@playwright/test';

test('renders the responsive trip planning shell', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.addInitScript(() => {
    document.documentElement.dataset.darkreaderMode = 'dynamic';
    document.documentElement.dataset.darkreaderScheme = 'dark';
  });
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Turn a free day into a great story.' }),
  ).toBeVisible();
  const startPlanning = page.getByRole('link', { name: 'Start planning' });
  await expect(startPlanning).toHaveAttribute('href', '/trips/demo');
  await expect(page.locator('.nav-button')).toHaveAttribute(
    'href',
    '/trips/demo',
  );
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  );
  expect(
    consoleErrors.filter((message) => message.includes('hydrated')),
  ).toEqual([]);

  await startPlanning.click();
  await expect(page).toHaveURL(/\/trips\/demo$/);
  await expect(page.getByRole('heading', { name: 'Route plan' })).toBeVisible();
});
