import { describe, expect, test } from "bun:test";
import { buildServiceProvisionSql, runServiceProvision } from "./provision-admin-service";

describe("administrator service credential provisioning", () => {
  test("hashes the token and targets only the test D1", async () => {
    const commands: string[][] = [];
    await runServiceProvision(
      {
        databaseIdentity: "shoppp-staging",
        environment: "test",
        name: "Release automation",
        subject: "release-automation",
        token: "a-random-service-token-that-is-long-enough",
      },
      async (command) => {
        commands.push([...command]);
        return 0;
      },
    );
    expect(commands[0]).toContain("staging");
    expect(commands[0]!.join(" ")).not.toContain("a-random-service-token-that-is-long-enough");
  });

  test("rejects an unconfirmed production target", async () => {
    await expect(
      buildServiceProvisionSql({
        databaseIdentity: "shoppp-production",
        environment: "production",
        name: "Release automation",
        subject: "release-automation",
        token: "a-random-service-token-that-is-long-enough",
      }),
    ).rejects.toThrow(/confirmation/);
  });
});
