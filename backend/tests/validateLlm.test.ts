import { describe, it, expect } from "vitest";
import { hasNonEmptyStrings } from "../src/util/validateLlm.js";

describe("hasNonEmptyStrings", () => {
  it("passes when every listed key is a non-empty string", () => {
    expect(hasNonEmptyStrings({ a: "x", b: "y" }, ["a", "b"])).toBe(true);
  });

  it("fails when a key is missing", () => {
    expect(hasNonEmptyStrings({ a: "x" } as { a: string; b?: string }, ["a", "b"])).toBe(false);
  });

  it("fails when a key is an empty or whitespace-only string", () => {
    expect(hasNonEmptyStrings({ a: "x", b: "   " }, ["a", "b"])).toBe(false);
  });

  it("fails when a key is not a string at all", () => {
    expect(hasNonEmptyStrings({ a: "x", b: null } as unknown as { a: string; b: string }, ["a", "b"])).toBe(false);
  });

  it("passes with an empty keys list", () => {
    expect(hasNonEmptyStrings({ a: "x" }, [])).toBe(true);
  });
});
