# Soroban Scaffold CLI

Scaffold production-ready Soroban smart contract projects in one command — like `create-react-app` but for Soroban/Stellar development.

## What it does

Soroban Scaffold CLI (`sorokit`) is a command-line tool that bootstraps complete, production-ready Soroban smart contract projects with a single command. It sets up:

- Proper Rust/Cargo workspace structure with Soroban SDK 22.x
- Choice of contract templates (basic counter, token, escrow, and more)
- Full test suites following best practices
- Pre-configured `.gitignore`, README, and development tooling
- Optimized release profiles for WASM deployment

## Installation

_Planned — not yet published to npm_

```bash
npm install -g @soro-bix/scaffold
```

## Usage

```bash
# Create a new basic counter contract project
sorokit init my-contract

# See available options
sorokit --help
sorokit init --help
```

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.x
- **CLI Framework**: Commander
- **Terminal UI**: Chalk (colors), Ora (spinners), Figlet (ASCII banners)
- **Testing**: Jest + ts-jest
- **Build**: TypeScript compiler (tsc)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup instructions, branch naming conventions, and commit guidelines.
