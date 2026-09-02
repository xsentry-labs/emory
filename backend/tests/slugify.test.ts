import { describe, it, expect } from "vitest";
import slugify from "../src/util/slugify.js";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Fix Missing Titles!")).toBe("fix-missing-titles");
  });

  it("falls back to 'fix' for empty input", () => {
    expect(slugify("...")).toBe("fix");
  });
});
