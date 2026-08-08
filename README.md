# Sorobix — Soroban Scaffold CLI

> Scaffold production-ready Soroban smart contracts in one command.

Sorobix is a command-line tool that generates fully working, tested, CI-ready Soroban smart contract projects on Stellar — so you can start building your contract logic immediately instead of spending hours on boilerplate setup.

## Why Sorobix?

Every Soroban developer today manually assembles the same boilerplate:
- Workspace Cargo.toml with the right release profile
- Dependency pinning to avoid the ed25519-dalek conflict that breaks fresh installs
- GitHub Actions CI with the right wasm32 target
- Test file with mock environment setup
- README and CONTRIBUTING docs

Sorobix eliminates all of that. One command, three template types, everything pre-configured and pre-tested.

## Quick Start

```bash
# Install globally
npm install -g @soro-bix/scaffold

# Scaffold a new project
sorobix init my-token --template token

# Generated project works immediately
cd my-token
cargo test --locked
```

## Templates

| Template | Description | Tests |
|---|---|---|
| `basic` | Counter contract — ideal for learning Soroban | 5 |
| `token` | SEP-41 fungible token with mint/burn/transfer/approve | 9 |
| `escrow` | Milestone-based escrow with dispute resolution | 7 |

## Commands

```bash
sorobix init <project-name> [--template basic|token|escrow]
sorobix --version
sorobix --help
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `SOROBIX_TEMPLATES_DIR` | Override the default template directory path | `../soroban-scaffold-templates/templates` |

## Requirements

- Node.js 20+
- Rust + Stellar CLI (for building generated contracts)
- Freighter wallet (for deploying to Stellar Testnet)

## Tech Stack

- TypeScript + Commander (CLI framework)
- Handlebars (template variable rendering)
- Chalk + Ora (terminal UX)
- Jest (test suite — 10 passing tests)
- GitHub Actions CI (Node 20/22 matrix)

## Contributing

We welcome contributors of all experience levels. See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup instructions and contribution guidelines.

This project participates in the [Drips Wave Stellar contributor program](https://drips.network/wave/stellar). Check the open issues for tasks you can pick up and earn points for.

## Related

- [soroban-scaffold-templates](https://github.com/Soro-Bix/soroban-scaffold-templates) — The contract templates this CLI generates from
- [Stellar Soroban docs](https://developers.stellar.org/docs/smart-contracts)

## License

MIT
