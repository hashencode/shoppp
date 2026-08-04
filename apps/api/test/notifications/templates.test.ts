import { describe, expect, test } from "vitest";

import {
  renderInvitationNotificationTemplate,
  renderNotificationTemplate,
} from "../../src/notifications/templates";

const order = {
  currency: "USD",
  email: "shopper@example.test",
  grandTotal: 12_900,
  lines: [{ productName: "Atlas Carry-on", quantity: 1 }],
  publicReference: "ORD-NOTIFY-001",
};

describe("transactional notification templates", () => {
  test.each([
    ["order_receipt", "Order confirmed"],
    ["payment_failed", "Payment was not completed"],
    ["cancellation", "Order canceled"],
    ["refund", "Refund processed"],
    ["shipment", "Order shipped"],
  ] as const)("%s selects the expected customer template", (type, subject) => {
    const rendered = renderNotificationTemplate(
      type,
      {
        amount: 3_000,
        carrier: "DHL",
        order,
        trackingNumber: "DHL-TRACK-001",
      },
      "https://shop.example.test",
    );

    expect(rendered.subject).toContain(subject);
    expect(rendered.text).toContain("ORD-NOTIFY-001");
    expect(rendered.html).not.toContain("100 Market Street");
    expect(JSON.stringify(rendered)).not.toContain("guestAccessToken");
  });
});

test("admin invitation escapes display names and uses only the environment sign-in origin", () => {
  const rendered = renderInvitationNotificationTemplate({
    adminOrigin: "https://admin-test.example.test/",
    displayName: '<Admin & "Owner">',
  });
  expect(rendered.html).toContain("&lt;Admin &amp; &quot;Owner&quot;&gt;");
  expect(rendered.text).toContain("https://admin-test.example.test/");
  expect(JSON.stringify(rendered)).not.toMatch(/bearer|secret|access_token/i);
});
