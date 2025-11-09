# codex-1up — Safer Config Changes (Key-Level Patching)

This document defines the simplified, non-destructive approach for configuring Codex without rewriting a user’s entire `~/.codex/config.toml`. The installer edits only specific keys/tables and leaves all other user content intact.

## Goals
- Preserve existing config and user-defined MCP servers.
- Avoid merges and template overwrites; perform targeted edits only.
- Be reversible, idempotent, and transparent (dry-run + backup).

## What We Ask During Install
- Install profiles?
  - Add (upsert only our four tables)
  - Overwrite (replace only our four tables)
  - No (leave profiles untouched)
- Enable reasoning steps?
  - `tui.show_raw_agent_reasoning = true`
  - `tui.hide_agent_reasoning = false`
- Notification sound (existing flow): picking any sound implies `tui.notifications = true`.

Non-interactive flags:
- `--profiles add|overwrite|no` (default `add`)
- `--reasoning on|off` (default `on`)
- `--sound <file|none|skip>` (unchanged)
- `--yes`, `--dry-run` remain supported.

## Safety & Behavior
- Never rewrite the whole file. Modify only:
  - `[tui]` keys: `show_raw_agent_reasoning`, `hide_agent_reasoning`, and `notifications` (only when a sound is chosen).
  - `[profiles.balanced]`, `[profiles.safe]`, `[profiles.minimal]`, `[profiles.yolo]`.
- Always back up `~/.codex/config.toml` on the first write in an install session.
- Dry-run shows a key-level diff (only changed lines).
- Writes are atomic: temp file + rename.

## Patch Semantics
- Profiles = `add`:
  - Create missing `[profiles.<name>]` tables with our defaults.
  - If table exists, set only missing keys; do not delete any user keys.
- Profiles = `overwrite`:
  - Replace the body of our four profile tables with our defaults.
  - Do not touch other user profile tables.
- Reasoning = `on`:
  - Ensure `[tui]` exists; set `show_raw_agent_reasoning = true`, `hide_agent_reasoning = false`.
- Sound chosen (not `none`/`skip`):
  - Ensure `[tui] notifications = true` and preserve existing list/boolean if already true.

## Implementation Outline
- New module: `cli/src/installers/config-patch.ts`
  - `ensure_table(toml: string, name: string): string`
  - `set_bool(toml: string, keyPath: 'tui.show_raw_agent_reasoning', value: boolean, policy: 'force'|'if-missing'): string`
  - `upsert_profile(toml: string, name: Profile, defaults: Record<string, unknown>, mode: 'add'|'overwrite'): string`
  - `set_tui_notifications_enabled(toml: string, enabled: boolean): string`
  - Use anchored regex for table blocks; append tables if missing. Keep edits surgical to avoid reformatting unrelated content.
- Replace `writeCodexConfig` with `applyCodexConfigPatches` in the installer pipeline.
  - If the file is missing, create a minimal header-only file and then patch keys/tables.
  - Otherwise, patch in place per options.
- Wizard (`cli/src/commands/install.ts`) updates:
  - Ask for: Profiles (Add/Overwrite/No), Reasoning (On/Off), Sound (existing picker). Choosing a sound turns on `tui.notifications`.

## Defaults for Profile Tables
- `balanced`: `approval_policy = "on-request"`, `sandbox_mode = "workspace-write"`, and `features.web_search_request = true`.
- `safe`: `approval_policy = "on-failure"`, `sandbox_mode = "workspace-write"`, and `features.web_search_request = false`.
- `minimal`: `model_reasoning_effort = "minimal"`, and `features.web_search_request = false`.
- `yolo`: `approval_policy = "never"`, `sandbox_mode = "danger-full-access"`, and `features.web_search_request = true`.

## Backups, Idempotency, and Uninstall
- Backups: `~/.codex/config.toml.backup.<timestamp>` before the first write.
- Idempotent: Re-running with the same options yields no additional changes.
- Uninstall: a new step that only reverts keys/tables we manage when requested, using the latest backup if reversal is desired. By default, uninstall leaves user customizations intact.

## Validation & Doctor
- `codex-1up doctor` parses and prints the effective values for edited keys and the presence of our four profile tables.
- Warn on parse errors (show location + snippet). Exit non-zero on errors.

## Tests (Vitest)
- `config.patch.profiles.add.test.ts` — existing table preserved; missing keys added.
- `config.patch.profiles.overwrite.test.ts` — our four tables replaced; others untouched.
- `config.patch.reasoning.on.off.test.ts` — toggles `[tui]` keys as expected.
- `config.patch.notifications.enable-on-sound.test.ts` — selecting a sound enables notifications without clobbering existing values.

## Migration Notes
- We stop copying a full template by default. The template remains available for users who want a fresh start (`codex-1up config init --force`).
- The installer now defaults to non-destructive, key-level edits.

## Rationale
This approach avoids merge conflicts, preserves user MCP servers and comments, and provides a clear UX: users opt into exactly the aspects codex-1up manages while retaining control over the rest of their configuration.
