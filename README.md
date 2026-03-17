# TaskFlow

基于班级的教学任务管理系统。教师创建班级、发布任务、收集作业、批量评分导出；学生通过邀请码加入班级、查看任务、提交作业。系统借助大语言模型将自然语言描述自动解析为结构化任务信息。

---

## 功能概览

- **班级管理**：创建班级、邀请码加入、成员角色管理（所有者 / 管理员 / 成员）
- **任务管理**：Markdown 正文、附件、前置任务关联、甘特图视图
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
| 前端 | Next.js 14 App Router · TypeScript · Tailwind CSS · shadcn/ui |
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

# 3. 启动基础设施（PG + Redis + MinIO）
cd infra && docker compose -f docker-compose.dev.yml up -d && cd ..

# 4. 安装依赖
pnpm install

# 5. 执行数据库迁移
cd packages/db && npx prisma migrate dev && cd ../..

# 6. 启动后端
cd apps/api && pnpm dev
# 另开终端

# 7. 启动前端
cd apps/web && pnpm dev
```

前端访问：http://localhost:3000  
后端 API：http://localhost:3001  
MinIO 控制台：http://localhost:9001（用户名/密码见 `.env`）

## 本地预发布

本地预发布用于查看每次提交后的可操作界面，不与日常开发端口冲突。

- 入口文档：`docs/deployment/local-preview.md`
- 预发布前端：`http://localhost:35540`
- 预发布 API：`http://localhost:35541`

初始化顺序：

```bash
cp .env.preview.example .env.preview
cp .env.test.example .env.test
pnpm preview:hooks
pnpm preview:deploy
```

说明：

- `preview` 使用独立 Docker volumes，数据默认保留
- `test` 应使用 `.env.test`，避免影响 `preview`
- 每次 `git commit` 后会自动触发本地预发布刷新

### 环境变量说明

复制 `.env.example` 后，必填项：

| 变量 | 说明 |
|---|---|
| `ADMIN_TOKEN` | 管理员控制台访问令牌，只负责 `/admin` 鉴权 |
| `JWT_SECRET` | 普通用户登录态签名密钥 |
| `SYSTEM_CONFIG_SECRET` | 敏感系统配置的数据库加密密钥，需保持稳定 |
| `DATABASE_URL` | PostgreSQL 连接串 |

其余业务配置（SMTP 主机、端口、发件人、LLM 模型等）在启动后通过 `/admin` 控制台填写；其中敏感值会使用 `SYSTEM_CONFIG_SECRET` 加密后存入数据库。

---

## 生产部署

远程生产部署流程仍在建设中，当前仓库已优先完善本地开发与本地预发布。

在正式生产部署链路完成之前，请先使用：

- 本地开发：`docker-compose.dev.yml`
- 本地预发布：`docker-compose.preview.yml`

后续会补充正式生产 compose、反向代理与远程 CI/CD。

当前预留的生产部署占位文件：

```bash
infra/docker-compose.prod.yml
infra/nginx/nginx.conf
```

---

## FOR AI AGENT

开始工作前请阅读：

1. `AGENT.md` — 项目结构、技术栈、关键约定
2. `docs/DATABASE.md` — 涉及数据库操作时必读
3. `docs/openapi/openapi.yaml` — 实现或调用接口时必读
4. `docs/features/<功能名>.md` — 实现具体功能时按需阅读
