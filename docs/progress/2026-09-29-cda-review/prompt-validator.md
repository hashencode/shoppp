# Validator Batch Prompt Template

Use one fresh validator subagent for one batch of already-merged findings. Eight findings is the normal cap. When more than eight P0/P1 findings survive, expand that same batch to include every surviving P0/P1; never omit a blocker or split the work into another batch. The validator is independent of the originating reviewers and the orchestrator. Fill `/Users/studio/Documents/GitHub/shoppp/docs/progress/2026-09-29-cda-review` with the review's run directory; the orchestrator waits on the verdicts file there, so the file, not the in-band return, is the contract.

```
You are the independent validation gate for the code-review findings below. Evaluate every finding separately under fresh inspection and under the shared protected-subject policy below. Outside a protected subject, false positives are common; reject a finding when the cited code does not prove it, it predates and is unaffected by this diff, surrounding code handles it, or it is only an unsupported preference. Inside a protected subject, a rejection requires one of the evidence forms the policy names.

Do not let one finding's outcome influence another. Do not invent new findings.

<findings-to-validate>
[{"#": 1, "autofix_class": "manual", "confidence": 75, "evidence": ["apps/api/src/analytics/service.ts:60:     (SELECT rowid FROM traffic_event_dedup WHERE expires_at <= ? ORDER BY expires_at LIMIT 500)`,", "apps/api/src/index.ts:31 calls cleanupTraffic once per non-backup scheduled invocation; apps/api/wrangler.jsonc:32 configures that invocation every five minutes.", "apps/api/src/analytics/protection.ts keys quotas separately by source and visitor; no global ingestion ceiling restricts all traffic to the cleaner's 100 records/minute capacity.", "apps/api/src/analytics/service.ts:52 sets expires_at to now + two hours, while migration 0039 retains visitor_digest, product_id and release_id on each dedup row until deletion.", "apps/api/test/analytics/traffic.test.ts:317-330 verifies only that one cleanup leaves one of 501 expired rows; it does not exercise scheduled backlog continuation. docs/progress/2026-09-29-cda-runtime-setup.md:17 describes retry records as lasting two hours.", "docs/plans/2026-09-29-2128-feat-commerce-dashboard-analytics-plan.md:125 KTD6 requires short-term idempotency and no long-lived per-visit logs; line 150 delegates cleanup to bounded maintenance batches. The capacity claim preserves this design and questions its drain rate, not the settled long-lived aggregate policy. Production incidence was not measured."], "file": "apps/api/src/analytics/service.ts", "first_evidence": "apps/api/src/analytics/service.ts:60:     (SELECT rowid FROM traffic_event_dedup WHERE expires_at <= ? ORDER BY expires_at LIMIT 500)`,", "independent_reviewers": ["adversarial"], "line": 60, "owner": "downstream-resolver", "pre_existing": false, "requires_verification": true, "reviewers": ["adversarial"], "severity": "P2", "suggested_fix": "Keep bounded deletion batches, but drain or enqueue continuation while expired rows remain, using a bounded execution budget and a continuation mechanism when that budget is exhausted. Add a focused scheduler/cleanup test with several batches proving backlog progress exceeds supported ingestion and aggregates remain intact.", "title": "Sustained traffic outpaces retry-record expiry cleanup", "why_it_matters": "The collector accepts traffic independently across source and visitor quotas, but the scheduler removes only 500 expired events every five minutes. At 200 accepted page entries per minute (for example 200 independent visitors each opening one page), 1,000 records expire between runs while only 500 are removed. The expired backlog grows by 500 each cycle, retaining event-level visitor/product/release associations far beyond the documented two-hour retry window and eventually consuming database capacity. The deliberate per-query batch bound is reasonable, but there is no continuation or draining mechanism to keep retention bounded."}, {"#": 2, "autofix_class": "gated_auto", "confidence": 75, "evidence": ["apps/storefront/app/utils/traffic.ts:42-48: const result = await request(\"/api/platform/traffic/events\", {\n            method: \"POST\",\n            credentials: \"same-origin\",\n            keepalive: true,\n            headers: { \"Content-Type\": \"application/json\" },\n            body,\n          });", "apps/storefront/app/utils/traffic.ts:64: pending = pending.then(() => send(route, productId));", "apps/storefront/app/utils/traffic.ts:15-22: identity fetch and response.json() are awaited without an AbortSignal or deadline.", "apps/storefront/app/plugins/traffic.client.ts:11: navigator.locks ? navigator.locks.request(\"shoppp-traffic-identity\", operation) : operation(),"], "file": "apps/storefront/app/utils/traffic.ts", "first_evidence": "apps/storefront/app/utils/traffic.ts:42-48: const result = await request(\"/api/platform/traffic/events\", {\n            method: \"POST\",\n            credentials: \"same-origin\",\n            keepalive: true,\n            headers: { \"Content-Type\": \"application/json\" },\n            body,\n          });", "independent_reviewers": ["reliability"], "line": 42, "owner": "downstream-resolver", "pre_existing": false, "requires_verification": true, "reviewers": ["reliability"], "severity": "P2", "suggested_fix": "Give identity acquisition (including JSON body consumption) and each event attempt a finite AbortController deadline, clearing the timer in finally. A 10-second deadline is a defensible default for optional analytics. Let the existing catches release the queue and Web Lock after timeout, preserve the identical event ID/body for the existing bounded retry, and add a focused stalled-request test proving later visits can proceed.", "title": "Bound traffic requests so one stall cannot stop collection", "why_it_matters": "Integration point without a timeout: both identity and event requests use native fetch without a deadline, while every subsequent route entry waits on the same pending promise. If an identity response, response body, or event response stalls, the affected tab stops collecting every later route entry until that request eventually settles. An identity stall additionally holds the cross-tab Web Lock supplied by the plugin, preventing other tabs from initializing traffic. Shopping remains usable, so this loss is silent in the dashboard rather than a visible page failure."}]
</findings-to-validate>

<diff>
/Users/studio/Documents/GitHub/shoppp/docs/progress/2026-09-29-cda-review/full.diff
</diff>

<scope-context>
{"mode": "standalone", "base": "05d0fe68^", "diff_a": "0b24241dd6e023a62d8a399a067b38e952659808", "diff_b": null, "pr": {"number": null, "url": null, "title": null, "body": null, "base_ref_name": null, "head_ref_oid": null, "head_ref": null, "base_ref": null, "has_prior_comments": false}, "branch": "codex/fix-new-arrival-icon", "head_sha": "05d0fe68f710f3c1578f76c02bee2c0f3e9fce28", "files": "/Users/studio/Documents/GitHub/shoppp/docs/progress/2026-09-29-cda-review/files.txt", "diff": "/Users/studio/Documents/GitHub/shoppp/docs/progress/2026-09-29-cda-review/full.diff", "tree_is_reviewed_head": true, "untracked_excluded": []}
</scope-context>

<protected-subject-policy>
Return status "confirmed", "rejected", or "unresolved". Never use lack of disproof as evidence of confirmation.

Set protected_subject to the best-fitting key below, or JSON null when none applies:
- memory-safety: allocation sizes, buffer lengths, index bounds, use-after-free, invalid memory access, or null dereferences.
- concurrency: locks, atomics, data races, ordering, or synchronization whose failure can affect observable behavior.
- data-loss: destructive writes, deletes, truncation, overwrite-in-place, or irreversible migrations and backfills.
- authorization-authentication: identity, permissions, ownership, session/token handling, or privilege boundaries.
- injection: attacker-influenced or untrusted data that can alter SQL, commands, templates, paths, or markup across a trust boundary, including stored input. Text assembly alone is not proof.
- public-contract: an evidenced compatibility concern involving an externally consumed response field, status code, error path, default, message, or published signature. An internal export or intentional contract change alone is not a defect.
- secrets-exposure: hardcoded credentials, API keys, tokens, or private keys in source or configuration; credentials, session tokens, or personal data written to logs, error messages, URLs, or responses; secrets committed to a repository or shipped in a built artifact.
- cryptography: weak or broken algorithms and modes, a fast general-purpose hash used for passwords, static or predictable keys, salts, or IVs, disabled certificate or signature verification, insufficient randomness, or a misused primitive whose failure breaks a security guarantee.

For every subject, confirm only when inspected evidence establishes the issue, the diff introduces or newly exposes it, and surrounding code or applicable runtime guarantees do not prevent it.

A finding that is real in the code may still describe a state that never occurs. For every finding, name the precondition the defect needs (the input, data shape, or ordering) and say what would show it occurs or is reachable: a test, a query against available data, a caller that produces it. When that evidence is in reach with the budget, obtain it; when it is not, confirm on the code alone and state in `reason` that incidence was not measured. Unmeasured incidence does not lower confidence or block confirmation; it is what the reader needs to weigh the severity.

Treat a finding as protected when the actual failure it alleges falls within a subject above. Read its category, title, and body together; keywords only prompt inspection and never establish protection. A naming preference about a token helper is not a token-handling defect. Your classification cannot remove protection established by the claim; the consumer applies this test independently.

On a protected subject, reject only by citing specific evidence that refutes the claim or establishes that it is unrelated pre-existing behavior: quote the file and line number that refutes it, name the version-specific or configuration-specific documentation and the version in force, give short-hash provenance, or cite a discriminating test result. Test evidence must identify the reviewed revision, engine/runtime version, configuration, exercised trigger, assertion, and observed result, and explain why it disproves the exact claim. A general passing suite or a test that did not exercise the alleged trigger is not disproof. An assumed framework guarantee is not evidence. Without one of these evidence forms, return status "unresolved", not "rejected". Inspect existing test evidence or use a read-only reproduction within your authority; do not mutate files or application state to obtain it.

If a protected claim remains uncertain, return status "unresolved" and state the missing evidence. Low confidence alone does not justify rejecting or confirming it.

Outside protected subjects, keep the ordinary conservative evidence bar: after inspection, reject an unsupported claim and explain why. Missing required inspection is different from inspected-but-unsupported evidence. If the cited file or required context cannot be accessed, return status "unresolved" for any subject, state the access limit, and do not guess.

Classify the claim itself, not its title. Never raise severity or confidence to preserve it. Do not invent findings or propose that uncertainty is a confirmed defect.
</protected-subject-policy>

For local-aligned scope, inspect the cited files, callers, guards, project contracts, and targeted history with read-only tools. For pr-remote or branch-remote scope, use the provided diff and reviewed head ref, never the unrelated workspace copy.

Budget: the batch has 15 minutes of wall clock and about five tool calls per finding. Inspect findings in the order given. When the budget runs out, stop inspecting and give every remaining finding `"status": "unresolved"` with the reason `budget exhausted, uninspected`; never guess a verdict you did not inspect.

Write the JSON object below to `/Users/studio/Documents/GitHub/shoppp/docs/progress/2026-09-29-cda-review/validator-verdicts.json` before you return, then return the same object:
{
  "verdicts": [
    {
      "#": <input stable number>,
      "status": "confirmed" | "rejected" | "unresolved",
      "protected_subject": "<one of the eight policy keys>" | null,
      "reason": "<one sentence grounded in inspected evidence, or naming the evidence you could not obtain>"
    }
  ]
}

Each entry carries exactly those four fields. Return one verdict for every input # exactly once; unknown, duplicate, or missing numbers and invalid status or subject values are malformed output. Do not emit the legacy `validated` boolean. No prose outside JSON. Writing the verdicts file above is the one permitted write; do not edit project files, commit, push, or otherwise mutate the checkout.
```
