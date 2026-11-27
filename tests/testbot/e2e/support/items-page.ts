import type { Locator, Page } from "@playwright/test";

/** The sign-in page (/login). */
export class LoginPage {
  readonly email: Locator;
  readonly password: Locator;
  readonly signIn: Locator;

  constructor(readonly page: Page) {
    this.email = page.getByLabel("Email");
    this.password = page.getByLabel("Password");
    this.signIn = page.getByRole("button", { name: "Sign in" });
  }

  async goto() {
    await this.page.goto("/login");
  }

  /** Signs in as the run's UI login (SKYRAMP_UI_USERNAME / SKYRAMP_UI_PASSWORD). */
  async signInAsUiUser() {
    const username = process.env.SKYRAMP_UI_USERNAME;
    const password = process.env.SKYRAMP_UI_PASSWORD;
    if (!username || !password) {
      throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set to sign in");
    }
    await this.email.fill(username);
    await this.password.fill(password);
    await this.signIn.click();
    return username;
  }
}

/** The items page (/items). */
export class ItemsPage {
  readonly mainHeading: Locator;
  readonly headings: Locator;
  readonly userStatus: Locator;
  readonly navHome: Locator;
  readonly navLogin: Locator;
  readonly navItems: Locator;
  readonly signOut: Locator;
  readonly newItem: Locator;
  readonly addItem: Locator;
  readonly itemError: Locator;
  readonly list: Locator;
  readonly items: Locator;

  constructor(readonly page: Page) {
    this.mainHeading = page.getByRole("heading", { level: 1 });
    this.headings = page.getByRole("heading");
    this.userStatus = page.getByTestId("user-status");
    this.navHome = page.getByTestId("nav-home");
    this.navLogin = page.getByTestId("nav-login");
    this.navItems = page.getByTestId("nav-items");
    this.signOut = page.getByRole("button", { name: "Sign out" });
    this.newItem = page.getByLabel("New item");
    this.addItem = page.getByRole("button", { name: "Add item" });
    this.itemError = page.getByTestId("item-error");
    this.list = page.getByTestId("items-list");
    this.items = this.list.getByTestId("item");
  }

  /** A heading whose accessible name is exactly `name`. */
  heading(name: string) {
    return this.page.getByRole("heading", { name, exact: true });
  }
}
