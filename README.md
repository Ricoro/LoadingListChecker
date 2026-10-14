# Loading List Checker

A Windows desktop app that compares a vessel loading list with the containers currently on quay. Files are processed locally.

## Use

Open the portable executable, import both Excel `.xls` or `.xlsx` files, choose each worksheet and container-number column, and confirm the first data row (usually 2 when row 1 contains headings). Click **Compare lists**.

A vessel container is **Delivered** when its number appears on the quay list; otherwise it is **Outstanding**. Spaces, hyphens and letter case are ignored. Duplicate numbers count once. Blank cells and numbers outside the standard four-letter/seven-digit format are excluded and counted. ISO check digits are not validated. Quay containers outside the vessel list are counted separately. Search and filter results or export all vessel results to CSV. CSV imports are also supported; legacy `.xls` files are supported directly.

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

The portable Windows x64 executable is written to `dist/`. Windows builds are unsigned; production distribution should use your organization's code-signing certificate. Building on Windows is recommended. Linux cross-builds need Wine for Windows resource editing, or can disable resource editing with `npm run dist:win -- -c.win.signAndEditExecutable=false` (the application still runs but executable branding is limited).

## Vessel overview

The supplied system export is detected automatically: loading-list column E, header on row 6, data from row 7; terminal export column C, data from row 2. Selections remain editable. Rows stay in loading-list order with row number, size/type and booking. Delivered rows are green, outstanding rows amber, and booking rows without usable container numbers grey (Cannot match). Counts show unique valid containers; duplicate loading rows remain visible. Save marked Excel exports all loading-sheet values and adds a highlighted Terminal status column. It recreates the worksheet rather than preserving the original print layout, formatting or formulas; the source file remains unchanged.
