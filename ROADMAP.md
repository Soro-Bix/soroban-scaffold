# Roadmap

Where Sorobix is going between September and November 2026, and what "done"
means for each step.

This is an engineering plan, not a wish list — every milestone below has
acceptance criteria that can be checked by running something. Items marked
**tracked** have a GitHub issue; the rest are scoped here first and will get one
when work starts.

## Where things stand

As of 2026-09-10:

| | |
|---|---|
| Templates | 4 (`basic`, `token`, `escrow`, `nft`) — 36 contract tests total |
| CLI tests | 36 unit, 4 integration (each builds a real contract) |
| CI | Green on both repos — Node 20/22 matrix here, 4-way template matrix there |
| Templates bundled in the package | Yes — enforced by the `package` CI job |
| Published to npm | **Not yet** — see Milestone 2 |
| Deployed to testnet | **Not yet** — see Milestone 3 |

The "not yet" rows are the gap between what Sorobix claims and what a new user
can actually verify. They come first for that reason.

## Milestones

| # | Milestone | Target | Tracking |
|---|---|---|---|
| 1 | [Bundle templates into the package](#1-bundle-templates-into-the-package) | Sep 10 — **done** | new |
| 2 | [Publish to npm](#2-publish-to-npm) | Sep 10–22 | [scaffold#7](https://github.com/Soro-Bix/soroban-scaffold/issues/7) |
| 3 | [Testnet deployment proof](#3-testnet-deployment-proof) | Sep 23–29 | new |
| 4 | [Multisig template](#4-multisig-template) | Sep 30–Oct 6 | [templates#3](https://github.com/Soro-Bix/soroban-scaffold-templates/issues/3) |
| 5 | [Timelock template](#5-timelock-template) | Oct 7–13 | [templates#4](https://github.com/Soro-Bix/soroban-scaffold-templates/issues/4) |
| 6 | [Vesting template + SEP-41 audit](#6-vesting-template--sep-41-audit) | Oct 14–20 | [templates#7](https://github.com/Soro-Bix/soroban-scaffold-templates/issues/7), [templates#1](https://github.com/Soro-Bix/soroban-scaffold-templates/issues/1) |
| 7 | [`sorobix upgrade`](#7-sorobix-upgrade) | Oct 21–27 | [scaffold#4](https://github.com/Soro-Bix/soroban-scaffold/issues/4) |
| 8 | [Docs site and UX pass](#8-docs-site-and-ux-pass) | Oct 28–Nov 3 | new |

---

### 1. Bundle templates into the package

**Done — 2026-09-10.**

Ordered ahead of publishing after the first tarball was built and tested:
it installed cleanly and then failed on every `sorobix init`, because
`resolveTemplatesDir()` resolved to a sibling checkout of the templates
repository that does not exist inside `node_modules`. npm versions are
immutable, so publishing that would have left a permanently broken `0.1.0` on
the registry.

Templates are now copied into the package by `scripts/sync-templates.sh` on
`prepack`, and `resolveTemplatesDir()` prefers that bundled copy. The
`SOROBIX_TEMPLATES_DIR` override and the sibling-checkout fallback both still
work, so development from a clone is unchanged.

**Done when:** ✅ all of the following

- `npm pack` produces a tarball containing every template — 24 files, 0 from
  `src/` or `tests/`
- The tarball installs globally and `sorobix list` reports all four templates
  found, with `SOROBIX_TEMPLATES_DIR` unset and no repo checkout reachable
- A project scaffolded from the installed package passes `cargo test --locked`
- A `package` CI job runs the whole sequence on every push, so it cannot rot

### 2. Publish to npm

The README's Quick Start opens with `npm install -g @soro-bix/scaffold`, and
that command currently 404s. This is the last step between the documented
install and a working one.

Remaining scope: a release workflow that publishes on a version tag rather than
from a laptop, and the `NPM_TOKEN` secret to go with it.

**Done when:**
- `npm view @soro-bix/scaffold version` returns `0.1.0`
- A `v0.1.0` tag exists and the release workflow published it
- `npm install -g @soro-bix/scaffold && sorobix init demo --template token`
  works off a clean npm cache, and the result passes `cargo test --locked`

### 3. Testnet deployment proof

Every template is tested against the local Soroban test environment. None has
been deployed to a real network.

Each template gets deployed to Stellar testnet, with the resulting contract IDs
recorded in that template's README and linked to a block explorer, so the claim
"this generates a working contract" is independently checkable rather than
taken on trust.

**Done when:**
- All four templates are deployed to testnet from freshly scaffolded projects
- Each template README carries its contract ID and explorer link
- The deploy steps are written up in the usage guide, including funding a
  testnet account
- Any template that fails to deploy is fixed, not documented around

### 4. Multisig template

M-of-N approval with a configurable threshold. Approvals tracked per signer
rather than as a running count, so one signer approving twice cannot push a
proposal over the threshold alone.

**Done when:** the template meets every criterion in the
[Template Authoring Guide](https://github.com/Soro-Bix/soroban-scaffold-templates/blob/main/docs/TEMPLATE_AUTHORING.md#review-criteria)
— at least 7 tests covering every error variant and authorization failure,
native and wasm32 builds green, a committed `Cargo.lock.template`, CI matrix leg
added, and `VALID_TEMPLATES` updated in this repo so it can actually be selected.

### 5. Timelock template

Time-delayed execution: a proposal is queued, becomes executable only after a
delay, and expires if left unexecuted past a grace period.

New ground for this repo — the tests need `env.ledger()` timestamp manipulation
to prove boundary behaviour, including that execution one second before the
unlock time is rejected.

**Done when:** the authoring guide's review criteria are met, with explicit
tests at each time boundary (before unlock, at unlock, after expiry).

### 6. Vesting template + SEP-41 audit

**Vesting:** linear token release over a schedule with an optional cliff.
Depends on the same ledger-time testing approach as the timelock template, which
is why it follows it.

**SEP-41 audit:** the `token` template is described as SEP-41 compliant. That
claim has not been checked function by function against the spec. This audit
does that, documents the result, and fixes any divergence found.

**Done when:**
- The vesting template meets the review criteria
- Every function and event in SEP-41 is mapped to the template's implementation
  in a written comparison, with any gaps either fixed or documented as
  deliberate

### 7. `sorobix upgrade`

Update an existing scaffolded project's templates and pinned dependencies to
the current release, showing a diff and requiring confirmation before writing.

The design problem is that user code and template code live in the same files,
so a naive overwrite destroys work. The initial version should be conservative:
detect divergence, report it clearly, and refuse rather than guess.

**Done when:**
- `sorobix upgrade` detects the template a project came from and reports what
  would change
- Modified files are detected and never silently overwritten
- Integration tests cover a clean upgrade, a locally-modified project, and a
  project that did not come from Sorobix

### 8. Docs site and UX pass

A GitHub Pages site built from the existing guides, a terminal recording in the
README showing a real scaffold run, and a pass over every error message the CLI
can emit — checking each one names the actual problem and the next action.

**Done when:**
- The docs site is live and linked from both repos
- The README shows a recorded run
- Every error path has been triggered by hand and its message reviewed

---

## Out of scope for now

Deliberately not planned for this window:

- **Mainnet deployment tooling.** Testnet proof first; mainnet raises key
  handling questions that deserve their own design.
- **A plugin system for third-party templates.** `SOROBIX_TEMPLATES_DIR`
  already covers local template development, and four templates is too few to
  design a plugin API against.
- **Supporting soroban-sdk 23.x.** Worth doing when 23.x is released and
  stable, not speculatively.

## Contributing

Milestones 4, 5 and 6 are self-contained contract-writing tasks and are the
easiest place to start — each is one template with its tests, following the
[Template Authoring Guide](https://github.com/Soro-Bix/soroban-scaffold-templates/blob/main/docs/TEMPLATE_AUTHORING.md).
See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup and conventions.

Issues labelled `Stellar Wave` are open for contribution under the
[Drips Wave Stellar contributor program](https://drips.network/wave/stellar).
