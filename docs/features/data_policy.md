# 数据政策

本文档定义数据所有权、删除行为及 GDPR 合规相关事项。

## 数据所有权层级

```
用户
└── 拥有：个人空间（班级）
    └── 拥有：任务（在个人空间中创建的）
        └── 拥有：任务附件

班级（由某用户拥有）
└── 拥有：任务
    └── 拥有：任务附件（任务正文中的内联媒体）

任务
└── 包含：提交（每个成员一条）
    └── 包含：提交附件

用户
└── 拥有：提交（跨所有班级）
└── 拥有：用户头像附件
```

提交归属于创建它的用户，而非班级或任务。这一区别在执行删除操作时至关重要。

---

## 删除规则

### 删除提交

v1 不对外提供用户自助删除提交的入口，可作为管理员功能实现。

执行后：`submissions` 记录硬删除，所有 `submissionId` 指向该提交的 `attachments` 记录通过 CASCADE 删除，应用层同步删除对应的 MinIO 对象。`tasks` 记录和 `task_user_state` 记录均不受影响。

---

### 删除任务

由班级 OWNER 或 ADMIN 执行。

**情况 A — 任务无提交记录（零条）：**

硬删除。`tasks` 记录被删除，以下关联数据通过 FK CASCADE 一并删除：
- `task_user_state` 记录
- `taskId` 指向该任务的 `attachments` 记录
- `notification_jobs` 记录

应用层在执行 DB 删除前后同步删除对应的 MinIO 对象。

**情况 B — 任务有一条或以上提交记录：**

软删除。任务内容被清空，但任务行本身保留。

应用层执行步骤：
1. 将 `tasks.deletedAt` 设为当前时间。
2. 将 `tasks.title` 置为 `""`。
3. 将 `tasks.description` 置为 `NULL`。
4. 删除所有 `taskId` 指向该任务的 `attachments` 记录，同步删除对应的 MinIO 对象。
5. `notification_jobs` 通过 CASCADE 自动删除。
6. `task_user_state` 记录**不删除**（需保留成员的提交状态追踪数据）。
7. `submissions` 记录及其附件**不删除**。

保留的 `tasks` 行仅用于维持 `submissions.taskId` 外键的有效性，不包含任何有意义的内容。

备注：v1 不实现评论功能。若后续版本加入评论系统，任务软删除时应同步清除该任务下的所有评论。

---

### 删除班级

由班级 OWNER 执行。

删除班级不是简单 CASCADE，而是应用层分流处理任务：

1. 找出该班级所有任务。
2. 对每个任务：
   - 若提交数为 0：硬删除任务（清理 `task_user_state`、任务附件、通知 job）。
   - 若提交数 > 0：软删除任务（`deletedAt`、清空标题/正文、删除任务附件），并将 `classId` 置空（任务脱离班级但继续保留）。
3. 删除 `classes` 记录（并清理 `class_members`）。

**提交记录不会被删除。** `submissions.taskId` 始终指向真实存在的任务行（软删保留的任务元数据），不会形成“指向不存在 task 的 submission”。

补充：当某软删且已脱离班级的任务后续提交被删到 0 条时，系统应触发该任务硬删除，避免长期残留不可访问元数据。

---

### 删除用户

#### 前置条件（由应用层强制执行）

用户不能是任何非私有班级的 OWNER。删除接口首先检查此条件，若不满足则返回 400，并列出用户需要处理的班级（转让或解散）。

管理员操作例外：系统管理员通过 `/admin` 删除用户时，**跳过**此前置检查。该用户拥有的非私有班级**不会被自动删除**，需管理员另行处理。

#### 删除序列（应用层按顺序执行）

1. **删除该用户的所有提交：**
   - 对每条提交：删除 `submissionId` 指向该提交的 `attachments` 记录，同步删除 MinIO 对象。
   - 删除 `submissions` 记录。

2. **删除用户的个人空间**（`isPersonal = true` 的班级）：
   - CASCADE 自动删除：`class_members`、`tasks`、`task_user_state`、任务 `attachments`、`notification_jobs`。
   - 应用层同步删除任务附件的 MinIO 对象。

3. **删除 `users` 记录**，以下数据通过 FK CASCADE 自动清理：
   - `user_credentials`
   - `user_notification_prefs`
   - `class_members` 记录（将该用户从所有共享班级中移除）
   - 尚未删除的 `task_user_state` 记录
   - 该用户的 `notification_jobs`
   - 头像附件（通过 `avatarUserId` CASCADE）

4. **其他表中指向该用户的字段**通过 FK SET NULL 自动置空：
   - `tasks.createdBy`
   - `attachments.uploadedBy`
   - `submissions.reviewerId`

执行完上述序列后，该用户在数据库和 MinIO 中的数据为零残留。

---

## GDPR 被遗忘权合规说明

上述删除序列满足 GDPR 被遗忘权的要求。用户删除账号后：
- 个人信息（邮箱、昵称、凭据、通知配置）已删除。
- 提交内容和上传文件已删除。
- 读取与互动历史（`task_user_state`）已删除。
- 用户创建的任务若有其他成员的提交，任务行会保留，但 `createdBy` 已置为 NULL，无法再追溯到该用户。

**数据导出（v1 不实现）：** 用户可在删除账号前申请导出个人数据。若后续实现，导出内容应包括：用户基本信息、所有提交及其内容、所有 `task_user_state` 记录。
