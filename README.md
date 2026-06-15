<p align="center">
  <img src="assets/banner.png" alt="Hermes Agent" width="100%">
</p>

# Hermes Agent

> A self-improving AI agent with a learning loop, multi-platform messaging gateway, and a paper-themed web dashboard.

> **Maintained by [badhope](https://github.com/badhope)** — originally created by the [Nous Research](https://github.com/NousResearch) team as [hermes-agent](https://github.com/NousResearch/hermes-agent). This fork preserves the original architecture while shipping a new paper-themed dashboard, multilingual UI, and a friendlier runtime layout system.

<p align="center">
  <a href="https://github.com/badhope/HermesAgent/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License: MIT"></a>
  <a href="README.zh-CN.md"><img src="https://img.shields.io/badge/%E4%B8%AD%E6%96%87-README-red?style=for-the-badge" alt="Chinese README"></a>
  <a href="https://github.com/badhope/HermesAgent/issues"><img src="https://img.shields.io/badge/Maintainer-badhope-7c2d12?style=for-the-badge" alt="Maintained by badhope"></a>
</p>

---

## What is Hermes Agent?

Hermes Agent is an AI assistant that gets better the more you use it. It remembers what worked, creates reusable skills from complex tasks, and builds a deeper understanding of who you are over time.

It runs on any LLM provider — OpenAI, Anthropic, OpenRouter, local models, or your own endpoint. Switch providers with one command. No vendor lock-in.

It's not tied to your laptop. Talk to it from Telegram, Discord, Slack, WhatsApp, or Signal while it works on a cloud VM.

---

## Features

| Feature | Description |
|---|---|
| **Terminal UI** | Full TUI with multiline editing, slash-command autocomplete, conversation history, streaming tool output. |
| **Multi-platform** | Telegram, Discord, Slack, WhatsApp, Signal, and CLI — all from a single gateway process. Voice transcription, cross-platform conversation continuity. |
| **Learning loop** | Agent-curated memory with periodic nudges. Autonomous skill creation after complex tasks. Skills self-improve during use. Cross-session recall via full-text search. |
| **Scheduled tasks** | Built-in cron scheduler with delivery to any platform. Daily reports, nightly backups, weekly audits — all in natural language. |
| **Parallel subagents** | Spawn isolated subagents for parallel workstreams. Write Python scripts that call tools via RPC. |
| **Runs anywhere** | Local, Docker, SSH, Singularity, Modal, Daytona. Serverless persistence — environment hibernates when idle, wakes on demand. |
| **Paper dashboard** | Clean, warm paper-themed web UI with runtime layout controls — font size, density, corner radius, content width, auto-fit, and 16-language i18n. |

---

## Quick Start

### Linux / macOS / WSL2 / Termux

```bash
curl -fsSL https://raw.githubusercontent.com/badhope/HermesAgent/main/scripts/install.sh | bash
```

### Windows (PowerShell)

```powershell
iex (irm https://raw.githubusercontent.com/badhope/HermesAgent/main/scripts/install.ps1)
```

After installation:

```bash
source ~/.bashrc    # or: source ~/.zshrc
hermes              # start chatting
```

---

## Getting Started

```bash
hermes              # Interactive CLI
hermes model        # Choose LLM provider and model
hermes tools        # Configure enabled tools
hermes config set   # Set config values
hermes gateway      # Start messaging gateway
hermes setup        # Full setup wizard
hermes update       # Update to latest version
hermes doctor       # Diagnose issues
```

---

## CLI vs Messaging

| Action | CLI | Messaging |
|---|---|---|
| Start chatting | `hermes` | `hermes gateway setup` + `hermes gateway start`, then message the bot |
| New conversation | `/new` or `/reset` | `/new` or `/reset` |
| Change model | `/model [provider:model]` | `/model [provider:model]` |
| Set personality | `/personality [name]` | `/personality [name]` |
| Retry / undo | `/retry`, `/undo` | `/retry`, `/undo` |
| Browse skills | `/skills` or `/<skill-name>` | `/<skill-name>` |
| Interrupt | `Ctrl+C` or new message | `/stop` or new message |

---

## Dashboard

The web dashboard uses a paper-inspired theme — warm off-white canvas, deep ink text, hairline rules, and a deep-amber accent.

**Runtime layout controls** (System page):

- Language switcher — 16 locales
- Font size — 6 steps (XS to XXL)
- Code font size — 6 steps, independent from body text
- Display density — 3 levels
- Corner radius — 3 levels
- Content max-width — 4 presets
- Auto-fit toggle — responsive layout with CSS container queries

All settings persist to `localStorage` and take effect immediately without rebuild.

---

## Documentation

| Section | What's Covered |
|---|---|
| Quickstart | Install, setup, first conversation |
| CLI Usage | Commands, keybindings, personalities, sessions |
| Configuration | Config file, providers, models, all options |
| Messaging Gateway | Telegram, Discord, Slack, WhatsApp, Signal |
| Tools & Toolsets | 40+ tools, toolset system, terminal backends |
| Skills System | Procedural memory, Skills Hub, creating skills |
| Memory | Persistent memory, user profiles |
| MCP Integration | Connect any MCP server for extended capabilities |
| Cron Scheduling | Scheduled tasks with platform delivery |

---

## Supported LLM Providers

- OpenAI (GPT-4o, o1, etc.)
- Anthropic (Claude 3.5 Sonnet, etc.)
- OpenRouter (200+ models)
- Nous Portal (300+ models + tool gateway)
- NVIDIA NIM (Nemotron)
- Xiaomi MiMo
- z.ai / GLM
- Kimi / Moonshot
- MiniMax
- Hugging Face
- Any OpenAI-compatible endpoint

Switch with `hermes model` — no code changes.

---

## Contributing

```bash
git clone https://github.com/badhope/HermesAgent.git
cd HermesAgent
./setup-hermes.sh
./hermes
```

---

## License

MIT — see [LICENSE](LICENSE).
