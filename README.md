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

The Windows x64 installer is written to `dist/`. Windows builds are unsigned; production distribution should use your organization's code-signing certificate. Building on Windows is recommended. Linux cross-builds need Wine for Windows resource editing, or can disable resource editing with `npm run dist:win -- -c.win.signAndEditExecutable=false` (the application still runs but executable branding is limited).

## Vessel overview

The supplied system export is detected automatically: loading-list column E, header on row 6, data from row 7; terminal export column C, data from row 2. Selections remain editable. Rows stay in loading-list order with row number, size/type and booking. Delivered rows are green, outstanding rows amber, and booking rows without usable container numbers grey (No containernumber). Counts show unique valid containers; duplicate loading rows remain visible. Save marked Excel exports all loading-sheet values and adds a highlighted Terminal status column. It recreates the worksheet rather than preserving the original print layout, formatting or formulas; the source file remains unchanged.

## Booking totals and bills of lading

Each known container number counts once, even if it appears on multiple bill-of-lading rows. All original rows remain visible and are marked in Excel. Container numbers received shows distinct valid numbers. The total booked count uses the sheet's `TOTAL units` value when present; otherwise it counts distinct known containers plus unnumbered booking rows and invalid-number rows requiring review. Awaiting container numbers counts rows with an empty container-number cell; these cannot be deduplicated reliably until a number is provided. Footer and padding rows are excluded.

A warning appears only when the stated total differs from these container counts, not merely because one container has multiple bills of lading. Export uses Save marked Excel; CSV imports remain supported.

## Marked Excel columns

Saved Excel omits Seal No, POL, POD, BL No, the source Status, Weight (including Weight (ton)), Tare, Gross, IMO, Ocean Vessel, Ocean carrier, Ocean BL No, Stock, Forwarder VAT No and SKK/KFK. Matching is case-insensitive and ignores spacing and punctuation in these headers. The generated Terminal status column remains. All bill-of-lading rows and retained column values remain in order. Missing container numbers are labelled No containernumber in the app and Excel.

## In-app updates (v0.6.0 onward)

The portable releases through v0.5.0 need one manual transition: close the old app and install `Loading-List-Checker-Setup-0.6.0.exe`. Use the installed Start-menu app thereafter. Future releases use an NSIS installer, `latest.yml` with SHA-512 download checksums, and its blockmap. All three must be uploaded before publishing a release. The release workflow does this automatically.

Because the repository is private, open **App updates** and enter a fine-grained GitHub access token once. Select only `Ricoro/LoadingListChecker`, with **Contents: Read-only** (Metadata read access is automatic); your account must have repository access. Create it in GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens. Enter its value only in the app, never in chat. Organization approval may be required by your GitHub organization.

The app encrypts the token using Electron safeStorage backed by Windows DPAPI and stores it in its per-user application-data directory, never in the executable or release. It checks at startup and every four hours, with a manual Check for updates option. An available update appears in a top banner. Click Download update, then Restart and update after saving your marked Excel. Restart requires confirmation. Offline/authentication errors do not affect list comparison; expired tokens can be replaced under App updates. Disconnect removes the saved token. Containers and workbooks are never uploaded.

Updates require outbound HTTPS to GitHub's API and release-download hosts. Builds remain unsigned; a future code-signing certificate can be configured without placing signing credentials in the app. Native installed-app replacement should be validated on a Windows workstation; unit tests use a mocked updater; the release workflow also checks the real private update feed and runs a native Windows Electron smoke test for DPAPI token encryption, release detection and a checksum-verified installer download.
