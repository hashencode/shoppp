# Capacity Envelope and Exit Signals

D1 is the P0 relational authority, not an unlimited default. Launch approval requires the
representative catalog size and agreed peak concurrency to be tested in staging and recorded with
the release.

## Launch envelope

| Signal                    | Gate                                                                           | Evidence                                                 |
| ------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------- |
| Static catalog            | At least 1,000 products and 5,000 variants                                     | Generated route manifest and release fixture record      |
| Static generation         | Target under 10 minutes; 15 minutes is a release failure                       | `release:validate` gate duration and workflow log        |
| Catalog/cart read latency | Staging p95 at or below 500 ms                                                 | `bun run test:staging-latency`                           |
| Checkout mutation latency | Staging p95 at or below 800 ms, excluding hosted provider time                 | `bun run test:staging-latency`                           |
| Inventory correctness     | No oversell at agreed last-unit concurrency                                    | Worker/D1 concurrency suite plus staging purchase race   |
| D1 integrity              | Zero foreign-key violations, inventory imbalance, or order arithmetic mismatch | Backup/restore reconciliation suite                      |
| D1 size                   | Operating forecast remains comfortably below the 10 GB database limit          | Cloudflare D1 size metric captured in the release ticket |
| Field experience          | p75 LCP <= 2.5 s, INP <= 200 ms, CLS <= 0.1                                    | Post-launch field dashboard                              |

## Exit signals

Capacity work is mandatory when any of these signals is sustained or repeats during a release:

- indexed short writes still produce D1 overload/queueing or checkout p95 exceeds the gate;
- one or a small set of SKUs dominates reservation contention;
- database growth puts the 10 GB limit inside the approved operating horizon;
- reporting/export queries compete with checkout writes;
- full catalog generation exceeds 15 minutes or freshness exceeds the approved publication SLO;
- queue, webhook, or payment reconciliation lag crosses the alert threshold.

## Prescribed moves

Do not silently raise a budget. Isolate reporting/export workloads first. Introduce a per-SKU
SQLite Durable Object only for measured hot-key serialization. Partition or migrate relational
authority only with a rehearsed dual-read/write and rollback plan. Move from full static generation
to partial or cached on-demand rendering only after the measured publication limit is crossed.

The infrastructure owner records the D1 size, write-overload count, latency samples, generation
duration, queue lag, representative load, and chosen action in every staging release ticket.
