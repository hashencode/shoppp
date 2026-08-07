import { describe, expect, test } from "bun:test";

import {
  compareSourceContractSnapshots,
  type SourceContractSnapshot,
} from "../e2e/support/theme-source-contract";

function snapshot(): SourceContractSnapshot {
  return {
    documentHeight: 10_000,
    probes: [
      {
        count: 1,
        content: true,
        geometry: true,
        elements: [
          {
            asset: "hero.jpg",
            href: "/collections/women",
            assetMetadata: {
              currentSrc: "hero@2x.jpg",
              dataAt2x: "hero@2x.jpg",
              devicePixelRatio: 2,
              naturalHeight: 400,
              naturalWidth: 800,
              renderedHeight: 200,
              renderedWidth: 400,
              srcset: "hero.jpg 1x, hero@2x.jpg 2x",
            },
            layout: {
              clientHeight: 24,
              clientWidth: 180,
              lineCount: 1,
              overflowsX: false,
              overflowsY: false,
              scrollHeight: 24,
              scrollWidth: 180,
            },
            pseudoStyles: {
              after: { "border-color": "rgb(31, 31, 31)", width: "12px" },
              before: { content: '""' },
            },
            rect: { bottom: 300, height: 200, left: 20, right: 420, top: 100, width: 400 },
            styles: {
              color: "rgb(31, 31, 31)",
              "font-size": "17px",
              "font-weight": "500",
            },
            text: "Women’s collection",
            visible: true,
          },
        ],
        id: "hero",
      },
    ],
    devicePixelRatio: 2,
    viewport: { height: 1_000, width: 1_440 },
  };
}

describe("source-contract comparison", () => {
  test("retains targeted evidence for controlled Fashion Store copy, count, icon, asset, and geometry defects", () => {
    const reference = snapshot();
    reference.probes[0]!.elements[0]!.pseudoStyles!.before.content = '"\\e8e1"';
    const implementation = structuredClone(reference);
    const element = implementation.probes[0]!.elements[0]!;
    implementation.probes[0]!.count = 2;
    element.text = "Approximate collection";
    element.asset = "substitute.jpg";
    element.rect.left += 2.1;
    element.pseudoStyles!.before.content = '"?"';

    expect(compareSourceContractSnapshots(reference, implementation)).toEqual([
      "hero: expected 1 elements, received 2",
    ]);

    implementation.probes[0]!.count = 1;
    expect(compareSourceContractSnapshots(reference, implementation)).toEqual([
      'hero[0] text: expected "Women’s collection", received "Approximate collection"',
      "hero[0] asset: expected hero.jpg, received substitute.jpg",
      "hero[0] left: expected 20px, received 22.1px",
      'hero[0] ::before content: expected ""\\e8e1"", received ""?""',
    ]);
  });

  test("accepts numeric style and geometry drift inside the fidelity threshold", () => {
    const reference = snapshot();
    const implementation = structuredClone(reference);
    implementation.documentHeight = 10_049;
    implementation.probes[0]!.elements[0]!.rect.left = 22;
    implementation.probes[0]!.elements[0]!.styles["font-size"] = "17.5px";

    expect(compareSourceContractSnapshots(reference, implementation)).toEqual([]);
  });

  test("treats serialized identity transforms as visually equivalent", () => {
    const reference = snapshot();
    const implementation = structuredClone(reference);
    reference.probes[0]!.elements[0]!.styles.transform = "matrix(1, 0, 0, 1, 0, 0)";
    implementation.probes[0]!.elements[0]!.styles.transform = "none";

    expect(compareSourceContractSnapshots(reference, implementation)).toEqual([]);
  });

  test("allows only explicitly registered source-correction style pairs", () => {
    const reference = snapshot();
    const implementation = structuredClone(reference);
    reference.probes[0]!.elements[0]!.styles.color = "rgb(136, 142, 149)";
    implementation.probes[0]!.elements[0]!.styles.color = "rgb(113, 117, 128)";

    expect(
      compareSourceContractSnapshots(reference, implementation, {
        styleEquivalences: {
          color: [{ implementation: "rgb(113, 117, 128)", reference: "rgb(136, 142, 149)" }],
        },
      }),
    ).toEqual([]);
  });

  test("reports content, asset, visibility, style, geometry, and page-height mismatches", () => {
    const reference = snapshot();
    const implementation = structuredClone(reference);
    const element = implementation.probes[0]!.elements[0]!;
    implementation.documentHeight = 10_100;
    element.asset = "replacement.jpg";
    element.href = "/collections";
    element.rect.width = 403;
    element.styles.color = "rgb(0, 0, 0)";
    element.styles["font-size"] = "18px";
    element.text = "Approximate collection";
    element.visible = false;

    expect(compareSourceContractSnapshots(reference, implementation)).toEqual([
      "document height: expected 10000px, received 10100px",
      'hero[0] text: expected "Women’s collection", received "Approximate collection"',
      "hero[0] href: expected /collections/women, received /collections",
      "hero[0] asset: expected hero.jpg, received replacement.jpg",
      "hero[0] visibility: expected true, received false",
      "hero[0] width: expected 400px, received 403px",
      'hero[0] color: expected "rgb(31, 31, 31)", received "rgb(0, 0, 0)"',
      'hero[0] font-size: expected "17px", received "18px"',
    ]);
  });

  test("reports missing, extra, and reordered contract probes", () => {
    const reference = snapshot();
    const implementation = snapshot();
    implementation.probes = [
      {
        count: 0,
        content: true,
        geometry: true,
        elements: [],
        id: "extra",
      },
    ];

    expect(compareSourceContractSnapshots(reference, implementation)).toEqual([
      "hero: missing probe",
      "extra: unexpected probe",
    ]);
  });

  test("reports probe order drift even when every region is present", () => {
    const reference = snapshot();
    reference.probes.push({
      count: 0,
      content: true,
      geometry: true,
      elements: [],
      id: "footer",
    });
    const implementation = structuredClone(reference);
    implementation.probes.reverse();

    expect(compareSourceContractSnapshots(reference, implementation)).toEqual([
      "probe order: expected hero > footer, received footer > hero",
    ]);
  });

  test("reports pseudo-element, line wrapping, overflow, asset-density, and DPR mismatches", () => {
    const reference = snapshot();
    const implementation = structuredClone(reference);
    implementation.devicePixelRatio = 1;
    const element = implementation.probes[0]!.elements[0]!;
    element.pseudoStyles!.after["border-color"] = "rgb(255, 255, 255)";
    element.layout!.lineCount = 2;
    element.layout!.overflowsX = true;
    element.assetMetadata!.currentSrc = "hero.jpg";
    element.assetMetadata!.naturalWidth = 400;

    expect(compareSourceContractSnapshots(reference, implementation)).toEqual([
      "device pixel ratio: expected 2, received 1",
      'hero[0] ::after border-color: expected "rgb(31, 31, 31)", received "rgb(255, 255, 255)"',
      "hero[0] lineCount: expected 1, received 2",
      "hero[0] overflowsX: expected false, received true",
      "hero[0] currentSrc: expected hero@2x.jpg, received hero.jpg",
      "hero[0] naturalWidth: expected 800, received 400",
    ]);
  });

  test("can opt out of geometry for content-only probes", () => {
    const reference = snapshot();
    const implementation = structuredClone(reference);
    reference.probes[0]!.geometry = false;
    implementation.probes[0]!.geometry = false;
    implementation.probes[0]!.elements[0]!.rect.width = 999;

    expect(compareSourceContractSnapshots(reference, implementation)).toEqual([]);
  });

  test("can compare a route-specific visual shell without forcing source demo copy", () => {
    const reference = snapshot();
    const implementation = structuredClone(reference);
    reference.probes[0]!.content = false;
    implementation.probes[0]!.content = false;
    implementation.probes[0]!.elements[0]!.text = "Kids";
    implementation.probes[0]!.elements[0]!.href = "/collections/kids";
    implementation.probes[0]!.elements[0]!.asset = "kids.jpg";

    expect(compareSourceContractSnapshots(reference, implementation)).toEqual([]);
  });
});
