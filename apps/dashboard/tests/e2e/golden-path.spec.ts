import { expect, test } from '@playwright/test';

const credentials = {
  email: process.env.E2E_USER_EMAIL,
  password: process.env.E2E_USER_PASSWORD,
  databaseUrl: process.env.E2E_READONLY_DATABASE_URL,
  repository: process.env.E2E_GITHUB_REPOSITORY,
};

test.describe('golden path', () => {
  test('authentication → repository → read-only DB → scan → plan → approval → execution boundary', async ({ page }) => {
    test.skip(!Object.values(credentials).every(Boolean), 'Set the documented E2E fixture environment variables.');
    await page.goto('/auth/login');
    await page.getByLabel('Email Address').fill(credentials.email!);
    await page.getByLabel('Password').fill(credentials.password!);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/dashboard/projects/new');
    await page.getByLabel('Project name').fill(`Golden path ${Date.now()}`);
    const repositorySelect = page.locator('select').filter({ has: page.locator(`option[value="${credentials.repository}"]`) });
    await repositorySelect.selectOption(credentials.repository!);
    await page.getByRole('button', { name: /continue/i }).click();

    await page.getByLabel('PostgreSQL connection string').fill(credentials.databaseUrl!);
    await page.getByRole('button', { name: /verify read-only access/i }).click();
    await expect(page.getByText('Read-only access verified')).toBeVisible();
    await page.getByRole('button', { name: /review setup/i }).click();
    await page.getByRole('button', { name: /^connect project$/i }).click();

    await expect(page).toHaveURL(/onboarding=scan/);
    await page.getByRole('button', { name: /run first scan/i }).click();
    await expect(page).toHaveURL(/scan-reports/);
    await expect(page.getByText(/start here · highest-priority issue/i)).toBeVisible();

    await page.getByRole('link', { name: /generate safe plan/i }).click();
    await page.getByRole('button', { name: /generate change plan/i }).click();
    await expect(page.getByText(/human approval boundary/i)).toBeVisible();
    await page.getByRole('button', { name: /approve version/i }).click();
    await expect(page.getByText(/^approved$/i)).toBeVisible();

    const boundary = await page.request.post('/api/migrations/not-a-real-migration/execute', { data: {} });
    expect(boundary.status()).toBe(400);
    await expect(boundary.json()).resolves.toMatchObject({ error: expect.stringMatching(/confirmation required/i) });
  });

  test('signup validates credentials before account creation', async ({ page }) => {
    await page.goto('/auth/signup');
    await page.getByLabel('Email Address').fill(`golden-path-${Date.now()}@example.com`);
    await page.getByLabel('Password', { exact: true }).fill('short');
    await page.getByLabel('Confirm Password').fill('different');
    await page.getByRole('button', { name: /^sign up$/i }).click();
    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });
});
