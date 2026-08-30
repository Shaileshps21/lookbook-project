import { describe, expect, it } from "vitest";
import { formatPrice, formatCompactNumber, truncate } from "./format";

describe("formatPrice", () => {
  it("formats a number as an Indian rupee amount", () => {
    expect(formatPrice(1000)).toBe("₹1,000");
    expect(formatPrice(0)).toBe("₹0");
  });
});

describe("formatCompactNumber", () => {
  it("leaves numbers under 1000 as-is", () => {
    expect(formatCompactNumber(500)).toBe("500");
  });

  it("compacts round thousands without a decimal", () => {
    expect(formatCompactNumber(2000)).toBe("2k");
  });

  it("compacts non-round thousands with one decimal", () => {
    expect(formatCompactNumber(2500)).toBe("2.5k");
  });
});

describe("truncate", () => {
  it("returns short text unchanged", () => {
    expect(truncate("short text")).toBe("short text");
  });

  it("truncates long text and appends an ellipsis", () => {
    const long = "a".repeat(200);
    const result = truncate(long, 10);
    expect(result).toBe(`${"a".repeat(10)}...`);
  });
});
