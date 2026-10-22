import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mapDirectoryResult,
  mapContentResult,
  mapPressOutletResult,
  mapPressCoverageResult,
  mapPressSubmissionResult,
} from "../marketing";

describe("Marketing Search Mappers", () => {
  describe("Directory Result Mapper", () => {
    it("uses website as title when directory name is empty", () => {
      const result = mapDirectoryResult(
        {
          id: "dir-1",
          name: "",
          website: "https://directory.example.com",
          status: "Live",
          notes: "Some notes",
          listingUrl: "https://directory.example.com/listing",
        },
        "directory",
      );

      assert.strictEqual(result.title, "https://directory.example.com");
      assert.strictEqual(result.subtitle, null);
      assert.strictEqual(result.status, "Live");
      assert.strictEqual(result.type, "directory");
      assert.strictEqual(result.matchedField, "website");
      assert.strictEqual(
        result.href,
        `/directories?q=${encodeURIComponent("https://directory.example.com")}`,
      );
    });

    it("displays website as subtitle when a separate name is available", () => {
      const result = mapDirectoryResult(
        {
          id: "dir-2",
          name: "Product Hunt",
          website: "https://producthunt.com",
          status: "PendingReview",
        },
        "hunt",
      );

      assert.strictEqual(result.title, "Product Hunt");
      assert.strictEqual(result.subtitle, "https://producthunt.com");
      assert.strictEqual(result.status, "Pending review");
      assert.strictEqual(result.matchedField, "name");
      assert.strictEqual(
        result.href,
        `/directories?q=${encodeURIComponent("Product Hunt")}`,
      );
    });

    it("identifies matchedField correctly across notes and listingUrl", () => {
      const noteMatch = mapDirectoryResult(
        {
          id: "dir-3",
          name: "BetaList",
          website: "https://betalist.com",
          status: "NotSubmitted",
          notes: "Need founder twitter handle",
        },
        "twitter",
      );
      assert.strictEqual(noteMatch.matchedField, "notes");

      const urlMatch = mapDirectoryResult(
        {
          id: "dir-4",
          name: "Indie Hackers",
          website: "https://indiehackers.com",
          status: "NeedsChanges",
          listingUrl: "https://indiehackers.com/products/my-cool-app",
        },
        "cool-app",
      );
      assert.strictEqual(urlMatch.matchedField, "listingUrl");
    });
  });

  describe("Content Result Mapper", () => {
    it("falls back to 'Untitled content' when both title and url are missing or empty", () => {
      const result = mapContentResult(
        {
          id: "content-1",
          title: null,
          url: "",
          platform: "Twitter",
          status: "Draft",
        },
        "twitter",
      );

      assert.strictEqual(result.title, "Untitled content");
      assert.strictEqual(result.subtitle, "Twitter");
      assert.strictEqual(result.status, "Draft");
      assert.strictEqual(result.type, "content");
      assert.strictEqual(result.href, `/content?q=${encodeURIComponent("Untitled content")}`);
    });

    it("uses title when present, or url as fallback", () => {
      const withTitle = mapContentResult(
        {
          id: "content-2",
          title: "How to Build Marketing Dashboards",
          url: "https://blog.example.com/post-1",
          platform: "Blog",
          status: "Published",
        },
        "dashboards",
      );
      assert.strictEqual(withTitle.title, "How to Build Marketing Dashboards");
      assert.strictEqual(withTitle.matchedField, "title");
      assert.strictEqual(
        withTitle.href,
        `/content?q=${encodeURIComponent("How to Build Marketing Dashboards")}`,
      );

      const withUrlOnly = mapContentResult(
        {
          id: "content-3",
          title: null,
          url: "https://youtube.com/watch?v=12345",
          platform: "YouTube",
          status: "Idea",
        },
        "youtube",
      );
      assert.strictEqual(withUrlOnly.title, "https://youtube.com/watch?v=12345");
      assert.strictEqual(withUrlOnly.matchedField, "url");
    });

    it("matches topics in matchedField", () => {
      const result = mapContentResult(
        {
          id: "content-4",
          title: "Product Update",
          platform: "Newsletter",
          status: "Published",
          topics: ["ai", "growth", "metrics"],
        },
        "growth",
      );

      assert.strictEqual(result.matchedField, "topics");
    });
  });

  describe("Press Outlet Result Mapper", () => {
    it("never exposes contact information or notes", () => {
      const rawOutletWithSensitiveData = {
        id: "outlet-1",
        name: "TechCrunch",
        website: "https://techcrunch.com",
        tier: "Tier1" as const,
        contactName: "John Reporter",
        contactEmail: "john@techcrunch.com",
        notes: "Strict embargo until Friday",
      };

      const result = mapPressOutletResult(rawOutletWithSensitiveData, "tech");

      assert.strictEqual(result.type, "press_outlet");
      assert.strictEqual(result.id, "outlet-1");
      assert.strictEqual(result.title, "TechCrunch");
      assert.strictEqual(result.subtitle, "Tier 1");
      assert.strictEqual(result.status, null);
      assert.strictEqual(result.matchedField, "name");
      assert.strictEqual(
        result.href,
        `/media?q=${encodeURIComponent("TechCrunch")}`,
      );

      // Verify no sensitive keys leaked into the SearchResult object
      const keys = Object.keys(result);
      assert.strictEqual(keys.includes("contactName"), false);
      assert.strictEqual(keys.includes("contactEmail"), false);
      assert.strictEqual(keys.includes("notes"), false);
    });

    it("correctly maps website matches", () => {
      const result = mapPressOutletResult(
        {
          id: "outlet-2",
          name: "Sifted",
          website: "https://sifted.eu",
          tier: null,
        },
        "sifted.eu",
      );

      assert.strictEqual(result.title, "Sifted");
      assert.strictEqual(result.subtitle, null);
      assert.strictEqual(result.matchedField, "website");
    });
  });

  describe("Press Coverage Result Mapper", () => {
    it("maps coverage fields and handles title and outlet matches", () => {
      const result = mapPressCoverageResult(
        {
          id: "cov-1",
          title: "Amp Launch Announcement & Feature Breakdown",
          outlet: "TechCabal",
          summary: "Covered the global search capability and AI features.",
        },
        "launch",
      );

      assert.strictEqual(result.type, "press_coverage");
      assert.strictEqual(result.id, "cov-1");
      assert.strictEqual(result.title, "Amp Launch Announcement & Feature Breakdown");
      assert.strictEqual(result.subtitle, "TechCabal");
      assert.strictEqual(result.status, null);
      assert.strictEqual(result.matchedField, "title");
      assert.strictEqual(
        result.href,
        `/media?q=${encodeURIComponent("Amp Launch Announcement & Feature Breakdown")}`,
      );

      const summaryMatch = mapPressCoverageResult(
        {
          id: "cov-2",
          title: "Funding News",
          outlet: "Forbes",
          summary: "Series A round completed successfully.",
        },
        "series a",
      );
      assert.strictEqual(summaryMatch.matchedField, "summary");
    });
  });

  describe("Press Submission Result Mapper", () => {
    it("maps submission fields and preserves status", () => {
      const result = mapPressSubmissionResult(
        {
          id: "sub-1",
          title: "Op-Ed: The Future of Marketing Metrics",
          outlet: "VentureBeat",
          status: "Submitted",
          notes: "Follow up next Monday.",
        },
        "metrics",
      );

      assert.strictEqual(result.type, "press_submission");
      assert.strictEqual(result.id, "sub-1");
      assert.strictEqual(result.title, "Op-Ed: The Future of Marketing Metrics");
      assert.strictEqual(result.subtitle, "VentureBeat");
      assert.strictEqual(result.status, "Submitted");
      assert.strictEqual(result.matchedField, "title");
      assert.strictEqual(
        result.href,
        `/media?q=${encodeURIComponent("Op-Ed: The Future of Marketing Metrics")}`,
      );

      const noteMatch = mapPressSubmissionResult(
        {
          id: "sub-2",
          title: "Product Pitch",
          outlet: "Wired",
          status: "Draft",
          notes: "Need higher resolution screenshot.",
        },
        "screenshot",
      );
      assert.strictEqual(noteMatch.matchedField, "notes");
    });
  });

  describe("Query Parameter URL Encoding", () => {
    it("correctly encodes special characters, spaces, and ampersands in destination URLs", () => {
      const specialTitle = "Growth & Marketing / Q4 Strategy (2026)?";
      const contentResult = mapContentResult(
        {
          id: "c-spec",
          title: specialTitle,
          status: "Published",
        },
        "strategy",
      );

      assert.strictEqual(
        contentResult.href,
        `/content?q=Growth%20%26%20Marketing%20%2F%20Q4%20Strategy%20(2026)%3F`,
      );
      assert.strictEqual(
        decodeURIComponent(contentResult.href.replace("/content?q=", "")),
        specialTitle,
      );
    });
  });
});
