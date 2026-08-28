# Fashion Store U8 acceptance evidence

This is an append-only evidence ledger for U8 attempts. The active feature plan remains the sole
authority for current unit, status, blocker, execution order, and next action. Local harness
development tests are not authoritative preparation, human, build, machine, or cleanup attempts and
are therefore not entered as remote attempts here.

## Attempt record contract

Append one `started` record before every authoritative preparation, human, build, machine, or
cleanup attempt. Append its terminal record without editing or deleting the start record. Each
record must contain:

- attempt ID, kind, canonical start/finish timestamps, run-manifest digest, candidate SHA, harness
  SHA, harness-manifest and contract-test digests;
- U12 readiness digest and baseline Snapshot, Catalog Release, theme/platform identity, source draft,
  successor Snapshot/content/audit lineage, and build/artifact identities when they exist;
- status, non-secret failure class, cleanup outcome, and the corrective or environmental reason
  recorded before any retry;
- every immutable Snapshot or audit created by a failed or abandoned attempt, explicitly classified
  as retained non-candidate evidence.

Do not append passwords, bearer headers, grants, Preview cookies, Admin sessions, CartTokens, request
bodies, HARs, traces, storage state, browser profiles, screenshots, or recordings. U8 cannot close
until every started record has a terminal outcome and all mutable-state cleanup and runner/operator
reconciliation have passed.

## Attempts

No authoritative U8 remote or human attempt has started as of 2026-08-24T02:15:00.000Z.

### human-u8-20260825a-1 — started

- **Kind/status:** `human` / `started`
- **Started at:** `2026-08-25T02:59:21.000Z`
- **Run manifest:** `u8-20260825a` / `305e56a2d7e003cae6db29445fe7f09143106f1bad73a3e88273c3e0d19a5988`
- **Frozen code:** candidate `1e8231726d8a0ad2c9ed4c10e4d27092160fd629`; harness
  `e7e1297c7eba26afcdd09b13d3df0b03cda12ba4`; harness manifest
  `b6938c75f48d1ae6025c632e4144c0eb3c7a79046b8dc57570f881c9bf36c6ce`; contract-test
  digest `2167369260e2d6ced936e84fa7016fafa58e17c3628be8e219504da28259d3cb`.
- **Frozen baseline:** U12 readiness
  `c56650555ee51eba2c51e0b79e55df8b7749b81d6a7ea0640e8dea5984da0cde`; Snapshot
  `snapshot-approved-89c1cd6696769d3a962f1029e9118892`; artifact
  `58eab5a6dcdd9d94a13e22f2002ff72d1f2cc3dffdf85660aeb98f6b341bb52e`; Catalog Release
  `fashion-staging-u12-release-2026-08-18`; theme/platform `fashion-store@1.0.0` / `1.0.0`.
- **Human input:** source draft `draft-fashion-u8-u8-20260825a-source`, copied from the approved U12
  source and changed only to carry the deterministic missing collection reference. Setup audit is
  `audit-fashion-u8-u8-20260825a-source-setup`.
- **Operational setup:** offline runner ID `71` / `shoppp-fashion-u8-20260825a` has the exact two
  U8 labels under isolated standard account `shopppu8_20260825a`; Fashion staging alone has D1
  migration `0022` and API version `ed2f28b0-29c8-4943-a536-3eb6dbae3ca8`. Operator
  `identity_fashion_u8_u8_20260825a` expires at `2026-08-26T02:30:00.000Z` with exactly
  `catalog.read`, `themes.read`, `themes.write`, `themes.preview`, and `themes.approve`.
- **Run-scoped credential exception:** the user explicitly authorized one generated credential in a
  repository-external owner-only `0600` file for this run. The path and secret are excluded from
  retained evidence; the file must be destroyed after operator cleanup. This supersedes the prior
  no-file transport detail only for `u8-20260825a`.
- **Successor/build:** not yet created; the started record is non-terminal.

### human-u8-20260825a-1 — failed

- **Kind/status:** `human` / `failed`
- **Started/finished:** `2026-08-25T02:59:21.000Z` / `2026-08-25T03:02:56.000Z`
- **Run manifest:** `305e56a2d7e003cae6db29445fe7f09143106f1bad73a3e88273c3e0d19a5988`
- **Failure class:** `local_node_runtime_unavailable`. The Playwright wrapper resolved the broken
  Homebrew Node 24.4.1 and exited on its missing `libsimdjson.26.dylib` before browser launch.
- **Cleanup:** `not-required`. No login, Admin session, draft mutation, validation, Snapshot, build,
  Preview grant, or other remote human-lane mutation occurred. The prepared source draft and
  disabled-list reconciliation baseline remain inputs for the corrective retry.
- **Retained immutable output:** none.

### human-u8-20260825a-2 — started

- **Kind/status:** `human` / `started`
- **Started at:** `2026-08-25T03:02:56.000Z`
- **Run manifest and frozen inputs:** unchanged from `human-u8-20260825a-1`.
- **Corrective reason:** pin PATH and Playwright subprocesses to the verified bundled Node 24.19.0
  runtime, bypassing the broken Homebrew Node without changing the reviewed harness.
- **Successor/build:** not yet created; the retry record is non-terminal.

### human-u8-20260825a-2 — failed

- **Kind/status:** `human` / `failed`
- **Started/finished:** `2026-08-25T03:02:56.000Z` / `2026-08-25T03:04:52.000Z`
- **Run manifest:** `305e56a2d7e003cae6db29445fe7f09143106f1bad73a3e88273c3e0d19a5988`
- **Failure class:** `local_bun_runtime_not_on_path`. The bundled Node correction worked, but its
  replacement PATH omitted the owner-scoped Bun installation required by the configured Admin
  development web server. Playwright stopped before browser launch when `bun run dev` could not be
  resolved.
- **Cleanup:** `not-required`. No login, Admin session, draft mutation, validation, Snapshot, build,
  Preview grant, or other remote human-lane mutation occurred.
- **Retained immutable output:** none.

### human-u8-20260825a-3 — started

- **Kind/status:** `human` / `started`
- **Started at:** `2026-08-25T03:04:52.000Z`
- **Run manifest and frozen inputs:** unchanged from `human-u8-20260825a-1`.
- **Corrective reason:** keep the verified bundled Node first while retaining
  `/Users/studio/.bun/bin` for the Admin development web server; no reviewed harness input changes.
- **Successor/build:** not yet created; the retry record is non-terminal.

### human-u8-20260825a-3 — failed

- **Kind/status:** `human` / `failed`
- **Started/finished:** `2026-08-25T03:04:52.000Z` / `2026-08-25T03:07:00.000Z`
- **Run manifest:** `305e56a2d7e003cae6db29445fe7f09143106f1bad73a3e88273c3e0d19a5988`
- **Failure class:** `local_admin_port_contract_mismatch`. The verified Admin launcher listened on
  its Rsbuild default port `3000`, while the live Playwright configuration awaited its fallback
  port `3418`. The attempt was terminated before the web-server wait could time out.
- **Cleanup:** `not-required`. No browser launched and no login, Admin session, draft mutation,
  validation, Snapshot, build, Preview grant, or other remote human-lane mutation occurred.
- **Retained immutable output:** none.

### human-u8-20260825a-4 — started

- **Kind/status:** `human` / `started`
- **Started at:** `2026-08-25T03:07:00.000Z`
- **Run manifest and frozen inputs:** unchanged from `human-u8-20260825a-1`.
- **Corrective reason:** explicitly bind the live Playwright origin to the verified Admin launcher
  port with `FASHION_U8_ADMIN_PORT=3000`; no reviewed harness input changes.
- **Successor/build:** not yet created; the retry record is non-terminal.

### human-u8-20260825a-4 — failed

- **Kind/status:** `human` / `failed`
- **Started/finished:** `2026-08-25T03:07:00.000Z` / `2026-08-25T03:08:10.000Z`
- **Run manifest:** `305e56a2d7e003cae6db29445fe7f09143106f1bad73a3e88273c3e0d19a5988`
- **Failure class:** `local_admin_port_already_in_use`. Another repository legitimately owns the
  Rsbuild default port `3000`; Playwright rejected reuse before starting the configured U8 web
  server. That unrelated service was left untouched.
- **Cleanup:** `not-required`. No browser launched and no login, Admin session, draft mutation,
  validation, Snapshot, build, Preview grant, or other remote human-lane mutation occurred.
- **Retained immutable output:** none.
- **Required correction:** the reviewed Admin launcher must forward its declared `E2E_PORT` to
  Rsbuild, with focused contract coverage, before a new authoritative human attempt begins.

### human-u8-20260825a-5 — started

- **Kind/status:** `human` / `started`
- **Started at:** `2026-08-25T03:12:11.000Z`
- **Run manifest:** `u8-20260825a` / `89be1573af1e5a257e0fd397825fc23339b8e74fe66f761d4c0e3bc591b76dab`
- **Frozen code:** candidate `1e8231726d8a0ad2c9ed4c10e4d27092160fd629`; corrected harness
  `8ba861870d2897ea2064635b04770544757deeb0`; harness manifest
  `9c5ad14170712f8741af5127d3b1287611a4f325e48f075f80a13f3598b2706f`; contract-test
  digest `f9478871911dc572cee3564e853965dd3d46bfe6d0f300575d4756633e50de02`.
- **Frozen baseline and human inputs:** unchanged from `human-u8-20260825a-1`; the deterministic
  source draft and expiring operator were not mutated by the four failed preflights.
- **Corrective reason:** harness `8ba86187` validates and forwards `E2E_PORT=3418` to the Admin
  Rsbuild process; focused unit tests, tool TypeScript, Admin ESLint, and formatting all pass.
- **Successor/build:** not yet created; the retry record is non-terminal.

### human-u8-20260825a-5 — failed

- **Kind/status:** `human` / `failed`
- **Started/finished:** `2026-08-25T03:12:11.000Z` / `2026-08-25T03:13:22.000Z`
- **Run manifest:** `89be1573af1e5a257e0fd397825fc23339b8e74fe66f761d4c0e3bc591b76dab`
- **Failure class:** `login_readiness_locator_mismatch`. The isolated server and headed browser
  launched successfully, but the live spec expected an ARIA heading while the existing Ant Design
  Card exposes the visible login title as text. Playwright stopped before credential entry.
- **Cleanup:** `not-required`. No login, Admin session, draft mutation, validation, Snapshot, build,
  Preview grant, or other remote human-lane mutation occurred.
- **Retained immutable output:** none. The local text-only Playwright error context is diagnostic
  output, not retained acceptance evidence.
- **Required correction:** bind login readiness to the exact visible `Sign in to Shoppp Admin` text
  already exposed by the page, without weakening any credential, URL, or staging assertions.

### human-u8-20260825a-6 — started

- **Kind/status:** `human` / `started`
- **Started at:** `2026-08-25T03:15:23.000Z`
- **Run manifest:** `u8-20260825a` / `f5c7ca32b1d93bdc742c17c420106083eb3ec70ef0c770be4c1d40f85c741e84`
- **Frozen code:** candidate `1e8231726d8a0ad2c9ed4c10e4d27092160fd629`; corrected harness
  `879ad0bc2a3fbd877b03e147e93ad63332e56459`; harness manifest
  `65c61a74465acc385eb9173addad0ad2ba0be5db8fe097528ffd93c11df91b40`; contract-test
  digest `690b60516f381a3879602840028bc992d15cb2d86985f01b98fb43e1f0a217eb`.
- **Frozen baseline and human inputs:** unchanged from `human-u8-20260825a-1`; no failed preflight
  entered credentials or mutated the deterministic source draft or expiring operator.
- **Corrective reason:** harness `879ad0bc` retains the tested isolated-port correction and binds
  login readiness to the exact visible Admin title; focused config tests, Admin ESLint, and
  formatting pass.
- **Successor/build:** not yet created; the retry record is non-terminal.

### human-u8-20260825a-6 — failed

- **Kind/status:** `human` / `failed`
- **Started/finished:** `2026-08-25T03:15:23.000Z` / `2026-08-25T03:17:21.000Z`
- **Run manifest:** `f5c7ca32b1d93bdc742c17c420106083eb3ec70ef0c770be4c1d40f85c741e84`
- **Failure class:** `fashion_staging_admin_development_origin_mismatch`. The headed browser and
  VoiceOver launched and the generated credential was submitted once, but Fashion staging rejected
  `http://127.0.0.1:3418` because its exact non-production development-origin binding still named
  port `3000`.
- **Cleanup:** `passed-for-attempt`. Authentication failed closed with
  `admin_origin_denied`; no Admin session was created and no draft mutation, validation, Snapshot,
  build, or Preview grant occurred. The test and isolated server were stopped.
- **Retained immutable output:** the denied security audit, if emitted by the API, is retained as
  non-candidate failure evidence; no candidate Snapshot or approval audit exists.
- **Required correction:** make port `3418` the fail-closed Fashion Admin development default, bind
  the exact Fashion-staging `ADMIN_DEVELOPMENT_ORIGIN` to it, verify the binding in the launcher
  preflight, and freeze the Wrangler environment file in the harness manifest. Ordinary staging
  and production must remain unchanged.

### human-u8-20260825a-7 — started

- **Kind/status:** `human` / `started`
- **Started at:** `2026-08-25T03:21:33.000Z`
- **Run manifest:** `u8-20260825a` / `2a6964d07a825d73632e8758f077a0e5b776a2e536886ca0436477b4362ae199`
- **Frozen code:** candidate `1e8231726d8a0ad2c9ed4c10e4d27092160fd629`; corrected harness
  `7d8f535a99a78c116d5e25f16d06806e43cc4b63`; harness manifest
  `b74e3b2998d4435c20fe8075ba2404d0f65e6c1000ef9a11733ed53ab4ad53c0`; contract-test
  digest `2276bea32df5cc54eae0c95939998cc4bea80a3a0eddb0caeb48490b39a2b052`.
- **Fashion staging API:** version `284c7b70-6c8f-4738-803e-a723addbb172`, healthy after an
  environment-specific deployment that binds exactly `http://127.0.0.1:3418`; ordinary staging and
  production origin configuration is unchanged.
- **Frozen baseline and human inputs:** unchanged from `human-u8-20260825a-1`; failed attempts made
  no candidate mutation and created no Admin session.
- **Corrective reason:** the launcher default, checked Wrangler contract, frozen manifest, and live
  Fashion-staging API now agree on the exact isolated Admin origin.
- **Successor/build:** not yet created; the retry record is non-terminal.

### human-u8-20260825a-7 — failed

- **Kind/status:** `human` / `failed`
- **Started/finished:** `2026-08-25T03:21:33.000Z` / `2026-08-25T03:28:18.000Z`
- **Run manifest:** `2a6964d07a825d73632e8758f077a0e5b776a2e536886ca0436477b4362ae199`
- **Failure class:** `voiceover_login_input_not_committed`. The exact Fashion development-origin
  contract passed. VoiceOver was enabled before login, and Computer Use accessibility value,
  keyboard, and paste operations changed the visible field value without committing the controlled
  React form state. Three login submissions therefore carried no matching operator email; their
  denied audits have a null actor and the five-minute login wait expired.
- **Cleanup:** `passed-for-attempt`. No Admin session was created, and no draft mutation,
  validation, Snapshot, build, or Preview grant occurred. The headed browser, server, and
  VoiceOver processes started for this attempt were stopped.
- **Credential verification:** a read-only direct comparison proved the owner-only file matches the
  stored password digest; identity and role are enabled and unexpired with exactly five permissions.
  No password, hash, salt, cookie, or token was emitted.
- **Corrective reason for retry:** complete the ordinary login with VoiceOver off using real keyboard
  events, then enable VoiceOver immediately after authentication and before the six required Admin
  checkpoints. This preserves both the direct human-browser credential boundary and the governed
  screen-reader evidence lane.

### human-u8-20260825a-8 — started

- **Kind/status:** `human` / `started`
- **Started at:** `2026-08-25T03:28:48.000Z`
- **Run manifest and frozen inputs:** unchanged from `human-u8-20260825a-7`.
- **Corrective reason:** perform credential entry before opening the VoiceOver tutorial/session, then
  enable VoiceOver immediately after the authenticated route transition and before the automated
  missing-reference, conflict, preview-return, and approval flow begins.
- **Successor/build:** not yet created; the retry record is non-terminal.

### human-u8-20260825a-8 — failed

- **Kind/status:** `human` / `failed`
- **Started/finished:** `2026-08-25T03:28:48.000Z` / `2026-08-25T03:32:04.000Z`
- **Run manifest:** `2a6964d07a825d73632e8758f077a0e5b776a2e536886ca0436477b4362ae199`
- **Failure class:** `prepared_missing_reference_id_schema_invalid`. Login succeeded with the exact
  run operator, but the first authenticated draft GET returned `500`. A direct contract parse proved
  binding index 6 used `col_missing_fashion_u8_u8_20260825a`, which is not a valid public catalog
  resource ID and therefore prevented the editor from loading.
- **Cleanup:** `passed`. The Playwright browser profile was destroyed, every operator session was
  revoked, the diagnostic session logged out, and VoiceOver processes started for the attempt were
  stopped. No human edit, validation, Snapshot, build, or Preview grant occurred.
- **Retained immutable output:** successful login audit and setup correction audit only; no candidate
  Snapshot or approval audit exists.
- **Corrective setup:** the one invalid source binding was replaced with schema-valid but deliberately
  absent `col_U8MISSING20260825A0000`; full binding parsing passes, authenticated draft GET is `200`,
  correction audit is `audit-fashion-u8-u8-20260825a-source-schema-fix`, and final D1 bookmark is
  `00000e59-0000001a-000050d2-f294a8e8b6df31b03c85d58f55ecb357`.

### human-u8-20260825a-9 — started

- **Kind/status:** `human` / `started`
- **Started at:** `2026-08-25T03:38:20.000Z`
- **Run manifest and frozen code:** unchanged from `human-u8-20260825a-7`.
- **Prepared source correction:** binding index 6 now references absent but schema-valid
  `col_U8MISSING20260825A0000`; correction audit and bookmark are retained from attempt 8 cleanup.
- **Corrective reason:** authenticated draft read and full binding parsing now pass. Login will occur
  before VoiceOver starts; VoiceOver will be enabled immediately after the authenticated route
  transition and before the six required checkpoints.
- **Successor/build:** not yet created; the retry record is non-terminal.

### human-u8-20260825a-9 — failed

- **Kind/status:** `human` / `failed`
- **Started/finished:** `2026-08-25T03:38:20.000Z` / `2026-08-25T03:41:04.000Z`
- **Run manifest:** `2a6964d07a825d73632e8758f077a0e5b776a2e536886ca0436477b4362ae199`
- **Failure class:** `computer_use_window_identity_collision_and_credential_exposure`. A residual
  non-Playwright Chrome for Testing window shared the application identity of the fresh Playwright
  browser. Computer Use targeted that residual new-tab window, putting the run credential into a
  browser field and tool-visible accessibility state instead of Shoppp. No form was submitted.
- **Cleanup/security response:** `passed`. The mis-targeted fields were cleared, the acceptance test
  was interrupted before login, the residual Chrome for Testing process was terminated, and all
  operator sessions remain revoked. The exposed credential was immediately invalidated: the
  owner-only file was overwritten with a newly generated 64-character credential and operator
  provisioning replaced the D1 password digest while retaining the same identity, permissions, and
  expiry. A direct comparison proves the replacement file matches the new digest; active sessions
  are zero. The old credential must never be reused.
- **Retained immutable output:** security incident record only; no human edit, validation, Snapshot,
  build, Preview grant, or candidate approval exists.
- **Corrective reason for retry:** assert that no Chrome for Testing process exists before launch and
  target the single fresh Shoppp window. Do not emit a post-run Computer Use state after Playwright
  has closed its browser. Populate the correct fields, verify only the non-secret email, then enable
  VoiceOver before submitting the already-populated form.

### human-u8-20260825a-10 — started

- **Kind/status:** `human` / `started`
- **Started at:** `2026-08-25T03:41:45.000Z`
- **Run manifest, frozen code, and corrected source:** unchanged from attempt 9.
- **Credential state:** replacement credential is active in the owner-only file and D1; the exposed
  predecessor is invalid, active sessions are zero, and no Chrome for Testing or VoiceOver process
  exists before launch.
- **Corrective reason:** target the single fresh Shoppp test-browser window, populate the correct
  fields before starting VoiceOver, then enable VoiceOver and click the already-populated Sign in
  button so all six governed checkpoints execute with the screen reader active.
- **Successor/build:** not yet created; the retry record is non-terminal.

### human-u8-20260825a-10 — failed

- **Kind/status:** `human` / `failed`
- **Started/finished:** `2026-08-25T03:41:45.000Z` / `2026-08-25T03:43:55.000Z`
- **Run manifest:** `2a6964d07a825d73632e8758f077a0e5b776a2e536886ca0436477b4362ae199`
- **Failure class:** `catalog_release_select_assertion_mismatch`. The replacement credential was
  entered in the single verified Shoppp window, VoiceOver was enabled before submit, login
  succeeded, and the corrected draft loaded. The live spec then called `toContainText` on Ant
  Design Select's readonly internal combobox input; that input correctly has an empty value while
  the selected Catalog Release is rendered in a sibling selection item.
- **Cleanup:** `passed`. All operator sessions were revoked and VoiceOver processes were stopped.
  No human edit, validation, Snapshot, build, or Preview grant occurred.
- **Retained immutable output:** successful login audit only; no candidate Snapshot or approval
  audit exists.
- **Required correction:** assert that the accessible Catalog Release combobox is visible and that
  the exact selected release text is visibly rendered, without treating the internal input as a
  text container.

### human-u8-20260825a-11 — started

- **Kind/status:** `human` / `started`
- **Started at:** `2026-08-25T03:46:48.000Z`
- **Run manifest:** `u8-20260825a` / `29ad337f78405369920a418bec03ac85ab55addd65efc3d034b34b169e48d339`
- **Frozen code:** candidate `1e8231726d8a0ad2c9ed4c10e4d27092160fd629`; harness
  `11b122445aa176318aa97b010d5a1a729a33cc8e`; harness manifest
  `80fae0620618c71992b61e6b00beb3ad6981c84a87ba47db4d524c40ac287b8d`; contract-test
  digest `10fc6057787acd554d9d46bd72334064387ef142a3dbccac092ae114f9d4ea3c`.
- **Prepared source and credential:** schema-corrected source, replacement credential, zero active
  sessions, and API version are retained from the preceding corrective setup.
- **Corrective reason:** the live spec now asserts the accessible Select plus its exact visibly
  rendered release item. VoiceOver is already active; credential entry will use the single verified
  Shoppp window and the exact underscore-bearing operator email.
- **Successor/build:** not yet created; the retry record is non-terminal.

### human-u8-20260825a-11 — failed

- **Kind/status:** `human` / `failed`
- **Started/finished:** `2026-08-25T03:46:48.000Z` / `2026-08-25T03:48:22.000Z`
- **Run manifest:** `29ad337f78405369920a418bec03ac85ab55addd65efc3d034b34b169e48d339`
- **Failure class:** `catalog_release_visible_label_shape_mismatch`. VoiceOver remained active,
  the replacement credential authenticated, and the corrected editor loaded. The exact release ID
  is rendered inside the combined visible label `Live preview context <id> · staging · <date>`, not
  as a standalone text node, so the exact-text locator failed before any edit.
- **Cleanup:** `passed`. Operator sessions were revoked and the Playwright browser closed; no
  lingering VoiceOver process remained. No human edit, validation, Snapshot, build, or Preview
  grant occurred.
- **Required correction:** retain the accessible combobox visibility assertion and bind the release
  identity assertion to the anchored `Live preview context <exact-id>` label prefix.

### human-u8-20260825a-12 — started

- **Kind/status:** `human` / `started`
- **Started at:** `2026-08-25T03:50:07.000Z`
- **Run manifest:** `u8-20260825a` / `0d0a3110f0da21e8cd1e41237633f2bfcefda6bea2cefd5ab0cf3aeb464e1821`
- **Frozen code:** candidate `1e8231726d8a0ad2c9ed4c10e4d27092160fd629`; harness
  `3595ffcc6695b05319f94dbb292bbf96c02b19b5`; harness manifest
  `9876c9114baaadbaf21a385f0d54d6747a30f7b08b3870eef32343e3b8b54547`; contract-test
  digest `5f016311e132603e0d15146636b7097cf4cee6b169f8332d3409687b926c54af`.
- **Corrective reason:** the Catalog Release assertion now matches the actual anchored live-preview
  context label while keeping the accessible combobox requirement and exact internal ID.
- **Successor/build:** not yet created; the retry record is non-terminal.

### human-u8-20260825a-12 — failed

- **Kind/status:** `human` / `failed`
- **Started/finished:** `2026-08-25T03:50:07.000Z` / `2026-08-25T03:55:01.000Z`
- **Run manifest:** `0d0a3110f0da21e8cd1e41237633f2bfcefda6bea2cefd5ab0cf3aeb464e1821`
- **Failure class:** `catalog_release_card_title_and_selection_are_distinct_dom_nodes`. The
  replacement credential authenticated after its digest was resynchronized, VoiceOver remained
  active, and the corrected editor loaded. The accessibility snapshot flattens the Card title and
  selected release into one line, but the browser DOM keeps `Live preview context` and the Ant
  Select selection item as separate nodes; the combined-prefix text locator therefore matched no
  element before any edit.
- **Cleanup:** `passed`. Every operator session was revoked and the Playwright browser closed; no
  VoiceOver process remained. No human edit, validation, Snapshot, build, or Preview grant occurred.
- **Required correction:** retain the accessible combobox assertion and bind the release check to
  the exact visible `.ant-select-selection-item`, whose rendered text is the frozen release ID.

### human-u8-20260825a-13 — started

- **Kind/status:** `human` / `started`
- **Started at:** `2026-08-25T03:59:30.000Z`
- **Run manifest:** `u8-20260825a` / `5412f55d498e8cffc3aaf0fe7eb84eabe64de17b9ed8fb7a96b41bdc6f22bf5d`
- **Frozen code:** candidate `1e8231726d8a0ad2c9ed4c10e4d27092160fd629`; harness
  `1da0544aa1680ff1cb2e7df15c616e22e507e629`; harness manifest
  `d8ae5ad0c2ef277d0205c48d1fda94e0f68afd5fbc49bfda7a523f4fe7c1f80e`; contract-test
  digest `046368d6868e3c712b35bbc80ad1f091b807d694f6bc518e136fe92b785a8e7f`.
- **Corrective reason:** the live assertion now targets the exact visible Ant Select selection item;
  formatting, Admin typecheck/lint, the focused mocked browser flow, canonical manifest rebuild,
  and standing-authority verification pass.
- **Successor/build:** not yet created; the retry record is non-terminal.

### human-u8-20260825a-13 — failed

- **Kind/status:** `human` / `failed`
- **Started/finished:** `2026-08-25T03:59:30.000Z` / `2026-08-25T04:00:17.000Z`
- **Run manifest:** `5412f55d498e8cffc3aaf0fe7eb84eabe64de17b9ed8fb7a96b41bdc6f22bf5d`
- **Failure class:** `launcher_source_draft_id_typo`. The local launch command supplied
  `draft-fashion-u8-u8_20260825a-source`, while the authoritative run manifest names
  `draft-fashion-u8-u8-20260825a-source`. The manifest equality assertion failed closed before the
  login page or any authenticated request.
- **Cleanup:** `passed-for-attempt`. No Admin session, draft mutation, validation, Snapshot, build,
  Preview grant, or VoiceOver record was created.
- **Corrective reason for retry:** supply the source draft ID verbatim from the frozen run manifest;
  no executable harness or remote setup change is required.

### human-u8-20260825a-14 — started

- **Kind/status:** `human` / `started`
- **Started at:** `2026-08-25T04:00:30.000Z`
- **Run manifest and frozen code:** unchanged from attempt 13.
- **Corrective reason:** use exact source draft `draft-fashion-u8-u8-20260825a-source` from the
  authoritative manifest; all other frozen inputs and the owner-only replacement credential remain
  unchanged, with zero active operator sessions.
- **Successor/build:** not yet created; the retry record is non-terminal.

### human-u8-20260825a-14 — failed

- **Kind/status:** `human` / `failed`
- **Started/finished:** `2026-08-25T04:00:30.000Z` / `2026-08-25T04:01:02.000Z`
- **Run manifest:** `5412f55d498e8cffc3aaf0fe7eb84eabe64de17b9ed8fb7a96b41bdc6f22bf5d`
- **Failure class:** `staging_session_cold_start_exceeded_default_assertion_timeout`. Manifest identity
  passed, but the login route remained at `Verifying login status…` beyond Playwright's default
  five-second assertion timeout. The browser failed before credential entry or authentication.
- **Cleanup:** `passed-for-attempt`. No Admin session, draft mutation, validation, Snapshot, build,
  Preview grant, or VoiceOver record was created.
- **Required correction:** give the staging session bootstrap a bounded 60-second visibility timeout;
  the overall login and test budgets remain unchanged.

### human-u8-20260825a-15 — started

- **Kind/status:** `human` / `started`
- **Started at:** `2026-08-25T04:03:10.000Z`
- **Run manifest:** `u8-20260825a` / `c1605a7b5734972929945e8cef947c2f2584d4ecf4dc52e3170bfb519d547641`
- **Frozen code:** candidate `1e8231726d8a0ad2c9ed4c10e4d27092160fd629`; harness
  `25e010bfafa11efd81de6c8a13c148dba9c0265f`; harness manifest
  `30f0c826613c55d71237805278fc72f841777a707f937cac3477823d8ab213d6`; contract-test
  digest `4a78f7109a22c71282caddf5aedb5360b7059acd4190afa806a94c80adf2318b`.
- **Corrective reason:** the exact rendered release selection check is retained and the login title
  may wait up to 60 seconds for the real Fashion-staging session cold start. Formatting, Admin
  typecheck/lint, focused mocked browser flow, manifest rebuild, and standing authority pass.
- **Successor/build:** not yet created; the retry record is non-terminal.

### human-u8-20260825a-15 — failed

- **Kind/status:** `human` / `failed`
- **Started/finished:** `2026-08-25T04:03:10.000Z` / `2026-08-25T04:04:39.000Z`
- **Run manifest:** `c1605a7b5734972929945e8cef947c2f2584d4ecf4dc52e3170bfb519d547641`
- **Failure class:** `catalog_release_selection_item_has_no_dom_text`. The bounded cold-start wait
  worked, the replacement credential authenticated, and the editor loaded. The release ID is
  exposed as visible aggregate text for the Live preview context Card, but not as text content on
  Ant Select's `.ant-select-selection-item`; the class-scoped locator therefore failed before edit.
- **Cleanup:** `passed`. Every operator session was revoked, the Playwright browser closed, and the
  residual test-browser window opened by post-failure inspection was terminated. No human edit,
  validation, Snapshot, build, Preview grant, or VoiceOver record occurred.
- **Required correction:** anchor the assertion to the exact `Live preview context` Card and require
  that bounded visible region to contain the frozen release ID.

### human-u8-20260825a-16 — started

- **Kind/status:** `human` / `started`
- **Started at:** `2026-08-25T04:07:00.000Z`
- **Run manifest:** `u8-20260825a` / `10233af59e907c0a18b36e882916c59abf38995d26309bfe4edd61d4c46aae8e`
- **Frozen code:** candidate `1e8231726d8a0ad2c9ed4c10e4d27092160fd629`; harness
  `f6a3cce6dbcbe0b7b72ede76d70d5a35c51279a4`; harness manifest
  `1a83e96637820ee6f48fe77c3049ddf17d642ae8a1d1033f30ea3fc41297af5f`; contract-test
  digest `fb332610eb646858509d1e6feade7076f0044a8bdff53e26bd6cbbcb98da32b8`.
- **Corrective reason:** release identity is asserted within the exact live-preview context Card,
  preserving the visible combobox requirement without relying on Ant Select's internal node shape.
  Formatting, Admin typecheck/lint, focused mocked browser flow, manifest rebuild, and standing
  authority pass.
- **Successor/build:** not yet created; the retry record is non-terminal.

### human-u8-20260825a-16 — failed

- **Kind/status:** `human` / `failed`
- **Started/finished:** `2026-08-25T04:07:00.000Z` / `2026-08-25T04:12:13.000Z`
- **Run manifest:** `10233af59e907c0a18b36e882916c59abf38995d26309bfe4edd61d4c46aae8e`
- **Failure class:** `computer_use_focus_interfered_with_open_select`. Login, context-Card identity,
  and expected failed validation passed. The replacement option resolved as
  `Travel essentials · /collections/travel-essentials` and was initially visible, but a concurrent
  Computer Use progress inspection changed the browser focus timing; the open Select closed and the
  role option became hidden. The test was manually interrupted after repeated actionability retries.
- **Cleanup:** `passed`. The only retained remote output is the expected failed-validation audit.
  Every operator session was revoked; no replacement, save, successor, Snapshot, build, Preview
  grant, or VoiceOver record occurred.
- **Corrective reason for retry:** keep the exact same frozen harness and inputs, but after submitting
  login do not inspect, foreground, or otherwise touch the browser until the automated flow reaches
  its terminal VoiceOver-record wait or fails on its own.

### human-u8-20260825a-17 — started

- **Kind/status:** `human` / `started`
- **Started at:** `2026-08-25T04:13:00.000Z`
- **Run manifest and frozen code:** unchanged from attempt 16.
- **Corrective reason:** repeat the proven login and run the browser flow without concurrent Computer
  Use focus inspection. Only the process output and server-side non-secret audit state may be
  monitored until the VoiceOver evidence handoff.
- **Successor/build:** not yet created; the retry record is non-terminal.

### human-u8-20260825a-17 — failed

- **Kind/status:** `human` / `failed`
- **Started/finished:** `2026-08-25T04:13:00.000Z` / `2026-08-25T04:14:01.000Z`
- **Run manifest:** `10233af59e907c0a18b36e882916c59abf38995d26309bfe4edd61d4c46aae8e`
- **Failure class:** `persisted_invalid_validation_did_not_refocus_summary`. With no concurrent
  browser inspection, login and the context identity passed. The expected failed validation rendered
  its linked issue summary, but the summary stayed inactive. The source draft already retained the
  same invalid validation identity/status/issue count from the prior attempt, so the effect keyed
  only to those fields did not rerun after explicit revalidation.
- **Cleanup:** `passed`. Every operator session was revoked. The failed-validation audit is retained;
  no replacement, save, successor, Snapshot, build, Preview grant, or VoiceOver record occurred.
- **Implemented correction:** explicit invalid revalidation increments a focus-request generation,
  so React refocuses the committed summary even when the server returns the same persisted validation
  record. A focused regression reproduces that exact same-record case.

### human-u8-20260825a-18 — started

- **Kind/status:** `human` / `started`
- **Started at:** `2026-08-25T04:17:00.000Z`
- **Run manifest:** `u8-20260825a` / `b8fd93aa1feaead913ae51efdb2cbf587922e4aef23a09f80ddb792fc02ad818`
- **Frozen code:** candidate `1e8231726d8a0ad2c9ed4c10e4d27092160fd629`; harness
  `79bc92615810533851ba5ec1432a23f51f7714ac`; harness manifest
  `70f8435fe190396656d735a82cf3ea48d0f06a660e9f1b056939a19ba87675bc`; contract-test
  digest `f39a1da062f903a5ca29492361745fb655e7815ca00ad2bf5025463be500ae06`.
- **Corrective reason:** the product now refocuses repeated invalid summaries through an explicit
  focus-request generation. All 19 editor tests, Admin typecheck/lint, formatting, canonical manifest
  rebuild, and standing authority pass.
- **Successor/build:** not yet created; the retry record is non-terminal.

### human-u8-20260825a-18 — failed

- **Kind/status:** `human` / `failed`
- **Started/finished:** `2026-08-25T04:17:00.000Z` / `2026-08-25T04:24:58.000Z`
- **Run manifest:** `b8fd93aa1feaead913ae51efdb2cbf587922e4aef23a09f80ddb792fc02ad818`
- **Failure class:** `ant_virtual_option_mouse_actionability_mismatch`. Login and the repeated-invalid
  summary focus correction passed. The collection listbox opened and put assistive focus on its sole
  `Travel essentials · /collections/travel-essentials` option, while Playwright's role locator bound
  to Ant's hidden virtual option node and retried mouse actionability until manual interruption.
- **Cleanup:** `passed`. Every operator session was revoked. No replacement, save, successor,
  Snapshot, build, Preview grant, or VoiceOver record occurred.
- **Implemented correction:** verify the open listbox contains the named replacement and press Enter
  on the focused option. The live configuration now gives ordinary actions a bounded 60-second
  timeout so a future control mismatch cannot consume the full 20-minute test budget.

### human-u8-20260825a-19 — started

- **Kind/status:** `human` / `started`
- **Started at:** `2026-08-25T04:26:30.000Z`
- **Run manifest:** `u8-20260825a` / `1912ecd04b968b60759f2b3a6d17b39dd975d88de32ae5f0a9388eafd64d60da`
- **Frozen code:** candidate `1e8231726d8a0ad2c9ed4c10e4d27092160fd629`; harness
  `ad3584224b769d86908ecb43b4615244d5b6ddf9`; harness manifest
  `2377fd62e5453e0d64cbf4ea2c23fc2f21aa1fe7597c5cbf0277578cffe046f5`; contract-test
  digest `d523aaccea03c78f2da3d822703fa43270b307f644fda10a256f900f0f25fa54`.
- **Corrective reason:** replace the hidden virtual-option mouse click with the actual keyboard path:
  named listbox assertion followed by Enter. Formatting, Admin typecheck/lint, focused mocked browser
  flow, manifest rebuild, and standing authority pass.
- **Successor/build:** not yet created; the retry record is non-terminal.

### human-u8-20260825a-19 — failed

- **Kind/status:** `human` / `failed`
- **Started/finished:** `2026-08-25T04:26:30.000Z` / `2026-08-25T04:30:37.000Z`
- **Run manifest:** `1912ecd04b968b60759f2b3a6d17b39dd975d88de32ae5f0a9388eafd64d60da`
- **Failure class:** `ant_listbox_text_is_id_not_accessible_name`. The first login submission was
  locally blocked after consecutive clipboard pastes restored unrelated clipboard content into the
  email field; no request was sent. A corrected keyboard email plus pasted password produced one
  denied audit, then reprovisioning and keyboard entry authenticated. The editor focus correction
  passed, but listbox DOM text was the stable collection ID while `Travel essentials` was exposed
  only as the option's accessible name, so the text assertion failed before Enter.
- **Cleanup:** `passed`. Every operator session was revoked. No replacement, save, successor,
  Snapshot, build, Preview grant, or VoiceOver record occurred.
- **Implemented correction:** assert exactly one option with the expected accessible name, without
  clicking its hidden virtual node, then select it with Enter. Credential entry for the next run uses
  keyboard events in separate steps; no consecutive clipboard paste is allowed.

### human-u8-20260825a-20 — started

- **Kind/status:** `human` / `started`
- **Started at:** `2026-08-25T04:33:00.000Z`
- **Run manifest:** `u8-20260825a` / `716bd0f0ce23742c28f8fa0c0846f4065a7bd9ed496a6ac11763965eb57e9d15`
- **Frozen code:** candidate `1e8231726d8a0ad2c9ed4c10e4d27092160fd629`; harness
  `7b5d6d1ddd096b6805feacc739b7b4b8d46a3420`; harness manifest
  `cf441c0f03046bbfe95bd2052fdb18be3e2aa7f795acea8bb64f921842137231`; contract-test
  digest `c0093ad1382bb7f6878044a5bca23046f84bd06d3f0c50c978ff5a89f0d47f0b`.
- **Corrective reason:** option identity now uses its accessible name and selection remains keyboard
  Enter. Formatting, Admin typecheck/lint, focused mocked browser flow, manifest rebuild, and
  standing authority pass.
- **Successor/build:** not yet created; the retry record is non-terminal.

### human-u8-20260825a-20 — failed

- **Kind/status:** `human` / `failed`
- **Started/finished:** `2026-08-25T04:33:00.000Z` / `2026-08-25T04:34:02.000Z`
- **Run manifest:** `716bd0f0ce23742c28f8fa0c0846f4065a7bd9ed496a6ac11763965eb57e9d15`
- **Failure class:** `global_and_select_polite_regions_caused_strict_locator_collision`. Keyboard-only
  credential entry authenticated. The accessible-name option assertion and Enter replacement passed;
  the missing-reference error cleared and the editor announced revalidation. The generic
  `[aria-live="polite"]` assertion then matched both the intended global screen-reader announcement
  and Ant Select's selected-value announcement, causing strict-mode failure before save.
- **Cleanup:** `passed`. Every operator session was revoked. The replacement remained local and was
  never saved; no successor, Snapshot, build, Preview grant, or VoiceOver record occurred.
- **Implemented correction:** scope all three governed editor announcements to the product-owned
  `.sr-only[aria-live="polite"]` region, excluding component-library live regions.

### human-u8-20260825a-21 — started

- **Kind/status:** `human` / `started`
- **Started at:** `2026-08-25T04:36:00.000Z`
- **Run manifest:** `u8-20260825a` / `ae7ba5cabb7c86bb0324658d11f8c8a5c54bdc7a0af6f59efb2960bf3bf96fa1`
- **Frozen code:** candidate `1e8231726d8a0ad2c9ed4c10e4d27092160fd629`; harness
  `1c1dd663dced6405aa1142cd28557f0b90c36612`; harness manifest
  `4394439959045ed41dd66e8569b5040b4193d27fd3d0ec36748b44ae96908192`; contract-test
  digest `c77c4e282bb4a748c5ffe57dc5c11a0611f97f291580d759cea266e22b3b225b`.
- **Corrective reason:** validation, conflict-successor, and preview-return announcements now target
  the editor's global screen-reader region. Formatting, Admin typecheck/lint, focused mocked browser
  flow, manifest rebuild, and standing authority pass.
- **Successor/build:** not yet created; the retry record is non-terminal.

### human-u8-20260825a-21 — failed

- **Kind/status:** `human` / `failed`
- **Started/finished:** `2026-08-25T04:36:00.000Z` / `2026-08-25T04:36:53.000Z`
- **Run manifest:** `ae7ba5cabb7c86bb0324658d11f8c8a5c54bdc7a0af6f59efb2960bf3bf96fa1`
- **Failure class:** `save_button_name_not_exact`. Keyboard login, invalid-summary focus, replacement,
  and scoped announcement all passed. `getByRole(button, name: "Save")` also matched `Validate saved
version` and `Save and preview`, causing strict-mode failure before save.
- **Cleanup:** `passed`. Every operator session was revoked. The replacement was not saved; no
  successor, Snapshot, build, Preview grant, or VoiceOver record occurred.
- **Implemented correction:** all three ordinary Save actions now require the exact accessible name.

### human-u8-20260825a-22 — started

- **Kind/status:** `human` / `started`
- **Started at:** `2026-08-25T04:39:00.000Z`
- **Run manifest:** `u8-20260825a` / `fd01b3853eec95b8c6760762d02fd079029d467a5adf848fbf86b5e0e812ea23`
- **Frozen code:** candidate `1e8231726d8a0ad2c9ed4c10e4d27092160fd629`; harness
  `b7326f416190bb888e3d3dd1bb7aca6132699f34`; harness manifest
  `b6526594a1e918f7ad2dbefd7499863734b54cffe7f26d9ef69e3516aa6942cb`; contract-test
  digest `925357fd4af2080d217a39734c9b9d199d4c67e224333e19606670c5e7e4b0c7`.
- **Corrective reason:** ordinary save locators now use exact accessible names. Formatting, Admin
  typecheck/lint, focused mocked browser flow, manifest rebuild, and standing authority pass.
- **Successor/build:** not yet created; the retry record is non-terminal.

### human-u8-20260825a-22 — failed

- **Kind/status:** `human` / `failed`
- **Started/finished:** `2026-08-25T04:39:00.000Z` / `2026-08-25T04:40:03.000Z`
- **Run manifest:** `fd01b3853eec95b8c6760762d02fd079029d467a5adf848fbf86b5e0e812ea23`
- **Failure class:** `successor_route_read_before_async_navigation`. Login, replacement, save, a real
  two-context optimistic conflict, and **Save local edits as successor** succeeded. The test read the
  current URL immediately after the announcement, before asynchronous navigation committed, and
  therefore incorrectly compared the source ID to itself.
- **Cleanup:** `passed-with-retained-output`. Every operator session was revoked. Source
  `draft-fashion-u8-u8-20260825a-source` reached v3; failed-attempt successor
  `draft-a9d08f31-8b7c-4210-8a26-89b0465198ce` v1 and its successful creation audit are retained as
  non-candidate evidence. Neither draft was validated or approved; no Snapshot, build, Preview
  grant, or VoiceOver record occurred.
- **Implemented correction/setup:** wait up to 60 seconds for the route's final segment to differ
  from the source before reading successor identity. New audited retry source
  `draft-fashion-u8-u8-20260825a-retry22-source` v1 was derived from the source-parity baseline with
  empty overrides and exact absent ID `col_U8MISSING20260825A0000`; setup audit is
  `audit-fashion-u8-u8-20260825a-retry22-source-setup`.

### human-u8-20260825a-23 — started

- **Kind/status:** `human` / `started`
- **Started at:** `2026-08-25T04:43:30.000Z`
- **Run manifest:** `u8-20260825a` / `28e8d47ec857eec3261ad57d6fffb2922b3404f16a9c82b6af239b71e48d28e4`
- **Frozen code:** candidate `1e8231726d8a0ad2c9ed4c10e4d27092160fd629`; harness
  `3a930ff14e000b29846058d58fa8f339c4e00a09`; harness manifest
  `1e71466798da79962006971de8cf25e3447c1ae359cb1124f1330a63c9a98f7c`; contract-test
  digest `59a2703d13f8be8965f49e0b7c87c0e7d3a283c681153b3542229b9d6b87401`.
- **Prepared source:** `draft-fashion-u8-u8-20260825a-retry22-source` v1 with audited exact missing
  reference and no overrides. Failed-attempt source/successor outputs remain excluded.
- **Corrective reason:** successor identity is read only after route handoff completes. Formatting,
  Admin typecheck/lint, focused mocked browser flow, manifest rebuild, and standing authority pass.
- **Successor/build:** not yet created; the retry record is non-terminal.

### human-u8-20260825a-23 — failed

- **Kind/status:** `human` / `failed`
- **Started/finished:** `2026-08-25T04:43:30.000Z` / `2026-08-25T04:44:53.000Z`
- **Run manifest:** `28e8d47ec857eec3261ad57d6fffb2922b3404f16a9c82b6af239b71e48d28e4`
- **Failure class:** `retry_source_binding_index_reordered`. Login and editor load passed, but the
  expected featured-collection missing marker was absent. Setup had modified `bindings[6]` based on
  the original order; after prior source saves, index 6 was `default-collection` and
  `featured-collection` had moved to index 7.
- **Cleanup:** `passed`. Every operator session was revoked; no human edit, successor, validation,
  Snapshot, build, Preview grant, or VoiceOver record occurred.
- **Corrected setup:** restored default-collection to `col_01JFASHIONLIVE0000000001`, set the binding
  identified by `settingId === "featured-collection"` to `col_U8MISSING20260825A0000`, retained
  retry source v1 with empty overrides, and recorded audit
  `audit-fashion-u8-u8-20260825a-retry22-binding-index-fix`.

### human-u8-20260825a-24 — started

- **Kind/status:** `human` / `started`
- **Started at:** `2026-08-25T04:45:30.000Z`
- **Run manifest and frozen code:** unchanged from attempt 23.
- **Corrective reason:** the retry source now verifies missing state by stable setting IDs instead of
  array position: default-collection is live, featured-collection is the sole intended missing
  reference, version remains 1, and overrides remain empty.
- **Successor/build:** not yet created; the retry record is non-terminal.

### human-u8-20260825a-24 — failed

- **Kind/status:** `human` / `failed`
- **Started/finished:** `2026-08-25T04:45:30.000Z` / `2026-08-25T04:48:36.000Z`
- **Run manifest:** `28e8d47ec857eec3261ad57d6fffb2922b3404f16a9c82b6af239b71e48d28e4`
- **Failure class:** `dirty_blocker_prevented_successor_route_alignment`. Missing-reference validation,
  replacement, saves, conflict, and successor creation passed. Successor
  `draft-14da6b38-7ce7-4a56-9d14-9e22a6b05ace` was created, but the component called navigate in the
  same update batch while `dirty` was still true, so the route blocker retained the source URL and
  the explicit 60-second route wait expired.
- **Cleanup:** `passed-with-retained-output`. Every operator session was revoked. Retry22 source v3,
  the unvalidated successor, and their audits are retained as excluded non-candidate evidence; no
  validation of the successor, Snapshot, build, Preview grant, or VoiceOver record occurred.
- **Implemented correction/setup:** route alignment is now state-driven after successor/saved state
  commits and `dirty === false`; its 19-test editor regression passes. New audited retry source
  `draft-fashion-u8-u8-20260825a-retry24-source` v1 has empty overrides, live default-collection,
  and the sole intended missing featured-collection. Setup audit is
  `audit-fashion-u8-u8-20260825a-retry24-source-setup`.

### human-u8-20260825a-25 — started

- **Kind/status:** `human` / `started`
- **Started at:** `2026-08-25T04:53:00.000Z`
- **Run manifest:** `u8-20260825a` / `5ef88b3c7ed13679980f8e346addde261b5b33c1755f3b7ba2bc2115314e8ac2`
- **Frozen code:** candidate `1e8231726d8a0ad2c9ed4c10e4d27092160fd629`; harness
  `e1a55e181378efbe3130504062e337b9a20e495d`; harness manifest
  `6586b536b65cd1c0ee5c0aa4796cd1f48e30a8f5f1a2f1c30840d1e87c38e41a`; contract-test
  digest `efb4c6e9f4e2b029b11f475dd1811941a4b975e58bb5032ac0686cd84696187c`.
- **Prepared source:** `draft-fashion-u8-u8-20260825a-retry24-source` v1 with stable-ID verified
  bindings and no overrides. All prior mutable successors remain excluded.
- **Corrective reason:** product route alignment waits for clean committed successor state before
  navigation. Editor tests, typecheck/lint, formatting, manifest rebuild, and standing authority pass.
- **Successor/build:** not yet created; the retry record is non-terminal.

### human-u8-20260825a-25 — failed

- **Kind/status:** `human` / `failed`
- **Started/finished:** `2026-08-25T04:53:00.000Z` / `2026-08-25T05:01:00.000Z`
- **Run manifest:** `5ef88b3c7ed13679980f8e346addde261b5b33c1755f3b7ba2bc2115314e8ac2`
- **Failure class:** `fashion_staging_preview_build_hook_not_configured`. Keyboard login,
  missing-reference validation and recovery, accessible resource replacement, ordinary saves, a
  real two-context optimistic conflict, successor route handoff, successor validation, and Preview
  Snapshot creation all passed. The resulting build failed immediately because Fashion staging has
  no configured `PREVIEW_BUILD_HOOK`; this is an environment/CD wiring failure, not an editor-content
  or accessibility assertion failure.
- **Retained excluded output:** successor `draft-fce674d7-464f-44c1-95d7-8224a57c2f55`, Preview
  Snapshot `snapshot-preview-c23a28656de8a42e8290cdaa03351da4`, and failed build
  `preview-build-6de8a42e8290cdaa03351da4-f1bb77ee6f824f48-1` remain classified non-candidate
  evidence. No Preview grant, immutable approval, VoiceOver record, or terminal p95 evidence was
  produced.
- **Cleanup:** `passed-with-retained-output`. Every operator session was revoked and the active
  session count returned to zero. The browser wait was interrupted only after the server-side build
  had reached its terminal failed state.
- **Corrective requirement before rerun:** connect Fashion staging's Preview build hook to the
  governed local-CI/self-hosted remote-CD executor, verify callback and failure handling without
  GitHub-hosted billing as a CI prerequisite, then create a fresh deterministic missing-reference
  source. The consumed retry24 source and all attempt-25 outputs remain excluded from reuse.

### human-u8-20260825a-26 — started

- **Kind/status:** `human` / `started`
- **Started at:** `2026-08-25T05:09:07.000Z`
- **Run manifest:** `u8-20260825a` / `cf704fc336220807c42bfc8254fcb9b51ffb73f4029f450ccc31f1f8e71e352d`
- **Frozen code:** candidate `1e8231726d8a0ad2c9ed4c10e4d27092160fd629`; harness
  `e1a55e181378efbe3130504062e337b9a20e495d`; harness manifest
  `6586b536b65cd1c0ee5c0aa4796cd1f48e30a8f5f1a2f1c30840d1e87c38e41a`; contract-test
  digest `efb4c6e9f4e2b029b11f475dd1811941a4b975e58bb5032ac0686cd84696187c`.
- **Prepared source:** `draft-fashion-u8-u8-20260825a-retry25-source` v1 has no overrides, a live
  default collection, and the sole intended missing featured collection. Setup audit is
  `audit-fashion-u8-u8-20260825a-retry25-source-setup`.
- **Corrective reason:** Fashion staging now has an authenticated ephemeral build hook that dispatches
  only the frozen Preview workflow to the isolated self-hosted U8 runner. Its public endpoint rejects
  unauthenticated and malformed input, stores no GitHub credential, and does not use GitHub-hosted
  runner billing; protected environment secrets remain runner-side.
- **Successor/build:** not yet created; the attempt is non-terminal.

### human-u8-20260825a-26 — failed

- **Kind/status:** `human` / `failed`
- **Started/finished:** `2026-08-25T05:09:07.000Z` / `2026-08-25T05:33:11.000Z`
- **Run manifest:** `cf704fc336220807c42bfc8254fcb9b51ffb73f4029f450ccc31f1f8e71e352d`
- **Failure class:** `human_locator_used_display_label_instead_of_accessible_name`. Login and the
  exact source editor load passed, then the live harness waited for group name `Featured
collection`. The real fieldset's stable accessible name is
  `fashion-store-home featured-collection`; no draft mutation occurred before the 20-minute hard
  timeout. The same invocation also carried the unexercised wrong heading name `Merchandising
title` instead of `fashion-store-home merchandising-title`.
- **Cleanup:** `passed`. The source remains v1 with no overrides, no successor, Snapshot, build, or
  Preview grant was created, every operator session was revoked, and the identity was disabled with
  zero active sessions.
- **Implemented correction:** the two manifest-owned stable control names are now fixed harness
  constants instead of caller-supplied display-label parameters. The Playwright contract regression
  failed on the old behavior and passes after the correction.

### human-u8-20260825a-27 — started

- **Kind/status:** `human` / `started`
- **Started at:** `2026-08-25T05:36:05.000Z`
- **Run manifest:** `u8-20260825a` / `dd0d2baaba87dfc4fa37ba4cb85cff1adcda618a9f9724b3948c106878188cfa`
- **Frozen code:** candidate `1e8231726d8a0ad2c9ed4c10e4d27092160fd629`; harness
  `500d4ba7c068caed7fca43275f1211aacdabcb8b`; harness manifest
  `b178634b5b28773d4c4c08fc824cd0ab843b5c49f68bdc85e87a86c2461bccd9`; contract-test
  digest `241f1b90a427cbfc68dd27194328db93fb6cf7489928f320152d9556641756d3`.
- **Prepared source:** unchanged `draft-fashion-u8-u8-20260825a-retry25-source` v1 with audited sole
  missing featured collection and no overrides. Attempt 26 did not mutate it.
- **Corrective reason:** the live harness now owns the exact manifest-derived accessible control
  names and cannot be launched with their display labels. Focused red/green regression, formatting,
  Admin typecheck, lint, manifest rebuild, standing authority, operator reconciliation, and
  reprovisioning all pass.
- **Successor/build:** not yet created; the attempt is non-terminal.

### human-u8-20260825a-27 — failed

- **Kind/status:** `human` / `failed`
- **Started/finished:** `2026-08-25T05:36:05.000Z` / `2026-08-25T05:43:04.000Z`
- **Run manifest:** `dd0d2baaba87dfc4fa37ba4cb85cff1adcda618a9f9724b3948c106878188cfa`
- **Failure class:** `human_conflict_ui_wait_was_not_bound_to_the_stale_put_response`. Login,
  missing-reference validation and replacement, the replacement save, and the competing-page save
  passed. The consumed retry25 source reached v3. The stale save did not advance the draft, but the
  harness began a default five-second UI assertion without first retaining the causal PUT response,
  so the conflict panel was not observed within that assertion window.
- **Cleanup:** `passed-with-retained-output`. The operator identity is disabled and active sessions
  are zero. The v3 source and its successful update audits remain excluded non-candidate evidence;
  no successor, Snapshot, build, Preview grant, approval, or VoiceOver record was created.
- **Implemented correction:** the live harness now starts an exact source-draft PUT response wait
  before the stale save, requires status `409`, and gives the resulting conflict panel an explicit
  60-second bound. The focused regression failed before the change and now passes with Admin
  typecheck, lint, and formatting at harness `ed91c980`.

### human-u8-20260825a-28 — started

- **Kind/status:** `human` / `started`
- **Started at:** `2026-08-25T05:47:13.000Z`
- **Run manifest:** `u8-20260825a` / `8117f5f0703feb672ea7cdddca087778f1dd0d0aa4f3b68abceaab1ebe2a0dfd`
- **Frozen code:** candidate `1e8231726d8a0ad2c9ed4c10e4d27092160fd629`; harness
  `ed91c9801399bbdad38782bc768600fcb4972171`; harness manifest
  `6fb2e43eef4e465a728bdc4d25a5d0f838fe915638b3c3825868097ff4c5a228`; contract-test
  digest `45210843132eaa7b3d7eb20a35a6bf701c4829eab83d27abc5aba4eecb1ff158`.
- **Prepared source:** `draft-fashion-u8-u8-20260825a-retry27-source` v1 has no overrides, live
  default collection, and the sole intended missing featured collection. Setup audit is
  `audit-fashion-u8-u8-20260825a-retry27-source-setup`.
- **Corrective reason:** the stale-save proof is causally bound to the exact PUT `409` before the
  conflict UI and successor path are asserted. Standing authority, manifest hashes, environment
  variables, operator reconciliation, and reprovisioning all pass.
- **Successor/build:** not yet created; the attempt is non-terminal.

### human-u8-20260825a-28 — failed

- **Kind/status:** `human` / `failed`
- **Started/finished:** `2026-08-25T05:47:13.000Z` / `2026-08-25T05:50:30.000Z`
- **Run manifest:** `8117f5f0703feb672ea7cdddca087778f1dd0d0aa4f3b68abceaab1ebe2a0dfd`
- **Failure class:** `operator_invocation_used_incorrect_catalog_display_name`. Login and invalid
  validation passed, then the replacement picker correctly returned no option for the supplied
  guessed label `Fashion U12 Live Collection`. The frozen release manifest identifies the canonical
  collection as `Travel essentials`.
- **Cleanup:** `passed`. The source remains v1 with zero overrides and its sole intended missing
  featured collection; no save, successor, Snapshot, build, Preview grant, approval, or VoiceOver
  record occurred. The operator is disabled and active sessions are zero.
- **Corrective requirement:** reuse the unchanged source and frozen manifests, launch with the
  release-derived `Travel essentials` label, and do not alter the harness or candidate identity.

### human-u8-20260825a-29 — started

- **Kind/status:** `human` / `started`
- **Started at:** `2026-08-25T05:50:49.000Z`
- **Run manifest:** `u8-20260825a` / `8117f5f0703feb672ea7cdddca087778f1dd0d0aa4f3b68abceaab1ebe2a0dfd`
- **Frozen code:** candidate `1e8231726d8a0ad2c9ed4c10e4d27092160fd629`; harness
  `ed91c9801399bbdad38782bc768600fcb4972171`; harness manifest
  `6fb2e43eef4e465a728bdc4d25a5d0f838fe915638b3c3825868097ff4c5a228`; contract-test
  digest `45210843132eaa7b3d7eb20a35a6bf701c4829eab83d27abc5aba4eecb1ff158`.
- **Prepared source:** unchanged audited retry27 source v1; Attempt28 made no mutation.
- **Corrective reason:** the replacement display name is read from the frozen Catalog Release as
  `Travel essentials`; operator reconciliation and reprovisioning pass with zero retained sessions.
- **Successor/build:** not yet created; the attempt is non-terminal.

### human-u8-20260825a-29 — failed

- **Kind/status:** `human` / `failed`
- **Started/finished:** `2026-08-25T05:50:49.000Z` / `2026-08-25T05:53:40.000Z`
- **Run manifest:** `8117f5f0703feb672ea7cdddca087778f1dd0d0aa4f3b68abceaab1ebe2a0dfd`
- **Failure class:** `competing_save_response_not_awaited_before_stale_save`. Login, invalid
  validation, replacement, and the first save passed. The harness then clicked the competing save
  but did not await its PUT response before the stale page submitted; the stale PUT won with `200`
  and advanced the source to v3 instead of proving a `409` conflict.
- **Cleanup:** `passed-with-retained-output`. The consumed v3 source and its two successful update
  audits are excluded non-candidate evidence. No successor, Snapshot, build, Preview grant,
  approval, or VoiceOver record occurred; the operator is disabled and active sessions are zero.
- **Implemented correction:** harness `91e5db24` starts and validates the competing PUT `200` before
  the stale page may submit, then independently requires the stale PUT `409`. The focused
  red/green regression, typecheck, lint, and formatting pass. Fresh audited source
  `draft-fashion-u8-u8-20260825a-retry29-source` is v1 with the sole intended missing reference.

### human-u8-20260825a-30 — started

- **Kind/status:** `human` / `started`
- **Started at:** `2026-08-25T05:56:00.000Z`
- **Run manifest:** `u8-20260825a` / `806d61396072c8c904cacde51fc47cc0d6317608dd244e5090884876c47129aa`
- **Frozen code:** candidate `1e8231726d8a0ad2c9ed4c10e4d27092160fd629`; harness
  `91e5db248f7e53c9029c73539ee7d0dfa575233a`; harness manifest
  `b1816a408e96dcc82958144d05851607c8ae38fcd2a990e66a186f1268951c33`; contract-test
  digest `c5baad7ff9b3ee0e73f6e4cd9557dcfb8fa92abae03ecb55d043a834ed88c78d`.
- **Prepared source:** `draft-fashion-u8-u8-20260825a-retry29-source` v1 with audited sole missing
  featured collection and no overrides.
- **Corrective reason:** the two-context conflict sequence now proves competing PUT `200` before
  stale PUT `409`; standing authority, hashes, environment bindings, operator reconciliation, and
  reprovisioning pass.
- **Successor/build:** not yet created; the attempt is non-terminal.

### human-u8-20260825a-30 — failed

- **Kind/status:** `human` / `failed`
- **Started/finished:** `2026-08-25T05:56:00.000Z` / `2026-08-25T07:48:16.000Z`
- **Run manifest:** `806d61396072c8c904cacde51fc47cc0d6317608dd244e5090884876c47129aa`
- **Failure class:** `retained_human_state_unavailable_after_preview_checkout_failure`. The
  surviving GitHub record proves that Preview run `32814863542` was dispatched for exact harness
  `91e5db24`, waited for the isolated runner, and then failed in `actions/checkout@v4`. Every step
  after checkout—including readiness download, build, deployment, U13, purchase, restoration, and
  evidence publication—was skipped. No immutable candidate or passing U8 evidence was produced.
  The repository contains no retained human-evidence file from this attempt, so the human lane,
  source-draft version, successor identity, and any Admin-side audit outcome cannot be reconstructed
  from local evidence and are conservatively treated as failed rather than inferred complete.
- **Cleanup:** `incomplete`. On 2026-08-28 no runner listener or related child process was active;
  repository runner ID `71` / `shoppp-fashion-u8-20260825a` was offline and not busy, then its exact
  GitHub registration was removed and the repository inventory no longer contained that name or the
  `fashion-staging-u8` label. The dedicated local account and inaccessible runner home still require
  a privileged operator to retain exact manifests before removal. Fashion D1 operator/session and
  retry29 source state could not be queried because the available Cloudflare identity was rejected
  with API code `7403`; those states remain an explicit reconciliation blocker.
- **Retained immutable output:** failed GitHub run `32814863542` and job `97701009346`; no build or
  deployment artifact was produced after checkout failed.
