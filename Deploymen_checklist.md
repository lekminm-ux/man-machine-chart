# Deployment Checklist — Man-Machine Chart App

This checklist tracks the deployment and verification steps for releases and database schema migrations.

## Pre-Deployment Verification
- [x] Run local TypeScript compilation check and Turbopack builds:
  ```bash
  npm run build
  ```
- [x] Verify that code builds with zero errors.
- [x] Ensure git status is clean and all files are staged/committed.

## Deployment Steps (Cloudflare Pages)
- [x] Push the latest changes to GitHub `main` branch to trigger automatic Cloudflare Pages deployment:
  ```bash
  git push origin main
  ```
- [x] Monitor Cloudflare Pages build status in Cloudflare Dashboard (Workers & Pages -> man-machine-chart -> Deployments).
- [x] Wait for deployment status to show **Success (green)**.

## Post-Deployment Verification
- [x] Load the live URL: `https://man-machine-chart.pages.dev/`
- [x] Verify that the self-healing migration successfully executes (runs `ALTER TABLE folders ADD COLUMN parentId TEXT DEFAULT NULL` on first load).
- [x] Verify that the folders API `/api/folders` returns `"parentId": null` or a valid parent ID instead of omitting the field.
- [x] Verify that you can create nested sub-folders (up to 4 levels) and that they remain nested after reloading the browser.
- [x] Verify that existing files in Local Storage are merged correctly and not overwritten with empty steps during hydration.
- [x] Verify that opening a file and making updates does not cause unintended data loss.
