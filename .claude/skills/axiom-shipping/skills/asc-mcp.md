
# App Store Connect MCP Integration

**Core principle**: With asc-mcp configured, the App Store Connect workflow — builds, TestFlight, submission, phased release, reviews, Xcode Cloud, IAP and subscriptions — runs from the assistant without the web dashboard.

Covers asc-mcp **v4.1.6**: 502 tools, 35 workers, pinned to App Store Connect API 4.4.1. **Every tool input is snake_case** (`app_id`, `version_id`, `build_id`); camelCase keys fail as missing or unknown parameters.

## Setup

### Install

```bash
brew install mint
mint install zelentsov-dev/asc-mcp@v4.1.6   # the tag includes the v
~/.mint/bin/asc-mcp --version
```

| Requirement | Detail |
|-------------|--------|
| Toolchain | Swift 6.2+ (Mint builds from source) — Xcode 26.x |
| macOS | 15.6+ recommended and CI-tested; 14.0–15.5 is the declared target only, unverified |
| Runtime | Local stdio server on a Mac. No Linux or Windows; web and cloud sessions don't inherit a local MCP config |

### API Key

1. [App Store Connect → Users and Access → Integrations → Team Keys](https://appstoreconnect.apple.com/access/integrations/api)
2. Least-privileged role that covers the workflow; App Manager or Admin only when an operation needs it
3. Download the `.p8` (one-time download) → `~/.keys/`, `chmod 600`
4. Note the **Key ID** and **Issuer ID**

### Credentials

`~/.config/asc-mcp/companies.json` (recommended — GUI clients don't inherit shell env vars):

```json
{
  "companies": [
    {
      "id": "my-company",
      "name": "My Company",
      "key_id": "KEY_ID",
      "issuer_id": "ISSUER_ID",
      "key_path": "/Users/you/.keys/AuthKey_KEY_ID.p8",
      "vendor_number": "OPTIONAL"
    }
  ]
}
```

- One object per App Store Connect team. `key_path` must be absolute; `key_content` (PEM string) overrides it.
- `vendor_number` only feeds `analytics_sales_report`, `analytics_financial_report`, `analytics_app_summary` (or pass it per call). Missing → explicit "Missing vendor_number" error.
- Resolution order: `--companies <path>` → `ASC_MCP_COMPANIES=<path>` → `~/.config/asc-mcp/companies.json` → `~/Library/Application Support/asc-mcp/companies.json` → `ASC_COMPANY_{N}_KEY_ID`/`_ISSUER_ID`/`_KEY_PATH` or `_KEY` (PEM)/`_NAME`/`_VENDOR_NUMBER` (N from 1, stops at the first missing pair) → `ASC_KEY_ID` + `ASC_ISSUER_ID` + `ASC_PRIVATE_KEY_PATH` (or `ASC_PRIVATE_KEY`).
- An explicit path (`--companies` or `ASC_MCP_COMPANIES`) doesn't fall through: a missing file is fatal at startup, and env-var companies are never read.
- A `companies.json` at a default path beats `-e ASC_*` env vars. No config at all → the server exits at startup and exposes no tools.

### Register (Claude Code)

```bash
claude mcp add --transport stdio --scope user asc-mcp -- ~/.mint/bin/asc-mcp
claude mcp get asc-mcp
```

- Server flags go after the binary: `-- ~/.mint/bin/asc-mcp --workers apps,builds --read-only`
- Other clients: `command` = absolute path `/Users/you/.mint/bin/asc-mcp`; restart GUI clients. Codex: `codex mcp add asc-mcp -- ~/.mint/bin/asc-mcp`
- Never put credentials in a committed `.mcp.json`

### Verify

1. `company_current` → active company `id`, `name`, masked key. **Local only** — proves which config loaded, not that the key works.
2. `apps_list(limit: 1)` → a real API call. 401 → wrong Key ID or Issuer ID, modified `.p8`, or revoked key.

`auth_validate_token` is also local; it doesn't prove Apple accepts the token.

## Worker Filtering

No `--workers` flag → all 35 workers, 502 tools, ~60K tokens of schema when the client loads them eagerly. Tool-capped clients (Devin Desktop's Cascade: 100) need a filter.

| Preset | `--workers` | Tools |
|--------|-------------|-------|
| TestFlight | `apps,builds,beta_groups,beta_testers` | 63 |
| TestFlight + external review + feedback | add `beta_app,beta_feedback` | 81 |
| Release | `apps,builds,export_compliance,versions,reviews` | 72 |
| Xcode Cloud | `apps,builds,xcode_cloud` | 78 |
| Monetization + review submission | `apps,iap,subscriptions,pricing,review_submissions` | 193 (upstream's Monetization preset, without `review_submissions`: 184) |
| Marketing | `apps,screenshots,custom_pages,ppo,promoted` | 78 |
| Full | (no flag) | 502 |

- Counts include `company` (3) + `auth` (4), which always load.
- `builds` auto-adds `build_processing` + `build_beta` (4 + 4 + 11 = 19 tools). It does **not** add `build_uploads`.
- All keys: `company`, `auth`, `apps`, `accessibility`, `webhooks`, `xcode_cloud`, `builds`, `build_uploads`, `build_processing`, `export_compliance`, `build_beta`, `versions`, `reviews`, `beta_groups`, `beta_feedback`, `beta_testers`, `iap`, `subscriptions`, `sandbox`, `beta_app`, `pre_release`, `beta_license`, `provisioning`, `app_info`, `pricing`, `users`, `app_events`, `analytics`, `screenshots`, `custom_pages`, `ppo`, `promoted`, `review_attachments`, `review_submissions`, `metrics`
- Unknown key (e.g. pre-3.0 `offer_codes`) → stderr warning only; the server starts without it. Calling a filtered-out tool → "Worker 'x' is disabled".
- `--read-only` blocks every create, update, upload, submit, release, and delete before the handler runs; the tools stay listed but calls are refused. Reads and `company_switch` still work. Use it for audits and triage.

## Mutation Safety

| Operation | Required confirmation |
|-----------|----------------------|
| `app_versions_release` | `confirm_version_string` = exact version string |
| `app_versions_create_phased_release` with `ACTIVE` | `confirm_version_id` |
| `app_versions_update_phased_release` to `ACTIVE`/`COMPLETE` | `confirm_phased_release_id` |
| `app_versions_delete`, `app_versions_delete_phased_release` | exact-ID `confirm_*` |
| Screenshot, preview, custom page, PPO, promoted, review-attachment deletes | exact-ID `confirm_*` |
| `xcode_cloud_products_delete`, `xcode_cloud_workflows_delete` | default preview → latest receipt + exact name and counts from that preview + `confirm_permanent_deletion: true` |

- A failed write with `retrySafe: false`, `operationCommitState: unknown | committed_unverified`, or `write_outcome: not_confirmed` may already be applied → run the returned inspection step before retrying. A blind retry duplicates versions, submissions, or build runs.
- POST, PATCH, DELETE retry only on 401 (after a token refresh) and 429 — never after an ambiguous transport or 5xx failure. GET and PUT also retry 408 and 5xx.

## Workflow: Release Pipeline

```
0. (no build yet) build_uploads_upload(app_id, file_path, short_version, build_version, platform: "IOS", uti: "com.apple.ipa")
1. apps_search(query: "MyApp")                → app_id
2. builds_list(app_id, limit: 5)              → newest first; build_id with processing_state VALID
   builds_check_readiness(build_id)           → processing, encryption, expiry, TestFlight state
3. app_versions_list(app_id, version_strings: ["2.1.0"])   → reuse if present
   else app_versions_create(app_id, platform: "IOS", version_string: "2.1.0")
4. app_versions_attach_build(version_id, build_id)
5. app_versions_set_review_details(version_id, contact_first_name, contact_last_name, contact_phone, contact_email, notes)
6. (optional) app_versions_create_phased_release(version_id)   → INACTIVE until the version releases
7. app_versions_submit_for_review(version_id) → submission_id
8. Manual release, after approval (PENDING_DEVELOPER_RELEASE):
   app_versions_release(version_id, confirm_version_string: "2.1.0")
```

- **Step 0**: needs `build_uploads` in `--workers`; file path must be absolute. Or upload from Xcode or Xcode Cloud.
- **Step 2**: processing typically takes 5–30 min, longer at peak → poll `builds_get_processing_status` (non-blocking). Missing encryption answer → `builds_update_encryption(build_id, uses_non_exempt_encryption: false)` or `ITSAppUsesNonExemptEncryption` in Info.plist. `builds_check_readiness` doesn't judge version-level submission readiness.
- **Step 5**: `attachment_file_id` is rejected → `review_attachments_upload` after review details exist.
- **Step 7**: wraps the Review Submissions API (create → add item → confirm). Partial failure returns `submission_id` + `recovery_tools` → `app_versions_cancel_review(review_submission_id)` before retrying. Cancel takes the submission ID, not the version ID.
- **Step 8**: the version must be in `PENDING_DEVELOPER_RELEASE`. Without `confirm_version_string` the tool returns an error naming the exact string.

### Phased Release

- Configure in `PREPARE_FOR_SUBMISSION`, `WAITING_FOR_REVIEW`, `IN_REVIEW`, `WAITING_FOR_EXPORT_COMPLIANCE`, `PENDING_DEVELOPER_RELEASE`, `DEVELOPER_REJECTED`, `REJECTED`, `METADATA_REJECTED`; not after release, and only for version updates
- `app_versions_get_phased_release(version_id)` → `phased_release_id`, state, current day
- `app_versions_update_phased_release(phased_release_id, phased_release_state: "PAUSED")`; `ACTIVE` resumes, `COMPLETE` releases to everyone — both need `confirm_phased_release_id`. Pauses total at most 30 days; any number of pauses
- `app_versions_delete_phased_release` works only before the rollout starts

## Workflow: TestFlight Distribution

```
1. apps_search(query: "MyApp")                → app_id
2. builds_list(app_id, limit: 5)              → build_id (VALID)
3. builds_set_beta_localization(build_id, locale: "en-US", whats_new: "Bug fixes")
4. beta_groups_list(app_id)                   → group_id
   OR beta_groups_create(app_id, name: "Internal Testers", is_internal_group: true)
5. beta_groups_add_builds(group_id, build_ids: [build_id])
6. External group → beta_app_submit_for_review(build_id)
7. builds_send_beta_notification(build_id)    → notify testers (optional)
```

- `is_internal_group` defaults to `false` — omit it and the group is external.
- Internal (up to 100, team members) → available once processed, no review.
- External (up to 10,000 per app) → adding the build doesn't submit it. Step 6 needs the `beta_app` worker. The first build of a version gets full TestFlight App Review; later builds of that version may skip it.
- `builds_set_beta_localization` takes build-level fields only; feedback email, description, and policy URLs → `beta_app_create_localization` / `beta_app_update_localization`.
- New tester → `beta_testers_create(email, group_ids)`; resend → `beta_testers_send_invitation(beta_tester_id, app_id)`.

## Workflow: Review Management

```
1. apps_search(query: "MyApp")                → app_id
2. reviews_list(app_id, ratings: [1, 2], sort: "-createdDate", has_published_response: false, limit: 50)
3. reviews_stats(app_id, period: "last_month") → last_week | last_month | last_3_months | all_time
4. reviews_summarizations(app_id)             → Apple's generated summary of review themes
5. reviews_create_response(review_id, response_body: "Thank you for...")
```

- One response per review; a new response replaces the old one (users see "Developer Response")
- Respond to negative reviews within 24–48 hours, professionally, with specific help

## Workflow: TestFlight Feedback and Crash Triage

```
1. builds_list(app_id, limit: 10)             → build_id
2. beta_feedback_list_crashes(app_id, build_id: build_id)    → id (pass as submission_id), device, OS, tester
3. beta_feedback_get_crash_log(submission_id) → crash log text (max_log_chars, default 100,000)
4. beta_feedback_list_screenshots(app_id, build_id: build_id, include_pii: true)   → screenshots + tester comment
5. metrics_build_beta_usage(build_id)         → crash, session, install, feedback counts
```

- List tools default `include_pii: false` → the tester's email **and free-text comment** are omitted. The get tools default to `true`.
- Screenshot URLs expire (`expirationDate`).
- `metrics_build_diagnostics` and `metrics_build_perf` cover **App Store builds only** — TestFlight builds return 404. Signature types are `HANGS`, `LAUNCHES`, `DISK_WRITES`, not crashes. `metrics_get_diagnostic_logs(signature_id)` → call stacks.
- Analyze a crash log → crash-analyzer agent (`/axiom:analyze-crash`).

## Workflow: Xcode Cloud

```
1. xcode_cloud_app_product_get(app_id)        → product_id
2. xcode_cloud_product_workflows_list(product_id)  → workflow_id
3. xcode_cloud_build_runs_start(workflow_id: workflow_id)    → build_run_id
4. xcode_cloud_build_runs_get(build_run_id)   → executionProgress, completionStatus (poll)
5. xcode_cloud_build_run_actions_list(build_run_id)   → action_id per action
   → xcode_cloud_action_issues_list / xcode_cloud_action_test_results_list / xcode_cloud_action_artifacts_list(action_id)
6. xcode_cloud_build_run_builds_list(build_run_id)    → ASC build_id → TestFlight or Release workflow
```

- Start: exactly one of `workflow_id` (new run) or `build_run_id` (rebuild); at most one of `source_branch_or_tag_id` or `pull_request_id`; optional `clean: true`
- Git reference IDs: `xcode_cloud_workflow_repository_get(workflow_id)` → `repository_id` → `xcode_cloud_scm_repository_git_references_list(repository_id)`
- Start is never replayed after an ambiguous failure (only 401 and 429 retry). After one, inspect `xcode_cloud_workflow_build_runs_list(workflow_id)` before starting again.
- Unknown argument keys are rejected; a nested `*_limit` needs its matching `include`; `next_url` calls must repeat the original filters unchanged
- Workflow CRUD: `xcode_cloud_workflows_create`, `_update`, `_delete`

## Workflow: IAP and Subscription Review

API 4.4.1 versions IAP and subscription metadata. The legacy `iap_submit_for_review`, `subscriptions_submit`, `subscriptions_submit_group`, and product-scoped localization and image tools are deprecated — still callable, but they never create or select a version.

```
1. subscriptions_list_groups(app_id) → group_id; subscriptions_list(group_id) → subscription_id
   (IAP: iap_list(app_id) → iap_id)
2. subscriptions_list_versions(subscription_id)   → reuse an editable version
   else subscriptions_create_version(subscription_id)     (IAP: iap_create_version(iap_id))
3. subscriptions_create_version_localization(version_id, locale: "en-US", name: "Pro Monthly")
4. review_submissions_create(app_id, platform: "IOS")   → submission_id
5. review_submissions_add_item(submission_id, subscription_version_id: version_id)
6. review_submissions_submit(submission_id)
```

- `add_item` takes exactly one typed ID per call: `app_store_version_id`, `in_app_purchase_version_id`, `subscription_version_id`, `subscription_group_version_id`, `app_custom_product_page_version_id`, `app_event_id`, …
- Apple requires an app's first IAP or subscription to ship with a new app version → add the `app_store_version_id` to the same submission.
- Pricing: `subscriptions_pricing_summary(subscription_id, territory_id)` keeps MONTHLY and UPFRONT plans separate; IAP → `iap_pricing_summary`.
- Availability: `subscriptions_*_plan_availability`. Deprecated: `subscriptions_get_availability`, `subscriptions_set_availability`, `subscriptions_list_available_territories`, and `subscriptions_inventory` (it can miss subscriptions past the first page).
- Intro, promotional, offer-code, and win-back offers live under `subscriptions_*` since 3.0; the `offer_codes_*`, `intro_offers_*`, `promo_offers_*`, `winback_*` prefixes are gone.
- IAP types: `CONSUMABLE`, `NON_CONSUMABLE`, `NON_RENEWING_SUBSCRIPTION`; auto-renewables use the subscription tools.

## Workflow: Multi-Company

```
1. company_list                               → ids, names, [ACTIVE]
2. company_switch(company: "client-a")        → exact id, exact name, or unique name fragment
3. company_current                            → confirm before any write
```

- The active company resets to the **first** `companies` entry on every server start; switches don't persist
- An ambiguous or empty query errors instead of guessing; env-var companies get ids `"1"`, `"2"`, …

## API Constraints

| Constraint | Details |
|-----------|---------|
| **No emoji in metadata** | What's New, descriptions, keywords — rejected locally before the request |
| **Editable versions** | Apple decides. `PREPARE_FOR_SUBMISSION` is editable; `DEVELOPER_REJECTED`, `REJECTED`, `METADATA_REJECTED` are edited and resubmitted; in-review and released versions reject most edits — promotional text and App Review info stay editable |
| **JWT** | 20-minute ES256 tokens, cached and auto-refreshed; each 401 refreshes and retries, within the 3-attempt limit |
| **Rate limits** | Per account. 429 is retried with backoff that honors `Retry-After`, up to 3 attempts |
| **Locale format** | `en-US`, `ja`, `de-DE`, `zh-Hans`, `ru` |
| **Platforms** | `IOS`, `MAC_OS`, `TV_OS`, `VISION_OS` |
| **Pagination** | Call `next_url` with the same filters, sort, and limit as the original request; scope drift is rejected |

## Gotchas

| Gotcha | Details |
|--------|---------|
| **Build not found / attach fails** | Still processing → `builds_get_processing_status`; build must be `VALID` and the version editable |
| **"Version already exists"** | Check `app_versions_list(app_id, version_strings: [...])` first |
| **`apps_search` finds nothing** | Matches exact name or bundle ID only, not fuzzy → `apps_list` and pick by `bundleId` |
| **Wrong account** | `company_current` before writes; the active company resets each server start |
| **Env vars ignored** | A `companies.json` at a default path wins over `ASC_*` variables |
| **Tool missing** | Not listed → worker filtered out or unknown `--workers` key. Listed but refused → `--read-only` |
| **Review details rejected** | Apple validates contact fields: valid email, phone with country code |
| **Feedback comment empty** | Pass `include_pii: true` to `beta_feedback_list_*` |
| **TestFlight build metrics 404** | `metrics_build_*` covers App Store builds only → `beta_feedback_*`, `metrics_build_beta_usage` |

## Anti-Rationalization

| Thought | Reality |
|---------|---------|
| "I'll just use the ASC web dashboard" | MCP tools are faster for repetitive tasks — respond to 20 reviews, distribute to 5 groups, create versions across apps. |
| "I don't need worker filtering" | 502 tools are ~60K tokens of schema when loaded eagerly, and capped clients drop tools. Filter to the workflow. |
| "`company_current` worked, so the key works" | It reads local config. Prove the key with `apps_list(limit: 1)`. |
| "I'll skip `company_current` — I only have one account" | The active company is the first `companies.json` entry at every startup. Verify before writes. |
| "I'll submit without review details" | App Review needs contact info. Run `app_versions_set_review_details` before `app_versions_submit_for_review`. |
| "The write errored, I'll retry" | `retrySafe: false` means it may have landed. Inspect first, or you create duplicates. |
| "`metrics_build_diagnostics` will show my TestFlight crashes" | It 404s on TestFlight builds and lists hangs, launches, and disk writes. Use `beta_feedback_*`. |

## When asc-mcp is NOT Available

- **Crash analysis**: Xcode Organizer (`axiom-shipping (skills/testflight-triage.md)`) or the App Store Connect web dashboard (`axiom-shipping (skills/app-store-connect-ref.md)`)
- **TestFlight distribution**: Xcode → Product → Archive → Distribute, or `xcodebuild` + `altool`
- **Review management**: App Store Connect web dashboard
- **Submission**: Xcode → Product → Archive → Distribute to App Store

## Resources

**Skills**: axiom-shipping (skills/app-store-submission.md), axiom-shipping (skills/app-store-ref.md), axiom-shipping (skills/app-store-connect-ref.md), axiom-shipping (skills/testflight-triage.md)

**Agents**: crash-analyzer, security-privacy-scanner, iap-auditor
