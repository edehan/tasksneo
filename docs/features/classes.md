# 班级

## 班级的两种类型

系统中存在两种班级，共用同一张数据表（`classes`），仅通过 `isPersonal` 字段区分。

| 类型 | isPersonal | inviteCode | 创建方式 |
|---|---|---|---|
| 个人空间 | true | NULL | 用户注册时系统自动创建 |
| 共享班级 | false | 自动生成 | 用户主动创建 |

除此以外无其他结构差异。应用层负责阻止向个人空间添加成员的操作。

---

## 个人空间

用户注册时由系统自动创建，字段如下：
- `name = "个人空间"`
- `isPersonal = true`
- `inviteCode = NULL`
- `ownerId` 指向当前用户
- `class_members` 中同步插入一条记录，`role = OWNER`

用户不能重命名、删除或分享个人空间。可以在其中创建任务。

---

## 创建共享班级

1. 已登录用户提交：班级名称（必填）、描述（选填）、颜色（选填，默认 `#6366f1`）、学校限制（选填）。
2. 后端创建 `classes` 表记录。
3. 后端使用 `node:crypto` 生成 10 位随机邀请码（字符集为 `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`），写入 `inviteCode` 字段。
4. 后端在 `class_members` 中插入一条创建者的记录，`role = OWNER`。
5. 返回创建的班级信息，包含邀请码。

---

## 加入班级

1. 用户提交邀请码。
2. 后端通过 `inviteCode` 查找对应班级。
3. 若班级设置了 `schoolId`，则验证 `user.schoolId === class.schoolId`。不匹配时返回 403，提示该班级仅限特定学校的用户加入。
4. 若用户已是成员，返回 409。
5. 向 `class_members` 插入记录，`role = MEMBER`。

学校限制**仅在加入时检查**。用户加入后修改学校信息，不影响其现有成员资格。

---

## 角色与权限

| 操作 | OWNER | ADMIN | MEMBER |
|---|---|---|---|
| 发布任务 | ✓ | ✓ | — |
| 编辑 / 删除任务 | ✓ | ✓ | — |
| 查看任务详情 | ✓ | ✓ | ✓ |
| 提交任务 | — | — | ✓ |
| 查看全部提交 | ✓ | ✓ | — |
| 对提交评分 | ✓ | ✓ | — |
| 导出 CSV | ✓ | ✓ | — |
| 将成员升级为管理员 | ✓ | — | — |
| 将管理员降级为成员 | ✓ | — | — |
| 移除成员 | ✓ | ✓ | — |
| 刷新邀请码 | ✓ | ✓ | — |
| 转让所有权 | ✓ | — | — |
| 删除班级 | ✓ | — | — |

**核心规则**：ADMIN 不能任命或降级其他 ADMIN，该权限仅 OWNER 拥有。在其他日常管理操作上（任务管理、查看提交、移除成员），OWNER 与 ADMIN 权限等同。

---

## 刷新邀请码

OWNER 或 ADMIN 可随时申请生成新邀请码。旧邀请码立即失效，持有旧链接的用户无法继续使用。

---

## 转让所有权

1. OWNER 选择一名现有成员作为新所有者。
2. 后端在单个事务中执行：
   - `UPDATE classes SET ownerId = newOwnerId`
   - `UPDATE class_members SET role = OWNER WHERE userId = newOwnerId`
   - `UPDATE class_members SET role = ADMIN WHERE userId = previousOwnerId`
3. 原所有者成为该班级的 ADMIN。

---

## 退出班级

- MEMBER 或 ADMIN：可随时退出，对应的 `class_members` 记录被删除。
- OWNER：必须先完成所有权转让，否则无法退出。

---

## 删除班级

完整的级联删除逻辑见 `data_policy.md`。简要说明：删除班级会同时删除班级下的所有任务及其内容和附件，但成员的提交记录及提交附件不受影响。
