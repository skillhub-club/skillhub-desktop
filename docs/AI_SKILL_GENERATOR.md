# AI Skill Generator 功能设计

## 概述
用户描述需求，AI Agent 帮助生成 SKILL.md 内容。支持流式输出，自动追踪使用情况。

## 商业模式
- **免费用户**: 每天 1 次生成
- **付费用户**: 无限制（使用现有的订阅包）
- **数据收集**: 用户需求 + 生成结果 + 使用情况，用于改进 AI 和分析用户需求

---

## 架构设计

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Desktop App    │────▶│  SkillHub API    │────▶│  Claude AI  │
│  (用户描述)      │◀────│  (流式返回)       │◀────│  (生成内容)  │
└─────────────────┘     └──────────────────┘     └─────────────┘
        │                       │
        │                       ▼
        │               ┌──────────────────┐
        └──────────────▶│  Analytics DB    │
          (追踪数据)     │  - generations   │
                        │  - usage_events  │
                        └──────────────────┘
```

---

## 后端 API (SkillHub Web)

### 1. 生成 Skill API
**Endpoint**: `POST /api/v1/desktop/generate-skill`

**Request**:
```json
{
  "description": "一个帮助生成 React 组件的技能，包含 TypeScript 支持",
  "category": "frontend",
  "context": {
    "tool": "claude",  // 目标工具
    "language": "zh"   // 输出语言
  }
}
```

**Response** (Server-Sent Events 流式):
```
data: {"type": "start", "generation_id": "gen_xxx"}
data: {"type": "content", "text": "---\nname: \"React Component Generator\"\n"}
data: {"type": "content", "text": "description: \"...\""}
...
data: {"type": "done", "usage": {"daily_remaining": 0}}
data: {"type": "error", "message": "Rate limit exceeded"}
```

**限流逻辑**:
- 未登录: 禁止使用
- 免费用户: 每天 1 次 (UTC 0点重置)
- 付费用户: 无限制

### 2. 追踪 API
**Endpoint**: `POST /api/v1/desktop/track-generation`

**Request**:
```json
{
  "generation_id": "gen_xxx",
  "event": "used",  // "used" | "modified" | "discarded"
  "data": {
    "original_content": "...",
    "final_content": "...",
    "modification_ratio": 0.15  // 修改了 15%
  }
}
```

### 3. 数据库表设计

```sql
-- 生成记录表
CREATE TABLE skill_generations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  description TEXT NOT NULL,
  category VARCHAR(50),
  generated_content TEXT,
  model VARCHAR(50) DEFAULT 'claude-3-5-sonnet',
  tokens_used INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 使用追踪表
CREATE TABLE generation_events (
  id UUID PRIMARY KEY,
  generation_id UUID REFERENCES skill_generations(id),
  event_type VARCHAR(20), -- 'used', 'modified', 'discarded'
  original_content TEXT,
  final_content TEXT,
  modification_ratio FLOAT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 每日使用配额表
CREATE TABLE daily_generation_quota (
  user_id UUID REFERENCES users(id),
  date DATE,
  count INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, date)
);
```

---

## 桌面端实现

### 1. AI 生成按钮 (CreateSkill 页面)
- 位置: 表单上方，显眼的 "AI 帮写" 按钮
- 点击弹出对话框
- 输入描述 → 流式显示生成内容 → 可编辑 → 应用到编辑器

### 2. 编辑器内 AI 辅助
- MDEditor 工具栏添加 AI 按钮
- 选中文字后可以：
  - 扩展/详细化
  - 简化/精简
  - 改写/优化
  - 翻译

### 3. 自动追踪
- 生成时记录 `generation_id`
- 用户点击 "Create Skill" 时：
  - 比较生成内容 vs 最终内容
  - 计算修改比例
  - 发送追踪事件

### 4. UI 组件

```tsx
// AIGenerateDialog.tsx
interface AIGenerateDialogProps {
  open: boolean
  onClose: () => void
  onApply: (content: string, generationId: string) => void
}

// 状态: idle → generating → done/error
// 显示: 剩余次数、流式内容、应用/重新生成按钮
```

---

## 实现步骤

### Phase 1: 后端 API
1. [ ] 创建 `skill_generations` 表
2. [ ] 创建 `generation_events` 表
3. [ ] 创建 `daily_generation_quota` 表
4. [ ] 实现 `/api/v1/desktop/generate-skill` (SSE 流式)
5. [ ] 实现 `/api/v1/desktop/track-generation`
6. [ ] 添加配额检查逻辑

### Phase 2: 桌面端 - AI 生成按钮
1. [ ] 创建 `AIGenerateDialog` 组件
2. [ ] 实现 SSE 流式接收
3. [ ] 添加到 CreateSkill 页面
4. [ ] 显示剩余配额

### Phase 3: 桌面端 - 编辑器 AI 辅助
1. [ ] 自定义 MDEditor 工具栏
2. [ ] 添加 AI 辅助按钮
3. [ ] 实现选中文字的 AI 操作

### Phase 4: 自动追踪
1. [ ] 在生成时保存 `generationId`
2. [ ] 在保存时计算 diff
3. [ ] 发送追踪事件

---

## Prompt 设计

### 生成 SKILL.md 的 System Prompt

```
You are an expert AI coding skill creator. Generate a SKILL.md file based on the user's description.

The SKILL.md should:
1. Have YAML frontmatter with: name, description, author, category
2. Clear instructions section
3. Examples with code blocks
4. Best practices and notes

Output format:
- Use markdown
- Include practical code examples
- Be specific and actionable
- Keep it concise but comprehensive

User's target tool: {tool}
Output language: {language}
```

---

## 安全考虑

1. **Rate Limiting**: 防止滥用
2. **Content Filtering**: 过滤不当内容
3. **Token Limiting**: 限制生成长度
4. **Auth Required**: 必须登录才能使用

---

## 指标追踪

1. **生成指标**
   - 每日生成次数
   - 平均生成时间
   - 错误率

2. **使用指标**
   - 使用率 (used / total)
   - 平均修改比例
   - 丢弃率

3. **用户需求分析**
   - 热门类别
   - 常见需求关键词
   - 用户痛点
