# 认证 — 注册、登录、会话与密码

## 总览

- 普通用户浏览器登录态使用 `HttpOnly` cookie：`tfses_session`。
- 会话本体仍是服务端持久化 opaque token（`tfses_<random>`），真源在数据库 `sessions` 表。
- MCP / 非浏览器客户端仍使用 `Authorization: Bearer <token>`。
- Redis 不承担用户认证缓存或 token 黑名单职责，仅用于队列与业务缓存。

---

## 注册

### 两步流

1. 用户在 `/register` 第一步只提交邮箱。
2. 后端检查 `auth.registration_open`；若关闭则拒绝注册。
3. 后端先按邮箱记录注册尝试并执行限流，再判断邮箱是否已存在。
4. 若邮箱未注册，后端发送注册验证邮件，并把一次性 token 写入 `email_verification_tokens`；若邮箱已注册，后端发送“账号已存在”提醒邮件，邮件中提供 `/reset-password?token=...` 链接用于重置密码或直接登入。
5. 注册第一步对已注册邮箱和未注册邮箱返回相同的 200 响应，避免泄露账号是否存在。
6. 用户点击注册验证邮件链接，前端先调用 `GET /auth/verify-token?purpose=REGISTRATION` 校验 token。
7. 用户在 `/register/complete` 页面补充密码、昵称、学校、学号、时区，并提交到 `POST /auth/register/complete`。
8. 后端创建 `users`、`user_credentials`、私人班级与首个浏览器 session。
9. 响应返回 `{ user }`，并通过 `Set-Cookie` 写入浏览器会话 cookie。

### 规则

- 学校已选时，学号必填。
- `trustDevice=true` 时创建 30 天滑动续期浏览器会话；否则创建 7 天固定过期会话。
- 昵称为空时存 `NULL`，前端可回退显示邮箱。
- 注册尝试按邮箱地址限流：24 小时内最多处理 5 次；超过后仍返回相同成功响应，但不再发送邮件。

---

## 登录

1. 用户提交邮箱、密码，可选 `trustDevice`。
2. 后端查找 `user_credentials(provider=LOCAL)` 并校验 bcrypt。
3. 若 `users.isActive = false`，返回 `403 USER_INACTIVE`。
4. 登录成功后返回 `{ user }`，并写入会话 cookie。

### 会话时长

- `trustDevice=false` 或未传：7 天固定过期浏览器会话。
- `trustDevice=true`：30 天滑动续期浏览器会话。
- `lastSeenAt` / trusted session 续期写入按 1 小时 debounce，避免每请求写库。

---

## 鉴权中间件

所有用户保护路由都经过 `authMiddleware`：

1. 优先读取 `Authorization: Bearer <token>`。
2. 若无 Bearer，再读取 `tfses_session` cookie。
3. 校验前缀 `tfses_`，并以 token hash 查询 `sessions`（联查用户状态）。
4. 若 session 不存在、已过期、或用户停用，则拒绝请求。
5. 对浏览器会话执行 debounced touch：
   - 超过 1 小时未更新时刷新 `lastSeenAt`
   - trusted browser session 同时把 `expiresAt` 向后顺延 30 天
   - MCP session 不做 touch

`/admin/*` 继续使用独立 `ADMIN_TOKEN`（Bearer）。

---

## CSRF 与跨域

- API CORS 使用白名单 origin + `credentials: true`。
- 对 `POST/PUT/PATCH/DELETE`：若请求是 cookie 鉴权且无 Bearer，则强制校验 `Origin` 必须在白名单。
- 配合 `SameSite=Lax`，用于降低跨站请求伪造风险。

---

## 登出与会话管理

### 当前会话登出

- `POST /auth/logout`
- 服务端删除当前 session，并清除 `tfses_session` cookie。

### 会话列表

- `GET /users/me/sessions`
- 返回当前用户所有 `BROWSER` + `MCP` session。

### 登出其他浏览器会话

- `DELETE /users/me/sessions`
- 仅撤销“其他浏览器会话”，当前会话保留。

### 撤销单个会话

- `DELETE /users/me/sessions/:id`
- 可撤销指定 browser session 或 MCP session。
- 若撤销的是当前 session，会同时清除当前浏览器 cookie。
- 若撤销 MCP session，只断开该连接，不吊销底层 MCP key。
- 当前设置页 UI 对 MCP session 不再暴露“只断开单条连接”的操作；用户确认后会撤销底层 MCP key，并清除该 key 的全部 MCP sessions，避免客户端用同一 key 自动重连。

---

## 密码修改与重置

### 已登录修改密码

- 接口：`PATCH /users/me/password`
- 成功后保留当前浏览器 session，撤销其他浏览器 session；MCP keys / MCP sessions 不受影响。

### 忘记密码 / 重置密码

1. 用户提交邮箱到 `POST /auth/forgot-password`。
2. 前端进入重置页前先调用 `GET /auth/verify-token?purpose=PASSWORD_RESET`。
3. 用户可选择：
   - 提交新密码到 `POST /auth/reset-password`
   - 或点击“暂不重设，直接登入”，调用 `POST /auth/reset-password/sign-in`
4. 提交新密码成功后：
   - 更新本地密码 hash
   - 撤销该用户全部旧浏览器 sessions
   - 自动创建新的 7 天非信任浏览器 session（cookie 自动登录）
   - MCP keys / MCP sessions 保持可用
5. 直接登入成功后：
   - 不修改密码
   - 不撤销该用户已有浏览器 sessions
   - 自动创建新的 7 天非信任浏览器 session（cookie 自动登录）
   - 消耗该重置 token

---

## 邮箱修改

1. 已登录用户发起 `POST /users/me/email/change`
2. 系统不在请求阶段返回目标邮箱是否已注册；可发送时总是向目标邮箱发送同一类确认邮件
3. 确认邮件说明“正在尝试将一个账号邮箱修改为本邮箱”，不暴露原邮箱
4. 用户登录状态下调用 `POST /users/me/email/confirm`
5. 确认阶段才检查目标邮箱是否已绑定其他账号；若已绑定，页面提示需先登录该邮箱对应账号并注销或更换邮箱后再重试
6. 邮箱更新成功后，系统向原邮箱发送安全通知，通知中只展示脱敏后的新邮箱地址
7. 邮箱更新成功后，现有 sessions 保持可用
