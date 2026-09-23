import type { PresentationProvider } from "./types";

export function selectPresentationProvider(input: {
  fixtureProvider: PresentationProvider;
  liveProvider?: PresentationProvider;
  mode: "fixture-preview" | "live" | "production";
}): PresentationProvider | undefined {
  if (input.mode !== "live") return input.fixtureProvider;
  return input.liveProvider;
}

export function selectLivePort<T>(mode: "fixture-preview" | "live" | "production", port: T) {
  return mode === "live" ? port : undefined;
}
