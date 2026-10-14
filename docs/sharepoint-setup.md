# Connect shared comparison history

An IT administrator must configure Microsoft Entra before shared history can operate. No passwords, client secrets or access tokens belong in this repository. Tenant and client IDs are public identifiers.

1. Register a single-tenant application in Microsoft Entra ID for Seabow.
2. Add a **Single-page application (SPA)** platform with the exact redirect URI `https://ricoro.github.io/LoadingListChecker/auth.html`. Do not create a client secret or enable implicit grant.
3. Add Microsoft Graph **delegated** `Sites.Selected` permission and grant administrator consent.
4. Explicitly grant this application **write** access to the site `https://seabownv.sharepoint.com/sites/seabow`. Consent alone is insufficient. An administrator with permission to manage site application grants can use Graph `POST /sites/{site-id}/permissions` with:

```json
{"roles":["write"],"grantedToIdentities":[{"application":{"id":"YOUR-APPLICATION-CLIENT-ID","displayName":"Loading List Checker"}}]}
```

See Microsoft's [selected permissions documentation](https://learn.microsoft.com/graph/permissions-selected-overview). Granting the site permission requires administrative `Sites.FullControl.All`; the browser application itself uses only delegated `Sites.Selected`. Each signed-in colleague also needs their own read/write permission to the destination folder.

5. In GitHub repository Settings → Secrets and variables → Actions → **Variables**, set `M365_TENANT_ID` and `M365_CLIENT_ID`. Optional overrides: `SHAREPOINT_SITE_URL`, `SHAREPOINT_HISTORY_FOLDER`, `SHAREPOINT_DRIVE_ID`. The defaults target the site's default document library and folder `LoadingListCheckerExcels`. Use a drive ID override if that is not the default document library.
6. Rerun the Browser portal deployment workflow (or push a source change).
7. Validate with two work accounts: sign in, compare lists, confirm a saved timestamp and matching `.xlsx`/`.json` files in SharePoint; on a different PC sign in and open the saved comparison without uploading inputs. Verify Excel download and Mail attachment. Test an account without site access as well.

Every comparison saves a marked Excel file and a versioned JSON snapshot, including vessel results, source filenames and the Excel attachment. The snapshot excludes unrelated terminal container numbers. Timestamps come from SharePoint and display in Brussels time. A stable comparison ID makes retries overwrite the same files. Failed saves remain available for retry while the page remains open. Save succeeds only after both files are uploaded; if interrupted, an Excel file may exist without a history entry.

Work-account tokens use MSAL session storage, not GitHub. Signing out clears this app's authentication cache, not the user's Microsoft-wide login session. A public portal does not make SharePoint files public. Anyone with access to the folder can see its comparisons, so limit folder membership appropriately. Delete both files in SharePoint to remove a saved comparison. No retention policy is applied by the app.

Shared history is currently on hold and hidden. After permissions are configured and access is verified, set the GitHub Actions variable `SHAREPOINT_HISTORY_ENABLED` to `true` and redeploy to enable it. Leave it unset while setup is incomplete.
