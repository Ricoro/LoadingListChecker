# Testing and production

- Production: https://ricoro.github.io/LoadingListChecker/ — source branch `main`.
- Testing: https://ricoro.github.io/LoadingListChecker/testing/ — source branch `development`.

All routine changes go to development. A push runs `Validate testing portal`. After success, `Publish browser portal` on the default branch rebuilds and publishes both directories. Production is always built from main, even when development triggered publication. Failed validation leaves the deployed site unchanged. Pages keeps its existing main-only deployment policy. The testing page has a visible banner and requests search engines not to index it.

These are two public builds on the same Pages origin, not isolated authenticated hosting environments. Input files remain in each browser. Shared history is forcibly disabled for testing. When work-account sign-in or persistence is introduced, use a separate test app registration and storage destination, preferably a separate hostname/site for security isolation. Do not assume that a testing URL restricts access.

## Approving a release

1. Review the testing URL and request adjustments there.
2. Explicitly ask to publish the approved development changes to main.
3. Review the PR from development to main, check validation, then merge the approved PR. A push to main publishes production while preserving the testing URL.
4. Merge main back into development to keep branches in sync.

A code change on development never merges itself into main. Publishing the combined Pages artifact does replace the site artifact, but the production portion always comes from main. Builds currently share one deployment job; broken development may block a production release until corrected. For emergency production rollback, revert the relevant approved PR on main and rerun deployment after making sure development validates.

## Enable GitHub enforcement (repository owner)

The connected integration cannot read or change branch protection (GitHub returns HTTP 403). To enforce the release process beyond repository instructions:

1. Open repository Settings → Rules → Rulesets → New branch ruleset (or Branches → branch protection).
2. Target `main`, enable the rule, and require a pull request before merging.
3. Block force pushes and deletion. Require a reviewer if another reviewer is available; avoid requiring self-approval on a single-maintainer repository.
4. Add required validation checks once GitHub shows their exact names. Do not require the deployment job before merging: it runs after changes reach main. The development `validate` check is available after its first run.

The workflow does not configure a mandatory human approval gate. A repository owner can additionally configure a required reviewer under Settings → Environments → github-pages, but that would also pause testing updates because Pages publishes one combined site. PR protection on main is the appropriate gate for this setup.
