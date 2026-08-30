import { test, expect } from "@playwright/test";

/**
 * Covers the critical path from future.md §8.3: register → browse → cart.
 * Stops short of an actual Razorpay payment — that widget is real (even in
 * test mode) and out of scope for an automated E2E run; checkout correctness
 * is covered separately via the backend's payment-verification tests.
 */
test("register, browse, and add a book to cart", async ({ page }) => {
  const email = `e2e${Date.now()}@example.com`;

  await page.goto("/register");
  await page.getByLabel("Full Name").fill("E2E Tester");
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password").fill("TestPass@123");
  await page.getByRole("button", { name: "Get Started" }).click();

  await expect(page).toHaveURL(/\/(onboarding|$)/, { timeout: 10000 });

  await page.goto("/categories");
  await expect(page.getByText(/books found/i)).toBeVisible({ timeout: 10000 });

  const firstAddToCart = page.getByLabel("Add to cart").first();
  await firstAddToCart.click();

  await page.goto("/cart");
  await expect(page.getByText("Order Summary")).toBeVisible({ timeout: 10000 });
});

test("submits a review from a book detail page", async ({ page }) => {
  const email = `e2ereview${Date.now()}@example.com`;

  await page.goto("/register");
  await page.getByLabel("Full Name").fill("Review Tester");
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password").fill("TestPass@123");
  await page.getByRole("button", { name: "Get Started" }).click();
  await expect(page).toHaveURL(/\/(onboarding|$)/, { timeout: 10000 });

  await page.goto("/categories");
  await page.locator("a[href^='/books/']").first().click();
  await expect(page).toHaveURL(/\/books\//);

  await page.getByRole("button", { name: /write a review/i }).click();
  await page.getByPlaceholder(/what did you think/i).fill("A genuinely great read, would recommend.");
  await page.getByRole("button", { name: /submit review/i }).click();

  // The form closes on success (clearing the textarea) — wait for that before
  // asserting, so the still-open textarea's matching text isn't a false match.
  await expect(page.getByPlaceholder(/what did you think/i)).toBeHidden({ timeout: 10000 });
  // Reviews sort newest-first, so the just-submitted one is the first match
  // even if earlier test runs left others with the same fixed review text.
  await expect(
    page.getByRole("paragraph").filter({ hasText: "A genuinely great read, would recommend." }).first()
  ).toBeVisible();
});
