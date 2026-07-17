import { test, expect } from "@playwright/test";
import { buildPreview } from "../functions/lib/preview";

/** Pure copy-builder for the edge share-preview meta (functions/lib/preview.ts). No browser — these
 *  run in Node — so they pin the exact strings crawlers will read without a live deploy. City keys
 *  come from the same top-500 bundle the function ships with; the four megacities below resolve to
 *  plain ASCII names, so the assertions don't hinge on diacritics. */
test.describe("buildPreview", () => {
  test("real-time share names the cities and reads as current time", () => {
    expect(buildPreview("tokyo_JP", null)).toEqual({
      title: "Current time in Tokyo",
      description: "Live local times, shared via Happyhour.",
    });
    expect(buildPreview("tokyo_JP,paris_FR", null).title).toBe("Current time in Tokyo & Paris");
    expect(buildPreview("tokyo_JP,paris_FR,london_GB", null).title).toBe(
      "Current time in Tokyo, Paris & London"
    );
  });

  test("beyond three cities, the rest collapse into '& K more'", () => {
    expect(buildPreview("tokyo_JP,paris_FR,london_GB,berlin_DE", null).title).toBe(
      "Current time in Tokyo, Paris, London & 1 more"
    );
  });

  test("a custom-time share (t present) reads as a conversion", () => {
    expect(buildPreview("tokyo_JP,paris_FR", "1700000000000")).toEqual({
      title: "Time zone conversion for Tokyo & Paris",
      description: "A time zone conversion, shared via Happyhour.",
    });
  });

  test("an empty t is treated as live, not custom", () => {
    expect(buildPreview("tokyo_JP", "").title).toBe("Current time in Tokyo");
  });

  test("keys outside the top-500 map fall back to a count", () => {
    // Wholly unresolved → bare count.
    expect(buildPreview("zzz_XX", null).title).toBe("Current time in 1 location");
    expect(buildPreview("zzz_XX,qqq_YY", null).title).toBe("Current time in 2 locations");
    // Partially resolved → name what we can, count the rest.
    expect(buildPreview("tokyo_JP,zzz_XX", null).title).toBe("Current time in Tokyo & 1 more");
  });
});
