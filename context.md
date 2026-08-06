# Soroban Scaffold CLI — Project Context

## Session 1 — 2026-08-04

### What was built
- Initial project scaffolded
- CLI entry point with commander
- Init command stub
- Jest configured
- README, CONTRIBUTING.md added

### Tech stack
- Node.js/TypeScript
- Commander (CLI framework)
- Chalk (terminal colors)
- Ora (spinners)
- Figlet (ASCII art banner)

### Next session
- Implement actual init command logic (copy templates, create project structure)

## Session 2 — 2026-08-05

### What was built
- Template rendering engine using Handlebars (`src/utils/template.ts`) — supports `{{PROJECT_NAME}}` / `{{AUTHOR}}` placeholders
- File copy utility with template variable substitution (`src/utils/files.ts`) — `copyTemplate` and `createProjectDir`
- init command fully implemented — creates real project from `basic/` template, resolves author from `--author` flag or `git config user.name`, shows an ora spinner and chalk-colored success/error output
- End-to-end test: `sorokit init test-project` generates a working Soroban project (verified `Cargo.toml`, `.gitignore`, `README.md`, `src/lib.rs`, `src/test.rs` all present and rendered correctly)
- Fixed `npm run dev` script — `ts-node` alone can't load ESM TS files under `type: module` + `NodeNext`; now uses `node --loader ts-node/esm`
- Fixed CI: `ora@9.4.1` (pulled in transitively via `string-width@8.x`, which uses the Unicode-sets regex flag) requires Node ≥20 and now actually gets imported by `init.ts`, which broke the Node 18.x matrix job with a "Invalid regular expression flags" crash. Dropped 18.x from the CI matrix (now 20.x/22.x) and added `engines.node: ">=20"` to package.json
- Fixed CI: `tests/init.test.ts` originally exercised `init()` against the hardcoded sibling `soroban-scaffold-templates` path, which doesn't exist in a CI checkout of this repo alone (ENOENT). `init()` now takes an optional `templateDir` override (production default unchanged); tests point it at a fixture under `tests/fixtures/template/`
- CI green on both matrix legs: https://github.com/Soro-Bix/soroban-scaffold/actions/runs/30995585459

### What still needs doing
- Make template path configurable (not hardcoded to `../soroban-scaffold-templates`)
- Implement template selection (`--template` flag to choose basic/token/escrow)
- Populate token/ and escrow/ templates properly
- Publish to npm as `@soro-bix/scaffold`

## Session 3 — 2026-08-06

### What was fixed
- Renamed npm package scope `@soro-kiit/scaffold` → `@soro-bix/scaffold` to match the actual GitHub org (`Soro-Bix`); updated README install instructions and regenerated `package-lock.json`
- Confirmed and fixed a live bug affecting real users: a freshly `sorokit init`-generated project's `cargo test` failed out of the box with a `ChaCha20Rng`/`ed25519_dalek::rand_core::CryptoRng` trait-bound error, because the generated `Cargo.toml` was unpinned and shipped no `Cargo.lock` — a fresh dependency resolve pulls in `ed25519-dalek` 3.0.0 via `soroban-env-host`'s `testutils` feature, which conflicts with an older `ed25519-dalek`/`rand_core` elsewhere in the graph
- No code changes were needed in this repo — the fix is entirely on the templates side (`soroban-scaffold-templates`): each template now ships a pre-generated, verified `Cargo.lock.template` that `copyTemplate` already renders and copies like any other template file (no CLI changes required), and `.gitignore.template` no longer excludes `Cargo.lock`
- Verified end-to-end: `sorokit init fixed-test-project` → `cargo test` passes (5/5) with zero manual `cargo update`/intervention

### What still needs doing
- Make template path configurable (not hardcoded to `../soroban-scaffold-templates`)
- Implement template selection (`--template` flag to choose basic/token/escrow)
- Populate token/ and escrow/ templates properly (contract logic — Cargo.lock/tests are now fixed)
- Publish to npm as `@soro-bix/scaffold`
- Cargo.lock.template pins `soroban-sdk` at whatever was latest when generated (22.0.11 as of this session) — will need periodic regeneration as the SDK evolves
