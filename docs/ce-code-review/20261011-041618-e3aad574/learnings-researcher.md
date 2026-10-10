## Institutional Learnings Search Results

### Search Context

- **Feature/Task**: Review U7 formal storefront publication against existing institutional knowledge: protected exact-byte delivery, environment isolation, retained recovery, truthful online observation and preservation of storefront behavior.
- **Keywords Used**: release, publication, workflow, deploy, resilience, rollback, artifact, source, runtime, recovery, fail-closed, source-parity, interaction.
- **Files Scanned**: 2 solution files in the live `docs/solutions/workflow-issues/` tree; both matched the frontmatter pre-filter and broader content search and were read fully. No declared packs. Root `CONCEPTS.md` and `docs/solutions/patterns/critical-patterns.md` are absent.
- **Relevant Matches**: 2 files: one direct and one adjacent.

### Relevant Learnings

#### 1. Operating GitHub-first release resilience for a solo-maintained product

- **File**: `docs/solutions/workflow-issues/github-first-release-resilience-for-solo-maintainers-2026-08-28.md`
- **Module**: github-first-release-delivery
- **Problem Type**: workflow_issue
- **Relevance**: Direct Known Pattern for delivery risk division 4 and its producer/runtime/Commerce/Admin boundaries. The historical lesson distinguishes local development evidence from fresh protected hosted release evidence and requires retained recovery before mutation. Current changed workflow code visibly follows the baseline ordering: `.github/workflows/deploy.yml:1086` says `- name: Preserve exact storefront baseline before mutation`, before delivery at line 1094; production repeats that ordering at lines 1194 and 1202. `tools/release-validate.ts:753` checks `assert(attestation.github.runId === options.runId, "validation attestation run ID mismatch");`, with attempt and artifact-map binding immediately following. These are supporting evidence, not proof that hosted jobs ran. No specific defect is established by this learning.
- **Key Insight**: Missing or unavailable artifacts and provider authority must stop release; local success cannot substitute. Retain the original baseline and reconcile uncertain outcomes rather than assuming restoration. Current code writes the baseline exclusively with `{ flag: "wx" }` at `tools/storefront-publication.ts:305`, rechecks it before delivery at line 744, distinguishes lost activation responses at lines 471–501, and reports `restorationVerified` at lines 533–542. Fresh runtime observation remains separate from historical success: `apps/api/src/publishing/storefront-publications.ts:156–162` compares environment, approved identity and actual Worker version, while the panel's line 153 requires verified state and a receipt for Online. The 2026-10-11 verification document explicitly limits its evidence to local implementation and tests.
- **Severity**: high

The 2026-08-28 entry predates U7. Its fresh-run rule should not be misread as forbidding the deliberately governed retained-version rollback: current architecture explicitly permits a new authorized request using an existing successful receipt and saved Worker version (`docs/architecture/storefront-publication.md:37`), and `tools/storefront-publication.ts:401–444` restores that exact version without compilation. Likewise, the old recovery-drill description includes Worker/D1 baseline capture; current storefront rollback intentionally leaves D1 transactions and migrations in place. The current architecture governs those distinctions.

#### 2. Preventing behavioral gaps in source-equivalent HTML reconstruction

- **File**: `docs/solutions/workflow-issues/html-source-parity-reconstruction-workflow-2026-08-06.md`
- **Module**: storefront-html-source-parity
- **Problem Type**: workflow_issue
- **Relevance**: Adjacent Known Pattern for public compiler/runtime division 3 and Commerce consumers in division 5. Publication changes the renderer's public/live branch, so generated modules and static markup alone do not prove working cart, checkout, search or runtime product revalidation. Current code retains live Commerce provision at `apps/storefront/app/StorefrontExperience.vue:111–121`, including `provide(runtimeCommercePortKey, runtimeCommercePort);` at line 114, and has a dedicated public SEO branch at line 254. `apps/storefront/tests/storefront-publication.test.ts:222` covers compiled release/digest binding; lines 260 and 316 cover exact raw Catalog and actual runtime Worker identity. No behavioral regression is directly observed here.
- **Key Insight**: Preserve complete stateful capability chains and verify observable outcomes; presence and source similarity are only supporting evidence. Public delivery must not inherit private-preview rendering or fixture behavior. The current publication tests distinguish approved live inputs, compilation, public prerender, marker corruption and missing runtime identity. The verification report also records an actual build/static check and native Admin browser interactions. This historical reconstruction lesson does not require rebuilding a behavior ledger for completed U1–U6, expanding the frozen template matrix, or imposing source-copy restrictions on a newly authorized Admin publication surface.
- **Severity**: high

### Recommendations

- Carry the release-resilience entry into synthesis as Known Pattern context for same-run artifacts, protected approvals, original baseline retention, receipt-loss reconciliation and unresolved recovery. A workflow definition or local fixture remains development evidence; hosted operation and DC/PG evidence stay with their existing owners.
- Evaluate exact rollback against the current storefront-publication architecture rather than treating the older general recovery guidance as a prohibition on retained successful receipts or a requirement to roll back D1.
- Carry the reconstruction entry only as adjacent context for preserving live storefront capability chains through the public build branch. Keep acceptance outcome-based and confined to U7's affected behavior and explicit template scope.

No actionable defect was independently established by this institutional-knowledge search. No pack violations exist because no packs were declared. This result is review context, not a substitute for the specialized authorization, D1/CAS, compiler, workflow, Commerce and Admin reviews. Existing green gates were not rerun, and no hosted or external actions were performed.
