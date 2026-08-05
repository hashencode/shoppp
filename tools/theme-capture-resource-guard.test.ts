import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acquireCaptureLease, clearStaleLease } from "./theme-capture-resource-guard";

async function exists(path: string): Promise<boolean> {
  return Boolean(await stat(path).catch(() => null));
}

test("preserves a newly created lease until its PID write can complete", async () => {
  const root = await mkdtemp(join(tmpdir(), "shoppp-capture-guard-"));
  const slot = join(root, "slot-0");
  try {
    await mkdir(slot);
    await clearStaleLease(slot);
    expect(await exists(slot)).toBe(true);

    const staleTime = new Date(Date.now() - 31_000);
    await utimes(slot, staleTime, staleTime);
    await clearStaleLease(slot);
    expect(await exists(slot)).toBe(false);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("keeps a live lease and removes a terminated owner", async () => {
  const root = await mkdtemp(join(tmpdir(), "shoppp-capture-guard-"));
  const liveSlot = join(root, "slot-live");
  const deadSlot = join(root, "slot-dead");
  try {
    await mkdir(liveSlot);
    await writeFile(join(liveSlot, "pid"), `${process.pid}\n`);
    await clearStaleLease(liveSlot);
    expect(await exists(liveSlot)).toBe(true);

    await mkdir(deadSlot);
    await writeFile(join(deadSlot, "pid"), "999999999\n");
    await clearStaleLease(deadSlot);
    expect(await exists(deadSlot)).toBe(false);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("enforces the two-worker cap and makes released slots reusable", async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), "shoppp-capture-output-"));
  const firstLease = await acquireCaptureLease({ origins: [], outputRoot, requestedWorkers: 1 });
  try {
    await expect(
      acquireCaptureLease({ origins: [], outputRoot, requestedWorkers: 2 }),
    ).rejects.toThrow("at most 2 browser/capture workers");
  } finally {
    await firstLease.release();
  }

  const fullLease = await acquireCaptureLease({ origins: [], outputRoot, requestedWorkers: 2 });
  try {
    expect(fullLease.preflight.requestedWorkers).toBe(2);
    expect(fullLease.preflight.activeLeases).toBe(2);
  } finally {
    await fullLease.release();
    await rm(outputRoot, { force: true, recursive: true });
  }
});

test("rejects an invalid worker request before acquiring a slot", async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), "shoppp-capture-output-"));
  try {
    await expect(
      acquireCaptureLease({ origins: [], outputRoot, requestedWorkers: 3 }),
    ).rejects.toThrow("between 1 and 2");
  } finally {
    await rm(outputRoot, { force: true, recursive: true });
  }
});
