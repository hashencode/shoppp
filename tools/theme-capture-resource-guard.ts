import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { cpus, freemem, loadavg, totalmem } from "node:os";
import { join } from "node:path";

const guardRoot = "/tmp/shoppp-theme-capture-guard";
const maximumWorkers = 2;
const incompleteLeaseGraceMs = 30_000;

interface CaptureLease {
  preflight: CapturePreflight;
  release(): Promise<void>;
}

export interface CapturePreflight {
  activeLeases: number;
  browserProcesses: string[];
  capturedAt: string;
  cpuCount: number;
  freeMemoryBytes: number;
  loadAverage: [number, number, number];
  origins: Array<{ ok: boolean; status?: number; url: string }>;
  requestedWorkers: number;
  taskCaptureProcesses: string[];
  totalMemoryBytes: number;
}

async function processLines(pattern: RegExp): Promise<string[]> {
  const child = Bun.spawn(["ps", "-axo", "pid=,ppid=,%cpu=,%mem=,etime=,command="], {
    stderr: "ignore",
    stdout: "pipe",
  });
  const output = await new Response(child.stdout).text();
  await child.exited;
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => pattern.test(line));
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function clearStaleLease(slot: string): Promise<void> {
  try {
    const pid = Number(await readFile(join(slot, "pid"), "utf8"));
    if (Number.isInteger(pid) && pid > 0) {
      if (processIsAlive(pid)) return;
      await rm(slot, { force: true, recursive: true });
      return;
    }
  } catch {
    // A competing process can observe the directory between mkdir and the PID write.
  }

  const leaseInfo = await stat(slot).catch(() => null);
  if (!leaseInfo || Date.now() - leaseInfo.mtimeMs < incompleteLeaseGraceMs) return;
  await rm(slot, { force: true, recursive: true });
}

async function inspectOrigin(url: string): Promise<{ ok: boolean; status?: number; url: string }> {
  try {
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(5_000) });
    return {
      ok: response.ok || (response.status >= 300 && response.status < 400),
      status: response.status,
      url,
    };
  } catch {
    return { ok: false, url };
  }
}

export async function acquireCaptureLease(options: {
  origins: string[];
  outputRoot: string;
  requestedWorkers?: number;
}): Promise<CaptureLease> {
  const requestedWorkers = options.requestedWorkers ?? 1;
  if (
    !Number.isInteger(requestedWorkers) ||
    requestedWorkers < 1 ||
    requestedWorkers > maximumWorkers
  )
    throw new Error(`Capture worker request must be between 1 and ${maximumWorkers}.`);
  await mkdir(guardRoot, { recursive: true });
  for (let index = 0; index < maximumWorkers; index += 1)
    await clearStaleLease(join(guardRoot, `slot-${index}`));

  const occupiedSlots: string[] = [];
  try {
    for (let worker = 0; worker < requestedWorkers; worker += 1) {
      let acquired: string | undefined;
      for (let index = 0; index < maximumWorkers; index += 1) {
        const slot = join(guardRoot, `slot-${index}`);
        try {
          await mkdir(slot);
          await writeFile(join(slot, "pid"), `${process.pid}\n`);
          acquired = slot;
          break;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        }
      }
      if (!acquired)
        throw new Error(
          `Capture concurrency limit reached: at most ${maximumWorkers} browser/capture workers are allowed.`,
        );
      occupiedSlots.push(acquired);
    }

    const [browserProcesses, taskCaptureProcesses, origins] = await Promise.all([
      processLines(/playwright_chromiumdev_profile|ms-playwright.*Chrom(e|ium)/i),
      processLines(/capture-(theme-named-states|storefront-theme-reference)/),
      Promise.all(options.origins.map(inspectOrigin)),
    ]);
    const preflight: CapturePreflight = {
      activeLeases: occupiedSlots.length,
      browserProcesses,
      capturedAt: new Date().toISOString(),
      cpuCount: cpus().length,
      freeMemoryBytes: freemem(),
      loadAverage: loadavg() as [number, number, number],
      origins,
      requestedWorkers,
      taskCaptureProcesses,
      totalMemoryBytes: totalmem(),
    };
    if (origins.some((origin) => !origin.ok))
      throw new Error(
        `Capture preflight failed: unavailable origin(s): ${origins
          .filter((origin) => !origin.ok)
          .map((origin) => origin.url)
          .join(", ")}`,
      );
    await mkdir(options.outputRoot, { recursive: true });
    await writeFile(
      join(options.outputRoot, "preflight.json"),
      `${JSON.stringify(preflight, null, 2)}\n`,
    );

    let released = false;
    const release = async (): Promise<void> => {
      if (released) return;
      released = true;
      process.off("SIGINT", onInterrupt);
      process.off("SIGTERM", onTerminate);
      await Promise.all(occupiedSlots.map((slot) => rm(slot, { force: true, recursive: true })));
    };
    const onInterrupt = (): void => {
      void release().finally(() => process.exit(130));
    };
    const onTerminate = (): void => {
      void release().finally(() => process.exit(143));
    };
    process.once("SIGINT", onInterrupt);
    process.once("SIGTERM", onTerminate);
    return { preflight, release };
  } catch (error) {
    await Promise.all(occupiedSlots.map((slot) => rm(slot, { force: true, recursive: true })));
    throw error;
  }
}
