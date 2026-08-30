import { test, expect } from "@playwright/test";

/**
 * Phase 13 §13.1 — Recommendation Experimentation Infrastructure e2e.
 *
 * Verifies the online A/B layer that wraps the homepage recommendation
 * pipeline:
 *   1. A logged-in user's homepage carries an `arm` and fires
 *      `recommendation_view` events tagged with arm/section/bookIds.
 *   2. Recommended books render explainability "why" badges.
 *   3. Clicking a recommended book fires `recommendation_click` with the
 *      serving arm + reason so conversions attribute back to the pipeline.
 *   4. The admin AB-report panel (hybrid vs popularity, z-test verdict,
 *      per-source breakdown) renders on the admin dashboard.
 *
 * The backend must be running with seeded data (admin@lookbook.dev /
 * Admin@12345) and an account with activity (abtester.phase13@gmail.com /
 * Test@12345). See `docs/phase-13-status.md` §13.1.
 */

const BASE = "http://localhost:5173";

const AB_TESTER = { email: "abtester.phase13@gmail.com", password: "Test@12345" };
const ADMIN = { email: "admin@lookbook.dev", password: "Admin@12345" };

interface TrackedEvent {
  event?: string;
  data?: Record<string, unknown>;
}

/** Intercept the analytics tracker so we can assert on the exact event payloads. */
async function interceptAnalytics(page: import("@playwright/test").Page) {
  const events: TrackedEvent[] = [];
  await page.route("**/api/analytics/track", (route) => {
    try {
      events.push((route.request().postDataJSON?.() ?? {}) as TrackedEvent);
    } catch {
      // non-JSON body — ignore
    }
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
  });
  return events;
}

async function login(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  // Login redirects to /profile; wait for the navigation away from /login so
  // the httpOnly refresh cookie is set before we continue.
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 20000 });
}

test("homepage serves A/B arm + reasons and fires attributed events (§13.1)", async ({ page }) => {
  test.setTimeout(60000);
  const events = await interceptAnalytics(page);

  await login(page, AB_TESTER.email, AB_TESTER.password);
  await page.goto(`${BASE}/`);

  // Session restore (httpOnly-refresh round-trip) runs on mount, then the
  // homepage refetches with auth — wait for the personalized sections + their
  // explainability "why" badges to actually render (auto-retrying assertion).
  await expect(page.getByText("Recommended For You")).toBeVisible({ timeout: 30000 });
  await expect(page.locator("body")).toContainText(
    /Similar to your recent reads|Because you read|Trending in|wishlisted|Most popular with all readers/,
    { timeout: 30000 }
  );

  // Impressions were logged with arm + section + bookIds.
  const recViews = events.filter((e) => e.event === "recommendation_view");
  expect(recViews.length).toBeGreaterThan(0);
  const firstView = recViews[0];
  expect(["hybrid", "popularity"]).toContain(firstView.data.arm);
  expect(typeof firstView.data.section).toBe("string");
  expect(Array.isArray(firstView.data.bookIds)).toBe(true);

  // Clicking a recommended card fires recommendation_click with the arm + reason.
  const card = page.locator("a[href^='/books/']").first();
  if ((await card.count()) > 0) {
    await card.click();
    await page.waitForTimeout(1200);
    const recClicks = events.filter((e) => e.event === "recommendation_click");
    expect(recClicks.length).toBeGreaterThan(0);
    expect(["hybrid", "popularity"]).toContain(recClicks[0].data.arm);
    expect(typeof recClicks[0].data.reason).toBe("string");
    expect(typeof recClicks[0].data.bookId).toBe("string");
  }
});

test("admin AB-report panel renders hybrid vs popularity with z-test (§13.1)", async ({ page }) => {
  test.setTimeout(60000);
  await login(page, ADMIN.email, ADMIN.password);

  await page.goto(`${BASE}/admin`);
  await page.getByText("Recommendation A/B test (§13.3)").waitFor({ state: "visible", timeout: 30000 });

  const body = await page.locator("body").innerText();
  expect(body).toContain("hybrid");
  expect(body).toContain("popularity");
  expect(body).toMatch(/z=.*p=/); // two-proportion z-test verdict
  expect(body.toUpperCase()).toContain("CONVERSIONS BY RECOMMENDATION SOURCE"); // §13.8 breakdown
});