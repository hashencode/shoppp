import { describe, expect, test } from "bun:test";

import {
  compareFontContractSnapshots,
  type FontContractSnapshot,
} from "../e2e/support/theme-font-contract";

function snapshot(): FontContractSnapshot {
  return {
    fontsReady: true,
    probes: [
      {
        family: "Outfit",
        id: "account",
        lineCount: 1,
        text: "Account",
        textWidth: 62.5,
        weight: "500",
      },
    ],
  };
}

describe("runtime font contract comparison", () => {
  test("accepts a loaded approved font with stable text metrics", () => {
    const reference = snapshot();
    const implementation = structuredClone(reference);
    implementation.probes[0]!.textWidth = 63;

    expect(compareFontContractSnapshots(reference, implementation)).toEqual([]);
  });

  test("fails fallback family, weight, width drift, and atomic-label wrapping", () => {
    const reference = snapshot();
    const implementation = structuredClone(reference);
    const probe = implementation.probes[0]!;
    implementation.fontsReady = false;
    probe.family = "Arial";
    probe.lineCount = 2;
    probe.textWidth = 71;
    probe.weight = "400";

    expect(compareFontContractSnapshots(reference, implementation)).toEqual([
      "fontsReady: expected true, received false",
      'account.family: expected "Outfit", received "Arial"',
      'account.weight: expected "500", received "400"',
      "account.textWidth: expected 62.5px, received 71px",
      "account.lineCount: expected 1, received 2",
    ]);
  });
});
