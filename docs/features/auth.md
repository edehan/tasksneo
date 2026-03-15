# 认证 — 注册、登录与密码

## 注册

### 流程

1. 用户提交注册表单，包含：邮箱（必填）、密码（必填）、昵称（选填）、学校（选填）、学号（条件必填）。
2. 如果用户选择了学校，则学号为必填项。此规则在前端表单验证和后端服务层同时强制执行。
3. 后端检查 `system_config` 中 `auth.registration_open` 的值。若为 `'false'`，则返回 403，拒绝注册。
4. 后端创建 `users` 表记录，随后创建 `user_credentials` 表记录，`provider = LOCAL`，`passwordHash = bcrypt(password)`。
5. 后端自动为新用户创建一个私人班级，字段如下：
   - `name = "个人空间"`
   - `isPersonal = true`
   - `inviteCode = null`
   - `ownerId` 指向新用户
   - 同时在 `class_members` 中插入一条记录，`role = OWNER`
6. 返回 JWT，用户直接处于登录状态。

### 邮箱验证码（v1 暂不实现）

v1 不做邮箱验证，用户注册后立即激活。

v2 及后续版本的实现方案：
- 将短效验证码存入 **Redis**，设置 15 分钟 TTL，无需新增数据库表。
- 系统向邮箱发送验证码，用户调用 `/auth/verify-email` 接口提交验证码。
- 验证通过后，在 `users` 表新增 `emailVerifiedAt` 字段并写入时间戳（届时需要一次数据库迁移）。

### 昵称

昵称为空时，后端存储 NULL，不写入任何默认值。前端在需要显示名称的地方，用邮箱地址作为展示名的回退方案。

### 学号唯一性

数据库层面通过 `@@unique([schoolId, studentId])` 保证同一学校内学号唯一。若冲突，后端返回 409 并附带明确的错误信息。

---

## 登录

1. 用户提交邮箱和密码。
2. 后端查询 `user_credentials`，找到 `userId` 匹配且 `provider = LOCAL` 的记录。
3. 使用 bcrypt 对比提交的密码与存储的 `passwordHash`。
4. 若 `users.isActive = false`，返回 403，提示信息："账号已被停用，请联系管理员"。
5. 验证通过后，签发包含 `{ sub: userId, email }` 的 JWT，有效期 7 天。
6. Token 在响应体中返回，前端存储后在后续所有请求中以 `Authorization: Bearer <token>` 的形式携带。

---

## 密码重置

v1 不提供用户自助重置密码功能。管理员可通过 `/admin` 控制平面手动重置任意用户的密码。

v2 及后续版本：通过邮件链接实现自助重置，Token 存入 Redis，与邮箱验证码方案一致。

---

## 鉴权中间件

所有受保护路由均经过 `authMiddleware`：
1. 从 `Authorization` 请求头中提取 Bearer Token。
2. 验证 JWT 签名与有效期。
3. 从数据库查询用户，检查 `isActive`。若为 false，返回 403。
4. 将 `{ userId, email }` 挂载到请求上下文中，供后续路由处理器使用。

`/admin` 路由使用独立的 `adminMiddleware`，仅验证 `Authorization: Bearer $ADMIN_TOKEN` 是否与环境变量匹配，与用户鉴权体系完全隔离。

---

## 登出

JWT 为无状态设计。登出由前端丢弃 Token 实现，服务端不维护会话状态，v1 无需服务端登出接口。

如果后续需要 Token 吊销能力，可以在 Redis 中维护一个 Token 黑名单，无需修改数据库结构。
