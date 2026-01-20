# SkillHub Desktop

A desktop application for managing AI coding skills across multiple tools. Browse, install, and sync skills between Claude Code, Cursor, OpenCode, and more.

<p align="center">
  <a href="https://www.skillhub.club">
    https://www.skillstore.club/
    <img src="https://www.skillstore.club/icon.svg" alt="SkillHub Desktop" width="600" />
  </a>
</p>

<p align="center">
  <strong>Supported by <a href="https://www.skillhub.club">SkillHub.club</a></strong> - The community-driven platform for AI coding skills
</p>

<p align="center">
  <a href="https://www.skillstore.club/">Website</a> •
  <a href="https://www.skillhub.club/skills">Browse Skills</a> •
  <a href="https://www.skillhub.club/docs">Documentation</a>
</p>

## Features

- **Discover Skills** - Browse and search AI coding skills from the SkillHub catalog
- **One-Click Install** - Install skills to multiple AI coding tools simultaneously
- **Create Skills** - Create custom skills with AI-powered generation
- **AI Enhance** - Expand, simplify, rewrite, or translate selected text with AI
- **Sync Skills** - Sync skills between different AI coding tools
- **Collections** - Organize and manage skill collections
- **Multi-language** - Supports English and Chinese (中文)

## Supported Tools

- Claude Code
- Cursor
- OpenCode
- Windsurf
- Cline
- Roo Code
- Aide
- Augment

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘ + K` | Open command palette / search |
| `⌘ + R` | Refresh detected tools |
| `⌘ + ,` | Open settings |

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/) (latest stable)
- [Tauri CLI](https://tauri.app/)

### Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SKILLHUB_API_URL` | `https://www.skillhub.club` | API base URL |

To use a custom API URL (e.g., local development):

```bash
SKILLHUB_API_URL=http://localhost:3000 npm run tauri dev
```

### Project Structure

```
skillhub-desktop/
├── src/                    # React frontend
│   ├── api/               # API functions
│   ├── components/        # React components
│   ├── i18n/              # Internationalization
│   ├── pages/             # Page components
│   ├── store/             # Zustand state management
│   └── types/             # TypeScript types
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── main.rs        # Entry point
│   │   ├── lib.rs         # Tauri commands
│   │   └── tools/         # Tool detection logic
│   └── Cargo.toml
└── package.json
```

### Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Rust, Tauri v2
- **State**: Zustand
- **i18n**: react-i18next
- **Editor**: @uiw/react-md-editor

## Building

### macOS

```bash
npm run tauri build
```

The built app will be in `src-tauri/target/release/bundle/`.

### Windows

```bash
npm run tauri build
```

### Linux

```bash
npm run tauri build
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Links

- [SkillHub Website](https://www.skillhub.club)
- [Documentation](https://www.skillhub.club/docs)
- [Report Issues](https://github.com/skillhub-club/skillhub-desktop/issues)
