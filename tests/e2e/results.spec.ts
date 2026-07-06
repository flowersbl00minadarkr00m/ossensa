import { expect, test } from '@playwright/test';

test('search results use a selectable list, evidence detail, and working comparison', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Use demo data').check();
  await page.getByLabel('Describe what you need').fill('self-hosted workflow automation with a REST API');
  await page.locator('main').getByRole('button', { name: 'Search', exact: true }).click();

  await expect(page.getByRole('heading', { name: /matches for your workflow/ })).toBeVisible();
  await expect(page.locator('.candidate-card')).toHaveCount(5);
  await expect(page.locator('.candidate-detail-panel')).toBeVisible();
  await expect(page.getByRole('link', { name: 'View repository' })).toBeVisible();

  const compareBoxes = page.getByRole('checkbox', { name: /Compare/ });
  await compareBoxes.nth(0).check();
  await compareBoxes.nth(1).check();
  await expect(page.getByRole('region', { name: 'Candidate comparison' })).toContainText('2 of 2');

  await page.locator('.candidate-select').nth(1).click();
  await expect(page.locator('.candidate-card').nth(1)).toHaveClass(/active/);
});

test('live search fans out beyond GitHub and reports coverage', async ({ page }) => {
  // Mock every discovery source so the e2e run is deterministic and offline
  await page.route('https://api.github.com/**', (route) =>
    route.fulfill({
      json: {
        items: [{
          id: 1,
          full_name: 'home-assistant/core',
          description: 'Open source home automation that puts local control first',
          html_url: 'https://github.com/home-assistant/core',
          homepage: 'https://www.home-assistant.io',
          stargazers_count: 70000,
          language: 'Python',
          license: { spdx_id: 'Apache-2.0' },
          pushed_at: '2026-07-01T00:00:00Z',
          archived: false,
          topics: ['home-automation'],
        }],
      },
    }),
  );
  await page.route('https://gitlab.com/**', (route) => route.fulfill({ status: 429, json: [] }));
  await page.route('https://codeberg.org/**', (route) => route.fulfill({ json: { data: [] } }));
  await page.route('https://registry.npmjs.org/**', (route) => route.fulfill({ json: { objects: [] } }));
  await page.route('https://crates.io/**', (route) => route.fulfill({ json: { crates: [] } }));
  await page.route('https://packagist.org/**', (route) => route.fulfill({ json: { results: [] } }));
  await page.route('https://en.wikipedia.org/**', (route) =>
    route.fulfill({ json: ['home automation', [], [], []] }),
  );
  await page.route('https://api.osv.dev/**', (route) => route.fulfill({ json: { vulns: [] } }));
  await page.route('**/api/fetch*', (route) => route.fulfill({ status: 404, json: {} }));

  await page.goto('/');
  await page.getByLabel('Describe what you need').fill('home appliance automation');
  await page.locator('main').getByRole('button', { name: 'Search', exact: true }).click();

  await expect(page.getByRole('heading', { name: /matches for your workflow/ })).toBeVisible();
  await expect(page.locator('.candidate-card')).toHaveCount(1);
  await expect(page.locator('.candidate-card').first()).toContainText('home-assistant/core');

  // Coverage panel reports the rate-limited source and stays retryable
  const coverage = page.getByRole('button', { name: /Coverage:/ });
  await expect(coverage).toBeVisible();
  await coverage.click();
  await expect(page.locator('.coverage-source-status').filter({ hasText: 'Rate limited' })).toBeVisible();
  await expect(page.locator('.coverage-gaps')).toContainText('GitLab is rate-limited');
  await expect(page.getByRole('button', { name: 'Retry' }).first()).toBeVisible();
});

test('mobile results fit the viewport and preserve details', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByLabel('Use demo data').check();
  await page.getByLabel('Describe what you need').fill('self-hosted workflow automation');
  await page.locator('main').getByRole('button', { name: 'Search', exact: true }).click();

  await expect(page.locator('.candidate-card').first()).toBeVisible();
  await expect(page.locator('.candidate-detail-panel')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});
