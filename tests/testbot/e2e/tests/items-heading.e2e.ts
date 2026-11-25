// Browser tests of the Items page heading ("Your items") and the sign-in / add-item flow around it.
// Recorded with the Skyramp walk helper, then extended to check every step's outcome.
import { test, checkRequestPayload, expect, getBaseUrl, newSkyrampPlaywrightPage } from '@skyramp/skyramp';
import type { Page } from '@playwright/test';

const pageTimeout = 15000;
const baseUrl = getBaseUrl('SKYRAMP_TEST_BASE_URL', 'http://localhost:3000');

test.use({
  viewport: { width: 1280, height: 900 },
});

function loginCredentials(): { username: string; password: string } {
  const username = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (username === undefined || password === undefined) {
    throw new Error('SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set: these tests sign in through the login page');
  }
  return { username, password };
}

// Signs in through /login and returns the names GET /api/items gave the Items page it lands on.
async function signIn(page: Page, username: string, password: string): Promise<string[]> {
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel('Email').fill(username);
  await page.getByLabel('Password').fill(password);
  const itemsResponse = page.waitForResponse(
    (r) => r.url().endsWith('/api/items') && r.request().method() === 'GET',
  );
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(`${baseUrl}/items`);
  const items: { name: string }[] = await (await itemsResponse).json();
  return items.map((i) => i.name);
}

test('Items page main heading reads exactly "Your items"', async ({ page }) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);
  const { username, password } = loginCredentials();

  await signIn(page, username, password);

  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  const heading = page.getByRole('heading', { name: 'Your items', exact: true });
  await expect(heading).toBeVisible();
  await expect(heading).toHaveText('Your items', { useInnerText: true });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Your items$/);
  // The old heading is gone.
  await expect(page.getByRole('heading', { name: 'Items', exact: true })).toHaveCount(0);
});

test('sign in, land on the Your items page and add an item', async ({ page }) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);
  const { username, password } = loginCredentials();
  const newName = `Lamp ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const list = page.getByTestId('items-list');
  const listItems = list.getByTestId('item');
  let namesBefore: string[] = [];

  await test.step('1. sign in at /login and land on /items', async () => {
    namesBefore = await signIn(page, username, password);
    await expect.soft(page).toHaveURL(`${baseUrl}/items`);
  });

  await test.step('2. the Items page shows the "Your items" heading', async () => {
    await expect.soft(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect.soft(page.getByRole('heading', { name: 'Your items', exact: true })).toHaveText('Your items');
    await expect.soft(page.getByRole('heading', { name: 'Items', exact: true })).toHaveCount(0);
    await expect.soft(page.getByTestId('user-status')).toHaveText(`Signed in as ${username}`);
    await expect.soft(page).toHaveTitle('Items - E2E Cred App');
    await expect.soft(page.getByTestId('nav-items')).toHaveText('Items');
    await expect(listItems).toHaveText(namesBefore);
  });

  await test.step('3. add an item', async () => {
    await page.getByLabel('New item').fill(newName);
    const postResponse = page.waitForResponse(
      (r) => r.url().endsWith('/api/items') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Add item' }).click();
    const response = await postResponse;
    checkRequestPayload(response.request().postDataJSON(), { name: newName });
    expect.soft(response.status()).toBe(201);
    await expect.soft(page.getByLabel('New item')).toHaveValue('');
    await expect.soft(page.getByTestId('item-error')).toBeHidden();
    await expect.soft(listItems.last()).toHaveText(newName);
    await expect.soft(list.getByTestId('item').filter({ hasText: newName })).toHaveCount(1);
  });

  await test.step('4. reload: the heading and the new item stay', async () => {
    const itemsResponse = page.waitForResponse(
      (r) => r.url().endsWith('/api/items') && r.request().method() === 'GET',
    );
    await page.reload();
    const apiNames = ((await (await itemsResponse).json()) as { name: string }[]).map((i) => i.name);
    await expect.soft(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect.soft(page.getByRole('heading', { name: 'Your items', exact: true })).toHaveText('Your items');
    await expect.soft(page.getByRole('heading', { name: 'Items', exact: true })).toHaveCount(0);
    await expect.soft(page.getByTestId('user-status')).toHaveText(`Signed in as ${username}`);
    // The list shows every item the API returns, in id order, ending with the one just added.
    await expect.soft(listItems).toHaveText(apiNames);
    expect.soft(apiNames).toHaveLength(namesBefore.length + 1);
    expect.soft(apiNames[apiNames.length - 1]).toBe(newName);
    await expect.soft(listItems).toHaveCount(namesBefore.length + 1);
    await expect.soft(listItems.last()).toHaveText(newName);
    await expect.soft(page.getByTestId('item-error')).toBeHidden();
    await expect.soft(page.getByLabel('New item')).toHaveValue('');
    await expect.soft(page).toHaveTitle('Items - E2E Cred App');
  });
});
