import { expect, test } from '@playwright/test';

test('renders the responsive trip planning shell', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Turn a free day into a great story.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Start planning' }),
  ).toBeVisible();
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  );
});
