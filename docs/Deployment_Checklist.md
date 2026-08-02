# Deployment Checklist — Man-Machine Chart App

This checklist tracks the deployment and verification steps for releases and database schema migrations.
The WebApp must remain usable while improvements are developed; local testing is
separate from the user-facing Production release, not a replacement for it.

## Pre-Deployment Verification
- [x] Run local TypeScript compilation check and Turbopack builds:
  ```bash
  npm run build
  ```
- [x] Verify that code builds with zero errors.
- [ ] Ensure the approved diff is reviewed, then stage and commit it before push.

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
- [ ] Do not delete/recreate `.wrangler/`, reset local D1, seed, migrate, or run
  `--remote` writes during layout/UI testing.
- [x] If the read, export, target, or counts cannot be verified, stop the release
  as `DATA_SAFETY_BLOCKED`; do not repair by inventing sample data.

## Deployment Steps (Cloudflare Pages)
- [x] Obtain explicit user authorization for Production deployment.
- [ ] Do not assume a Git push publishes the site. This project has previously
  required a manual Cloudflare Pages deployment:
  ```bash
  npm run build
  npx wrangler pages deploy out --project-name=man-machine-chart --branch=main --commit-dirty=true
  ```
- [ ] Monitor Cloudflare Pages (Workers & Pages -> man-machine-chart -> Deployments)
  and wait for **Success (green)**.

## Post-Deployment Verification
- [ ] Load the live URL: `https://man-machine-chart.pages.dev/`
- [x] Verify that no self-healing schema migration runs; a missing `parentId`
  column must produce a clear unavailable response rather than an `ALTER TABLE`.
- [ ] Verify that the folders API `/api/folders` returns `"parentId": null` or a valid parent ID instead of omitting the field.
- [ ] Verify that the existing multi-level folder tree and representative charts remain intact after reloading the browser.
- [ ] Verify that existing files in Local Storage are not used to overwrite cloud content with empty steps during hydration.
- [ ] Verify that opening a file and making updates does not cause unintended data loss.
- [ ] Verify that the affected chart layout remains readable and the graph remains visible beside the table.
- [ ] Re-run the read-only Production inventory after deployment and compare the
  folder count, four-level parent-child tree, chart count, and representative
  chart IDs/names with the pre-deploy record. Any unexpected decrease is a STOP
  condition.
- [ ] Open the real Production URL and verify the existing four-level tree and
  representative charts, not only a newly created sample chart.
