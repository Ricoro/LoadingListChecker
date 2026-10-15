# Development and publication

- Default all new application changes to the `development` branch. Fetch origin and use the existing checkout; do not create worktrees unless the user requests one.
- Testing URL: https://ricoro.github.io/LoadingListChecker/testing/
- Production URL: https://ricoro.github.io/LoadingListChecker/
- Never push or merge application changes to `main` unless the user explicitly asks to publish/promote those changes. Completing a change means publishing to testing and reporting the test URL, not promoting it.
- For an approved release, review the diff between origin/main and origin/development, run the relevant checks, create a PR from development to main, and merge only within the user's explicit release authorization. Bring main back into development afterward to keep deployment infrastructure in sync.
- Both Pages environments are public and share an origin. They are separate builds, not a security boundary. Do not enable authentication or shared storage for testing using production credentials or folders. Shared history is disabled in testing.
- Run `npm test` for calculation/export changes; run `npm run build:web` and relevant browser checks for UI changes. Do not add tests that merely mirror low-impact copy edits.
- The publisher runs from main and builds production from main and testing from development. It must never use development output at the production root.
