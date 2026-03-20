# TaskFlow 前端组件库指南

> 本文档整理了 TaskFlow 项目推荐使用的第三方 shadcn/ui 生态组件。  
> 所有组件均为 copy-paste 模式或 shadcn CLI 安装，代码归你所有，无黑盒依赖。  
> 评级说明：🔴 建议必装 / 🟡 按需安装 / 🟢 备用可选

---

## 目录

1. [Kibo UI — 核心组件套件](#1-kibo-ui--核心组件套件)
2. [shadcn-kanban-board — 看板视图](#2-shadcn-kanban-board--看板视图)
3. [shadcn-datetime-picker — 日期时间选择器](#3-shadcn-datetime-picker--日期时间选择器)
7. [fancy-multi-select — 多选下拉](#7-fancy-multi-select--多选下拉)
8. [shadcn-dropzone (janglad) — 文件上传备选](#8-shadcn-dropzone-janglad--文件上传备选)
10. [tnks-data-table — 服务端数据表格](#10-tnks-data-table--服务端数据表格)
11. [enhanced-button — 异步状态按钮](#11-enhanced-button--异步状态按钮)
12. [number-flow — 数字动画过渡](#12-number-flow--数字动画过渡)
13. [password-input — 密码输入框](#13-password-input--密码输入框)
14. [Vaul / Drawer — 移动端抽屉](#14-vaul--drawer--移动端抽屉)
15. [shadcn-multi-select-component — 多选备选](#15-shadcn-multi-select-component--多选备选)
16. [calendar-cn — 日历视图备选](#16-calendar-cn--日历视图备选)

---

## 1. Kibo UI — 核心组件套件

**评级：🔴 建议必装**  
**官方文档：** https://www.kibo-ui.com/components  
**GitHub：** https://github.com/shadcnblocks/kibo

### 简介

Kibo UI 是基于 shadcn/ui 构建的高级组件库，定位为 shadcn/ui 的"伴侣库"。它使用相同的 Tailwind CSS 变量主题系统，所有组件与项目现有的设计系统无缝兼容。安装方式与 shadcn/ui 完全一致：

```bash
npx kibo-ui add <component-name>
```

我们使用其中四个组件，以下分别说明。

---

### 1.1 Kibo UI — Editor（富文本编辑器）

**用于：** 任务正文编辑（管理员发布任务）、提交作业编辑（学生提交内容）

```bash
npx kibo-ui add editor
```

**功能特性：**
- TipTap 引擎，支持斜杠命令（`/` 快捷菜单）、浮动工具栏、气泡菜单
- 文字格式：加粗、斜体、下划线、删除线、代码、上下标
- 文字与背景颜色
- 链接、表格（含行列管理、合并单元格）
- 代码块（含语法高亮）、标题 H1/H2/H3、有序列表、无序列表、任务列表
- 字数统计、字符限制
- Markdown 快捷键支持

**优点：**
- 功能完整，直接覆盖任务描述和提交内容两个编辑场景
- 代码 copy-paste 进项目，完全可定制，无黑盒
- 与项目 shadcn/ui + Tailwind 设计系统无缝集成

**缺点：**
- 依赖 TipTap 系列包，安装后 node_modules 体积增加约 2MB
- 图片上传需要自行对接 `uploadFn` 回调（对接 MinIO 的上传端点）

**注意事项：** 图片粘贴场景需实现 `uploadFn`，返回上传后的 URL。参考后端附件上传接口 `POST /tasks/:taskId/attachments`。

---

### 1.2 Kibo UI — Gantt（甘特图）

**用于：** Dashboard 甘特图视图（`/dashboard/gantt`）

```bash
npx kibo-ui add gantt
```

**功能特性：**
- 水平时间轴，支持月/季度/年范围切换
- 任务按分组折叠展示（对应我们按班级分组）
- 今日红线标记
- 任务拖拽移动时间（v1 可禁用，展示模式即可）
- 右键菜单、Marker 标记点
- 基于 `@haydenbleasel/roadmap-ui`，专为 shadcn/ui 设计

**优点：**
- 省去从零实现甘特图的工作量（估计节省 2~3 天开发时间）
- 依赖连线可通过外部 SVG 叠加实现（对应 `blockedBy` 字段的可视化）
- 响应式，适配不同屏幕宽度

**缺点：**
- 依赖连线（task dependency arrows）需要在 Gantt 组件外自行用 SVG 绘制，组件本身不内置
- 文档相对简洁，部分 props 需要阅读源码理解

**v1 使用建议：** 禁用拖拽（不传 `onMove` 回调），只做展示。`blockedBy` 依赖连线用 SVG `<line>` 叠加在甘特图容器上，找不到引用 taskId 时静默跳过。

---

### 1.3 Kibo UI — Dropzone（文件上传区）

**用于：** 任务附件上传、提交作业附件上传

```bash
npx kibo-ui add dropzone
```

**功能特性：**
- 基于 `react-dropzone`，支持拖拽和点击两种上传方式
- 文件列表展示（文件名 + 大小 + 状态）
- 上传进度条（`InfiniteProgress` 组件）
- 文件重试、移除操作
- 单文件 / 多文件模式
- 图片预览支持

**优点：**
- 组合式 API 设计，各子组件可独立使用，布局完全灵活
- 与 shadcn/ui 原语 100% 兼容，外观与项目一致
- 无障碍优先设计

**缺点：**
- 不内置实际的 HTTP 上传逻辑，需要自行对接 MinIO 上传端点（这是设计上的优势，不是缺陷）

---

### 1.4 Kibo UI — Tags（标签输入）

**用于：** 用户对任务的个人标签（对应 `task_user_state.tags` 字段）

```bash
npx kibo-ui add tags
```

**功能特性：**
- 输入后按 Enter 或逗号确认标签
- 标签可单独删除
- 支持最大标签数限制
- 完全匹配我们将 `tags: string[]` 存入后端的数据模型

**优点：** 与 `task_user_state.tags` 字段的数据结构直接对应，后端存储 `string[]`，前端 `value` 也是 `string[]`，零转换成本。

**缺点：** 功能简单，无自动补全，但我们的标签是用户自由输入，不需要补全。

---

## 2. shadcn-kanban-board — 看板视图

**评级：🔴 建议必装（Dashboard 看板视图）**  
**官方网站：** https://www.shadcn-kanban-board.com  
**GitHub：** https://github.com/janhesters/shadcn-kanban-board

### 简介

一个现代、生产可用的看板组件，专为 shadcn/ui 生态设计。最大亮点是**零外部依赖**——纯 React 实现拖拽，无需 dnd-kit 或 react-beautiful-dnd。

**功能特性：**
- 零依赖，纯 React 原生拖拽（通过 HTML5 Drag and Drop API）
- WCAG 2.2 AAA 无障碍合规，全键盘支持，屏幕阅读器公告
- 自动适配 shadcn/ui 颜色主题（light/dark 模式）
- 兼容 Next.js App Router Server Actions、React Router v7、本地状态等多种架构
- 内置列折叠 Dropdown 菜单、每列任务计数、多行卡片支持

**优点：**
- 对 v1 的看板（三列：未读/已读/已提交）只需展示，完全够用
- 零依赖意味着 bundle 体积不增加
- 在生产环境（SocialKit 平台）经过验证

**缺点：**
- 拖拽实现基于 HTML5 原生 API，在某些移动端浏览器触摸拖拽体验不如 dnd-kit
- 定制列标题颜色需要修改源码中的 CSS 变量

**v1 使用建议：** v1 看板只做展示，不做拖拽状态变更（任务状态由提交行为驱动，不由拖拽决定）。可以把拖拽回调设为空函数或展示 toast 提示"请通过提交流程更改状态"。

---

## 3. shadcn-datetime-picker — 日期时间选择器

**评级：🟡 按需安装（Task 5/6）**  
**演示：** https://shadcn-datetime-picker.vercel.app/datetime-picker  
**GitHub：** https://github.com/Maliksidk19/shadcn-datetime-picker

### 简介

shadcn/ui 官方的 Calendar 组件只支持日期选择，没有时间部分。这个组件在其基础上补充了小时和分钟的选择，是任务创建/编辑页面的必需组件。

**功能特性：**
- 日期 + 时间（时、分）一体化选择
- 两个版本：V1（时间选择集成在弹窗内）、V2（日期和时间分离控件）
- 基于 shadcn/ui Calendar 原语，样式与项目一致
- copy-paste 单文件，无额外依赖

**优点：**
- 轻量，单文件 copy-paste
- 直接输出 `Date` 对象，与后端 `timestamptz` 字段直接对应
- 无需额外安装包

**缺点：**
- 不支持时区选择（我们将所有时间统一存 UTC，前端显示时用 `Intl.DateTimeFormat` 转换，符合项目设计，无需时区选择）
- 文档简单，部分行为需要读源码


## 7. fancy-multi-select — 多选下拉

**评级：🟡 按需安装（Task 6，选前置任务）**  
**演示：** https://craft.mxkaske.dev/post/fancy-multi-select  
**说明：** copy-paste 单文件，源码在演示页面可直接获取

### 简介

受 campsite.design 和 cal.com 设置表单启发的多选下拉组件，基于 shadcn/ui Command 原语实现。

**功能特性：**
- 已选项以 Badge 形式展示在输入框内
- 内置搜索过滤
- 键盘导航（方向键、Enter、Backspace 删除最后一项）
- 无额外依赖（基于 shadcn/ui 已有的 cmdk）

**优点：**
- 轻量，copy-paste 单文件
- 视觉效果优雅，符合办公软件调性
- 与项目 cmdk 依赖复用，无新增包

**缺点：**
- 不支持异步搜索（我们的前置任务是同班级内加载，一次性拉取，无需异步）
- 不支持分组（不需要）

**使用场景：** 任务创建/编辑页面中选择前置任务（`blockedBy` 字段）。

---

## 8. shadcn-dropzone (janglad) — 文件上传备选

**评级：🟢 备用（Kibo UI Dropzone 不满足需求时使用）**  
**演示：** https://shadcn-dropzone.vercel.app/docs  
**GitHub：** https://github.com/janglad/shadcn-dropzone

```bash
pnpx shadcn@latest add 'https://shadcn-dropzone.vercel.app/dropzone.json'
```

### 简介

shadcn/ui 风格的 Dropzone 组件，基于 `react-dropzone`，无障碍优先设计。相比 Kibo UI Dropzone，API 粒度更细，各子组件可独立组合。

**功能特性：**
- 拖拽 + 点击两种上传方式
- 组合式子组件：`DropZoneArea`、`DropzoneTrigger`、`DropzoneFileList`、`DropzoneFileListItem`、`DropzoneRemoveFile`、`DropzoneRetryFile`
- 上传进度（`InfiniteProgress`）
- 文件状态消息（`DropzoneFileMessage`、`DropzoneMessage`）

**优点：**
- 组合式 API 比 Kibo UI Dropzone 更灵活
- 无障碍支持更完整（项目文档明确强调 fully accessible）

**缺点：**
- 子组件较多，初次使用需要阅读文档理解组装方式

---

## 10. tnks-data-table — 服务端数据表格

**评级：🟡 按需安装（Task 7，管理员提交列表）**  
**GitHub：** https://github.com/jacksonkasi1/tnks-data-table  
**演示：** https://tnks-data-table.vercel.app

```bash
npx shadcn@latest add https://tnks-data-table.vercel.app/r/data-table.json
npx shadcn@latest add https://tnks-data-table.vercel.app/r/calendar-date-picker.json
```

### 简介

基于 TanStack Table v8 和 shadcn/ui 的企业级数据表格，内置服务端分页/排序/筛选，与项目技术栈（Hono + Drizzle ORM）完美匹配。

**功能特性：**
- 服务端分页、排序、筛选（API 参数规范清晰）
- 列宽调整（持久化）
- 批量选择（跨页）
- 搜索工具栏
- CSV/Excel 导出（`DataExport` 组件，直接覆盖成绩导出需求）
- TypeScript 端到端类型安全
- WCAG 无障碍合规

**优点：**
- 直接覆盖"管理员查看提交列表"和"导出 CSV"两个功能点
- 与 Hono.js 后端的 API 响应格式天然匹配
- 通过 shadcn registry 安装，代码在项目内完全可控

**缺点：**
- 安装依赖较多（TanStack Table、TanStack Query、zod、xlsx 等）
- 需要按文档定义后端 API 的请求参数和响应格式（`page`、`limit`、`sort_by`、`sort_order`、`search`）

**重要：** 提交列表的查询必须从 `class_members` 出发做 `LEFT JOIN submissions`，以保证未提交的成员也出现在列表中。这是数据层的要求，与该组件无关，但务必在后端实现时注意。

---

## 11. enhanced-button — 异步状态按钮

**评级：🟡 按需安装（Task 1，全局可用）**  
**GitHub：** https://github.com/jakobhoeg/enhanced-button  
**说明：** copy-paste 单组件

### 简介

扩展 shadcn/ui Button，内置 loading、success、error 三种异步状态的视觉反馈。无需引入 XState 等状态机库。

```tsx
<EnhancedButton
  variant="default"
  onClick={handleSubmit}
  loadingText="提交中..."
>
  提交作业
</EnhancedButton>
```

**功能特性：**
- Loading 状态：Loader2 旋转图标 + 自定义文字
- Success 状态：CheckCircle 图标 + 绿色，自动 2 秒后回到 idle
- Error 状态：XCircle 图标 + 红色
- 状态期间自动禁用，防止重复提交
- Promise-aware：传入返回 Promise 的 `onClick`，自动管理状态

**优点：**
- 轻量，单文件 copy-paste，无额外依赖
- 覆盖所有异步操作场景（AI 解析、提交作业、发布任务、保存设置）
- 比 progress-button（依赖 XState）轻 10 倍

**缺点：**
- 无进度条（文件上传场景需手动实现进度显示）
- 样式定制需修改源码

**使用场景：** AI 解析按钮、提交作业按钮、发布任务按钮、各类保存/确认操作。

---

## 12. number-flow — 数字动画过渡

**评级：🟡 按需安装（Task 5/7，任务统计区）**  
**官方网站：** https://number-flow.barvian.me  
**安装：**

```bash
npm install number-flow
```

### 简介

数字平滑过渡动画组件，将普通数字文本替换为带有滚动动画的展示，一行代码升级视觉质感。

```tsx
import NumberFlow from 'number-flow'

// 替换普通的 <span>{count}</span>
<NumberFlow value={submittedCount} />
```

**优点：**
- 极简 API，`<NumberFlow value={n} />` 替换 `<span>{n}</span>` 即可
- 动画物理感强，不浮夸
- 支持格式化选项（小数位、千分符等）

**缺点：**
- 增加约 8KB bundle 体积
- 对 SSR 需要配置 `data-nosnippet` 防止水合不匹配

**使用场景：** 任务详情页的统计数字（`12 人 · 8 已读 · 5 已提交`），数字变化时有滚动动画。

---

## 13. password-input — 密码输入框

**评级：🟡 按需安装（Task 2，登录注册页）**  
**来源：** https://gist.github.com/mjbalcueva/b21f39a8787e558d4c536bf68e267398  
**说明：** copy-paste 单文件，约 30 行代码

### 简介

扩展 shadcn/ui Input，右侧添加眼睛图标切换密码显隐。这是最简单实现，无额外依赖。

**功能特性：**
- 点击眼睛图标切换 `type="password"` / `type="text"`
- 使用 `lucide-react` 的 `Eye` / `EyeOff` 图标（项目已有依赖）
- 继承 shadcn/ui Input 的所有 props

**优点：** 30 行代码，零依赖，直接 copy-paste，5 分钟搞定

**缺点：** 无，这就是它应有的样子

---

## 14. Vaul / Drawer — 移动端抽屉

**评级：🔴 已内置，无需额外安装**  
**说明：** shadcn/ui 的 Drawer 组件已基于 Vaul 构建

```bash
npx shadcn@latest add drawer
```

**用途：** 移动端侧栏折叠（Task 10），侧栏在手机屏幕上变为从左侧滑出的抽屉。

shadcn/ui 已将 Vaul 封装进 Drawer 组件。可直接使用 `<Drawer direction="left">` 实现侧栏的移动端适配，无需安装任何额外依赖。

响应式侧栏方案：
```tsx
// 桌面端：固定侧栏
// 移动端：Drawer 触发器（汉堡菜单）+ Drawer 内容（侧栏内容）
<Drawer direction="left">
  <DrawerTrigger asChild>
    <Button variant="ghost" size="icon" className="md:hidden">
      <Menu />
    </Button>
  </DrawerTrigger>
  <DrawerContent className="w-[240px]">
    <AppSidebar />
  </DrawerContent>
</Drawer>
```

---

## 15. shadcn-multi-select-component — 多选备选

**评级：🟢 备用（fancy-multi-select 不满足需求时使用）**  
**GitHub：** https://github.com/sersavan/shadcn-multi-select-component  
**演示：** https://shadcn-multi-select-component.vercel.app

### 简介

功能更丰富的多选组件，相比 fancy-multi-select 增加了多种 Variant 样式、动画效果和最大选择数限制。

**功能特性：**
- 4 种 Variant：default、secondary、destructive、inverted
- 自定义 Badge 颜色和图标
- 分组选项（带标题和分隔线）
- 禁用特定选项
- 内置动画（bounce、pulse、wiggle、fade、slide）
- 最大选择数限制

**优点：** 功能比 fancy-multi-select 更完整，适合需要视觉差异的多选场景

**缺点：** 依赖较多（`@radix-ui/react-popover`、`@radix-ui/react-separator`、`cmdk`），比 fancy-multi-select 重

---

## 16. calendar-cn — 日历视图备选

**评级：🟢 备用（v2 日历视图）**  
**官方网站：** https://calendarcn.xyz  
**GitHub：** https://github.com/vmnog/calendarcn

### 简介

受 Notion Calendar 启发的 React 日历组件，周视图、暗色模式、事件颜色自定义。

**功能特性：**
- 周视图（v1 暂不需要月视图，周视图展示任务 DDL 足够）
- 暗色模式
- 事件颜色自定义（对应班级颜色）
- 基于 shadcn/ui + Tailwind，设计风格契合

**优点：** 外观最接近 Notion Calendar，与项目视觉调性一致

**缺点：**
- 功能相比 shadcn-event-calendar 更简单（无日视图、年视图）
- 文档较少

**建议：** v1 日历视图暂不实现，v2 需要时优先评估此组件。

---

## 附录：安装速查

### Task 1 之前（核心套件）

```bash
# Kibo UI 四件套
npx kibo-ui add editor
npx kibo-ui add gantt
npx kibo-ui add dropzone
npx kibo-ui add tags
```

### 按 Task 安装

```bash
# Task 2 — 登录注册
# copy-paste: password-input (https://gist.github.com/mjbalcueva/b21f39a8787e558d4c536bf68e267398)
npx shadcn@latest add https://credenza.rdev.pro/r/credenza.json

# Task 3 — Dashboard
npx shadcn@latest add drawer

# Task 5/6 — 任务
# copy-paste: shadcn-datetime-picker (https://shadcn-datetime-picker.vercel.app)
# copy-paste: enhanced-button (https://github.com/jakobhoeg/enhanced-button)

# Task 6 — 前置任务选择
# copy-paste: fancy-multi-select (https://craft.mxkaske.dev/post/fancy-multi-select)

# Task 7 — 提交批改
npx shadcn@latest add https://tnks-data-table.vercel.app/r/data-table.json
npx shadcn@latest add https://tnks-data-table.vercel.app/r/calendar-date-picker.json

# Task 8 — 看板视图
# copy-paste: shadcn-kanban-board (https://github.com/janhesters/shadcn-kanban-board)

# Task 9 — 个人设置
# copy-paste: shadcn-image-cropper (https://github.com/sujjeee/shadcn-image-cropper)
npm install number-flow
```

### 何时用 Credenza vs confirm-dialog

| 场景 | 用哪个 |
|---|---|
| 删除/危险操作的二次确认 | `confirm-dialog`（命令式调用更简洁） |
| 包含表单的弹窗（加入班级、创建班级） | `Credenza`（更好的移动端体验） |
| 需要展示复杂内容的弹窗 | `Credenza` |