import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const appPath = resolve(import.meta.dir, "../apps/api/src/http/app.ts");
const matrixTestPath = resolve(import.meta.dir, "../apps/api/test/http/app.test.ts");

describe("admin route permission matrix", () => {
  test("registers every declared admin route or explicit authentication-only exception", async () => {
    const [appSource, matrixSource] = await Promise.all([
      readFile(appPath, "utf8"),
      readFile(matrixTestPath, "utf8"),
    ]);
    const declared = [
      ...appSource.matchAll(/app\.(get|post|put|patch|delete)\(\s*"(\/admin\/[^"]+)"/g),
    ]
      .map(([, method, path]) => `${method!.toUpperCase()} ${path!}`)
      .sort();
    const permissioned = [
      ...matrixSource.matchAll(
        /\{\s*method:\s*"(GET|PATCH|POST|PUT)",\s*path:\s*"(\/admin\/[^"]+)",\s*permission:/g,
      ),
    ].map(([, method, path]) => `${method} ${path}`);
    const authenticationOnly = [
      "GET /admin/session",
      "POST /admin/auth/password/change",
      "POST /admin/onboarding",
    ];
    const publicAuthentication = [
      "POST /admin/auth/activate",
      "POST /admin/auth/login",
      "POST /admin/auth/logout",
      "POST /admin/auth/password-reset/confirm",
      "POST /admin/auth/password-reset/request",
    ];

    expect([...permissioned, ...authenticationOnly, ...publicAuthentication].sort()).toEqual(
      declared,
    );
  });
});
