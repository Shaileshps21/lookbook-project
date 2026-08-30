import { dedupeById } from "../utils/dedupeById";

describe("dedupeById", () => {
  it("returns an empty list unchanged", () => {
    expect(dedupeById([])).toEqual([]);
  });

  it("leaves an already-unique list untouched", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(dedupeById(items)).toEqual(items);
  });

  it("collapses repeats of the same id", () => {
    const items = [{ id: "a" }, { id: "a" }, { id: "a" }];
    expect(dedupeById(items)).toEqual([{ id: "a" }]);
  });

  it("keeps the first occurrence and preserves order", () => {
    const first = { id: "a", title: "first" };
    const items = [first, { id: "b", title: "b" }, { id: "a", title: "later duplicate" }];
    expect(dedupeById(items)).toEqual([first, { id: "b", title: "b" }]);
  });

  it("handles the real homepage case: one book rented across three orders", () => {
    const deepWork = { id: "6a5f547eaf19ce02267e4ab1", title: "Deep Work" };
    const rented = [deepWork, deepWork, deepWork];
    expect(dedupeById(rented)).toHaveLength(1);
  });

  it("drops entries with no id rather than collapsing them together", () => {
    const items = [{ id: "a" }, { id: undefined }, { id: undefined }, { id: "b" }];
    expect(dedupeById(items)).toEqual([{ id: "a" }, { id: "b" }]);
  });
});
