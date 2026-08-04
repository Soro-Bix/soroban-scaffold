# Contributing to Soroban Scaffold CLI

Thanks for your interest in contributing! This document covers everything you need to know to get started.

## Getting Started

### Prerequisites

- Node.js 18+ (recommend 20 LTS)
- npm 9+ or equivalent package manager
- Git

### Setup

1. Fork the repository
2. Clone your fork locally:
   ```bash
   git clone https://github.com/<your-username>/soroban-scaffold.git
   cd soroban-scaffold
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run the development build:
   ```bash
   npm run dev
   ```
5. Run tests:
   ```bash
   npm test
   ```
6. Run the TypeScript type checker:
   ```bash
   npx tsc --noEmit
   ```

### Running the CLI locally

```bash
# Using ts-node (dev mode)
npm run dev init my-test-project

# Build first, then run
npm run build
npm start init my-test-project
```

## Branch Naming Convention

Use the following pattern for branch names:

```
<type>/<short-description>
```

Examples:
- `feat/add-token-template`
- `fix/init-command-path-resolution`
- `docs/update-readme-examples`
- `chore/update-dependencies`
- `ci/add-typecheck-step`

## Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/). Every commit message must follow this format:

```
<type>: <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | A new feature for the user |
| `fix` | A bug fix |
| `docs` | Documentation only changes |
| `style` | Changes that do not affect the meaning of the code (white-space, formatting, etc.) |
| `refactor` | A code change that neither fixes a bug nor adds a feature |
| `perf` | A code change that improves performance |
| `test` | Adding missing tests or correcting existing tests |
| `ci` | Changes to CI configuration files and scripts |
| `chore` | Other changes that don't modify src or test files |
| `revert` | Reverts a previous commit |

### Examples

```
feat: add token contract template selection

fix: resolve template path correctly on Windows

docs: add contributing guidelines

ci: add tsc --noEmit to build pipeline
```

## Pull Request Process

1. Ensure your branch is up to date with `main`
2. Run `npx tsc --noEmit` — no type errors
3. Run `npm test` — all tests pass
4. Update `context.md` in the repo root with what you built
5. Open a pull request against `main`
6. Link any related GitHub issues
7. Request a review from maintainers

## Code Style

- Write TypeScript with strict mode enabled (we use `strict: true`)
- Prefer `async`/`await` over raw promises
- Use ESM modules (`type: "module"` in package.json)
- Keep functions focused and testable
- Add JSDoc comments for public APIs

## Project Structure

```
soroban-scaffold/
├── src/
│   ├── index.ts           # CLI entry point, commander setup
│   └── commands/
│       └── init.ts        # `sorokit init` command implementation
├── jest.config.ts         # Jest configuration
├── tsconfig.json          # TypeScript configuration
├── package.json
├── README.md
├── CONTRIBUTING.md
└── context.md             # Session-by-session project context
```

## Questions?

Open a GitHub discussion or reach out to the maintainers.
