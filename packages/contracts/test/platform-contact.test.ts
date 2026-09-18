import { describe, expect, test } from "bun:test";

import { contactProfileSchema } from "../src/platform";

const profile = {
  publishSupportEmail: true,
  publishPrivacyEmail: false,
  publicPhone: "+12125550123",
  serviceHours: "Monday to Friday, 9–5",
  timeZone: "America/New_York",
  locations: [{
    id: "0c57bff1-b605-4a67-b2e5-14f3edbf8baa",
    name: "Main studio", city: "New York", address: "123 Main Street, New York, NY 10001",
    phone: "+12125550124", email: "studio@example.com",
    mapUrl: "https://maps.example.com/main", visible: true,
  }],
  socials: [{
    id: "cafb8667-9916-47f4-85a8-c16296523713", platform: "Instagram",
    label: "Shoppp on Instagram", url: "https://instagram.com/shoppp", visible: true,
  }],
};

describe("contact profile", () => {
  test("accepts complete public channels, places and socials", () => {
    expect(contactProfileSchema.parse(profile)).toEqual(profile);
  });

  test("rejects partial address, invalid phone/map URLs, and duplicate row IDs", () => {
    expect(contactProfileSchema.safeParse({ ...profile, locations: [{ ...profile.locations[0], address: "" }] }).success).toBe(false);
    expect(contactProfileSchema.safeParse({ ...profile, publicPhone: "555-0123" }).success).toBe(false);
    expect(contactProfileSchema.safeParse({ ...profile, locations: [{ ...profile.locations[0], mapUrl: "http://maps.example.com/main" }] }).success).toBe(false);
    expect(contactProfileSchema.safeParse({ ...profile, locations: [profile.locations[0], profile.locations[0]] }).success).toBe(false);
  });

  test("requires hours and a real time zone together", () => {
    expect(contactProfileSchema.safeParse({ ...profile, timeZone: null }).success).toBe(false);
    expect(contactProfileSchema.safeParse({ ...profile, timeZone: "Mars/West" }).success).toBe(false);
  });
});
