import { describe, expect, test } from "bun:test";

import { contactProfileSchema } from "../src/platform";

const profile = {
  publishSupportEmail: true,
  publishPrivacyEmail: false,
  publicPhone: "+12125550123",
  serviceHours: {
    kind: "weekly" as const,
    ranges: [
      {
        id: "dc6014f0-71e9-471a-9443-bd78af552081",
        startDay: "monday" as const,
        endDay: "friday" as const,
        startTime: "09:00",
        endTime: "17:00",
      },
    ],
  },
  timeZone: "America/New_York",
  locations: [
    {
      id: "0c57bff1-b605-4a67-b2e5-14f3edbf8baa",
      name: "Main studio",
      city: "New York",
      address: "123 Main Street, New York, NY 10001",
      phone: "+12125550124",
      email: "studio@example.com",
      mapUrl: "https://maps.example.com/main",
      visible: true,
    },
  ],
  socials: [
    {
      id: "cafb8667-9916-47f4-85a8-c16296523713",
      platform: "instagram" as const,
      label: "Instagram" as const,
      url: "https://instagram.com/shoppp",
      visible: true,
    },
  ],
};

describe("contact profile", () => {
  test("accepts complete public channels, places and socials", () => {
    expect(contactProfileSchema.parse(profile)).toEqual(profile);
  });

  test("normalizes legacy hours, platform casing, and social labels", () => {
    const parsed = contactProfileSchema.parse({
      ...profile,
      serviceHours: "Monday to Friday, 9–5",
      socials: [{ ...profile.socials[0], platform: "Instagram", label: "Custom label" }],
    });
    expect(parsed.serviceHours).toEqual({ kind: "legacy", text: "Monday to Friday, 9–5" });
    expect(parsed.socials[0]).toMatchObject({ platform: "instagram", label: "Instagram" });
  });

  test("rejects partial address, invalid phone/map URLs, and duplicate row IDs", () => {
    expect(
      contactProfileSchema.safeParse({
        ...profile,
        locations: [{ ...profile.locations[0], address: "" }],
      }).success,
    ).toBe(false);
    expect(contactProfileSchema.safeParse({ ...profile, publicPhone: "555-0123" }).success).toBe(
      false,
    );
    expect(
      contactProfileSchema.safeParse({
        ...profile,
        locations: [{ ...profile.locations[0], mapUrl: "http://maps.example.com/main" }],
      }).success,
    ).toBe(false);
    expect(
      contactProfileSchema.safeParse({
        ...profile,
        locations: [profile.locations[0], profile.locations[0]],
      }).success,
    ).toBe(false);
  });

  test("requires hours and a real time zone together", () => {
    expect(contactProfileSchema.safeParse({ ...profile, timeZone: null }).success).toBe(false);
    expect(contactProfileSchema.safeParse({ ...profile, timeZone: "Mars/West" }).success).toBe(
      false,
    );
  });

  test("rejects invalid weekly ranges and duplicate social platforms", () => {
    expect(
      contactProfileSchema.safeParse({
        ...profile,
        serviceHours: {
          kind: "weekly",
          ranges: [{ ...profile.serviceHours.ranges[0], endDay: "monday", startDay: "friday" }],
        },
      }).success,
    ).toBe(false);
    expect(
      contactProfileSchema.safeParse({
        ...profile,
        socials: [
          profile.socials[0],
          { ...profile.socials[0], id: "733ad7dc-f901-4a38-9718-488163c81de2" },
        ],
      }).success,
    ).toBe(false);
  });
});
