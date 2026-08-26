import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("candidate evidence operating contract", () => {
  test("documents GitHub-independent verification and the required single-domain command", async () => {
    const runbook = await readFile(resolve(import.meta.dir, "../docs/runbooks/release.md"), "utf8");
    const reference = await readFile(
      resolve(import.meta.dir, "../docs/reference/candidate-evidence-bundle.md"),
      "utf8",
    );
    expect(runbook).toContain("--capsule-receipt");
    expect(runbook).toContain("intel:intel-append-only:intel-jenkins");
    expect(runbook).toMatch(/one declared.*verified retention target/is);
    expect(runbook).toMatch(/second.*recommended.*not required/is);
    expect(reference).toMatch(/needs local bytes.*GitHub metadata/s);
    expect(reference).toMatch(/offline Ed25519 root.*short-lived signer/s);
    expect(reference).toMatch(/one successfully written and read-back-verified target/s);
  });
});
