# Deployment Checklist — Man-Machine Chart App

This checklist tracks the deployment and verification steps for releases and database schema migrations.
The WebApp must remain usable while improvements are developed; local testing is
separate from the user-facing Production release, not a replacement for it.

## Active-User Release Gate (mandatory)

This WebApp has users continuously. Every change must preserve a usable current
release while the replacement is being tested.

- [ ] Classify the change as UI-only, API, saved-chart JSON, schema, auth, or
  data operation. Any API/schema/data boundary change returns to GPT planning.
- [ ] Confirm the current Production deployment and record the last known-good
  commit/deployment as the rollback target.
- [ ] Confirm backward compatibility for existing browser sessions, API
  fields/endpoints, and saved chart content. Do not remove or rename a contract
  in the same release without a compatibility window.
- [ ] If users can edit the same chart concurrently, verify server-side identity,
  authorization, optimistic version/conflict handling, and audit requirements.
  Until these exist, do not claim safe multi-user concurrent editing.
- [ ] If a maintenance window or breaking change is unavoidable, obtain explicit
  user approval and record impact, communication, and rollback steps.

## Save-to-Cloud Persistence Gate (mandatory)

The Save button is not proof of persistence. A release is ready only when the
deployed API confirms the write and a fresh Cloud read proves that the complete
chart survives reopening the WebApp.

- [ ] Save a uniquely identifiable change to an existing representative chart
  through the deployed WebApp and record the exact URL, chart identity, response,
  server version/timestamp, and verification time.
- [ ] Read the same chart back through the deployed API, not only through the
  browser state, localStorage, fixture data, or local D1; compare metadata and
  every step/timeline value.
- [ ] Hard-refresh the page or open a new browser tab/session, reopen the same
  folder/chart, fetch it again from Cloud, and confirm the change remains.
- [ ] Test an error/timeout or ambiguous save response, when safely possible:
  the UI must keep the work dirty/unconfirmed, preserve it for retry, block an
  unsafe overwrite, and never replace Cloud data with an empty/stale fallback.
- [ ] If any read-after-write or reopen check cannot be proven, mark the release
  `PERSISTENCE_BLOCKED` and return to GPT planning; do not reset, reseed, or
  repair data to make the check pass.

## Pre-Deployment Verification
- [x] Run local TypeScript compilation check and Turbopack builds:
  ```bash
  npm run build
  ```
- [x] Verify that code builds with zero errors.
- [x] Ensure the approved diff is reviewed, then stage and commit it before push.

## Database Safety Gate (mandatory before any Production write/deploy)
- [x] Confirm the target environment and database explicitly: Production D1,
  local Pages Dev D1, or browser/localStorage. Never treat local `.wrangler/`
  state or a one-folder sample as a copy of Production.
- [x] Run a read-only inventory of `folders` and `chart_files`; record total
  rows, root folders, maximum hierarchy depth, the complete `parentId` tree,
  chart placement, and representative existing chart IDs/names.
- [x] Export the Production rows and schema to a timestamped directory outside
  the repository, for example
  `D:\00_LocalFile_WebApp\ManMachineChart_Data_Backups\YYYY-MM-DD_HHmmss\`.
  Verify the export before any authorized migration or bulk write. Do not commit
  the export and do not use it as development Source of Truth.
- [x] Do not delete/recreate `.wrangler/`, reset local D1, seed, migrate, or run
  `--remote` writes during layout/UI testing.
- [x] If the read, export, target, or counts cannot be verified, stop the release
  as `DATA_SAFETY_BLOCKED`; do not repair by inventing sample data.

## Deployment Steps (Cloudflare Pages)
- [x] Obtain explicit user authorization for Production deployment.
- [x] Do not assume a Git push publishes the site: verify the Cloudflare Pages
  deployment record. For this release the Dashboard confirmed the Git
  deployment for commit `4c7dacf`; keep the Wrangler command as the fallback
  when a future push does not create a deployment:
  ```bash
  npm run build
  npx wrangler pages deploy out --project-name=man-machine-chart --branch=main --commit-dirty=true
  ```
- [x] Monitor Cloudflare Pages (Workers & Pages -> man-machine-chart -> Deployments)
  and confirm the deployment for commit `4c7dacf`.

## Post-Deployment Verification
- [x] Load the live URL: `https://man-machine-chart.pages.dev/editor`
- [x] Verify that no self-healing schema migration runs; a missing `parentId`
  column must produce a clear unavailable response rather than an `ALTER TABLE`.
- [ ] Verify that the folders API `/api/folders` returns `"parentId": null` or a valid parent ID instead of omitting the field.
- [x] Verify that the existing multi-level folder tree and representative charts remain intact after reloading the browser.
- [ ] Verify that existing files in Local Storage are not used to overwrite cloud content with empty steps during hydration.
- [ ] Verify that opening a file and making updates does not cause unintended data loss.
- [x] Verify that the affected chart layout remains readable and the graph remains visible beside the table; the live smoke check found 24 table body rows, 4 SVG graph surfaces, and zero browser console errors.
- [ ] Re-run the read-only Production inventory after deployment and compare the
  folder count, four-level parent-child tree, chart count, and representative
  chart IDs/names with the pre-deploy record. Any unexpected decrease is a STOP
  condition.
- [x] Open the real Production URL and verify the existing four-level tree and
  representative charts, not only a newly created sample chart.
- [ ] Keep the previous known-good deployment available until the new release
  is verified by an active-user smoke test; if it is unhealthy, roll back the
  application and keep Production data untouched.

> Note: the post-deploy `/api/*` navigation was blocked by the browser client,
> so the API-specific and read-only inventory comparison items remain open.
