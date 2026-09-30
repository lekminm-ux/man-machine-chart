# Recoverable Trash: 90-day retention and seven-day in-app warning

Status: implemented and tested locally on 2026-09-30. **Not migrated or deployed to Production.**

Read-only Production Data Gate: **complete**. Verified backup and audit:
`D:\00_LocalFile_WebApp\ManMachineChart_Data_Backups\2026-09-30_104913`.
The live D1 schema still has no Trash tables or columns. Current D1 counts are
11 folders (6 roots, depth 3), 20 charts, and 0 revisions. R2 has 0 objects.
One chart was added since the earlier 19-chart backup; the earlier 19 are
unchanged. The backup contains 25 SHA-256-verified payload files. No Production
write has been authorized or performed for this feature.

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
5. **Scheduled purge deployment:** deploy `wrangler.trash.toml` as a separate Worker with the existing D1 and R2 bindings and a daily 01:00 UTC trigger (08:00 Bangkok). Verify its configuration and a dry no-eligible-entry run. It has no HTTP endpoint. The Worker must not be enabled before the app and migration are confirmed healthy.
6. **Post-release:** compare Production counts/tree/content to the preflight, allowing only the specifically approved synthetic test rows. Monitor API and Worker errors. On app failure, roll back to the compatibility deployment; retain the additive schema and all Trash data.

No Production D1/R2 read or write, migration, push, Pages deployment, or Worker deployment was performed during local implementation.
