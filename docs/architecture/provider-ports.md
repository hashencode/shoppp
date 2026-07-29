# Provider Ports

External services are translated at narrow server-only boundaries. Domain and transport contracts
never import a provider SDK or expose provider credentials to either browser application.

| Capability                | Port                                                    | Launch adapter                          | Stable authority and replacement rule                                                                                                                                                                                                            |
| ------------------------- | ------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hosted payment and refund | `PaymentProvider` in `apps/api/src/payments/port.ts`    | `StripePaymentProvider`                 | The port exposes hosted-session creation, signed event verification, provider-truth retrieval, and refunds. A replacement must preserve idempotency, raw-signature verification, approved-for-fulfillment mapping, and reconciliation semantics. |
| Transactional email       | `EmailProvider` in `apps/api/src/notifications/port.ts` | HTTP email adapter                      | The adapter receives a rendered snapshot plus a business idempotency key. Provider IDs and retryable/permanent errors are translated into append-only attempts.                                                                                  |
| Tax                       | `TaxPort` in `apps/api/src/pricing/tax.ts`              | Configured zero-tax launch mode         | Currency-safe integer quotes are authoritative. Enabling a real tax provider requires an approved market policy and must not move tax arithmetic into the browser.                                                                               |
| Storefront build          | `BuildTrigger` in `apps/api/src/publishing/releases.ts` | Authenticated Workers build hook        | The trigger returns a correlation ID. The build reads an immutable release and reports one authenticated terminal result.                                                                                                                        |
| Product media             | R2/Images boundary in `apps/api/src/media/uploads.ts`   | Cloudflare R2 plus public Images origin | Upload validates prefix, type, size, and metadata before writing. Public manifests contain delivery URLs, never storage credentials.                                                                                                             |
| Durable automation        | Queue payload and Workflow bindings                     | Cloudflare Queues and Workflows         | Payloads carry stable IDs only. D1 owns deduplication, attempts, exhaustion, and replay state.                                                                                                                                                   |

Provider secrets are Worker secrets. Environment-specific credentials, origins, webhook endpoints,
queues, and buckets are checked by `tools/verify-environment-isolation.ts`. Adding a provider
requires contract tests against the port and must retain the existing domain invariants and
runbooks.
