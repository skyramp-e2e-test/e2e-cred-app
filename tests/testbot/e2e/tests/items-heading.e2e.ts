import { test, expect, type Page } from "@playwright/test";
import { checkRequestPayload, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { ItemsPage, LoginPage } from "../support/items-page";

const isItemsLoad = (method: string) => (res: { url(): string; request(): { method(): string } }) =>
  new URL(res.url()).pathname === "/api/items" && res.request().method() === method;

/** Signs in through /login and waits for /items to load its list. */
async function signInToItems(page: Page) {
  const login = new LoginPage(page);
  await login.goto();
  const itemsLoaded = page.waitForResponse(isItemsLoad("GET"));
  const email = await login.signInAsUiUser();
  await expect(page).toHaveURL(/\/items$/);
  await itemsLoaded;
  return { email, items: new ItemsPage(page) };
}

test.describe("items page heading", () => {
  test("signed-in user sees one level-1 heading reading exactly Your items", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const { items } = await signInToItems(page);

    await expect(items.heading("Your items")).toBeVisible();
    await expect(items.mainHeading).toHaveCount(1);
    await expect(items.mainHeading).toHaveText("Your items");
  });

  test("no heading on the items page reads just Items, while the nav link still does", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const { items } = await signInToItems(page);
    await expect(items.mainHeading).toBeVisible();

    await expect(items.heading("Items")).toHaveCount(0);
    // The nav link keeps the word "Items" and is a link, not a heading.
    await expect(items.navItems).toHaveText("Items");
    await expect(page.getByRole("link", { name: "Items", exact: true })).toHaveCount(1);
  });

  test("user signs in, sees the items page under its new heading, adds an item and it stays after reload", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const itemName = `Walk item ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let items!: ItemsPage;
    let email = "";
    let before: string[] = [];

    await test.step("1. sign in at /login and land on /items", async () => {
      ({ items, email } = await signInToItems(page));
      await expect.soft(page).toHaveURL(/\/items$/);
    });

    await test.step("2. the items page shows its new heading", async () => {
      await expect.soft(items.heading("Your items")).toBeVisible();
      await expect.soft(items.mainHeading).toHaveCount(1);
      await expect.soft(items.mainHeading).toHaveText("Your items");
      await expect.soft(items.heading("Items")).toHaveCount(0);
      await expect.soft(items.userStatus).toHaveText(`Signed in as ${email}`);
      await expect.soft(items.navItems).toHaveText("Items");
      before = await items.items.allTextContents();
    });

    await test.step("3. add an item", async () => {
      await items.newItem.fill(itemName);
      const added = page.waitForResponse(isItemsLoad("POST"));
      const reloaded = page.waitForResponse(isItemsLoad("GET"));
      await items.addItem.click();
      const response = await added;
      checkRequestPayload(response.request().postDataJSON(), { name: itemName });
      expect.soft(response.status()).toBe(201);
      await reloaded;
      // The added name is the last entry: the order is what this checks.
      await expect.soft(items.items).toHaveText([...before, itemName]);
      await expect.soft(items.newItem).toHaveValue("");
      await expect.soft(items.itemError).toBeHidden();
      await expect.soft(items.mainHeading).toHaveText("Your items");
    });

    await test.step("4. reload /items and see the heading and the added item kept", async () => {
      const itemsLoaded = page.waitForResponse(isItemsLoad("GET"));
      await page.reload();
      await itemsLoaded;
      await expect.soft(items.mainHeading).toHaveCount(1);
      await expect.soft(items.mainHeading).toHaveText("Your items");
      await expect.soft(items.heading("Items")).toHaveCount(0);
      await expect.soft(items.userStatus).toHaveText(`Signed in as ${email}`);
      await expect.soft(items.navHome).toHaveText("Home");
      await expect.soft(items.navLogin).toHaveText("Login");
      await expect.soft(items.navItems).toHaveText("Items");
      await expect.soft(items.signOut).toBeVisible();
      // Every item listed before the add is unchanged, and the list grew by exactly the one added.
      await expect.soft(items.items).toHaveText([...before, itemName]);
      await expect.soft(items.items.filter({ hasText: itemName })).toHaveCount(1);
      await expect.soft(items.itemError).toBeHidden();
      await expect.soft(items.newItem).toHaveValue("");
    });
  });
});
