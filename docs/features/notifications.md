# 通知系统

## 设计原则

- 通知发送**完全异步**。任务发布成功不依赖邮件是否即时送达，主业务流程不被通知阻塞。
- 发送失败时支持重试，系统在邮件服务不可用时可降级运行。
- v1 只实现电子邮件通知，但架构设计支持后续新增渠道而无需修改现有代码。

---

## 触发时机

| 事件 | 通知接收方 | 发送时机 |
|---|---|---|
| 任务发布 | 班级所有成员 | 立即（任务发布时入队） |
| 任务截止前提醒 | 尚未提交的班级成员 | 截止前 N 小时，N 由 `system_config: notif.before_due_hours` 配置（如 `"24,8"` 表示提前 24 小时和 8 小时各发一次） |

---

## 队列架构

使用 **BullMQ**（基于 Redis）作为任务队列。每个通知事件触发以下两步：

1. 向 `notification_jobs` 表插入一条记录，`status = PENDING`。
2. 向 BullMQ 队列投递一个 job，携带相同的 ID 和 `scheduledAt` 时间戳。

`notification_jobs` 表作为持久化审计日志和故障恢复依据。服务重启后，BullMQ 可从该表中重新载入所有 `PENDING` 状态的 job，避免通知丢失。

---

## Worker 处理逻辑

通知 Worker 可运行在 API 主进程中，也可作为独立 Worker 进程——两种方式均与此架构兼容。

每条 job 的处理步骤：
1. 将 `status` 设为 `SENDING`。
2. 查询目标用户的 `user_notification_prefs`，找到对应渠道的配置。
3. 若该渠道的 `isEnabled = false`，跳过发送，将状态标记为 `SENT`（用户已选择退订，不计为失败）。
4. 从 `system_config` 读取 SMTP 配置。
5. 通过 Nodemailer 发送邮件。
6. 成功：将 `status` 设为 `SENT`，写入 `sentAt = now()`。
7. 失败：将 `status` 设为 `FAILED`，写入 `error = 错误信息`。BullMQ 以指数退避策略重试，最多 3 次。达到重试上限后，记录保持 `FAILED` 状态，供后续审计。

---

## 邮件内容模板

### 任务发布通知

```
主题：[TaskFlow] 新任务：{task.title}

班级 {class.name} 发布了新任务。

任务名称：{task.title}
截止时间：{task.dueAt}
查看详情：{app.base_url}/tasks/{task.id}
退订通知（居中靠下）：url
```

### 截止前提醒

```
主题：[TaskFlow] 任务截止提醒：{task.title}

你在班级 {class.name} 中有一个任务即将到期，请及时完成提交。

任务名称：{task.title}
截止时间：{task.dueAt}（需要根据用户偏好时区进行转换）
查看详情：{app.base_url}/tasks/{task.id}
退订通知（居中靠下）：url
```
注意：退订通知：url 需要符合常识中的unsubscribe链接规范，以避免邮件被认为是spam
邮件需要简单的页面设计，ui风格随主站简洁风即可，可以考虑使用班级颜色作为点缀色。

---

## 渠道扩展

当前阶段目标：
- 完全实现电子邮件通知
- 在用户主页设置一个收件箱盒子，展示最近的通知记录，考虑维护已读未读状态。（可以自己实现也可以使用其他库）
- 其他渠道的通知，若容易实现，尽力实现。可以查阅database文档已预留通知表。

`NotifChannel` 枚举值：`EMAIL | WEBHOOK | TELEGRAM`。

Worker 采用策略模式，每种渠道对应一个实现类：

```typescript
interface NotificationChannel {
  send(job: NotificationJob, prefs: UserNotificationPref): Promise<void>
}

class EmailChannel implements NotificationChannel { ... }
class WebhookChannel implements NotificationChannel { ... }  // v2
class TelegramChannel implements NotificationChannel { ... } // v2
```

新增渠道只需实现接口并注册，不影响队列、job 表或已有渠道的任何代码。

---

## 通知偏好

用户在个人设置页配置每个渠道的通知地址（存入 `user_notification_prefs`）。

v1 前端只暴露电子邮件渠道的配置入口，默认使用注册邮箱，用户可修改或关闭。Webhook 和 Telegram 配置入口暂不展示。

若用户没有 `EMAIL` 渠道对应的 `user_notification_prefs` 记录，Worker 回退到使用 `users.email` 发送，确保新注册用户也能收到通知。
