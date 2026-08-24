# Sorobix CLI Usage Guide

Complete reference for the `sorobix` command line tool.

- [Installation](#installation)
- [Command reference](#command-reference)
- [Template walkthroughs](#template-walkthroughs)
- [What gets generated](#what-gets-generated)
- [Environment variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

## Installation

```bash
npm install -g @soro-bix/scaffold
```

Requires Node.js 20 or newer. Building the *generated* contracts additionally
requires a Rust toolchain — see [Troubleshooting](#troubleshooting).

To run without installing:

```bash
npx @soro-bix/scaffold init my-contract
```

## Command reference

```
Usage: sorobix [options] [command]

Scaffold production-ready Soroban smart contract projects in one command

Options:
  -V, --version                  output the version number
  -h, --help                     display help for command

Commands:
  init [options] <project-name>  Create a new Soroban smart contract project
  list                           List the available contract templates
  help [command]                 display help for command
```

### `sorobix init <project-name>`

Creates a new directory named `<project-name>` in the current working directory
and generates a complete Soroban contract project inside it.

```
Options:
  -a, --author <author>  Author name (defaults to git config user.name)
  -t, --template <name>  Contract template to scaffold (prompts if omitted)
                         (choices: "basic", "token", "escrow", "nft")
  -h, --help             display help for command
```

**`--template <name>`**

Selects which contract to scaffold. If omitted on an interactive terminal,
Sorobix shows a selector:

```
? Which contract template would you like to use?
❯ basic
  token
  escrow
  nft

Counter contract — ideal for learning Soroban fundamentals
↑↓ navigate • ⏎ select
```

Passing `--template` explicitly skips the selector. In any non-interactive
context (CI, piped input, a script) the selector is skipped automatically and
`basic` is used, so an unattended run can never block waiting for input.

An invalid name is rejected before any files are written:

```
$ sorobix init my-contract --template solana
error: option '-t, --template <name>' argument 'solana' is invalid.
Allowed choices are basic, token, escrow, nft.
```

**`--author <name>`**

Fills the `authors` field in the generated `Cargo.toml` and the credit line in
the generated `README.md`. Resolved in this order:

1. `--author "Your Name"` if provided
2. `git config user.name`
3. An interactive prompt, if git has no identity configured

As with template selection, the prompt only appears on a real terminal. In CI a
placeholder is used rather than hanging.

**Failure cases**

`init` refuses to overwrite an existing directory:

```
$ sorobix init existing-project
✖ Failed to create project.
Directory "existing-project" already exists
```

It exits non-zero on any failure, so it is safe to use in a script with `set -e`.

### `sorobix list`

Prints every available template with its description and test count.

```
$ sorobix list

Available templates:

  basic    Counter contract — ideal for learning Soroban fundamentals  7 tests
  token    SEP-41 fungible token with mint/burn/transfer/approve  9 tests
  escrow   Milestone-based escrow with dispute resolution  7 tests
  nft      Non-fungible token with per-token metadata and approvals  13 tests

Templates directory: /path/to/soroban-scaffold-templates/templates
Usage: sorobix init <project-name> --template <name>
```

Test counts are read from each template's source at runtime rather than being
hardcoded, so they always reflect what the template actually contains. If a
template directory is missing it is reported as `not found` instead of causing
an error.

Respects `SOROBIX_TEMPLATES_DIR`, so it also works against a custom template
directory.

## Template walkthroughs

Each walkthrough below is a complete flow from scaffold to passing tests.

### basic — counter contract

The smallest useful Soroban contract. Good for learning the SDK.

```bash
sorobix init my-counter --template basic
cd my-counter
cargo test --locked
```

Expected result: **7 tests passing**.

Functions: `initialize(admin)`, `increment()`, `decrement()`, `get_count()`,
`reset(admin)`.

`increment`, `decrement` and `get_count` work with no setup. `reset` requires
`initialize(admin)` to have been called first, and is restricted to that admin.

Build a deployable WASM artifact:

```bash
cargo build --target wasm32-unknown-unknown --release
```

### token — SEP-41 fungible token

A fungible token following the Stellar token interface, suitable as a starting
point for a real asset.

```bash
sorobix init my-token --template token
cd my-token
cargo test --locked
```

Expected result: **9 tests passing**.

Functions: `initialize(admin, name, symbol, decimals, initial_supply)`,
`mint(admin, to, amount)`, `transfer(from, to, amount)`,
`transfer_from(spender, from, to, amount)`, `approve(owner, spender, amount)`,
`allowance(owner, spender)`, `burn(from, amount)`, `balance(address)`,
`total_supply()`, `name()`, `symbol()`, `decimals()`.

Every state-changing function calls `require_auth()`, and events are emitted on
transfer, approval, mint and burn.

### escrow — milestone escrow

A trustless escrow holding real tokens across a set of milestones, with an
arbiter for dispute resolution.

```bash
sorobix init my-escrow --template escrow
cd my-escrow
cargo test --locked
```

Expected result: **7 tests passing**.

Functions: `initialize(client, freelancer, arbiter, token, milestone_amounts)`,
`fund(client)`, `mark_delivered(freelancer, milestone_index)`,
`approve_milestone(client, milestone_index)`,
`raise_dispute(caller, milestone_index)`,
`resolve_dispute(arbiter, milestone_index, release_to_freelancer)`, `get_job()`.

Funds move through real cross-contract token transfers via
`soroban_sdk::token::Client` — the contract holds the balance at its own address
between `fund()` and release. The test suite deploys a genuine Stellar Asset
Contract rather than mocking the token.

### nft — non-fungible token

An NFT collection with per-token ownership, metadata URIs, and approvals for
delegated transfers.

```bash
sorobix init my-nft --template nft
cd my-nft
cargo test --locked
```

Expected result: **13 tests passing**.

Functions: `initialize(admin, name, symbol)`,
`mint(admin, to, token_id, metadata_uri)`, `transfer(from, to, token_id)`,
`approve(owner, spender, token_id)`,
`transfer_from(spender, from, to, token_id)`, `burn(owner, token_id)`,
`owner_of(token_id)`, `token_uri(token_id)`, `get_approved(token_id)`,
`balance_of(owner)`, `total_supply()`, `name()`, `symbol()`.

Token IDs are `u64` and must be unique — minting an existing ID fails with
`TokenAlreadyExists` rather than silently reassigning ownership. Approvals are
cleared on every ownership change, so a spender approved by a previous owner
cannot move the token again after it changes hands.

## What gets generated

Every template produces the same file layout:

```
my-contract/
├── Cargo.lock      # pinned dependency graph — committed deliberately
├── Cargo.toml      # package metadata + wasm release profile
├── .gitignore
├── README.md       # template-specific docs, with your name and project name
└── src/
    ├── lib.rs      # the contract
    └── test.rs     # its test suite
```

`Cargo.lock` is generated and **not** gitignored. This is deliberate: a
scaffolded contract is a deployable artifact rather than a library, and an
unpinned dependency resolve currently pulls in conflicting `ed25519-dalek`
versions that break `cargo test` on a fresh machine. Shipping the lockfile is
what makes a freshly generated project work on the first try.

## Environment variables

| Variable | Description | Default |
|---|---|---|
| `SOROBIX_TEMPLATES_DIR` | Directory containing `basic/`, `token/`, `escrow/` and `nft/` template subdirectories | `../soroban-scaffold-templates/templates`, relative to the CLI install |

Useful for developing templates locally:

```bash
SOROBIX_TEMPLATES_DIR=/path/to/my/templates sorobix init test-project
```

Both `init` and `list` respect it.

## Troubleshooting

### `cargo: command not found`

The CLI itself only needs Node. Building the generated contract needs Rust:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown
```

Then install the Stellar CLI for deployment:

```bash
cargo install --locked stellar-cli
```

### The author field says "Unknown"

Git has no `user.name` configured and the run was not interactive. Either
configure git:

```bash
git config --global user.name "Your Name"
```

…or pass the name explicitly, which is the right approach in CI:

```bash
sorobix init my-contract --author "Your Name"
```

### `Template "x" not found at ...`

`SOROBIX_TEMPLATES_DIR` points somewhere that does not contain the expected
template subdirectory. Check what the CLI can currently see:

```bash
sorobix list
```

Anything listed as `not found` is missing from the directory shown at the bottom
of that output.

### Node version errors

Sorobix requires Node.js 20 or newer (`engines.node: ">=20"`). A dependency uses
a regex feature unavailable in Node 18's V8, which surfaces as
`Invalid regular expression flags` rather than a clear version error.

```bash
node --version   # must be v20 or higher
```

### `cargo test` fails in a generated project

First confirm the lockfile is present — it should be, and it is what pins the
dependency graph to a working combination:

```bash
ls Cargo.lock
cargo test --locked
```

`--locked` makes cargo fail loudly if `Cargo.toml` and `Cargo.lock` have drifted
apart, rather than silently re-resolving and reintroducing the dependency
conflict the lockfile exists to prevent.

## Related

- [soroban-scaffold-templates](https://github.com/Soro-Bix/soroban-scaffold-templates) — the templates themselves
- [Stellar Soroban documentation](https://developers.stellar.org/docs/smart-contracts)
