import { expect, test } from "@playwright/test";
import { accessHeaders, requiredEnvironment } from "./support";

test("AE4/AE7: forged returns fail closed and an exhausted notification replays idempotently", async ({
  page,
  request,
}) => {
  await page.goto("/checkout/complete?session_id=forged-release-proof");
  await expect(page.getByText(/return URL cannot confirm payment/i)).toBeVisible();

  const api = requiredEnvironment("API_E2E_BASE_URL");
  const jobId = requiredEnvironment("E2E_EXHAUSTED_NOTIFICATION_ID");
  const headers = {
    ...accessHeaders(),
    "Content-Type": "application/json",
    "Idempotency-Key": `release-replay-${jobId}`,
  };
  const body = { confirm: true, reason: "Release recovery proof" };
  const first = await request.post(`${api}/admin/operations/jobs/${jobId}/replay`, {
    headers,
    data: body,
  });
  const second = await request.post(`${api}/admin/operations/jobs/${jobId}/replay`, {
    headers,
    data: body,
  });
  expect(first.ok()).toBeTruthy();
  expect(second.status()).toBe(first.status());
  expect(await second.text()).toBe(await first.text());
});

test("unsigned webhook retries are rejected without exposing provider data", async ({
  request,
}) => {
  const api = requiredEnvironment("API_E2E_BASE_URL");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await request.post(`${api}/webhooks/stripe`, {
      data: { id: "unsigned-release-proof" },
    });
    expect(response.status()).toBe(400);
    expect(await response.text()).not.toMatch(/secret|token|card/i);
  }
});
