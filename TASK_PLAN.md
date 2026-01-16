# SkillHub Desktop - 开发任务计划

## 项目概述

SkillHub Desktop 是一个跨平台桌面应用，用于统一管理多个 AI coding 工具的 skills。

- **技术栈**: Tauri v2 + React 19 + TypeScript + Tailwind CSS
- **目标**: 解决用户在不同 coding agent 之间切换时 skills 无法共享的痛点

---

## 开发进度

### Phase 1: MVP 基础功能 ✅ 已完成

| 任务 | 状态 | 完成日期 |
|------|------|----------|
| 项目初始化 (Tauri + React) | ✅ | 2026-01-16 |
| 多工具检测 (17个工具) | ✅ | 2026-01-16 |
| SkillHub API 集成 | ✅ | 2026-01-16 |
| Discover 页面 (搜索/浏览) | ✅ | 2026-01-16 |
| Installed 页面 (本地管理) | ✅ | 2026-01-16 |
| Sync 页面 (跨工具同步) | ✅ | 2026-01-16 |
| Settings 页面 | ✅ | 2026-01-16 |

### Phase 2: 用户系统 ✅ 已完成

| 任务 | 状态 | 完成日期 |
|------|------|----------|
| OAuth 登录 UI | ✅ | 2026-01-16 |
| SkillHub OAuth 集成 | ✅ | 2026-01-16 |
| Token 存储 (Zustand persist) | ✅ | 2026-01-16 |
| 用户收藏同步 | ✅ | 2026-01-16 |
| Favorites 页面 | ✅ | 2026-01-16 |

### Phase 3: 系统托盘 ✅ 已完成

| 任务 | 状态 | 完成日期 |
|------|------|----------|
| 托盘图标 | ✅ | 2026-01-16 |
| 托盘菜单 (Show/Quit) | ✅ | 2026-01-16 |
| 关闭到托盘 | ✅ | 2026-01-16 |
| 开机自启动 | ⏳ | 可选 - 后续实现 |

### Phase 4: 优化与发布 ⏳ 待开始

| 任务 | 状态 | 说明 |
|------|------|------|
| 生产构建测试 | ⏳ | 测试 macOS/Windows/Linux 构建 |
| 自动更新 | ⏳ | Tauri updater 集成 |
| 发布到 GitHub Releases | ⏳ | CI/CD 配置 |

---

## 支持的 AI Coding 工具 (17个)

### Front-Runners
1. Claude Code (`~/.claude`)
2. Cursor (`~/.cursor`)
3. Codex - OpenAI (`~/.codex`)
4. GitHub Copilot (`~/.config/github-copilot`)
5. Cline (`~/.cline`)

### Runners-Up
6. RooCode (`~/.roo`)
7. Windsurf (`~/.windsurf`)
8. Aider (`~/.aider`)
9. Augment (`~/.augment`)
10. Continue (`~/.continue`)
11. Gemini CLI (`~/.gemini`)
12. OpenCode (`~/.opencode`)

### Emerging
13. AWS Kiro (`~/.kiro`)
14. Kilo Code (`~/.kilocode`)
15. Zencoder (`~/.zencoder`)

### IDEs
16. Zed (`~/.zed`)
17. VS Code (`~/.vscode`)

---

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                    SkillHub Desktop                          │
├─────────────────────────────────────────────────────────────┤
│  React Frontend                                              │
│  ├── pages/                                                  │
│  │   ├── Discover.tsx    # 搜索/浏览 SkillHub               │
│  │   ├── Favorites.tsx   # 云端收藏同步                      │
│  │   ├── Installed.tsx   # 本地已安装管理                    │
│  │   ├── Sync.tsx        # 跨工具同步                        │
│  │   └── Settings.tsx    # 设置                              │
│  ├── components/                                             │
│  │   └── UserMenu.tsx    # 登录/用户菜单                     │
│  ├── store/              # Zustand 状态管理 (含认证)          │
│  └── api/                # API 调用                          │
├─────────────────────────────────────────────────────────────┤
│  Rust Backend (Tauri)                                        │
│  ├── lib.rs              # Tauri commands                    │
│  └── tools.rs            # 工具检测 & skill 管理             │
└─────────────────────────────────────────────────────────────┘
         │
         ▼ HTTP API
┌─────────────────────────────────────────────────────────────┐
│                    SkillHub Cloud                            │
│  - /api/v1/skills/search    # 语义搜索                       │
│  - /api/v1/skills/catalog   # 目录浏览                       │
│  - /api/v1/oauth/*          # 用户认证                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 开发命令

```bash
# 安装依赖
npm install

# 开发模式
npm run tauri:dev

# 构建生产版本
npm run tauri:build
```

---

## 更新日志

### 2026-01-16 (v0.1.0)
- 初始化项目
- 完成 Phase 1 所有功能
- 添加 17 个 AI coding 工具支持
- 集成 @skill-hub/sdk
- **Phase 2 完成**: OAuth 登录、用户收藏同步、Favorites 页面
- **Phase 3 完成**: 系统托盘图标、托盘菜单、关闭最小化到托盘
