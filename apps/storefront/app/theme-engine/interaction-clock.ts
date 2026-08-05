export type InteractionClockHandle = number;

export interface InteractionClock {
  clearTimeout(handle: InteractionClockHandle): void;
  now(): number;
  setTimeout(callback: () => void, delayMs: number): InteractionClockHandle;
}

export const browserInteractionClock: InteractionClock = {
  clearTimeout(handle) {
    globalThis.clearTimeout(handle);
  },
  now() {
    return globalThis.performance?.now() ?? Date.now();
  },
  setTimeout(callback, delayMs) {
    return globalThis.setTimeout(callback, Math.max(0, delayMs)) as unknown as number;
  },
};

interface ManualTask {
  callback: () => void;
  dueAt: number;
  id: number;
}

export class ManualInteractionClock implements InteractionClock {
  private currentTime = 0;
  private nextId = 1;
  private readonly tasks = new Map<number, ManualTask>();

  advanceBy(durationMs: number): void {
    if (durationMs < 0) throw new Error("ManualInteractionClock cannot move backwards.");
    const targetTime = this.currentTime + durationMs;

    while (true) {
      const nextTask = [...this.tasks.values()]
        .filter(({ dueAt }) => dueAt <= targetTime)
        .sort((left, right) => left.dueAt - right.dueAt || left.id - right.id)[0];
      if (!nextTask) break;
      this.currentTime = nextTask.dueAt;
      this.tasks.delete(nextTask.id);
      nextTask.callback();
    }

    this.currentTime = targetTime;
  }

  clearTimeout(handle: InteractionClockHandle): void {
    this.tasks.delete(handle);
  }

  now(): number {
    return this.currentTime;
  }

  pendingCount(): number {
    return this.tasks.size;
  }

  setTimeout(callback: () => void, delayMs: number): InteractionClockHandle {
    const id = this.nextId++;
    this.tasks.set(id, {
      callback,
      dueAt: this.currentTime + Math.max(0, delayMs),
      id,
    });
    return id;
  }
}
