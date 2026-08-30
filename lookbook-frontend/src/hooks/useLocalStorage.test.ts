import { describe, expect, it, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLocalStorage } from "./useLocalStorage";

describe("useLocalStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("initializes with the provided default when nothing is stored", () => {
    const { result } = renderHook(() => useLocalStorage("test-key", ["default"]));
    expect(result.current[0]).toEqual(["default"]);
  });

  it("persists updates to localStorage and reflects them on next mount", () => {
    const { result, unmount } = renderHook(() => useLocalStorage("test-key", [] as string[]));

    act(() => {
      result.current[1](["a", "b"]);
    });
    expect(result.current[0]).toEqual(["a", "b"]);
    unmount();

    const { result: second } = renderHook(() => useLocalStorage("test-key", [] as string[]));
    expect(second.current[0]).toEqual(["a", "b"]);
  });

  it("falls back to the default value for malformed stored JSON", () => {
    window.localStorage.setItem("test-key", "{not valid json");
    const { result } = renderHook(() => useLocalStorage("test-key", ["fallback"]));
    expect(result.current[0]).toEqual(["fallback"]);
  });
});
