import { describe, expect, test } from "bun:test";

import {
  buildAdminRecoverySql,
  recoveryConfirmation,
  runAdminPasswordRecovery,
} from "./recover-admin-password";

describe("protected administrator offline password recovery", () => {
  test("targets only the canonical test D1 and never embeds the plain password", async () => {
    const commands: string[][] = [];
    await runAdminPasswordRecovery(
      {
        databaseIdentity: "shoppp-staging",
        email: "Owner@Example.test",
        environment: "test",
        password: "correct horse battery staple",
      },
      async (command) => {
        commands.push([...command]);
        return 0;
      },
    );
    expect(commands[0]).toContain("staging");
    expect(commands[0]).not.toContain("development");
    expect(commands[0]!.join(" ")).not.toContain("correct horse battery staple");
  });

  test("requires exact production confirmation", async () => {
    const base = {
      databaseIdentity: "shoppp-production",
      email: "owner@example.test",
      environment: "production" as const,
      password: "correct horse battery staple",
    };
    await expect(buildAdminRecoverySql(base)).rejects.toThrow(/confirmation/);
    await expect(
      buildAdminRecoverySql({
        ...base,
        confirmation: recoveryConfirmation(base),
      }),
    ).resolves.toContain("iam.password.recover");
  });
});
