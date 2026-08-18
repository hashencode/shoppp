import type { ComposeExperienceRouteInput } from "../composer";
import { createLivePresentationProvider } from "./live";
import type { PresentationProvider } from "./types";

export function selectPresentationProvider(input: {
  fixtureProvider: PresentationProvider;
  liveInput?: ComposeExperienceRouteInput;
  mode: "fixture-preview" | "live" | "production";
}): PresentationProvider | undefined {
  if (input.mode !== "live") return input.fixtureProvider;
  return input.liveInput ? createLivePresentationProvider(input.liveInput) : undefined;
}

export function selectLivePort<T>(mode: "fixture-preview" | "live" | "production", port: T) {
  return mode === "live" ? port : undefined;
}
