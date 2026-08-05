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

### What still needs doing
- Make template path configurable (not hardcoded to `../soroban-scaffold-templates`)
- Implement template selection (`--template` flag to choose basic/token/escrow)
- Populate token/ and escrow/ templates properly
- Publish to npm as `@soro-bix/scaffold`
