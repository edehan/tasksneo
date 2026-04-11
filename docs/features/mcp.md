# MCP 集成

TaskFlow 提供 MCP key + MCP session 的双层认证模型，供 Claude Code、Cursor 等外部 AI 工具访问用户自己的数据。

## 认证链路

1. 用户在设置页创建 MCP key。
2. 前端只在创建当下展示一次明文 key；数据库只保存 hash 和前缀。
3. 外部工具把 MCP key 提交到 `POST /auth/mcp`。
4. 后端校验 key 是否存在、未撤销、未过期，且所属用户仍为激活状态。
5. 校验通过后，后端创建 `kind = MCP` 的 session，并返回普通 Bearer token。
6. 后续 MCP API 请求与浏览器端一样，统一走 `Authorization: Bearer <tfses_...>`。

## 生命周期

- MCP key 是长期凭证，可以被多次交换成新的 MCP session。
- MCP session 是连接级凭证，用于真正访问业务 API。
- 撤销 MCP key 时，会立即删除关联的 MCP sessions。
- 单独撤销某个 MCP session，只会断开那条连接，不会吊销底层 key。
- 修改密码、重置密码、批量登出其他浏览器会话，都不会影响 MCP keys。

## 当前范围

MCP server 目前面向教师工作流，重点支持：

- 获取我管理的班级列表
- 获取我管理的任务列表
- 创建、编辑、发布任务
- 获取任务下的提交
- 读取模范提交和尚未评分的提交
- 为提交打分和写评语

## 体验与文档

- 设置页需要明确区分“浏览器会话”和“MCP keys / MCP sessions”。
- 用户文案应始终说明：登出其他浏览器会话不会影响 MCP keys。
- MCP 接入说明应引导用户把生成的 key 保存到本地 AI 工具配置中，而不是误认为它等于网页登录态。
