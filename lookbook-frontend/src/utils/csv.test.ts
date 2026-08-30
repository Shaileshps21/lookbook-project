import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";

describe("parseCsv", () => {
  it("parses a simple CSV into row objects keyed by header", () => {
    const csv = "title,author\nAtomic Habits,James Clear\nDeep Work,Cal Newport";
    expect(parseCsv(csv)).toEqual([
      { title: "Atomic Habits", author: "James Clear" },
      { title: "Deep Work", author: "Cal Newport" },
    ]);
  });

  it("handles quoted fields with embedded commas", () => {
    const csv = 'title,description\n"Atomic Habits","A book about, well, habits"';
    expect(parseCsv(csv)).toEqual([{ title: "Atomic Habits", description: "A book about, well, habits" }]);
  });

  it("handles escaped double quotes inside a quoted field", () => {
    const csv = 'title,quote\nBook,"She said ""hello"" to me"';
    expect(parseCsv(csv)).toEqual([{ title: "Book", quote: 'She said "hello" to me' }]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });

  it("skips blank lines", () => {
    const csv = "title,author\nBook One,Author One\n\nBook Two,Author Two";
    expect(parseCsv(csv)).toHaveLength(2);
  });
});
