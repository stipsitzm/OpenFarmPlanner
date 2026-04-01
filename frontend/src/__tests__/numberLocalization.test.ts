import {
  formatLocalizedNumber,
  parseLocalizedNumber,
  resolveLocaleFromLanguage,
} from "../utils/numberLocalization";

describe("numberLocalization utilities", () => {
  it("formats decimals with comma in German locale", () => {
    expect(
      formatLocalizedNumber(12.75, "de-DE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    ).toBe("12,75");
  });

  it("parses German decimal input with comma", () => {
    expect(parseLocalizedNumber("1,5", "de-DE")).toBe(1.5);
  });

  it("parses decimal input with dot in German locale", () => {
    expect(parseLocalizedNumber("1.5", "de-DE")).toBe(1.5);
  });

  it("returns null for invalid localized number input", () => {
    expect(parseLocalizedNumber("abc", "de-DE")).toBeNull();
  });

  it("resolves language codes to locale tags", () => {
    expect(resolveLocaleFromLanguage("de")).toBe("de-DE");
    expect(resolveLocaleFromLanguage("en")).toBe("en-US");
  });
});
