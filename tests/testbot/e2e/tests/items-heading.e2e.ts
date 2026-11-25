// Items page heading: the page's main heading reads "Your items" (no longer "Items"),
// for signed-in and signed-out visitors alike, and stays so across a reload after adding an item.
import { test, checkRequestPayload, expect, getBaseUrl, newSkyrampPlaywrightPage } from '@skyramp/skyramp';
import type { Page } from '@playwright/test';

const pageTimeout = 15000;
const baseUrl = getBaseUrl('SKYRAMP_TEST_BASE_URL', 'http://localhost:3000');
const NEW_HEADING = 'Your items';
const OLD_HEADING = 'Items';

test.use({
    viewport: { width: 1280, height: 900 },
});

function loginCredentials(): { email: string; password: string } {
    const email = process.env.SKYRAMP_UI_USERNAME;
    const password = process.env.SKYRAMP_UI_PASSWORD;
    if (email === undefined || password === undefined) {
        throw new Error('SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set: these tests sign in with that account');
    }
    return { email, password };
}

async function expectItemsHeading(page: Page) {
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText(NEW_HEADING);
    await expect(page.getByRole('heading', { level: 1, name: OLD_HEADING, exact: true })).toHaveCount(0);
}

test('signed-in user sees the Items page heading "Your items"', async ({ page }) => {
    test.setTimeout(60000);
    page.setDefaultTimeout(pageTimeout);
    page = newSkyrampPlaywrightPage(page);
    const { email, password } = loginCredentials();

    await test.step('sign in on /login', async () => {
        await page.goto(`${baseUrl}/login`);
        await page.getByTestId('email-input').fill(email);
        await page.getByTestId('password-input').fill(password);
        await page.getByTestId('login-submit').click();
        await expect(page).toHaveURL(`${baseUrl}/items`);
    });

    await test.step('the single h1 reads "Your items"', async () => {
        await expectItemsHeading(page);
        await expect(page.getByTestId('user-status')).toHaveText(`Signed in as ${email}`);
    });
});

test('signed-out visitor sees the Items page heading "Your items"', async ({ page }) => {
    test.setTimeout(60000);
    page.setDefaultTimeout(pageTimeout);
    page = newSkyrampPlaywrightPage(page);

    await page.context().clearCookies();
    await page.goto(`${baseUrl}/items`);
    await expectItemsHeading(page);
    await expect(page.getByTestId('user-status')).toHaveText('You are not signed in.');
});

test('journey: sign in, open my items and add one', async ({ page, request }) => {
    test.setTimeout(90000);
    page.setDefaultTimeout(pageTimeout);
    page = newSkyrampPlaywrightPage(page);
    const { email, password } = loginCredentials();
    const itemName = `Heading walk ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await test.step('1. / - open the home page and follow the Login link', async () => {
        await page.goto(`${baseUrl}/`);
        await page.getByTestId('nav-login').click();
        await expect(page).toHaveURL(`${baseUrl}/login`);
        await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    });

    await test.step('2. /login - sign in and land on /items', async () => {
        await page.getByLabel('Email').fill(email);
        await page.getByLabel('Password').fill(password);
        await page.getByRole('button', { name: 'Sign in' }).click();
        await expect(page).toHaveURL(`${baseUrl}/items`);
        const h1 = page.getByRole('heading', { level: 1 });
        await expect.soft(h1).toHaveCount(1);
        await expect.soft(h1).toHaveText(NEW_HEADING);
        await expect.soft(page.getByRole('heading', { level: 1, name: OLD_HEADING, exact: true })).toHaveCount(0);
        await expect.soft(page.getByTestId('user-status')).toHaveText(`Signed in as ${email}`);
    });

    await test.step('3. /items - add an item', async () => {
        await page.getByLabel('New item').fill(itemName);
        const responsePromise = page.waitForResponse(
            (r) => r.url().endsWith('/api/items') && r.request().method() === 'POST',
        );
        await page.getByRole('button', { name: 'Add item' }).click();
        const response = await responsePromise;
        checkRequestPayload(response.request().postDataJSON(), { name: itemName });
        expect.soft(response.status()).toBe(201);
        const items = page.getByTestId('items-list').getByTestId('item');
        await expect.soft(items.filter({ hasText: itemName })).toHaveText(itemName);
        // The order of the list is what this checks: the newest item is last.
        await expect.soft.poll(async () => (await items.allTextContents()).at(-1)).toBe(itemName);
        await expect.soft(page.getByLabel('New item')).toHaveValue('');
        await expect.soft(page.getByTestId('item-error')).toBeHidden();
    });

    await test.step('4. /items - reload; heading, status and the new item persist', async () => {
        await page.reload();
        const h1 = page.getByRole('heading', { level: 1 });
        await expect.soft(h1).toHaveCount(1);
        await expect.soft(h1).toHaveText(NEW_HEADING);
        await expect.soft(page.getByTestId('user-status')).toHaveText(`Signed in as ${email}`);

        const apiItems: Array<{ id: number; name: string }> = await (await request.get(`${baseUrl}/api/items`)).json();
        const list = page.getByTestId('items-list').getByTestId('item');
        // The list shows every item from GET /api/items in id order (items others add meanwhile come after ours).
        const expectedNames = apiItems.map((i) => i.name);
        const ownIndex = expectedNames.lastIndexOf(itemName);
        expect.soft(ownIndex).toBeGreaterThanOrEqual(0);
        await expect.soft(list.filter({ hasText: itemName })).toHaveCount(1);
        await expect.soft(list.filter({ hasText: itemName })).toHaveText(itemName);
        const shown = await list.allTextContents();
        expect.soft(shown.slice(0, ownIndex + 1)).toEqual(expectedNames.slice(0, ownIndex + 1));

        await expect.soft(page.getByLabel('New item')).toHaveValue('');
        await expect.soft(page.getByTestId('item-error')).toBeHidden();
        await expect.soft(page.getByTestId('nav-home')).toHaveText('Home');
        await expect.soft(page.getByTestId('nav-login')).toHaveText('Login');
        await expect.soft(page.getByTestId('nav-items')).toHaveText('Items');
        await expect.soft(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
        await expect.soft(page).toHaveTitle('Items - E2E Cred App');
    });
});
