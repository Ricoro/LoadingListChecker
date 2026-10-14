# Loading List Checker

A Windows desktop app that compares a vessel loading list with the containers currently on quay. Files are processed locally.

## Use

Install the Windows app using the Setup executable, then open Loading List Checker, import both Excel `.xls` or `.xlsx` files, choose each worksheet and container-number column, and confirm the first data row (usually 2 when row 1 contains headings). Click **Compare lists**.

A vessel container is **Delivered** when its number appears on the quay list; otherwise it is **Outstanding**. Spaces, hyphens and letter case are ignored. Duplicate numbers count once. Blank cells and numbers outside the standard four-letter/seven-digit format are excluded and counted. ISO check digits are not validated. Quay containers outside the vessel list are counted separately. Search and filter results, then save a marked Excel loading list. CSV imports are also supported; legacy `.xls` files are supported directly.

Files are limited to 25 MB. For best results use clean tables with one container per row. The app shows a five-row preview and up to 2,000 matching result rows; exports include all results. Delivery reflects presence in the imported quay snapshot, not historical delivery or live terminal status.

## Development

Requires Node.js 22 or newer and npm. Use the existing checkout; cloud tasks are isolated and do not need a separate worktree.

```sh
npm ci
npm test
npm start
```

`npm start` needs a graphical desktop and Electron's Linux system libraries when developing on Linux. Tests run headlessly.

## Windows build

```sh
npm run dist:win
```

The Windows x64 installer is written to `dist/`. Windows builds are unsigned; production distribution should use your organization's code-signing certificate. Build NSIS installers on Windows (the release workflow does this). Linux NSIS builds require Wine even when executable resource editing is disabled. To prepare only the unpacked Windows app on Linux, run `./node_modules/.bin/electron-builder --win dir --x64 -c.win.signAndEditExecutable=false --publish never`.

## Vessel overview

The supplied system export is detected automatically: loading-list column E, header on row 6, data from row 7; terminal export column C, data from row 2. Selections remain editable. Rows stay in loading-list order with row number, size/type and booking. Delivered rows are green, outstanding rows amber, and booking rows without usable container numbers grey (No containernumber). Counts show unique valid containers; duplicate loading rows remain visible. Save marked Excel exports all loading-sheet values and adds a highlighted Terminal status column. It recreates the worksheet rather than preserving the original print layout, formatting or formulas; the source file remains unchanged.

## Booking totals and bills of lading

Each known container number counts once, even if it appears on multiple bill-of-lading rows. All original rows remain visible and are marked in Excel. Container numbers received shows distinct valid numbers. The total booked count uses the sheet's `TOTAL units` value when present; otherwise it counts distinct known containers plus unnumbered booking rows and invalid-number rows requiring review. Awaiting container numbers counts rows with an empty container-number cell; these cannot be deduplicated reliably until a number is provided. Footer and padding rows are excluded.

A warning appears only when the stated total differs from these container counts, not merely because one container has multiple bills of lading. Export uses Save marked Excel; CSV imports remain supported.

## Marked Excel columns

Saved Excel omits Seal No, POL, POD, BL No, the source Status, Weight (including Weight (ton)), Tare, Gross, IMO, Ocean Vessel, Ocean carrier, Ocean BL No, Stock, Forwarder VAT No and SKK/KFK. Matching is case-insensitive and ignores spacing and punctuation in these headers. The generated Terminal status column remains. All bill-of-lading rows and retained column values remain in order. Missing container numbers are labelled No containernumber in the app and Excel.

## In-app updates (public GitHub releases, v0.7.0 onward)

Install the Windows Setup executable and use the installed Start-menu app. Public GitHub releases need no account, token or connection setup. Previously saved encrypted updater tokens are removed on startup without reading or decrypting them.

The app checks on startup and every four hours, with a manual Check for updates option under App updates. A top banner offers Download update and then Restart and update. Save your marked Excel before confirming restart. Offline errors do not affect list comparison. Container files are never uploaded.

Future releases need the NSIS installer, latest.yml with SHA-512 checksums, and its blockmap. The release workflow uploads these before publication, then verifies the public feed and performs a native Windows download check with no GitHub token. Publishing the release still uses the scoped GitHub Actions token. Final installed-app replacement and restart require a workstation check. Builds remain unsigned.

Migration from v0.6.0: install v0.7.0 once manually if you have not configured the old private updater. If it already has a working token, it can download v0.7.0; subsequent checks use the public feed without credentials. Older portable versions also require a one-time installer migration.

## Package size

The installer includes Electron's Chromium/Node runtime. From v0.8.0, it packages only en-US and en-GB Electron locale files and excludes unused spreadsheet browser bundles. Legacy Excel code-page support and all Node runtime files are retained. The Windows release test loads dependencies from the packaged app.asar and checks XLS, XLSX, CSV, marked Excel and public-update downloads. Large reductions beyond this would require migrating away from Electron.
