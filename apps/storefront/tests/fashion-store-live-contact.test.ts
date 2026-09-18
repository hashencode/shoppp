import { describe, expect, test } from "bun:test";

import { presentationViewModelSchema } from "../app/theme-engine/view-models";
import { resolveFashionStoreLiveContactPresentation } from "../app/themes/fashion-store/contracts/content-presentation";

const contact = {
  supportEmail: "support@example.test",
  privacyEmail: null,
  publicPhone: null,
  serviceHours: null,
  timeZone: null,
  locations: [],
  socials: [],
};

describe("Fashion Store live Contact presentation", () => {
  test("selects the frozen public contact view, including an online-only profile", () => {
    const viewModel = presentationViewModelSchema.parse({
      contactVersion: "a".repeat(64),
      heading: "Contact us",
      kind: "state",
      message: "Choose a way to reach us.",
      publicContact: contact,
      state: "populated",
    });

    expect(resolveFashionStoreLiveContactPresentation(viewModel, "contact")).toEqual(viewModel);
    expect(resolveFashionStoreLiveContactPresentation(viewModel, "about")).toBeUndefined();
    expect(
      resolveFashionStoreLiveContactPresentation(
        { ...viewModel, publicContact: undefined },
        "contact",
      ),
    ).toBeUndefined();
  });

  test("retains ordered locations and socials while excluding historical and fixture views", () => {
    const locations = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "East studio",
        city: "Eastport",
        address: "1 River Street",
        phone: "+12025550111",
        email: "east@example.test",
        mapUrl: "https://maps.example.test/east",
        visible: true,
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "West studio",
        city: "Westport",
        address: "2 Hill Street",
        phone: null,
        email: null,
        mapUrl: null,
        visible: true,
      },
    ];
    const socials = [
      {
        id: "33333333-3333-4333-8333-333333333333",
        platform: "instagram",
        label: "Instagram",
        url: "https://social.example.test/instagram",
        visible: true,
      },
      {
        id: "44444444-4444-4444-8444-444444444444",
        platform: "facebook",
        label: "Facebook",
        url: "https://social.example.test/facebook",
        visible: true,
      },
    ];
    const viewModel = presentationViewModelSchema.parse({
      contactVersion: "b".repeat(64),
      heading: "Contact",
      kind: "state",
      message: "Visit or write to us.",
      publicContact: { ...contact, locations, socials },
      state: "populated",
    });
    const selected = resolveFashionStoreLiveContactPresentation(viewModel, "contact");
    expect(selected?.publicContact?.locations).toEqual(locations);
    expect(selected?.publicContact?.socials).toEqual(socials);
    expect(selected?.contactVersion).toBe("b".repeat(64));

    const historical = presentationViewModelSchema.parse({
      heading: "Contact information unavailable",
      kind: "state",
      message: "Merchant contact details have not been published.",
      state: "unavailable",
    });
    const fixture = presentationViewModelSchema.parse({
      data: { contact: { locations: [] } },
      kind: "theme-section",
      state: "populated",
    });
    expect(resolveFashionStoreLiveContactPresentation(historical, "contact")).toBeUndefined();
    expect(resolveFashionStoreLiveContactPresentation(fixture, "contact")).toBeUndefined();
  });
});
