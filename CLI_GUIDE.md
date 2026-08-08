# Sorobix CLI Usage Guide

## Installation

```bash
npm install -g @soro-bix/scaffold
```

Or run directly:

```bash
npx @soro-bix/scaffold <command>
```

## Commands

### `init` — Create a new project

```bash
# Basic template (default)
sorobix init my-project

# Specific template
sorobix init my-token -t token

# With author
sorobix init my-contract -a "Alice" -t multisig

# Interactive mode (step-by-step prompts)
sorobix init --interactive
```

**Options:**
- `-t, --template <name>` — Template name: basic, token, escrow, nft, multisig, timelock, vesting
- `-a, --author <author>` — Author name (defaults to `git config user.name`)
- `-i, --interactive` — Interactive mode with prompts

### `list` — Show available templates

```bash
sorobix list
```

Outputs a table of all available templates with descriptions and availability status.

### `upgrade` — Upgrade project to latest template

```bash
# Upgrade current directory
sorobix upgrade

# Upgrade specific project
sorobix upgrade -p ./my-project
```

Checks and updates the `soroban-sdk` version in `Cargo.toml` to the latest supported version.

## Available Templates

| Template | Description |
|----------|-------------|
| `basic` | Minimal contract skeleton |
| `token` | SEP-41 fungible token |
| `escrow` | Time-locked escrow |
| `nft` | Non-fungible token (ERC-721 style) |
| `multisig` | Multi-signature wallet |
| `timelock` | Time-based token lock |
| `vesting` | Token vesting with cliff |

## Environment Variables

- `SOROBIX_TEMPLATES_DIR` — Override the default templates directory

## Quick Start

```bash
# Install
npm install -g @soro-bix/scaffold

# Create a token project
sorobix init my-token -t token -a "Alice"

# Build
cd my-token
cargo build

# Test
cargo test
```
