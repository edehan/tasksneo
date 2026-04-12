# TaskFlow

基于班级的教学任务管理系统。教师创建班级、发布任务、收集作业、批量评分导出；学生通过邀请码加入班级、查看任务、提交作业。系统借助大语言模型将自然语言描述自动解析为结构化任务信息。

---

## TODO LIST

### Bug类
- [x] 班级管理功能缺失,创建班级时应该限定学校
- [x] 总视图显示逻辑的问题，view submission的统计功能
- [x] 主视图甘特图优化
- [x] 夜间模式自适应
- [x] 全局动画过度和圆角
- [x] 捕捉到多个时间段时的处理


### 功能类
- [x] 任务的前置任务关联功能
- [x] docx等文件解析，doc ppt尚不支持
- [x] 文件下载器
- [x] MCP
- [x] 完善通知系统 
- [x] s3储存和上传逻辑
- [x] 电子邮件验证，密码重置与验证码
- [x] i18n
- [x] cdci
- [x] 生产环境部署上线


## 功能概览

- **班级管理**：创建班级、邀请码加入、成员角色管理（所有者 / 管理员 / 成员）
- **任务管理**：Markdown 正文、附件、前置任务关联、甘特图视图
- **多语言与时区支持**：国际化界面和内容，根据用户偏好显示截止时间
- **AI 解析**：粘贴自然语言，自动提取任务名称、起止时间等字段
- **作业收集**：成员提交文件、管理员查看提交详情、批量重命名下载
- **评分导出**：在线评分、一键导出 CSV 成绩单（含未提交成员）
- **通知系统**：任务发布和截止前通过电子邮件异步推送
- **个人空间**：注册后自动创建私人班级，用于个人任务管理
- **管理控制台**：`/admin` 配置 SMTP、LLM API、注册开关、学校列表

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Next.js 16 App Router · TypeScript · Tailwind CSS · shadcn/ui |
| 后端 | Hono · Node.js · TypeScript |
| 数据库 | PostgreSQL 16 · Prisma 6 ORM |
| 文件存储 | MinIO（自托管，兼容 S3） |
| 任务队列 | Bull · Redis |
| 包管理 | pnpm workspaces（monorepo） |

---


## 本地开发

### 前置要求

- Node.js 22
- pnpm
- Docker（用于运行 PostgreSQL、Redis、MinIO）

### 启动步骤

```bash
# 1. 克隆仓库
git clone <repo-url> && cd taskflow

# 2. 复制并填写环境变量
cp .env.example .env

# 3. 安装依赖
pnpm install

# 4. 执行数据库迁移
cd packages/db && npx prisma migrate dev && cd ../..

# 5. 一键启动本地开发环境
pnpm dev

# 6. （可选）注入本地演示数据
pnpm dev:seed
```

如需在 `pnpm dev:seed` 时同时自动填充 Admin 的 LLM 基础配置，可在本地 `.env` 设置：

```bash
DEV_SEED_LLM_PROVIDER=openai
DEV_SEED_LLM_BASE_URL=https://api.openai.com/v1
DEV_SEED_LLM_MODEL=gpt-4o-mini
DEV_SEED_LLM_API_KEY=<your_key>
```

该 API Key 会按 `SYSTEM_CONFIG_SECRET` 加密后写入 `system_config`。

### 认证与会话模型

- 普通用户登录态使用服务端持久化的 opaque session token，格式为 `tfses_<random>`。
- `Authorization` 仍使用 Bearer 头，但 Bearer 值不是 JWT；会话真源在数据库 `sessions` 表。
- `/auth/logout`、`/users/me/sessions`、`/users/me/sessions/:id` 都会直接撤销服务端 session，失效立即生效。
- `trustDevice=true` 时创建 30 天滑动续期的浏览器会话；未勾选时是 7 天固定过期。
- MCP 认证链路是 `MCP key -> /auth/mcp -> MCP session token`。撤销 MCP key 会切断关联 MCP sessions。
- Redis 只用于 Bull 队列和业务缓存，不再承担用户认证缓存或 token 黑名单职责。

默认访问：

- 前端：http://localhost:3000
- 管理后台：http://localhost:3000/admin
- 后端 API：http://localhost:3001
- MinIO 控制台：http://localhost:9001（用户名/密码见 `.env`）

更多命令见：[`docs/deployment/local-dev.md`](docs/deployment/local-dev.md)

可选的分步命令：

```bash
pnpm dev:infra
pnpm dev:api
pnpm dev:web
pnpm dev:seed
pnpm dev:down
```

如需在 `pnpm dev` 启动时自动注入演示数据，可使用：

```bash
TASKFLOW_DEV_SEED=true pnpm dev
```

### 环境变量说明

复制 `.env.example` 后，必填项：

| 变量 | 说明 |
|---|---|
| `ADMIN_TOKEN` | 管理员控制台访问令牌，只负责 `/admin` 鉴权 |
| `SYSTEM_CONFIG_SECRET` | 敏感系统配置的数据库加密密钥，需保持稳定 |
| `DATABASE_URL` | PostgreSQL 连接串 |
| `NEXT_PUBLIC_API_BASE_URL` | 前端访问后端 API 的地址，开发环境默认 `http://localhost:3001` |

其余业务配置（SMTP 主机、端口、发件人、LLM 模型等）在启动后通过 `/admin` 控制台填写；其中敏感值会使用 `SYSTEM_CONFIG_SECRET` 加密后存入数据库。

---

## 生产部署

详见 [`docs/deployment/production.md`](docs/deployment/production.md)。

架构：前端部署到 Vercel / Cloudflare Pages，后端 + PostgreSQL + Redis 以 Docker 运行在 VPS 上，文件储存使用第三方 S3 兼容服务。

---

## 分支策略

| 分支 | 用途 |
|------|------|
| `main` | 生产发布，受保护 |
| `dev` | 日常集成分支 |
| `feat/*`, `fix/*` | 功能/修复分支，完成后 PR 合并到 `dev` |

发布流程：`dev` 稳定后提 PR 合并到 `main`。

---

## FOR AI AGENT

开始工作前请阅读：

1. `AGENT.md` — 项目结构、技术栈、关键约定
2. `docs/DATABASE.md` — 涉及数据库操作时必读
3. `docs/openapi/openapi.yaml` — 实现或调用接口时必读
4. `docs/features/<功能名>.md` — 实现具体功能时按需阅读
