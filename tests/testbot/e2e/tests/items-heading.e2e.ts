// Items page heading: the page's main heading reads "Your items" (no longer "Items").
// Drafted with the Skyramp walk helper, then strengthened.
import { test, checkRequestPayload, expect, getBaseUrl, newSkyrampPlaywrightPage } from '@skyramp/skyramp';
import type { Page } from '@playwright/test';

const pageTimeout = 15000;
const baseUrl = getBaseUrl('SKYRAMP_TEST_BASE_URL', 'http://localhost:3000');

test.use({
  viewport: { width: 1280, height: 900 },
});

function loginFromEnv(): { email: string; password: string } {
  const email = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!email || !password) {
    throw new Error('SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set: these tests sign in as the seeded user');
  }
  return { email, password };
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(`${baseUrl}/items`);
}

async function expectYourItemsHeading(page: Page) {
  const h1 = page.getByRole('heading', { level: 1 });
  await expect.soft(h1).toHaveCount(1);
  await expect.soft(h1).toHaveText('Your items', { useInnerText: true });
  await expect.soft(page.getByRole('heading', { name: 'Your items', exact: true })).toBeVisible();
  await expect.soft(page.getByRole('heading', { name: 'Items', exact: true })).toHaveCount(0);
}

test('signed-in user sees the Items page heading read "Your items"', async ({ page }) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);
  const { email, password } = loginFromEnv();

  await signIn(page, email, password);
  await expect(page.getByTestId('user-status')).toHaveText(`Signed in as ${email}`);
  await expectYourItemsHeading(page);
});

test('signed-out visitor sees the Items page heading read "Your items"', async ({ page }) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);

  await page.goto(`${baseUrl}/items`);
  await expect.soft(page.getByTestId('user-status')).toHaveText('You are not signed in.');
  await expectYourItemsHeading(page);
});

test('sign in, see the items page under its new heading, and add an item', async ({ page }) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);
  const { email, password } = loginFromEnv();
  const itemName = `Heading check ${Date.now()}`;
  const items = page.getByTestId('item');
  const addedItem = items.filter({ hasText: itemName });
  let countBefore = 0;

  await test.step('1. /login: sign in and land on /items', async () => {
    await signIn(page, email, password);
  });

  await test.step('2. /items: heading reads "Your items", status and nav shown', async () => {
    await expectYourItemsHeading(page);
    await expect.soft(page.getByTestId('user-status')).toHaveText(`Signed in as ${email}`);
    await expect.soft(page.getByRole('link', { name: 'Home', exact: true })).toBeVisible();
    await expect.soft(page.getByRole('link', { name: 'Login', exact: true })).toBeVisible();
    await expect.soft(page.getByRole('link', { name: 'Items', exact: true })).toBeVisible();
    await expect.soft(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });

  await test.step('3. /items: add an item', async () => {
    // Wait for the list to load before counting it.
    const apiItems = await (await page.request.get(`${baseUrl}/api/items`)).json();
    await expect(items).toHaveCount(apiItems.length);
    countBefore = apiItems.length;

    await page.getByLabel('New item').fill(itemName);
    const responsePromise = page.waitForResponse(
      (r) => r.url().endsWith('/api/items') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Add item' }).click();
    const response = await responsePromise;
    checkRequestPayload(response.request().postDataJSON(), { name: itemName });
    expect.soft(response.status()).toBe(201);

    await expect.soft(addedItem).toHaveCount(1);
    await expect.soft(addedItem).toHaveText(itemName);
    // The added item is the last entry of the list (order is what this checks).
    await expect.soft.poll(async () => (await items.allTextContents()).at(-1)).toBe(itemName);
    await expect.soft(items).toHaveCount(countBefore + 1);
    await expect.soft(page.getByLabel('New item')).toHaveValue('');
    await expect.soft(page.getByTestId('item-error')).toBeHidden();
  });

  await test.step('4. /items: after a reload the heading and the added item remain', async () => {
    await page.reload();
    await expectYourItemsHeading(page);
    await expect.soft(page.getByTestId('user-status')).toHaveText(`Signed in as ${email}`);
    await expect.soft(addedItem).toHaveCount(1);
    // The added item is the last entry of the list (order is what this checks).
    await expect.soft.poll(async () => (await items.allTextContents()).at(-1)).toBe(itemName);
    await expect.soft(items).toHaveCount(countBefore + 1);
    const apiItems: { id: number; name: string }[] = await (await page.request.get(`${baseUrl}/api/items`)).json();
    const namesInIdOrder = [...apiItems].sort((a, b) => a.id - b.id).map((i) => i.name);
    await expect.soft(items).toHaveText(namesInIdOrder);
    await expect.soft(page.getByLabel('New item')).toHaveValue('');
    await expect.soft(page.getByTestId('item-error')).toBeHidden();
  });
});
