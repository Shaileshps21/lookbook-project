import { test, expect } from "@playwright/test";

async function registerFreshUser(page, prefix: string) {
  const email = `${prefix}${Date.now()}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Full Name").fill("Smoke Tester");
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password").fill("TestPass@123");
  await page.getByRole("button", { name: "Get Started" }).click();
  await expect(page).toHaveURL(/\/(onboarding|$)/, { timeout: 10000 });
}

test("renders the public API developers page", async ({ page }) => {
  await page.goto("/developers");
  await expect(page.getByRole("heading", { name: "Build on LookBook's catalog" })).toBeVisible();
  await expect(page.getByText("Public API").first()).toBeVisible();
  await expect(page.getByText("/public/books", { exact: false }).first()).toBeVisible();
  await expect(page.locator("pre").first()).toContainText("curl");
});

test("lists a book using manual ISBN lookup", async ({ page }) => {
  await registerFreshUser(page, "e2eisbn");

  await page.goto("/sell");
  await expect(page.getByLabel("Book Title")).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("button", { name: "Scan cover with AI" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Scan ISBN barcode" })).toBeVisible();

  // Seeded catalog ISBN (Atomic Habits) — exercises the catalog-first lookup
  // so the test has no dependency on the external Open Library API.
  await page.getByPlaceholder("or type an ISBN").fill("9780735211292");
  await page.getByPlaceholder("or type an ISBN").press("Enter");

  await expect(page.getByText(/Barcode matched .* via our catalog/i)).toBeVisible({ timeout: 20000 });
  await expect(page.getByLabel("Book Title")).toHaveValue("Atomic Habits");
});

test("streams a reply from the AI chat assistant", async ({ page }) => {
  test.setTimeout(120_000);
  await registerFreshUser(page, "e2echat");

  await page.getByRole("button", { name: "Open AI Chat Assistant" }).click();
  await expect(page.locator("#chat-assistant-panel")).toBeVisible();
  await expect(page.locator("#chat-assistant-panel")).toContainText("I'm your LookBook Assistant");

  await page.locator("#chat-assistant-input").fill("Recommend a good book to read");
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(
    page.locator("#chat-assistant-panel").getByText("Recommend a good book to read")
  ).toBeVisible();

  // Streaming reply: the typing indicator disappears (input re-enabled) and the
  // single assistant bubble — the static welcome is swapped out once a
  // conversation starts — receives the streamed (or fallback) reply text.
  await expect(page.locator("#chat-assistant-input")).toBeEnabled({ timeout: 60_000 });
  await expect(page.locator("#chat-assistant-panel .justify-start").first()).not.toHaveText("", { timeout: 20_000 });
});