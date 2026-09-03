import { describe, expect, test } from "bun:test";
import { orderTimelineEntrySchema } from "../src/admin";

const legacy = {
  createdAt: "2026-09-03T00:00:00.000Z",
  id: "shipment_1",
  kind: "fulfillment" as const,
  label: "shipped · Carrier · Express  TRACK / # 42 ",
  status: "shipped",
};

describe("order timeline shipment compatibility", () => {
  test("accepts a legacy entry without inventing shipment fields or changing its label", () => {
    expect(orderTimelineEntrySchema.parse(legacy)).toEqual(legacy);
  });

  test.each([null, "", "   ", "Carrier · Express / # 42 "])(
    "preserves structured shipment value %p exactly",
    (value) => {
      const entry = { ...legacy, carrier: value, trackingNumber: value };
      expect(orderTimelineEntrySchema.parse(entry)).toEqual(entry);
    },
  );

  test("keeps strict validation and rejects non-string shipment data", () => {
    expect(orderTimelineEntrySchema.safeParse({ ...legacy, extra: true }).success).toBe(false);
    expect(orderTimelineEntrySchema.safeParse({ ...legacy, carrier: 123 }).success).toBe(false);
    expect(orderTimelineEntrySchema.safeParse({ ...legacy, trackingNumber: [] }).success).toBe(
      false,
    );
  });
});
