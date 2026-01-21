# How To Release codex-1up

This project ships via the Node script at `scripts/release.ts`. The script bumps versions, builds, pushes tags, and creates a GitHub Release with notes from `CHANGELOG.md`. Publishing to npm happens automatically via GitHub Actions using npm Trusted Publishing (OIDC).

## Prerequisites
- Node 18+
- pnpm (`corepack enable && corepack prepare pnpm@latest --activate` works too)
- GitHub CLI (`gh auth status` shows logged in)
- npm publish is handled by GitHub Actions (Trusted Publishing); no local `npm login` required
- Clean `main` branch pushed to origin

## Prepare
- Update `CHANGELOG.md` with a new section (e.g., `## [0.1.4] - YYYY-MM-DD`).
  - **Important**: The section header must match the exact version format: `## [X.Y.Z] - YYYY-MM-DD`
  - Include detailed descriptions of changes (Added/Changed/Fixed sections) so users can easily see what's included in the release
  - The release script extracts this section automatically for the GitHub Release description
- Ensure any user-facing docs (README, templates) are committed.
- Run tests and ensure coverage is healthy:
  - Run tests (one-shot): `pnpm -C cli test:run`
  - Check test coverage: `pnpm -C cli coverage`
  - **Release bar**: keep overall coverage **> 80%** (raise it if you touch core installer/config paths)

## Quick Release
- Patch/minor/major bump and release:
  - `pnpm dlx tsx scripts/release.ts patch` (or `minor`/`major`)
- The script will:
  - Bump `cli/package.json#version`
  - Build (`tsup`)
  - Commit `chore: release vX.Y.Z`, tag `vX.Y.Z`, push
  - Create/Update a GitHub Release with notes from `CHANGELOG.md`
  - Trigger the GitHub Actions publish workflow (OIDC) on release publish

## npm Trusted Publishing (automatic)
- Configure this once in npm:
  - Go to the package settings → **Access** → **Trusted Publishers**
  - Add GitHub Actions as a trusted publisher for this repo
  - Workflow filename: `npm-release.yml` (just the filename, not the full path)
  - Environment: leave blank unless you use GitHub Environments
- GitHub Actions will mint short-lived OIDC credentials at publish time; no stored tokens.
- The workflow pins npm CLI `11.5.1` to satisfy Trusted Publishing requirements.
- Note: This workflow runs on **GitHub Release published** (draft releases do not publish to npm).

## Homebrew tap update (automatic)
- A GitHub Actions workflow (`.github/workflows/homebrew-release.yml`) updates `regenrek/homebrew-tap` on each published GitHub Release.
- Required secrets:
  - `HOMEBREW_TAP_APP_ID` (GitHub App ID)
  - `HOMEBREW_TAP_APP_PRIVATE_KEY` (GitHub App private key PEM)
- The GitHub App must be installed on `regenrek/homebrew-tap` with **Contents: read/write**.
- The workflow:
  - Resolves the release tag version
  - Pulls the npm tarball from `registry.npmjs.org`
  - Computes the sha256
  - Updates `Formula/codex-1up.rb` in the tap and pushes
- Note: The job waits for the npm tarball to be available, but if registry propagation is slow you can rerun the **Homebrew Tap** workflow.

## Sanity Checks (optional but recommended)
- Build and pack locally:
  - `pnpm -C cli build`
  - `pnpm -C cli pack`
  - `tar -tf cli/codex-1up-*.tgz | grep -E 'package/(templates/|sounds/|README.md|LICENSE)'`
- Verify after publish:
  - npm page renders README banner
  - `templates/` and `sounds/` are present in the tarball
  - Git tag `vX.Y.Z` exists and GitHub Release has notes
  - **GitHub Release description**: Visit the release page and confirm the changelog content is displayed (not just "Full Changelog" link). If missing, check that the CHANGELOG.md section header matches `## [X.Y.Z]` exactly.

## Release Notes Tips
- The script extracts notes from `CHANGELOG.md` for the current version.
- **Changelog Format**: The section header must exactly match `## [X.Y.Z]` where `X.Y.Z` is the version being released (e.g., `## [0.2.8] - 2025-11-22`).
- The extracted changelog section becomes the GitHub Release description, so include clear, user-friendly descriptions of changes.
- If that section is missing, it falls back to the section named by `GH_NOTES_REF` (default: `0.4`).
  - Example: `GH_NOTES_REF=0.1.3 pnpm dlx tsx scripts/release.ts patch`
- **Verification**: After release, check the GitHub Release page to confirm the changelog description appears correctly. If it's missing, the regex may not have matched—verify the CHANGELOG.md format matches `## [X.Y.Z]` exactly.

## Prereleases / Dist-Tags
- To ship a prerelease, publish a GitHub Release marked **Prerelease**.
  - The npm workflow will automatically publish with `--tag next`.

## Rollback / Deprecation
- Prefer deprecation over unpublish:
  - `npm deprecate codex-1up@X.Y.Z "Reason…"`
- Only unpublish if necessary and allowed:
  - `npm unpublish codex-1up@X.Y.Z --force`
- Create a follow-up patch release that fixes the issue.

## Troubleshooting
- `npm Release` fails (OIDC / permissions / E403):
  - Check the `npm Release` workflow run logs in GitHub Actions.
  - Verify npm package settings → **Trusted Publishers** points to this repo and `npm-release.yml` (and the workflow has `permissions: id-token: write`).
  - Confirm the GitHub Release is **published** (not draft).
  - If needed, manually run the workflow via `workflow_dispatch` with `tag=vX.Y.Z` (and `prerelease=true` to publish to `next`).
- `Homebrew Tap` fails with a tarball download error (often 404): rerun the `homebrew-release.yml` workflow after the npm publish completes.
- `brew install regenrek/tap/codex-1up` fails with `std_npm_install_args` errors:
  - The tap formula is out of sync with Homebrew’s Node helpers; it should use `std_npm_args`.
  - Fix by updating the tap formula (or cut a new release that regenerates the formula via `homebrew-release.yml`).
- `Homebrew Tap` fails to push (403): confirm `HOMEBREW_TAP_APP_ID` and `HOMEBREW_TAP_APP_PRIVATE_KEY` are set in this repo, and the GitHub App is installed on `regenrek/homebrew-tap` with Contents write access.
- `gh` failures: `gh auth status`; ensure `repo` scope exists.
- Tag push rejected: pull/rebase or fast-forward `main`, then rerun.
