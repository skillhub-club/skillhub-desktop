# Findings & Decisions

## Requirements
- 采用 shadcn/ui + Tailwind 迁移当前“重组件”并拆分
- 迁移顺序：从难到易（优先 SkillPlayground）
- 在独立分支 `shadcn-migration` 中推进

## Research Findings
- 当前最大组件：`src/components/SkillPlayground.tsx` (~40K)、`src/components/SetupWizard.tsx` (~30K)、`src/components/SkillDetail.tsx` (~27K)
- 现有依赖已包含 Radix 组件与 `class-variance-authority`
- 目前代码中未发现 `cn()` 工具或 `cva` 使用
- `src/index.css` 已有 Tailwind layers 与 CSS variables，且定义了 `--radius` 等变量
- `tailwind.config.js` 已绑定 CSS variables 颜色与 0px radius，`plugins` 为空（未启用 tailwindcss-animate）
- `SkillPlayground` 内含复杂事件流（user/assistant/tool_call）、Artifacts 预览、设置面板与终端交互
- `SkillPlayground` Settings 面板有大量自定义按钮/输入，适合抽成 shadcn/ui Button/Input/Badge 等
- 已将 SkillPlayground Header/Settings/Artifacts/InputBar 拆分为独立组件（`PlaygroundHeader`, `PlaygroundSettingsPanel`, `PlaygroundArtifactsPanel`, `PlaygroundInputBar`）
- Playground 子组件按钮已迁移至 shadcn/ui Button（QuestionCard/ToolCallCard/TurnCard/AssistantMessage）
- SetupWizard 与 SkillDetail 的主要 modal/按钮已迁移至 shadcn/ui Dialog/Button/Input
- Playground 402 insufficient_balance 现在转为 toast（含“去充值”动作）而非 raw data
- Toast 支持可选 action 与 duration，用于 Playground 的余额不足提示
- Playground 余额不足提示已接入 i18n（中英文）
- SkillDetail 主要文案已接入 i18n（中英文）
- SkillCard、RelatedSkills、ImportSkillsModal、SearchDialog 文案已接入 i18n
- AIGenerateDialog 与 ToolSelector 文案/提示已接入 i18n
- Marketplace 页面文案已接入 i18n
- Installed 页面文案已接入 i18n（含分类标签/描述、项目/导入提示）
- Settings 页面文案已接入 i18n（账户/订阅/用量/API/外观子页）
- UserMenu 文案已接入 i18n（登录/提示/菜单项）
- Discover 页面文案已接入 i18n（分类/排序/安装/提示）
- Favorites/Collections 导出默认名与 Markdown 标签接入 i18n
- KolDetail 弹窗文案已接入 i18n（KOL 详情/统计/按钮）
- SkillsExplorer/TurnCard 补充 i18n（移动/删除/标题与摘要文案）
- Playground 页面补充 i18n（选择工具/搜索/项目下拉/加载提示）
- SkillDetail 补充 i18n（作者/评分/星标/文件选择文案）
- AIEnhanceToolbar/AIGenerateDialog/QuestionCard 补充 i18n（标题/错误/提示）
- AIIterateEditor/UpdateChecker 补充 i18n（编辑流程/更新提示）
- Toast 补充 i18n（关闭通知 aria-label）
- SetupWizard 补充 i18n（Terminal 标签/API Key 占位符）
- Terminal 组件补充 i18n（状态/按钮/提示）
- Dialog 组件补充 i18n（关闭按钮无障碍文本）
- CreateSkill 页面文案接入 i18n（表单/验证/导入/安装流程及模板）
- 全量字符串扫描噪音很高（className 等占多数），需要改用 showToast/placeholder/title/JSX 文本等定向查找继续清理
- `src/components/SkillDetail.tsx` 仍有 3 处硬编码 toast 文案（请选择工具/选择项目/未选文件），可接入 i18n
- placeholder/title 字面量扫描未发现新增未国际化内容（当前多为 t 或变量）
- JSX 文本扫描仅发现 Settings 快速开始的命令行示例与按钮加载占位符（属于代码/符号，不需要 i18n）
- `src/components/SkillsExplorer.tsx` 删除确认对话仍是硬编码英文模板字符串
- confirm/prompt 扫描无新增未国际化内容（Settings/SkillsExplorer/CreateSkill 均已使用 t）
- showToast 字面量与中文文本扫描无新增 UI 文案问题（中文多为注释）
- label 字段扫描未发现新增硬编码选项文案
- 数组字面量扫描未发现新增 UI 文案（多为扩展名/内部映射）
- Sync 页 JSX 文本/alt 扫描未发现未国际化文案
- Terminal 启动 banner 文案原为硬编码英文，现已接入 i18n
- JSX 文本/标题扫描仅剩 Settings 命令行示例与 SearchDialog 的键位提示（非本地化问题）
- JSX 内联字符串表达式（{'...'} / {"..."}) 扫描未发现未国际化文案
- desc 字段扫描未发现硬编码 UI 描述文案
- label/title 字段扫描发现 `src/App.tsx` 侧栏展开/收起 title 文案未接入 i18n
- `src/App.tsx` 侧栏展开/收起 title 文案已接入 i18n（nav.expandSidebar/nav.collapseSidebar）
- `SetupWizard` 包含 XTerm 终端与多步骤安装/配置流程，适合作为拆分 targets（Step header、Status badge、Action buttons 等）
- 多个页面/组件使用手写 modal（条件渲染 + overlay）与 dropdown/tooltip（非统一组件），适合引入 shadcn/ui Dialog/Dropdown/Tooltip 统一
- 已新增 `src/lib/utils.ts`（cn）、`src/components/ui` 基础组件（Button/Input/Badge/Dialog）

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| 先从 SkillPlayground 开始 | 复杂度最高，迁移收益最大 |
| 使用现有 Tailwind/CSS variables | 避免重置视觉风格，减少改动范围 |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| 无法创建 `chore/shadcn-migration` 分支（ref 目录权限） | 改用 `shadcn-migration` 并使用 escalated 权限创建 |

## Resources
- `src/components/SkillPlayground.tsx`
- `src/components/SetupWizard.tsx`
- `src/components/SkillDetail.tsx`
- `src/index.css`
- `tailwind.config.js`
- `package.json`

## Visual/Browser Findings
- 未使用图像/浏览器内容
