You are the independent validation gate for the code-review findings below. Evaluate every finding separately under fresh inspection and under the shared protected-subject policy below. Outside a protected subject, false positives are common; reject a finding when the cited code does not prove it, it predates and is unaffected by this diff, surrounding code handles it, or it is only an unsupported preference. Inside a protected subject, a rejection requires one of the evidence forms the policy names.

Do not let one finding's outcome influence another. Do not invent new findings.

<findings-to-validate>
[
  {
    "#": 1,
    "autofix_class": "manual",
    "confidence": 100,
    "evidence": [
      ".github/workflows/deploy.yml:1111 -- --proof-command 'bunx playwright test --config e2e/playwright.config.ts && bun tools/verify-release-staging-latency.ts'",
      "tools/verify-release-staging-latency.ts:76-84 requires CI_GH_STAGING_REHEARSAL === \"true\", CI_GH_PRODUCTION_PROMOTION === \"false\" and CI_GH_VALIDATED_SOURCE_SHA; its CLI calls assertReleaseStagingLatencyAuthority at line 244 before runReleaseStagingLatencyProbe.",
      ".github/workflows/deploy.yml:94-101 requires REHEARSE_STAGING_ROLLBACK to be false for every formal publication, and publication-staging at 1026-1040/1095-1106 provides no CI_GH authority variables. The only CI_GH variables belong to the separate old prove-staging job at 386-388.",
      "Non-mutating reproduction: importing assertReleaseStagingLatencyAuthority and calling it with GitHub Actions=true, repository=hashencode/shoppp, workflow_dispatch, the protected deploy.yml@refs/heads/main workflow ref and reviewed SHA, but the publication job's absent CI_GH variables, throws \"CI-GH staging rollback rehearsal must be enabled\" before network I/O.",
      "tools/storefront-publication.ts:806-852 places this command between actual version deployment/observation and the activation callback, so its deterministic rejection invokes baseline restoration; production-source proof remains failed and publication-production's dependency condition cannot pass.",
      ".github/workflows/deploy.yml:1111 --             --proof-command 'bunx playwright test --config e2e/playwright.config.ts && bun tools/verify-release-staging-latency.ts'",
      "tools/verify-release-staging-latency.ts:76-80 requires CI_GH_STAGING_REHEARSAL === 'true' and CI_GH_PRODUCTION_PROMOTION === 'false'; publication-staging does not supply these or CI_GH_VALIDATED_SOURCE_SHA.",
      ".github/workflows/deploy.yml:91-94 formal-publication preflight requires REHEARSE_STAGING_ROLLBACK to be false.",
      "e2e/support.ts:29 requires E2E_BUYER_EMAIL; e2e/publication.spec.ts:10 requires E2E_FAILED_CATALOG_RELEASE_ID, and checks the synthetic failed revision. publication-staging lacks the corresponding variables and setup provided by prove-staging.",
      "tools/storefront-publication.ts:802-806 runs proof-command before the activation callback; its catch path restores baseline on proof failure. tools/deploy-workflow.test.ts:1268 asserts only that the Playwright command string is present.",
      ".github/workflows/deploy.yml:1019 selects publication-staging for a publish, or staging rollback; its job/step env at 1026-1040 and 1095-1106 supplies no CI_GH_STAGING_REHEARSAL, CI_GH_PRODUCTION_PROMOTION, CI_GH_VALIDATED_SOURCE_SHA, E2E_BUYER_EMAIL, E2E_FAILED_CATALOG_RELEASE_ID or E2E_EXHAUSTED_NOTIFICATION_ID.",
      ".github/workflows/deploy.yml:101 -- test \"$REHEARSE_STAGING_ROLLBACK\" = \"false\"",
      "tools/verify-release-staging-latency.ts:76 -- if (environment.CI_GH_STAGING_REHEARSAL !== \"true\") {",
      "tools/verify-release-staging-latency.ts:77 -- throw new Error(\"CI-GH staging rollback rehearsal must be enabled\");",
      "Read-only pure-function reproduction using the publication job's environment and an exact checkout SHA throws: CI-GH staging rollback rehearsal must be enabled.",
      "e2e/publication.spec.ts:10 -- const failedReleaseId = requiredEnvironment(\"E2E_FAILED_CATALOG_RELEASE_ID\");",
      "e2e/support.ts:29 -- await page.getByLabel(\"Email\").fill(requiredEnvironment(\"E2E_BUYER_EMAIL\"));",
      ".github/workflows/deploy.yml:359 the legacy prove-staging job is selected only when inputs.publication_id == ''; that job normally supplies and seeds the required fixtures at 381-388 and 443-490.",
      "tools/storefront-publication.ts:806-807 executes the proof command before the activation callback; 834-851 restores the retained baseline when this command fails."
    ],
    "file": ".github/workflows/deploy.yml",
    "first_evidence": ".github/workflows/deploy.yml:1111 -- --proof-command 'bunx playwright test --config e2e/playwright.config.ts && bun tools/verify-release-staging-latency.ts'",
    "independent_reviewers": [
      "adversarial",
      "correctness",
      "reliability"
    ],
    "line": 1111,
    "owner": "downstream-resolver",
    "pre_existing": false,
    "requires_verification": true,
    "reviewers": [
      "adversarial",
      "correctness",
      "reliability"
    ],
    "severity": "P1",
    "suggested_fix": "Provide a dedicated formal-publication entry point for the shared latency probe, with authority checks for the protected deploy workflow, exact validated SHA, staging activation target, publication identity and same run. Invoke that entry point from publication-staging while leaving the existing CI-GH rehearsal-only entry point and its guards intact; do not fabricate rehearsal flags to bypass its intentionally different authority. Add a non-network authority test using the actual publication job environment.",
    "title": "Formal publication fails the rehearsal-only latency authority check",
    "why_it_matters": "Any publication that reaches the latency command is rejected before a latency request is made. That tool requires the protected CI-GH rollback-rehearsal authority, including CI_GH_STAGING_REHEARSAL=true, CI_GH_PRODUCTION_PROMOTION=false and the validated SHA; the new publication job supplies none of these, and publication preflight explicitly forbids a rollback rehearsal. This rolls back a successful staging publication and blocks every production publication's staging proof.",
    "source_detail_keys": [
      {
        "reviewer": "adversarial",
        "file": ".github/workflows/deploy.yml",
        "line": "1111",
        "title": "every publication fails the rehearsal-only latency authority check"
      },
      {
        "reviewer": "reliability",
        "file": ".github/workflows/deploy.yml",
        "line": "1111",
        "title": "formal publication invokes an incompatible staging proof gate"
      },
      {
        "reviewer": "correctness",
        "file": ".github/workflows/deploy.yml",
        "line": "1111",
        "title": "give formal staging proof a matching execution context"
      }
    ],
    "quote_verified_against_reviewed_tree": true,
    "validation_status": "pending"
  },
  {
    "#": 2,
    "autofix_class": "manual",
    "confidence": 100,
    "evidence": [
      ".github/workflows/deploy.yml:1111 -- --proof-command 'bunx playwright test --config e2e/playwright.config.ts && bun tools/verify-release-staging-latency.ts'",
      "e2e/playwright.config.ts:26-41 always selects provider-purchase from storefront-purchase.spec.ts, selects fashion-provider-purchase separately, and makes release-operations depend on the fallback provider-purchase project.",
      "e2e/storefront-purchase.spec.ts:16-17 -- await page.getByRole(\"button\", { name: \"Add to bag\" }).click(); await expect(page).toHaveURL(/\\/cart\\/?$/);",
      "apps/storefront/scripts/prepare-experience.ts:119-145 selects FashionStoreProductPage.vue for the public live snapshot; FashionStoreProductPage.vue:637 renders Add to cart, and addToCart at lines 322-359 updates runtimeState without navigating to /cart.",
      "e2e/fashion-store-purchase.spec.ts:118 -- test.skip(phase !== \"journey\", \"Runs only inside the locked destructive journey phase.\"); publication-staging does not set FASHION_U12_PHASE, so that project provides no public purchase proof.",
      "e2e/publication.spec.ts:10, e2e/payment-recovery.spec.ts:14 and e2e/admin-fulfillment.spec.ts:12 require E2E_FAILED_CATALOG_RELEASE_ID, E2E_EXHAUSTED_NOTIFICATION_ID and E2E_BUYER_EMAIL respectively; publication-staging's job/step environment at deploy.yml:1026-1040 and 1095-1106 supplies none of them. The old prove-staging job prepares these fixtures, but it is excluded for publication requests.",
      "tools/storefront-publication.ts:806-852 executes this proof before completeStorefrontPublication and restores the retained baseline on a proof exception. Thus this incompatible suite prevents a successful receipt for a healthy public deployment.",
      ".github/workflows/deploy.yml:1111 --             --proof-command 'bunx playwright test --config e2e/playwright.config.ts && bun tools/verify-release-staging-latency.ts'",
      "tools/verify-release-staging-latency.ts:76-80 requires CI_GH_STAGING_REHEARSAL === 'true' and CI_GH_PRODUCTION_PROMOTION === 'false'; publication-staging does not supply these or CI_GH_VALIDATED_SOURCE_SHA.",
      ".github/workflows/deploy.yml:91-94 formal-publication preflight requires REHEARSE_STAGING_ROLLBACK to be false.",
      "e2e/support.ts:29 requires E2E_BUYER_EMAIL; e2e/publication.spec.ts:10 requires E2E_FAILED_CATALOG_RELEASE_ID, and checks the synthetic failed revision. publication-staging lacks the corresponding variables and setup provided by prove-staging.",
      "tools/storefront-publication.ts:802-806 runs proof-command before the activation callback; its catch path restores baseline on proof failure. tools/deploy-workflow.test.ts:1268 asserts only that the Playwright command string is present.",
      ".github/workflows/deploy.yml:1019 selects publication-staging for a publish, or staging rollback; its job/step env at 1026-1040 and 1095-1106 supplies no CI_GH_STAGING_REHEARSAL, CI_GH_PRODUCTION_PROMOTION, CI_GH_VALIDATED_SOURCE_SHA, E2E_BUYER_EMAIL, E2E_FAILED_CATALOG_RELEASE_ID or E2E_EXHAUSTED_NOTIFICATION_ID.",
      ".github/workflows/deploy.yml:101 -- test \"$REHEARSE_STAGING_ROLLBACK\" = \"false\"",
      "tools/verify-release-staging-latency.ts:76 -- if (environment.CI_GH_STAGING_REHEARSAL !== \"true\") {",
      "tools/verify-release-staging-latency.ts:77 -- throw new Error(\"CI-GH staging rollback rehearsal must be enabled\");",
      "Read-only pure-function reproduction using the publication job's environment and an exact checkout SHA throws: CI-GH staging rollback rehearsal must be enabled.",
      "e2e/publication.spec.ts:10 -- const failedReleaseId = requiredEnvironment(\"E2E_FAILED_CATALOG_RELEASE_ID\");",
      "e2e/support.ts:29 -- await page.getByLabel(\"Email\").fill(requiredEnvironment(\"E2E_BUYER_EMAIL\"));",
      ".github/workflows/deploy.yml:359 the legacy prove-staging job is selected only when inputs.publication_id == ''; that job normally supplies and seeds the required fixtures at 381-388 and 443-490.",
      "tools/storefront-publication.ts:806-807 executes the proof command before the activation callback; 834-851 restores the retained baseline when this command fails."
    ],
    "file": ".github/workflows/deploy.yml",
    "first_evidence": ".github/workflows/deploy.yml:1111 -- --proof-command 'bunx playwright test --config e2e/playwright.config.ts && bun tools/verify-release-staging-latency.ts'",
    "independent_reviewers": [
      "adversarial",
      "correctness",
      "reliability"
    ],
    "line": 1111,
    "owner": "downstream-resolver",
    "pre_existing": false,
    "requires_verification": true,
    "reviewers": [
      "adversarial",
      "correctness",
      "reliability"
    ],
    "severity": "P1",
    "suggested_fix": "Select a hosted public-live purchase proof for this job, binding it to the retained Catalog/Snapshot and using the Fashion Store's actual option selection, Add to cart action and cart navigation. Supply/prepare only the staging Commerce data and required operational fixture variables that the selected tests need, under the existing REL staging authority. Do not use the private-preview FASHION_U12 grant flow or the fallback-specific purchase project as proof of public publication; add a workflow integration check covering the selected configuration and its required environment.",
    "title": "Formal staging proof selects fallback and private-preview journeys",
    "why_it_matters": "Even after validation is repaired, a correctly deployed public Fashion Store cannot pass the selected hosted purchase proof. The root suite's mandatory purchase project clicks the fallback Add to bag button and expects automatic navigation to /cart, while the public live page uses Add to cart and keeps the customer on the product page. Its Fashion purchase project is a private-preview journey that skips without FASHION_U12_PHASE, and the remaining root operations tests require fixture variables that this job never supplies; the delivery runner therefore restores the old version instead of recording activation.",
    "source_detail_keys": [
      {
        "reviewer": "adversarial",
        "file": ".github/workflows/deploy.yml",
        "line": "1111",
        "title": "public staging proof selects fallback and private-journey tests"
      },
      {
        "reviewer": "reliability",
        "file": ".github/workflows/deploy.yml",
        "line": "1111",
        "title": "formal publication invokes an incompatible staging proof gate"
      },
      {
        "reviewer": "correctness",
        "file": ".github/workflows/deploy.yml",
        "line": "1111",
        "title": "give formal staging proof a matching execution context"
      }
    ],
    "quote_verified_against_reviewed_tree": true,
    "validation_status": "pending"
  },
  {
    "#": 3,
    "autofix_class": "gated_auto",
    "confidence": 100,
    "evidence": [
      "apps/storefront/worker/index.ts:66 -- headers.set(\"X-Preview-Catalog-Release\", marker.identity.catalogReleaseId);",
      "apps/api/src/cart/service.ts:148 -- const authorizedReleaseId = context.req.header(\"x-preview-catalog-release\");",
      "apps/api/src/cart/service.ts:150 -- if (authorizedReleaseId && cartReleaseId && authorizedReleaseId !== cartReleaseId) {",
      "apps/api/src/cart/service.ts:153 -- \"cart_release_conflict\",",
      "apps/api/src/http/app.ts:1101 -- const cart = await requireCart(context);",
      "apps/api/src/http/app.ts:1172 also requires the cart before creating a checkout session, so this is not limited to adding a product from a newer catalog.",
      "apps/storefront/app/features/cart/use-guest-cart.ts:51 -- response.data?.error?.code === \"cart_release_conflict\" ||",
      "apps/storefront/app/features/cart/use-guest-cart.ts:83 -- localStorage.removeItem(TOKEN_KEY);",
      "apps/storefront/app/features/cart/use-guest-cart.ts:134-138 creates a replacement cart after this terminal error and reports that the previous cart is no longer available.",
      "docs/architecture/storefront-publication.md: Retention and Commerce explicitly retains historical activated catalogs for existing carts; the added API retention test calls the API directly without a new public Worker header."
    ],
    "file": "apps/storefront/worker/index.ts",
    "first_evidence": "apps/storefront/worker/index.ts:66 -- headers.set(\"X-Preview-Catalog-Release\", marker.identity.catalogReleaseId);",
    "independent_reviewers": [
      "correctness"
    ],
    "line": 66,
    "owner": "downstream-resolver",
    "pre_existing": false,
    "requires_verification": true,
    "reviewers": [
      "correctness"
    ],
    "severity": "P1",
    "suggested_fix": "Use a distinct public-storefront catalog header for the compiled marker, and consume it for public product lookup and current-release new-line qualification. Reserve X-Preview-Catalog-Release and assertUsableCart's strict release equality for actual private preview sessions; allow existing public CartToken reads, updates and checkout to keep their already-qualified historical catalog. Add a Worker-to-API regression covering an A cart after B activation and after rollback, and retain the private preview cross-release rejection test.",
    "title": "Preserve existing public carts when the storefront changes",
    "why_it_matters": "Publishing or rolling back from catalog A to B makes shoppers' existing A carts unavailable even though A has a retained successful activation. Every public API request receives B in the private-preview release header, so the existing cart guard returns cart_release_conflict on GET /cart and checkout. The storefront treats that error as terminal, deletes the stored cart token and starts an empty cart. Separating public catalog observation from private preview isolation lets retained public carts continue while preserving the preview guard.",
    "source_detail_keys": [
      {
        "reviewer": "correctness",
        "file": "apps/storefront/worker/index.ts",
        "line": "66",
        "title": "preserve existing public carts when the storefront changes"
      }
    ],
    "quote_verified_against_reviewed_tree": true,
    "validation_status": "pending"
  },
  {
    "#": 4,
    "autofix_class": "manual",
    "confidence": 100,
    "evidence": [
      "tools/release-validate.ts:256 -- if (![\"production-builds\", \"static-output\"].includes(gateName)) {",
      "tools/release-validate.ts:257-265 deletes STOREFRONT_BUILD_MODE/STOREFRONT_EXPERIENCE_FILE for browser-journeys and sets STOREFRONT_REUSE_VALIDATED_BUILD = \"1\"; RELEASE_GATES selects the unchanged bun run test:e2e after production-builds and static-output.",
      "apps/storefront/playwright.config.ts:38-47 uses scripts/serve-static.ts instead of rebuilding when STOREFRONT_REUSE_VALIDATED_BUILD is 1, so it serves the newly generated public artifact.",
      "apps/storefront/e2e/storefront.spec.ts:5-15 -- the active no-js-desktop test requests /products/atlas-carry-on and requires Atlas Carry-on, $129.00, Fixture variants, Select variant and https://shop.example.invalid/products/atlas-carry-on; line 27 also requires Select variant for the mobile project.",
      "apps/storefront/scripts/prepare-release.ts:52-73 compiles liveExperienceInput.catalogRelease, while StorefrontExperience.vue:258-272 creates its canonical link from liveRelease.site.origin. Construct an otherwise valid approved Catalog whose only product has a different slug or whose origin is the real configured store: build/static checks can pass, then the selected fixture browser test fails, validate never produces a passed attestation, and publication-staging cannot start.",
      "tools/release-validate.ts:257 -- delete scopedEnvironment.STOREFRONT_BUILD_MODE;",
      "tools/release-validate.ts:265 -- scopedEnvironment.STOREFRONT_REUSE_VALIDATED_BUILD = \"1\";",
      ".github/workflows/full-validation.yml:199 -- printf 'STOREFRONT_BUILD_MODE=public\\n' >> \"$GITHUB_ENV\"",
      "tools/release-validate.ts:80 -- { name: \"browser-journeys\", command: [\"bun\", \"run\", \"test:e2e\"] },",
      "apps/storefront/playwright.config.ts uses the default ./e2e suite and serves the validated .output/public without rebuilding when STOREFRONT_REUSE_VALIDATED_BUILD is 1.",
      "apps/storefront/e2e/storefront.spec.ts:9 -- await expect(page.getByText(\"Fixture variants\")).toBeVisible();",
      "apps/storefront/e2e/storefront.spec.ts:10 -- await expect(page.getByRole(\"button\", { name: \"Select variant\" })).toBeVisible();",
      "apps/storefront/e2e/storefront.spec.ts:14 -- \"https://shop.example.invalid/products/atlas-carry-on\",",
      "Read-only inspection of retained apps/storefront/.output/public: marker themeId=fashion-store; products/atlas-carry-on/index.html exists; Fixture variants=false, Select variant=false, shop.example.invalid/products/atlas-carry-on=false."
    ],
    "file": "tools/release-validate.ts",
    "first_evidence": "tools/release-validate.ts:256 -- if (![\"production-builds\", \"static-output\"].includes(gateName)) {",
    "independent_reviewers": [
      "adversarial",
      "correctness"
    ],
    "line": 256,
    "owner": "downstream-resolver",
    "pre_existing": false,
    "requires_verification": true,
    "reviewers": [
      "adversarial",
      "correctness"
    ],
    "severity": "P1",
    "suggested_fix": "Add a public-build browser configuration/suite that derives product routes, names and canonical origin from the retained approved input, and select it for publication validation while reusing the exact generated output. Preserve the public input/theme selector for that gate; keep the existing fixture-specific fallback tests on their own fixture build, rather than rebuilding the delivery artifact to satisfy them. Verify this with an approved input whose product slug and site.origin differ from the committed fixture. Keep the same approved identity available to accessibility and performance consumers where their selected assertions depend on renderer or frozen content.",
    "title": "Approved public builds fail the fixture-only browser gate",
    "why_it_matters": "A merchant's valid approved public build cannot pass hosted full validation when its catalog or origin differs from the committed fallback fixture. The new public input survives production-builds/static-output, but the following browser gate reuses that output with the unchanged suite that requires Atlas Carry-on, Fixture variants, Select variant, and shop.example.invalid URLs. A browser gate selected from the same immutable public input would validate the actual frozen content without replacing it with a fixture build.",
    "source_detail_keys": [
      {
        "reviewer": "adversarial",
        "file": "tools/release-validate.ts",
        "line": "256",
        "title": "approved live builds fail the fixture-only browser gate"
      },
      {
        "reviewer": "correctness",
        "file": "tools/release-validate.ts",
        "line": "257",
        "title": "validate public artifacts with their live renderer browser contract"
      }
    ],
    "quote_verified_against_reviewed_tree": true,
    "validation_status": "pending"
  },
  {
    "#": 5,
    "autofix_class": "manual",
    "confidence": 100,
    "evidence": [
      ".github/workflows/deploy.yml:1226 -- if: ${{ always() && inputs.publication_id != '' && needs.publication-request.result == 'success' && needs.publication-production.result == 'skipped' && (needs.validate.result == 'failure' || needs.verify-deployment-inputs.result == 'failure' || needs.approve-human-access.result == 'failure' || needs.approve-production.result == 'failure' || (inputs.source_environment == 'production' && needs.publication-staging.result == 'failure')) }}",
      "tools/storefront-publication.ts:616 sends the building callback in publication-request's fetch step, before the separate publication-staging/production job starts.",
      "Scenario A: validation and attestation verification succeed for a staging request; deploy.yml:1069 browser installation fails. capture and deliver are skipped, publication-staging is failure, publication-production is skipped, and the finalizer predicate's staging failure branch is disabled because source_environment is staging. The producer row remains building.",
      "Scenario B: production staging proof and approvals succeed, but the ready/recent backup query at deploy.yml:1163-1180 rejects the supplied backup. publication-production is failure, capture/deliver never start, and finalization is skipped because it requires publication-production to be skipped.",
      "tools/storefront-publication.ts:711-746 performs capture, retained-baseline read and pre-mutation baseline recheck outside the mutation recovery try, so those exceptions also cannot submit a failed result themselves.",
      "packages/db/migrations/0039_storefront_publications.sql:37-38 reserves one pending row per environment for queued/building/unresolved; apps/api/src/publishing/storefront-publications.ts:324-330 returns/rejects against that pending row. Admin's panel at lines 162-175 disables publishing while such a row exists. Recovery CLI at tools/storefront-publication.ts:719 requires a retained baseline, which is unavailable for a failure before capture.",
      "tools/storefront-publication.ts:616 -- await publicationCallback(source, { ...run, status: \"building\" });",
      ".github/workflows/deploy.yml:1175 selects only a ready production backup completed within 24 hours; jq --exit-status at 1177-1180 fails when none matches.",
      ".github/workflows/deploy.yml:1181 baseline capture follows backup verification, and the deliver call at 1212 is skipped after that earlier failure; neither job has a local pre-delivery failure callback.",
      "packages/db/migrations/0039_storefront_publications.sql:38 -- ON storefront_publications(environment) WHERE status IN ('queued', 'building', 'unresolved');",
      "apps/api/src/publishing/storefront-publications.ts:326 -- if (matchesPendingIntent(pending, input)) return pending;",
      "tools/storefront-publication.ts:593-599 already provides a same-run failed callback for verified pre-mutation failures; the protected workflow can use it before deliver begins."
    ],
    "file": ".github/workflows/deploy.yml",
    "first_evidence": ".github/workflows/deploy.yml:1226 -- if: ${{ always() && inputs.publication_id != '' && needs.publication-request.result == 'success' && needs.publication-production.result == 'skipped' && (needs.validate.result == 'failure' || needs.verify-deployment-inputs.result == 'failure' || needs.approve-human-access.result == 'failure' || needs.approve-production.result == 'failure' || (inputs.source_environment == 'production' && needs.publication-staging.result == 'failure')) }}",
    "independent_reviewers": [
      "adversarial",
      "correctness"
    ],
    "line": 1226,
    "owner": "downstream-resolver",
    "pre_existing": false,
    "requires_verification": true,
    "reviewers": [
      "adversarial",
      "correctness"
    ],
    "severity": "P2",
    "suggested_fix": "Give the capture/deliver steps explicit IDs and finalize unsuccessful publication jobs that never entered a mutation-capable delivery step, using the same-run failed callback and the producer's existing current-storefront verification. Cover publication-staging for staging-source requests and publication-production pre-delivery failures; keep post-mutation/unknown outcomes on the existing retained-baseline unresolved recovery path. Add workflow/state integration scenarios for browser-install failure, backup rejection and baseline-capture failure, verifying that a safely failed request permits a new attempt and an unverifiable storefront remains unresolved.",
    "title": "Pre-delivery failures strand the pending publication",
    "why_it_matters": "An ordinary job failure before delivery, such as a staging browser installation failure or a production backup rejection, leaves the request marked building although no storefront mutation occurred. The workflow's finalizer excludes staging-source publication-staging failures and any publication-production failure, while the runner's recovery catch begins only after baseline loading/rechecking. Admin consequently keeps showing publishing and refuses another request because the environment's unique pending row never becomes failed; cases before capture also lack the baseline required by the documented recovery command.",
    "source_detail_keys": [
      {
        "reviewer": "adversarial",
        "file": ".github/workflows/deploy.yml",
        "line": "1226",
        "title": "pre-delivery job failure permanently strands the pending publication"
      },
      {
        "reviewer": "correctness",
        "file": ".github/workflows/deploy.yml",
        "line": "1226",
        "title": "close ordinary failures before storefront mutation begins"
      }
    ],
    "quote_verified_against_reviewed_tree": true,
    "validation_status": "pending"
  },
  {
    "#": 6,
    "autofix_class": "gated_auto",
    "confidence": 75,
    "evidence": [
      ".github/workflows/deploy.yml:1008 --       - name: Retain the run-bound authorized input without credentials",
      "tools/storefront-publication.ts:616 --     await publicationCallback(source, { ...run, status: \"building\" });",
      ".github/workflows/deploy.yml:1003-1007 runs the failure handler before the final artifact upload, so it is skipped while the job is still successful.",
      ".github/workflows/deploy.yml:1226 publication-failure requires needs.publication-request.result == 'success'; an artifact-upload failure makes that prerequisite false.",
      "apps/api/src/publishing/storefront-publications.ts:323-326 returns a matching pending intent without invoking the build hook; recordStorefrontPublicationResult rejects a changed run attempt. packages/db/migrations/0039_storefront_publications.sql retains a unique pending request per environment."
    ],
    "file": ".github/workflows/deploy.yml",
    "first_evidence": ".github/workflows/deploy.yml:1008 --       - name: Retain the run-bound authorized input without credentials",
    "independent_reviewers": [
      "reliability"
    ],
    "line": 1008,
    "owner": "downstream-resolver",
    "pre_existing": false,
    "requires_verification": true,
    "reviewers": [
      "reliability"
    ],
    "severity": "P2",
    "suggested_fix": "Move the publication-request failure callback after the final artifact-retention step, retaining the steps.publication.outcome == 'success' guard so the original run is known and no storefront mutation has occurred. Distinguish input-retention failure from missing production gates. Verify an injected upload failure produces a failed request and permits an explicit new publication attempt.",
    "title": "Input artifact failure leaves publication permanently building",
    "why_it_matters": "A transient failure retaining the authorized-input artifact leaves the request marked building even though delivery never starts. The failure callback step occurs before this upload, and the downstream failure job requires publication-request to have succeeded, so neither handles this error. Repeating publication returns the existing pending intent without redispatch, while rerunning the workflow has a different attempt and is rejected by the producer; the environment remains blocked until an operator manually sends the original run's failure callback.",
    "source_detail_keys": [
      {
        "reviewer": "reliability",
        "file": ".github/workflows/deploy.yml",
        "line": "1008",
        "title": "input artifact failure leaves publication permanently building"
      }
    ],
    "quote_verified_against_reviewed_tree": true,
    "validation_status": "pending"
  }
]
</findings-to-validate>

<diff>
/Users/studio/Documents/GitHub/shoppp/docs/ce-code-review/20261011-041618-e3aad574/full.diff
</diff>

<scope-context>
{
  "scope": {
    "mode": "local-aligned",
    "base": "6cd04e6b18b4fac62c5bec704190f0113b03b2e9",
    "diff_a": "6cd04e6b18b4fac62c5bec704190f0113b03b2e9",
    "diff_b": null,
    "pr": {
      "number": null,
      "url": null,
      "title": null,
      "body": null,
      "base_ref_name": null,
      "head_ref_oid": null,
      "head_ref": null,
      "base_ref": null,
      "has_prior_comments": false
    },
    "branch": "codex/fix-new-arrival-icon",
    "head_sha": "36701cde3cd1cefdc7c316ecedc4cc741c09dbbc",
    "files": "/Users/studio/Documents/GitHub/shoppp/docs/ce-code-review/20261011-041618-e3aad574/files.txt",
    "diff": "/Users/studio/Documents/GitHub/shoppp/docs/ce-code-review/20261011-041618-e3aad574/full.diff",
    "tree_is_reviewed_head": true,
    "untracked_excluded": []
  },
  "intent": {
    "summary": "Complete U7 formal publication locally: an authorized human publishes the exact approved Catalog + Snapshot + Contact + Theme bytes through the existing protected delivery workflow, and Admin shows Online only from freshly verified activation evidence. Preserve immutable private origin identity, source/activation environment isolation, idempotency/CAS, exact rollback and unresolved recovery; protected Guide/Dashboard content stays unchanged. Hosted deployment, candidate freeze and DC/PG remain REL-owned.",
    "confidence": "explicit"
  },
  "scope_note": "Local-aligned actual current source vs completed U6 base, including dirty and untracked reviewed panel/test/evidence. Inspect only read-only; no source/Git mutation, worktree, deployment, hosted/candidate/production operation or external action. Any reproduction that would mutate is scratch-copy-only and cannot use a worktree. U1-U6 are preserved baseline; held finishing documentation does not create missing implementation scope. All six claims need independent verdicts; prior U6 receipts do not satisfy this gate.",
  "constraints": [
    "No apply token, readonly. Default depth:auto, let the skill self-size.",
    "Include committed U7 changes plus current settled unstaged changes and the new untracked publication panel/test/evidence file. This is local-aligned scope; no old U6 receipt satisfies this gate.",
    "No project mutation while you review, except root may finish documentation evidence. Preserve faithful dirty/untracked reviewed source.",
    "Mutation testing if selected is SCRATCH COPY ONLY, never shared checkout or worktree.",
    "No Git/index edits, branch switches, installs, deployments, external product writes, candidate freeze, DC/PG, push/PR, task launch or worktree creation. Reviewer artifacts only in skill-resolved artifact root.",
    "User prohibits any worktree without exact prior confirmation; none given.",
    "User goal: complete U7 formal release interfaces and actual activation receipts locally; Guide and Dashboard content unchanged. Active plan owns U7 implementation only. REL remains validation-only and owns real deployment/Pre-DC/DC/PG.",
    "Read plan R8/R12/F5/AE8, KTD6/KTD7 session-settled structure pins, U7 and Verification/DoD; older U1-U6 already completed baseline, not new review work.",
    "Architecture: docs/architecture/storefront-publication.md. Validate human themes.publish separate from machine build credential; exact raw Catalog+approved Snapshot+Contact+Theme binding; async idempotent job/CAS; authoritative runtime observations and current pointer distinct from historical success; source versus activation environment separation; original same-run baseline retained before mutation; protected production PG; exact rollback no rebuild or database/data rollback; receipt-loss reconciliation and unresolved failure recovery.",
    "UI uses native AntD and no new page/menu. R2 protected Guide/Dashboard files and original metadata/translations must stay unchanged. Existing a11y primitives own modal/focus behavior, do not demand hypothetical extra screenreader protocols.",
    "Do not count synthetic local fixtures as hosted/candidate/production proof.",
    "Host capacity4 includes root and you, so at most2 reviewer children active concurrently. Select entire required roster, dispatch bounded independent batches and collect ALL terminal outcomes in turn; capacity backpressure is not failure and must not silently drop reviewers.",
    "Finish pipeline strict: after all reviewer results, read finish-input.md, write actual input/artifacts, launch MERGE leaf seeded finish-review.md (you must NOT open finish-review.md), collect; launch/collect its selected validator if applicable; launch REPORT leaf seeded finish-review.md, collect terminal JSON and emit verbatim. No direct synthesis or harness findings tool substitute.",
    "Honor the top-level sole-location rule for durable review artifacts, e.g. docs/ce-code-review/20261011-041618-e3aad574, preserving current run ID/stage log and recording that the scratch example was overridden."
  ]
}
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

Write the JSON object below to `/Users/studio/Documents/GitHub/shoppp/docs/ce-code-review/20261011-041618-e3aad574/validator-verdicts.json` before you return, then return the same object:
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
The diff above is a staged path: read it as needed. Full plan requirements and U7/architecture context are in /Users/studio/Documents/GitHub/shoppp/docs/ce-code-review/20261011-041618-e3aad574/finish-input.json; retain scoped U1-U6 baseline. No subagent spawning. Source is frozen; no project or Git mutation, installs, worktree/deployment/external actions. All six selected input numbers require one verdict each.
