# Recoverable Trash: 90-day retention and seven-day in-app warning

Status: Production release complete on 2026-09-30. The separate scheduled purge
Worker is deployed with D1 and R2 bindings and a daily 01:00 UTC trigger
(08:00 Bangkok). Its first scheduled run is 2026-10-01 01:00 UTC.

The pre-migration Production Data Gate used a fresh verified export at
`D:\00_LocalFile_WebApp\ManMachineChart_Data_Backups\2026-09-30_121806`.
Before QA, Production had 11 folders, 20 charts, zero revisions, and zero R2
objects. The active original data still matches that export after release.

## Agreed behavior

- Any current app visitor may move a chart or a folder with its full nested subtree to Trash. The shared Smart Factory AI Ecosystem login/role system for all nine apps is a separate later project. The confirmation dialog prevents accidents but does not identify or authorize a person.
- Trash preserves chart content, revision snapshots, folder parent relationships, and R2 photos. Restoring a folder restores every member moved by that action. An item trashed separately keeps its own 90-day clock and must be restored separately; restore a trashed parent first.
- The app displays a warning from seven days before the 90-day deadline, including a Trash panel with each expiry date. Someone must acknowledge that warning in the app. The daily purge Worker may begin only after both 90 full days of retention and seven full days after acknowledgement. If nobody visits and acknowledges, the item remains recoverable past day 90. This prevents silent permanent deletion.
- Once purge starts, restore is closed. The Worker deletes a chart's R2 photo objects before deleting its D1 row (which cascades its revision snapshots). If R2 fails, D1 rows remain and the Worker retries. A folder batch waits for any separately trashed child whose own retention has not ended.
- `trash_members` keeps a small permanent ID tombstone so another browser's old cache cannot make a permanently deleted chart or folder reappear as an unsynced local draft.

## Production sequence and gates

1. **Production Data Gate:** identify the exact Pages project, D1 database ID, R2 bucket, current deployment, and live schema. Take a fresh verified recovery export of Production D1 rows and schema outside this repository. Record folder/root/chart counts, full parent tree, chart IDs/content checksums, revision counts, and representative R2 keys. The earlier APP02 backup is historical evidence, not this migration's fresh backup.
2. **Additive migration:** apply only `migrations/2026-09-30-trash.sql` to the verified Production D1. Do not rerun `schema.sql`, reset data, or change existing rows. Confirm the new columns/tables/indexes and unchanged original folder/chart/revision content and counts.
3. **Compatibility deployment:** ship the API/cache changes while the Sidebar delete controls remain off. Confirm existing charts, revisions, photos, folder tree, and cloud hydration still work. Preserve this deployment as the new rollback target after any Trash item exists; rolling back to a version unaware of `trashId` would show trashed rows again.
4. **Feature deployment:** enable Sidebar delete/Trash/restore and verify with one uniquely named reversible test chart and nested test folder under an explicitly approved Production write-test Gate. Confirm create → trash → hidden after refresh → full restore → content/revision/photo read-back; clean up test records through the normal Trash policy. Never use an existing user chart as test data.
5. **Scheduled purge deployment:** deploy `wrangler.trash.toml` as a separate Worker with the existing D1 and R2 bindings and a daily 01:00 UTC trigger (08:00 Bangkok). Verify its configuration and confirm that no entry is eligible before the first scheduled run. Disable public and preview URLs. The Worker must not be enabled before the app and migration are confirmed healthy.
6. **Post-release:** compare Production counts/tree/content to the preflight, allowing only the specifically approved synthetic test rows. Monitor API and Worker errors. On app failure, roll back to the compatibility deployment; retain the additive schema and all Trash data.

## Release record (2026-09-30)

- Fresh pre-migration Production recovery export: `D:\00_LocalFile_WebApp\ManMachineChart_Data_Backups\2026-09-30_121806`. Its 25 payload files were read back and SHA-256 verified: 11 folders (6 roots, depth 3), 20 full charts, zero revisions and zero pre-existing R2 objects.
- Applied the additive migration to D1 `mm-chart-db` (`c475f51c-3bcc-410a-8205-846b458c4efd`), then verified two new columns, two tables, four indexes, and unchanged original row counts.
- Pushed compatibility commit `b73d679` to `main`; Pages deployment `00b5798c-b3a2-4138-950e-d7a34c6aefe9` succeeded with delete controls still off. This is the Trash-aware rollback target.
- Pushed feature commit `247e2cf`; Pages deployment `2fc98027-41b9-44ac-80b0-6f1f38ea80b7` succeeded. Added missing Production `PHOTOS` binding to R2 bucket `mm-chart-photos` in Pages settings and redeployed the same commit as `427b0360-61ac-4f68-bb24-f0e355320a8a` (success).
- Production QA created only uniquely named test data: one root folder, nested child, chart, revision and PNG. Chart Trash/restore and full folder subtree Trash/restore passed through live APIs. Chart content, frozen revision and R2 photo bytes matched after restore. Acknowledgement before the seven-day window correctly returned HTTP 409.
- The live Sidebar displayed the Trash entry and restored the synthetic root, nested child and chart through its Restore button. Browser automation failed on the subsequent UI delete click, so the synthetic subtree was returned to normal Trash through its scoped API. Current entry `6e8beac2-0967-4cf1-a395-6d8fe82ee7b8` expires `2026-12-29T07:30:58.290Z`. No original user item was used for QA.
- Cloudflare OAuth connected Wrangler with `account:read`, `user:read` and `workers_scripts:write` scopes. Deployed Worker `man-machine-trash-purge` version `d770d323-ae8d-4246-89db-53d56ec290ba` with `DB=mm-chart-db`, `PHOTOS=mm-chart-photos`, `0 1 * * *` cron, and public/preview URLs disabled. Dashboard Settings confirms the bindings and next trigger on 2026-10-01 01:00 UTC. No Production Worker invocation has occurred yet; this release verifies deployment and schedule, not a completed scheduled purge.
- Final Production GET comparison matched all 11 original folders, 20 chart metadata rows and full content of all 20 original charts to the pre-migration backup. Exactly the synthetic QA subtree is hidden in Trash. `tests/trash.test.cjs` passed 7/7, including purge timing, warning acknowledgement, nested retention and R2 retry. No Trash entry is currently eligible for permanent purge.
