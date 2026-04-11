# 认证 — 注册、登录、会话与密码

## 总览

- 普通用户登录态不是 JWT，而是服务端持久化的 opaque session token，格式为 `tfses_<random>`。
- Bearer 头部格式保持不变：`Authorization: Bearer <token>`。
- 用户会话真源在数据库 `sessions` 表；删除 session 后会立即失效。
- Redis 不再承担用户认证缓存或 token 黑名单职责，只保留队列和业务缓存用途。

---

## 注册

### 两步流

1. 用户在 `/register` 第一步只提交邮箱。
2. 后端检查 `auth.registration_open`；若关闭则拒绝注册。
3. 后端发送注册验证邮件，并把一次性 token 写入 `email_verification_tokens`。
4. 用户点击邮件链接，前端先调用 `GET /auth/verify-token?purpose=REGISTRATION` 校验 token。
5. 用户在 `/register/complete` 页面补充密码、昵称、学校、学号、时区，并提交到 `POST /auth/register/complete`。
6. 后端创建：
   - `users`
   - `user_credentials`（`LOCAL` + bcrypt hash）
   - 私人班级
   - 首个浏览器 session
7. 响应返回 `{ token, user }`，前端进入已登录状态。

### 规则

- 学校已选时，学号必填。
- `trustDevice=true` 时，注册完成后创建 30 天滑动续期浏览器会话；否则创建 7 天固定过期浏览器会话。
- 昵称为空时存 `NULL`，前端可回退显示邮箱。
- 注册邮件按邮箱地址限流：24 小时内最多 5 封。

---

## 登录

1. 用户提交邮箱、密码，可选 `trustDevice`。
2. 后端查找 `user_credentials(provider=LOCAL)` 并校验 bcrypt。
3. 若 `users.isActive = false`，返回 `403 USER_INACTIVE`。
4. 登录成功后返回 `{ token, user }`。

### 会话时长

- `trustDevice=false` 或未传：7 天固定过期浏览器会话。
- `trustDevice=true`：30 天滑动续期浏览器会话。
- `lastSeenAt` / trusted session 的续期写入会做 1 小时 debounce，避免每个请求都写库。

---

## 鉴权中间件

所有用户保护路由都经过 `authMiddleware`：

1. 读取 `Authorization: Bearer <token>`。
2. 校验前缀是否为 `tfses_`。
3. 用 token hash 查询数据库 `sessions` 表，并联查用户的 `email` / `isActive`。
4. 若 session 不存在、已过期、或用户已停用，则拒绝请求。
5. 对浏览器会话执行 debounced touch：
   - 超过 1 小时未更新时刷新 `lastSeenAt`
   - trusted browser session 同时把 `expiresAt` 向后顺延 30 天
   - MCP session 不做 touch

`/admin/*` 继续使用完全独立的 `ADMIN_TOKEN`。

---

## 登出与会话管理

### 当前会话登出

- `POST /auth/logout`
- 服务端直接删除当前 session
- token 立即失效

### 会话列表

- `GET /users/me/sessions`
- 返回当前用户的所有 `BROWSER` + `MCP` session
- 前端按 `lastSeenAt` 展示最近使用时间

### 登出其他浏览器会话

- `DELETE /users/me/sessions`
- 仅撤销“其他浏览器会话”
- 当前浏览器会话保留
- MCP keys / MCP sessions 不受影响

### 撤销单个会话

- `DELETE /users/me/sessions/:id`
- 可撤销指定 browser session 或 MCP session
- 若撤销的是当前 session，效果等同于当前设备立即登出
- 若撤销的是 MCP session，只断开这条连接，不会吊销底层 MCP key

---

## 密码修改与重置

### 已登录修改密码

- 接口：`PATCH /users/me/password`
- 要求提供当前密码
- 成功后：
  - 保留当前浏览器 session
  - 撤销其他浏览器 sessions
  - MCP keys / MCP sessions 不受影响

### 忘记密码 / 重置密码

1. 用户提交邮箱到 `POST /auth/forgot-password`
2. 后端若账号存在则发送重置邮件；若不存在也返回 200，防止枚举邮箱
3. 前端进入重置页前先调用 `GET /auth/verify-token?purpose=PASSWORD_RESET`
4. 用户提交新密码到 `POST /auth/reset-password`
5. 成功后：
   - 更新本地密码 hash
   - 撤销该用户全部浏览器 sessions
   - 不自动登录
   - MCP keys / MCP sessions 仍保持可用

---

## 邮箱修改

1. 已登录用户发起 `POST /users/me/email/change`
2. 系统向新邮箱发送确认邮件
3. 用户登录状态下调用 `POST /users/me/email/confirm`
4. 邮箱更新成功后，现有 sessions 保持可用；下次鉴权会读到新的用户邮箱
