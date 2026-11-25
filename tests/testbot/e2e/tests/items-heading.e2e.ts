// Browser tests for the reworded Items page heading ("Items" -> "Your items", public/items.html).
import type { Page } from '@playwright/test';
import { test, checkRequestPayload, expect, newSkyrampPlaywrightPage } from '@skyramp/skyramp';

const baseUrl = process.env.SKYRAMP_TEST_SERVICE_URL_UI || process.env.SKYRAMP_TEST_BASE_URL || 'http://localhost:3000';

function credentials(): { username: string; password: string } {
  const username = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!username || !password) {
    throw new Error('SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set to sign in as the seeded user');
  }
  return { username, password };
}

/** The Items page (/items): its heading, nav, sign-in status, add-item form and item list. */
class ItemsPage {
  constructor(readonly page: Page) {}
  readonly levelOneHeadings = () => this.page.getByRole('heading', { level: 1 });
  readonly heading = () => this.page.getByRole('heading', { name: 'Your items', exact: true });
  readonly oldHeading = () => this.page.getByRole('heading', { level: 1, name: 'Items', exact: true });
  readonly navItems = () => this.page.getByTestId('nav-items');
  readonly navHome = () => this.page.getByTestId('nav-home');
  readonly navLogin = () => this.page.getByTestId('nav-login');
  readonly signOut = () => this.page.getByRole('button', { name: 'Sign out' });
  readonly userStatus = () => this.page.getByTestId('user-status');
  readonly newItemInput = () => this.page.getByLabel('New item');
  readonly addItemButton = () => this.page.getByRole('button', { name: 'Add item' });
  readonly itemError = () => this.page.getByTestId('item-error');
  readonly items = () => this.page.getByTestId('items-list').getByTestId('item');
  readonly item = (name: string) => this.items().filter({ hasText: name });

  /** Adds an item through the form and checks the request body it sends. */
  async addItem(name: string) {
    await expect(this.newItemInput()).toBeEditable();
    await this.newItemInput().fill(name);
    const responsePromise = this.page.waitForResponse(
      (r) => r.url().endsWith('/api/items') && r.request().method() === 'POST',
    );
    await this.addItemButton().click();
    const response = await responsePromise;
    checkRequestPayload(response.request().postDataJSON(), { name });
    expect(response.status()).toBe(201);
  }
}

/** Signs in on /login through the form; the app redirects to /items. */
async function signIn(page: Page) {
  const { username, password } = credentials();
  await page.getByLabel('Email').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(`${baseUrl}/items`);
}

test.describe('Items page heading', () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(10000);
  });

  test('signed-in user sees the h1 "Your items" and no h1 "Items"', async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const items = new ItemsPage(page);
    await page.goto(`${baseUrl}/login`);
    await signIn(page);
    await expect(items.levelOneHeadings()).toHaveCount(1);
    await expect(items.levelOneHeadings()).toHaveText('Your items');
    await expect(items.oldHeading()).toHaveCount(0);
  });

  test('signed-out visitor sees the same h1 "Your items" and the not-signed-in status', async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const items = new ItemsPage(page);
    await page.goto(`${baseUrl}/items`);
    await expect(items.levelOneHeadings()).toHaveCount(1);
    await expect(items.levelOneHeadings()).toHaveText('Your items');
    await expect(items.oldHeading()).toHaveCount(0);
    await expect(items.userStatus()).toHaveText('You are not signed in.');
  });

  test('journey: sign in, see my items under the new heading, and add an item', async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const { username } = credentials();
    const items = new ItemsPage(page);
    const name = `Journey item ${Date.now()}`;
    let before: string[] = [];
    let listLoaded: Promise<unknown> = Promise.resolve();

    await test.step('1. / - open Login from the nav', async () => {
      await page.goto(`${baseUrl}/`);
      await page.getByTestId('nav-login').click();
      await expect(page).toHaveURL(`${baseUrl}/login`);
      await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    });

    await test.step('2. /login - sign in as the seeded user', async () => {
      listLoaded = page.waitForResponse((r) => r.url().endsWith('/api/items') && r.request().method() === 'GET');
      await signIn(page);
    });

    await test.step('3. /items - heading, nav, title and status', async () => {
      await expect.soft(items.heading()).toBeVisible();
      await expect.soft(items.levelOneHeadings()).toHaveCount(1);
      await expect.soft(items.levelOneHeadings()).toHaveText('Your items');
      await expect.soft(items.oldHeading()).toHaveCount(0);
      await expect.soft(items.navItems()).toHaveText('Items');
      await expect.soft(page).toHaveTitle('Items - E2E Cred App');
      await expect.soft(items.userStatus()).toHaveText(`Signed in as ${username}`);
    });

    await test.step('4. /items - add an item', async () => {
      // The list the page loaded on arrival is the "before" the reload is compared with.
      await listLoaded;
      before = await items.items().allTextContents();
      await items.addItem(name);
      // The whole list in order: the items there before, then the new one as its last entry.
      await expect.soft(items.items()).toHaveText([...before, name]);
      await expect.soft(items.item(name)).toHaveCount(1);
      await expect.soft(items.newItemInput()).toHaveValue('');
      await expect.soft(items.itemError()).toBeHidden();
    });

    await test.step('5. /items - reload and see everything kept', async () => {
      await page.reload();
      await expect.soft(items.levelOneHeadings()).toHaveCount(1);
      await expect.soft(items.levelOneHeadings()).toHaveText('Your items');
      await expect.soft(items.oldHeading()).toHaveCount(0);
      await expect.soft(items.navHome()).toHaveText('Home');
      await expect.soft(items.navLogin()).toHaveText('Login');
      await expect.soft(items.navItems()).toHaveText('Items');
      await expect.soft(items.signOut()).toBeVisible();
      await expect.soft(items.userStatus()).toHaveText(`Signed in as ${username}`);
      await expect.soft(items.newItemInput()).toHaveValue('');
      await expect.soft(items.addItemButton()).toBeVisible();
      await expect.soft(items.itemError()).toBeHidden();
      // The items there before stay in the same order, with the new one as the last entry.
      await expect.soft(items.items()).toHaveText([...before, name]);
    });
  });
});
