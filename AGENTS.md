# AGENTS

## Read Before Work

- Read `README.md` and the governing `AGENTS.md` files.
- Read `docs/project-charter.md` when product scope or behavior matters.
- Read `docs/project-plan.md` for project-wide work or continuation.
- Read `docs/architecture.md` before changing contracts, data flow, dependencies, security, validation, or release behavior.
- Read `docs/project-structure.md` before adding top-level paths or moving, deleting, generating, or reclassifying files.
- Read `DESIGN.md` before visible UI work.

## Project-Specific Rules

- Use pnpm workspace commands from the repository root.
- Only the user-triggered recent WAV clip may be sent to Doubao; only its transcript and page title may be sent to DeepSeek.
- Provider keys may persist only in `chrome.storage.local`; never put them in source, build-time environment values, logs, fixtures, or webpages.
- Do not add persistent session, audio, transcript-history, or browsing-history storage.
- `apps/extension` targets desktop Chrome 116+ only. Host permissions are limited to the two configured provider API origins.
- Treat `apps/extension/.output`, `dist`, coverage, Playwright output, `.wrangler`, and local environment files as generated or local artifacts.
- Git remotes, pushes, deployments, and releases require separate user authorization.

## Validation

- Standard gate: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- Run `pnpm design:lint` after editing `DESIGN.md`.

## Documentation Ownership

- Update the single source that owns each changed durable fact.
- Do not create parallel plans, architecture notes, structure maps, or design systems when the standard source exists.
