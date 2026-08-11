import type { ThemeBehaviorAdapter } from "../../../e2e/support/theme-behavior-runner";

// U1 freezes the executable ledger. Capability-specific runners are attached as each production
// region lands; rows currently use the shared observable action vocabulary and need no override.
export const decorStoreAcceptanceAdapters = {} as const satisfies Readonly<
  Record<string, ThemeBehaviorAdapter>
>;
