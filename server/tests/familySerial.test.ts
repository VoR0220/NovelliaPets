import { describe, expect, it } from "vitest";
import {
  formatFamilySerial,
  parseFamilySerialInput,
} from "../src/models/Family";

describe("Family serial codes", () => {
  it("formats NP-######", () => {
    expect(formatFamilySerial(1)).toBe("NP-000001");
    expect(formatFamilySerial(42)).toBe("NP-000042");
  });

  it("parses NP- prefix, bare numbers, and leading zeros", () => {
    expect(parseFamilySerialInput("NP-000002")).toBe(2);
    expect(parseFamilySerialInput("np-2")).toBe(2);
    expect(parseFamilySerialInput("2")).toBe(2);
    expect(parseFamilySerialInput("  NP-000042 ")).toBe(42);
  });

  it("rejects invalid input", () => {
    expect(parseFamilySerialInput("")).toBeNull();
    expect(parseFamilySerialInput("NP-000000")).toBeNull();
    expect(parseFamilySerialInput("abc")).toBeNull();
  });
});
