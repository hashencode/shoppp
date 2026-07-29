export interface EnvironmentIdentity {
  readonly environment: "development" | "staging" | "production";
  readonly publicOrigin: string;
  readonly resourceNamespace: string;
}

export function assertEnvironmentIsolation(identity: EnvironmentIdentity): void {
  const expected = identity.environment;
  const namespace = identity.resourceNamespace.toLowerCase();
  const origin = new URL(identity.publicOrigin);
  const originText = origin.hostname.toLowerCase();

  if (!namespace.includes(expected)) {
    throw new Error(
      `Environment isolation violation: ${identity.environment} cannot use ${identity.resourceNamespace}.`,
    );
  }
  if (
    identity.environment !== "production" &&
    (namespace.includes("production") || originText.includes("production"))
  ) {
    throw new Error("Environment isolation violation: non-production bindings address production.");
  }
}
