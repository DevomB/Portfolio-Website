import { describe, expect, it } from "vitest";
import { suggestRoute } from "@/app/suggestRoute";

const routes = ["/", "/privacy", "/terms", "/poker-lab", "/projects/poker-bot", "/projects/ananke", "/card-desk"];

describe("suggestRoute", () => {
  it("reads a typo or a longer name as the route it resembles", () => {
    expect(suggestRoute("/privacy-policy", routes)).toBe("/privacy");
    expect(suggestRoute("/terms-of-service", routes)).toBe("/terms");
    expect(suggestRoute("/pokerlab", routes)).toBe("/poker-lab");
    expect(suggestRoute("/project/anank", routes)).toBe("/projects/ananke");
  });

  it("ignores case, query strings, doubled slashes and hashes", () => {
    expect(suggestRoute("/Privacy/?utm=1", routes)).toBe("/privacy");
    expect(suggestRoute("//projects//ananke#top", routes)).toBe("/projects/ananke");
  });

  it("sends nonsense home rather than guessing", () => {
    expect(suggestRoute("/zzzzzzzz", routes)).toBe("/");
    expect(suggestRoute("", routes)).toBe("/");
  });
});
