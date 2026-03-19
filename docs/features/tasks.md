# 任务

任务是 TaskFlow 的核心工作单元。每个任务属于且只属于一个班级，班级内所有成员均可见。

---

## 任务创建（管理员侧）

### 页面结构

任务创建页面分为上下两个区域：

**上方 — 自然语言输入区**
用户粘贴或输入对任务的自然语言描述，点击按钮后由 AI 解析为结构化字段。

**下方 — 结构化信息填写区**
- 任务名称（必填）
- 开始时间（选填，timestamptz）
- 截止时间（必填，timestamptz）
- 是否允许延迟提交（布尔值，默认 true；v1 只存字段，不实现逻辑）
- 任务正文（Markdown，选填）
- 附件（上传至 MinIO）
- 前置任务（选填，从当前班级已有任务中选择）

### AI 解析流程

1. 用户在上方输入区输入或粘贴自然语言文本。
2. 用户点击"AI 解析"按钮。
3. 前端调用 `POST /tasks/parse`，传入文本内容（该接口只做解析，不创建任务）。
4. 后端读取 `system_config` 中的 LLM 配置（`llm.base_url`、`llm.api_key`、`llm.model`），构造提示词，调用 LLM。
5. 提示词要求 LLM **仅返回** 如下结构的 JSON：
   ```json
   {
     "title": "字符串或 null",
     "startAt": "ISO 8601 格式字符串或 null",
     "dueAt": "ISO 8601 格式字符串或 null",
     "description": "字符串或 null"
   }
   ```
6. 后端用 Zod 验证返回内容。若验证失败或 LLM 返回格式异常，接口返回部分结果，失败字段置为 `null`，不报错，保持降级处理。
7. 前端将返回值填入下方结构化表单。返回 `null` 的字段保持为空。
8. **用户必须检查并确认所有字段后方可提交。** 表单对必填字段做严格校验，无论 AI 返回什么，空字段都不允许提交。

该交互逻辑类比快递地址识别：系统自动识别，最终由用户确认。

### 前置任务关联

- 创建表单中提供一个可选的多选区域，用于选择前置任务。
- 展开后，前端拉取当前班级所有已发布任务的基本信息（`GET /classes/:classId/tasks`）供用户选择。
- 选中的任务 ID 以字符串数组形式存入 `tasks.blockedBy`。
- 后端不做任何验证，循环依赖和悬空引用均被静默接受。前端在甘特图视图中利用此数据绘制任务依赖连线。

### 同时创建两个关联任务（未来方向）

v1 不实现。未来可考虑提供 UI 入口，允许用户一次创建一对"前置任务 → 后置任务"，在此记录为后续方向。

---

## 任务可见性与状态（成员侧）

班级内所有成员均可看到该班级的全部有效任务（`deletedAt IS NULL`）。

**任务状态为派生值，不存储在数据库中：**

| 条件 | 展示给成员的状态 |
|---|---|
| 无 `task_user_state` 记录，或 `viewedAt IS NULL` | 未读 |
| `viewedAt IS NOT NULL`，且无 `submissions` 记录 | 已读 |
| 存在该用户的 `submissions` 记录 | 已提交 |

---

## 已读记录

成员打开任务详情页时，前端立即调用 `POST /tasks/:taskId/view`。

后端处理逻辑：
- 若 `(taskId, userId)` 对应的 `task_user_state` 记录不存在 → 创建记录，写入 `viewedAt = now()`。
- 若记录存在且 `viewedAt IS NOT NULL` → 不做任何操作（只记录首次查看，不覆盖）。
- 若记录存在且 `viewedAt IS NULL` → 写入 `viewedAt = now()`。

此调用对前端而言是"发出即忘"，请求失败不影响用户正常阅读任务内容。

---

## 任务提交（成员侧）

### 提交页面

提交页面包含：
- 支持附件上传和内联图片插入的 Markdown 编辑器。
- 文件上传区域。
- "提交"按钮。

内联图片和文件附件须先上传至 MinIO，再通过 URL 引用插入 Markdown 正文。

### 首次提交

1. 成员提交内容和/或文件。
2. 后端检查 `(taskId, userId)` 对应的 `submissions` 记录是否存在。
3. 若不存在：创建记录，写入 `firstSubmittedAt = now()`。
4. 将附件元数据写入 `attachments` 表，`submissionId` 指向新建的提交记录。
5. 确保 `task_user_state` 记录存在（不存在则创建）。

### 重新提交（更新提交内容）

1. `submissions` 记录已存在。
2. 后端就地更新记录，`lastUpdatedAt` 由 Prisma `@updatedAt` 自动刷新。
3. 在写入新附件前，先删除旧提交对应的附件记录及 MinIO 对象。
4. `firstSubmittedAt` 永不修改。

### 延迟提交逻辑（`allowLateSubmission`）

**v1**：该字段存储在数据库中并由 API 返回，但不实现任何执行逻辑。所有提交请求均被接受，不受 `dueAt` 限制。

**v2 规划逻辑：**
- `allowLateSubmission = true`：任何时间均无限制。
- `allowLateSubmission = false` 且当前时间 > `dueAt`：
  - 若 `firstSubmittedAt IS NULL`（从未提交）：允许提交一次。
  - 若 `firstSubmittedAt IS NOT NULL`（已有提交）：返回 403，拒绝更新。

此检查在提交服务层执行。对 `task_user_state` 中 `viewedAt`、`tags`、`sortOrder` 的更新操作不受此规则影响。

---

## 任务统计（管理员侧）

管理员可以在任务页面查看统计数据：
- 班级总成员数
- 已读人数（`task_user_state` 中 `viewedAt IS NOT NULL` 的记录数）
- 已提交人数（`submissions` 中该任务的记录数）

以上数据通过 COUNT 查询从 `task_user_state` 和 `submissions` 派生，无需额外数据表。

---

## 管理员查看提交列表

管理员可以查看某任务下所有班级成员的提交情况，以列表形式展示。

**重要**：查询必须从 `class_members` 出发，而非从 `submissions` 出发，以确保从未提交的成员也出现在列表中。

```
class_members（当前班级）
  LEFT JOIN submissions ON (task_id = :taskId AND user_id = member.userId)
  JOIN users ON users.id = member.userId
```

返回字段：用户昵称、邮箱、学校、学号、提交状态、首次提交时间、最后修改时间。

管理员可点击进入某个成员的提交详情，查看其 Markdown 正文和附件文件。

- 列表接口：`GET /tasks/:taskId/submissions`
- 单条详情接口（含附件）：`GET /tasks/:taskId/submissions/:submissionId`

---

## 管理员评分

管理员可对其管理的班级中任意 `submissions` 记录更新以下字段：
- `score`（小数）
- `reviewNote`（文字反馈）
- `reviewerId`（自动设为当前管理员的 userId）
- `reviewedAt`（自动设为当前时间）

上述字段对普通成员只读。

---

## CSV 导出

导出指定任务下所有班级成员的成绩表，包括从未提交的成员。

**查询**：`class_members LEFT JOIN submissions LEFT JOIN users LEFT JOIN schools`

**CSV 列：**

| 列名 | 数据来源 |
|---|---|
| 昵称 | `users.nickname`（为空则回退到 `users.email`） |
| 学校 | `schools.name`（无学校则留空） |
| 学号 | `users.studentId`（无学号则留空） |
| 班级 | `classes.name` |
| 任务名称 | `tasks.title` |
| 首次提交时间 | `submissions.firstSubmittedAt`（无提交则留空） |
| 最后修改时间 | `submissions.lastUpdatedAt`（无提交则留空） |
| 成绩 | `submissions.score`（未评分则留空） |

无提交记录的成员同样出现在导出结果中，提交相关字段留空，以保证导出名单的完整性。

---

## 任务删除

完整逻辑见 `data_policy.md`。简要说明：
- 若任务有零条提交记录：硬删除，通过 CASCADE 完整清理所有关联数据。
- 若任务有一条或以上提交记录：软删除，将 `deletedAt` 置为当前时间，清空 `title` 和 `description`，删除任务附件（MinIO 对象 + 数据库记录），保留提交记录及其附件。
