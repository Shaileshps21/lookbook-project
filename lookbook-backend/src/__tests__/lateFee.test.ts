import { calculateLateFee, overdueDays } from "../utils/lateFee";
import { env } from "../config/env";
import type { IOrderItem } from "../models/Order";

const DAY_MS = 24 * 60 * 60 * 1000;
const RATE = env.rental.lateFeePerDay;

const rentItem = (over: Partial<IOrderItem> = {}): IOrderItem =>
  ({ mode: "rent", quantity: 1, price: 40, ...over }) as IOrderItem;

describe("overdueDays", () => {
  const now = new Date("2026-08-20T12:00:00Z");

  it("is 0 for a rental that is not yet due", () => {
    expect(overdueDays(new Date(now.getTime() + 2 * DAY_MS), now)).toBe(0);
  });

  it("floors partial days so a few hours late costs nothing", () => {
    expect(overdueDays(new Date(now.getTime() - 3 * 60 * 60 * 1000), now)).toBe(0);
    expect(overdueDays(new Date(now.getTime() - 25 * 60 * 60 * 1000), now)).toBe(1);
  });

  it("counts whole days overdue", () => {
    expect(overdueDays(new Date(now.getTime() - 5 * DAY_MS), now)).toBe(5);
  });
});

describe("calculateLateFee", () => {
  const now = new Date("2026-08-20T12:00:00Z");

  it("is 0 for a purchased (non-rent) item", () => {
    const item = rentItem({ mode: "buy", dueDate: new Date(now.getTime() - 10 * DAY_MS) });
    expect(calculateLateFee(item, now)).toBe(0);
  });

  it("is 0 for a rental with no due date", () => {
    expect(calculateLateFee(rentItem(), now)).toBe(0);
  });

  it("is 0 while the rental is still within its term", () => {
    const item = rentItem({ dueDate: new Date(now.getTime() + DAY_MS) });
    expect(calculateLateFee(item, now)).toBe(0);
  });

  it("charges per day overdue", () => {
    const item = rentItem({ dueDate: new Date(now.getTime() - 3 * DAY_MS) });
    expect(calculateLateFee(item, now)).toBe(3 * RATE);
  });

  it("scales with quantity", () => {
    const item = rentItem({ dueDate: new Date(now.getTime() - 2 * DAY_MS), quantity: 3 });
    expect(calculateLateFee(item, now)).toBe(2 * RATE * 3);
  });

  it("stops accruing at the return date, not the sweep date", () => {
    const item = rentItem({
      dueDate: new Date(now.getTime() - 10 * DAY_MS),
      returnedAt: new Date(now.getTime() - 8 * DAY_MS),
    });
    // Returned 2 days after it was due, even though the sweep runs 10 days later.
    expect(calculateLateFee(item, now)).toBe(2 * RATE);
  });

  it("is 0 for an item returned before its due date", () => {
    const item = rentItem({
      dueDate: new Date(now.getTime() - DAY_MS),
      returnedAt: new Date(now.getTime() - 3 * DAY_MS),
    });
    expect(calculateLateFee(item, now)).toBe(0);
  });
});
