# 附件

所有文件存储统一使用 MinIO（自托管，兼容 S3 协议）。数据库只存储文件元数据，文件本体不经过数据库。

---

## 附件归属

`attachments` 表中每条记录通过且仅通过一个非空的外键列指向其所属的父实体：

| 外键列 | 父实体 | 用途 |
|---|---|---|
| `taskId` | 任务 | 任务正文 Markdown 中的内联图片和文件 |
| `submissionId` | 提交 | 成员上传的作业文件 |
| `classId` | 班级 | 班级头像或封面图片 |
| `avatarUserId` | 用户 | 用户个人头像 |

应用层在每次 INSERT 前验证此规则——上述四列中有且仅有一列为非空。

---

## 上传流程

1. 客户端向对应的上传接口发起请求，指定父实体（例如 `POST /tasks/:taskId/attachments`）。
2. 后端生成唯一的 MinIO 对象键：`{parentType}/{parentId}/{uuid}.{ext}`（例如 `tasks/abc123/def456.pdf`）。
3. 后端将文件上传至 MinIO，并在 `attachments` 表插入记录，包含 `fileKey`、`originalName`、`mimeType`、`sizeBytes` 及对应的父实体外键。
4. 后端返回附件记录（含 `fileKey`）。
5. 对于 Markdown 编辑器中的内联图片：前端拼接文件访问 URL（`GET /files/:fileKey`），将其作为 Markdown 图片引用插入正文。

---

## 文件访问

`GET /files/:fileKey`

- 后端在 `attachments` 表中查找 `fileKey`。
- 执行权限验证：请求用户必须对该附件的父实体有访问权限（例如是任务或提交所属班级的成员，或本人头像）。
- 验证通过后：生成短效 MinIO 预签名 URL（TTL 建议 5 分钟），将客户端重定向至该 URL。客户端不会获得长效凭证。

---

## 删除

附件从 MinIO 和数据库中同步删除，由应用层负责协调。

通过外键级联触发的删除：
- 任务删除 → 任务附件 CASCADE 删除（数据库记录移除，应用层同步删除 MinIO 对象）
- 提交删除 → 提交附件 CASCADE 删除
- 班级删除 → 班级附件 CASCADE 删除
- 用户删除 → 头像附件 CASCADE 删除（通过 `avatarUserId`）

任务软删除时：应用层在执行软删除操作的同时，显式删除所有 `taskId` 指向该任务的附件（MinIO 对象 + 数据库记录），即使任务行本身被保留。

---

## 批量重命名（提交附件）

管理员可对某任务的所有提交附件触发批量重命名，命名规则：

```
{班级名}_{昵称}_{学号}_{原文件名}
```

若用户无学号，该段省略。若昵称为空，使用邮箱代替。

重命名后的文件名存入 `attachments.renamedFile`，MinIO 中的对象键（`fileKey`）**不变**，只更新展示名称。管理员下载全部提交的 ZIP 包时，ZIP 内各文件使用 `renamedFile` 作为文件名。

---

## Markdown 中的内联图片

用户在 Markdown 编辑器中粘贴图片时：
1. 编辑器拦截粘贴事件。
2. 立即通过附件上传接口将图片上传至 MinIO。
3. 在编辑器中插入 Markdown 图片引用：`![文件名](url)`。
4. 渲染时，图片通过需要鉴权的文件访问接口获取，正常显示。

---

## 未来方向：用户文件库

v1 不实现。未来可考虑提供类似"云盘"的个人文件库功能，允许用户统一查看自己上传过的所有附件。实现上只需对 `attachments` 表按 `uploadedBy = currentUserId` 过滤即可。
