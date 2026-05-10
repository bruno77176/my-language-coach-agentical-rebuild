import { describe, expect, it } from "vitest";
import { GREETING_TEMPLATES, buildGreeting } from "./greetings";
import { SUPPORTED_LANG_CODES } from "./languages";

describe("GREETING_TEMPLATES", () => {
  it("covers every supported language", () => {
    for (const lang of SUPPORTED_LANG_CODES) {
      expect(GREETING_TEMPLATES[lang]).toBeTruthy();
    }
  });

  it("every template contains the {name} placeholder", () => {
    for (const lang of SUPPORTED_LANG_CODES) {
      expect(GREETING_TEMPLATES[lang]).toContain("{name}");
    }
  });
});

describe("buildGreeting", () => {
  it("interpolates the name", () => {
    expect(buildGreeting("en", "Bruno")).toBe(
      "Hi Bruno! What would you like to talk about today?",
    );
  });

  it("works for every supported language", () => {
    for (const lang of SUPPORTED_LANG_CODES) {
      const result = buildGreeting(lang, "Bruno");
      expect(result).toContain("Bruno");
      expect(result).not.toContain("{name}");
    }
  });
});
