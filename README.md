# Loading List Checker

Browser portal: https://ricoro.github.io/LoadingListChecker/

Import the vessel loading list and terminal list, then compare container numbers. Delivered containers are marked; blocked containers appear deep red. Duplicate numbers on separate bills of lading count once, while all booking rows remain visible, including bookings without container numbers.

**Save as Excel** downloads the shortened marked loading list. **Mail** downloads an Outlook draft with that Excel attached; add recipients and send in Outlook.

Shared, timestamped comparisons use Microsoft 365 sign-in and a private SharePoint folder. Until the organisation completes the [Microsoft setup](docs/sharepoint-setup.md), comparisons remain local and shared history is unavailable. No customer spreadsheets are included in the portal.

## Development

```sh
npm ci
npm test
npm run build:web
```

The browser output is `dist/web`. GitHub Actions publishes it to Pages. The Electron desktop application is also retained in the source repository.

## Environments

Use the [testing app](https://ricoro.github.io/LoadingListChecker/testing/) for changes under review. The standard link tracks approved changes on `main`. Future work defaults to `development`; publish to main only on an explicit release request. See [environment workflow and branch protection](docs/environments.md).
