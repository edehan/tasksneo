import "./style.css";

type ClassId = "math" | "physics" | "cs" | "design";
type GanttState = "done" | "active" | "review" | "queued";

interface ParseSnapshot {
  prompt: string;
  deadline: string;
  deliverable: string;
  rubric: string;
  mention: string;
}

interface GanttTask {
  title: string;
  detail: string;
  start: number;
  end: number;
  progress: number;
  state: GanttState;
}

interface ThemePalette {
  primary: string;
  soft: string;
  ink: string;
  halo: string;
  bg: string;
}

interface ClassPreset {
  name: string;
  themeTitle: string;
  themeNote: string;
  stageTitle: string;
  stageDesc: string;
  previewSubtitle: string;
  previewNote: string;
  mcpNote: string;
  metrics: {
    active: number;
    rules: number;
    agents: number;
  };
  colors: ThemePalette;
  parse: ParseSnapshot;
  gantt: GanttTask[];
}

const CLASS_IDS = ["math", "physics", "cs", "design"] as const;
const CLASS_ID_SET = new Set<ClassId>(CLASS_IDS);
const GANTT_DAY_COUNT = 20;
const GANTT_START_DATE = new Date("2026-04-07T00:00:00");

const CLASS_PRESETS: Record<ClassId, ClassPreset> = {
  math: {
    name: "高等数学 A 班",
    themeTitle: "证明型任务主导",
    themeNote: "强调推导严谨度，提醒节奏在截止前分层推进。",
    stageTitle: "高等数学 A 班 · 紧凑作业节奏",
    stageDesc:
      "解析模板偏向公式与证明结构，提醒节奏在截止前 48h、12h、2h 自动触发。",
    previewSubtitle: "风格关键词：理性、克制、稳态推进",
    previewNote: "主题应用到按钮、甘特条、审核标记与工作流节点，视觉和行为保持一致。",
    mcpNote: "当前已为 高等数学 A 班 配置 34 个协作助手节点。",
    metrics: {
      active: 12,
      rules: 9,
      agents: 34,
    },
    colors: {
      primary: "#b25d2b",
      soft: "#da8a55",
      ink: "#6f3517",
      halo: "rgba(178, 93, 43, 0.27)",
      bg: "rgba(178, 93, 43, 0.13)",
    },
    parse: {
      prompt:
        "下周四 23:59 前提交微积分 Problem Set 5，格式 PDF，附关键推导步骤，满分 100，迟交扣 10%。",
      deadline: "4 月 16 日（周四）23:59",
      deliverable: "PDF + 关键推导截图",
      rubric: "满分 100 / 迟交扣 10%",
      mention: "AI 追加提醒：已自动绑定“公式检查助手”和“迟交预警助手”。",
    },
    gantt: [
      {
        title: "任务草案生成",
        detail: "已完成 · 100%",
        start: 0.4,
        end: 2.8,
        progress: 100,
        state: "done",
      },
      {
        title: "助教预审与补充说明",
        detail: "进行中 · 76%",
        start: 2.2,
        end: 5.6,
        progress: 76,
        state: "active",
      },
      {
        title: "学生提交窗口",
        detail: "进行中 · 58%",
        start: 4.4,
        end: 11.8,
        progress: 58,
        state: "active",
      },
      {
        title: "批改与反馈归档",
        detail: "待复核 · 18%",
        start: 12,
        end: 17.2,
        progress: 18,
        state: "review",
      },
    ],
  },
  physics: {
    name: "物理实验班",
    themeTitle: "实验报告驱动",
    themeNote: "更强调附件完整性和实验数据时间窗。",
    stageTitle: "物理实验班 · 实验周期联动",
    stageDesc:
      "解析引擎自动检测图表和数据文件缺失风险，提前触发实验报告模板补全。",
    previewSubtitle: "风格关键词：冷静、精确、数据优先",
    previewNote: "主题转为深蓝调后，进度与风险状态在时间轴上对比更清晰。",
    mcpNote: "当前已为 物理实验班 配置 41 个协作助手节点。",
    metrics: {
      active: 9,
      rules: 11,
      agents: 41,
    },
    colors: {
      primary: "#3f6994",
      soft: "#6b95bf",
      ink: "#1c4066",
      halo: "rgba(63, 105, 148, 0.25)",
      bg: "rgba(63, 105, 148, 0.14)",
    },
    parse: {
      prompt:
        "本周五 17:00 前提交波动实验报告，必须包含三组图表与误差分析，缺少原始数据视为未完成。",
      deadline: "4 月 17 日（周五）17:00",
      deliverable: "PDF 报告 + 原始数据表",
      rubric: "图表质量 40% / 结论 40% / 规范 20%",
      mention: "AI 追加提醒：已启用“图表核验助手”和“实验数据稽核助手”。",
    },
    gantt: [
      {
        title: "实验数据上传",
        detail: "进行中 · 66%",
        start: 0.8,
        end: 4.8,
        progress: 66,
        state: "active",
      },
      {
        title: "图表自动检查",
        detail: "进行中 · 52%",
        start: 3.1,
        end: 7.6,
        progress: 52,
        state: "active",
      },
      {
        title: "实验报告提交",
        detail: "未开始 · 0%",
        start: 7.4,
        end: 13.1,
        progress: 0,
        state: "queued",
      },
      {
        title: "助教复核与讲评",
        detail: "待复核 · 10%",
        start: 13.2,
        end: 18,
        progress: 10,
        state: "review",
      },
    ],
  },
  cs: {
    name: "软件工程实训班",
    themeTitle: "迭代冲刺节奏",
    themeNote: "更强调任务拆分、状态推进和合并前质量门禁。",
    stageTitle: "软件工程实训班 · Sprint 看板模式",
    stageDesc:
      "AI 解析会自动拆分需求为 issue、PR、回归验证三段，并挂接到同一甘特时间轴。",
    previewSubtitle: "风格关键词：工程化、模块化、快节奏",
    previewNote: "页面主题会同步到流程节点，方便识别当前班级的研发语境。",
    mcpNote: "当前已为 软件工程实训班 配置 57 个协作助手节点。",
    metrics: {
      active: 17,
      rules: 14,
      agents: 57,
    },
    colors: {
      primary: "#2f7b62",
      soft: "#62a68f",
      ink: "#1e5845",
      halo: "rgba(47, 123, 98, 0.28)",
      bg: "rgba(47, 123, 98, 0.14)",
    },
    parse: {
      prompt:
        "4 月 22 日前完成 API 模块开发，提交 PR、测试报告和接口文档，合并前必须通过回归测试。",
      deadline: "4 月 22 日（周三）23:59",
      deliverable: "PR 链接 + 测试报告 + API 文档",
      rubric: "功能正确 45% / 测试覆盖 35% / 文档 20%",
      mention: "AI 追加提醒：已接入“代码审查助手”“CI 诊断助手”“文档生成助手”。",
    },
    gantt: [
      {
        title: "需求拆分与任务分派",
        detail: "已完成 · 100%",
        start: 0.2,
        end: 2.1,
        progress: 100,
        state: "done",
      },
      {
        title: "模块开发与联调",
        detail: "进行中 · 61%",
        start: 1.9,
        end: 9.8,
        progress: 61,
        state: "active",
      },
      {
        title: "PR 审查与修复",
        detail: "进行中 · 34%",
        start: 8.1,
        end: 13.4,
        progress: 34,
        state: "active",
      },
      {
        title: "回归测试与发布",
        detail: "未开始 · 0%",
        start: 13.4,
        end: 18.4,
        progress: 0,
        state: "queued",
      },
    ],
  },
  design: {
    name: "视觉设计工作坊",
    themeTitle: "叙事与审美并重",
    themeNote: "解析时会强化风格词、视觉语义和评审轮次。",
    stageTitle: "视觉设计工作坊 · 评审波次模式",
    stageDesc:
      "AI 会把自然语言需求拆成概念稿、版式稿、终稿三段，并按评审节点自动提醒。",
    previewSubtitle: "风格关键词：叙事、层次、表现力",
    previewNote: "主题切到玫瑰调后，视觉反馈更柔和，适合呈现审美导向任务。",
    mcpNote: "当前已为 视觉设计工作坊 配置 29 个协作助手节点。",
    metrics: {
      active: 8,
      rules: 7,
      agents: 29,
    },
    colors: {
      primary: "#a35a73",
      soft: "#cb839f",
      ink: "#6f3047",
      halo: "rgba(163, 90, 115, 0.26)",
      bg: "rgba(163, 90, 115, 0.14)",
    },
    parse: {
      prompt:
        "两周内提交品牌海报提案，包含 moodboard、主视觉和排版规范，需给出三版迭代说明。",
      deadline: "4 月 21 日（周二）20:00",
      deliverable: "Moodboard + 主视觉 + 排版规范",
      rubric: "概念 40% / 视觉完成度 40% / 叙事 20%",
      mention: "AI 追加提醒：已连接“版式建议助手”和“评审总结助手”。",
    },
    gantt: [
      {
        title: "方向研究与 moodboard",
        detail: "进行中 · 69%",
        start: 0.4,
        end: 4.5,
        progress: 69,
        state: "active",
      },
      {
        title: "主视觉草图迭代",
        detail: "进行中 · 46%",
        start: 4.1,
        end: 9.5,
        progress: 46,
        state: "active",
      },
      {
        title: "版式与规范整理",
        detail: "未开始 · 0%",
        start: 9.4,
        end: 14.2,
        progress: 0,
        state: "queued",
      },
      {
        title: "终稿评审与交付",
        detail: "待复核 · 13%",
        start: 14,
        end: 18.8,
        progress: 13,
        state: "review",
      },
    ],
  },
};

const STATE_LABEL: Record<GanttState, string> = {
  done: "已完成",
  active: "进行中",
  review: "待复核",
  queued: "未开始",
};

const byId = <T extends HTMLElement>(id: string): T | null =>
  document.getElementById(id) as T | null;

const root = document.documentElement;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const classButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>(".class-chip[data-class]"),
);
const parallaxNodes = document.querySelectorAll<HTMLElement>("[data-parallax]");
const revealNodes = document.querySelectorAll<HTMLElement>("[data-reveal]");
const scrollZones = Array.from(
  document.querySelectorAll<HTMLElement>("[data-scroll-zone]"),
);

const loginUrl = import.meta.env.VITE_APP_LOGIN_URL || "/login";
const registerUrl = import.meta.env.VITE_APP_REGISTER_URL || "/register";

const loginLinks = document.querySelectorAll<HTMLAnchorElement>(
  'a[data-target="login"]',
);
const registerLinks = document.querySelectorAll<HTMLAnchorElement>(
  'a[data-target="register"]',
);

for (const link of loginLinks) {
  link.href = loginUrl;
}

for (const link of registerLinks) {
  link.href = registerUrl;
}

if (!import.meta.env.VITE_APP_LOGIN_URL || !import.meta.env.VITE_APP_REGISTER_URL) {
  console.info(
    "[landing] VITE_APP_LOGIN_URL / VITE_APP_REGISTER_URL not set, using /login and /register fallback.",
  );
}

const year = byId<HTMLElement>("year");
if (year) {
  year.textContent = String(new Date().getFullYear());
}

for (const panel of parallaxNodes) {
  panel.style.setProperty("--depth", panel.dataset.depth || "0.35");
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const isClassId = (value: string): value is ClassId =>
  CLASS_ID_SET.has(value as ClassId);

const formatDay = (offset: number): string => {
  const date = new Date(GANTT_START_DATE);
  date.setDate(date.getDate() + Math.round(offset));
  return date.toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
  });
};

const setText = (id: string, value: string): void => {
  const element = byId<HTMLElement>(id);
  if (element) {
    element.textContent = value;
  }
};

const setThemeVariables = (palette: ThemePalette): void => {
  root.style.setProperty("--theme-primary", palette.primary);
  root.style.setProperty("--theme-soft", palette.soft);
  root.style.setProperty("--theme-ink", palette.ink);
  root.style.setProperty("--theme-halo", palette.halo);
  root.style.setProperty("--theme-bg", palette.bg);
};

const renderGantt = (preset: ClassPreset): void => {
  const daysNode = byId<HTMLElement>("gantt-days");
  const rowsNode = byId<HTMLElement>("gantt-rows");
  const boardInner = byId<HTMLElement>("gantt-board-inner");

  if (!daysNode || !rowsNode || !boardInner) {
    return;
  }

  boardInner.style.setProperty("--gantt-day-count", String(GANTT_DAY_COUNT));
  daysNode.innerHTML = "";
  rowsNode.innerHTML = "";

  for (let day = 0; day < GANTT_DAY_COUNT; day += 1) {
    const label = document.createElement("span");
    const majorTick = day % 2 === 0;
    label.className = majorTick ? "is-major" : "";
    label.textContent = majorTick ? formatDay(day) : "·";
    daysNode.append(label);
  }

  for (const task of preset.gantt) {
    const row = document.createElement("article");
    row.className = "gantt-row";

    const taskNode = document.createElement("div");
    taskNode.className = "gantt-task";

    const title = document.createElement("strong");
    title.textContent = task.title;

    const detail = document.createElement("span");
    detail.textContent = `${STATE_LABEL[task.state]} · ${task.progress}% · ${task.detail}`;

    taskNode.append(title, detail);

    const lane = document.createElement("div");
    lane.className = "gantt-lane";

    const bar = document.createElement("div");
    bar.className = `gantt-bar is-${task.state}`;

    const left = clamp((task.start / GANTT_DAY_COUNT) * 100, 0, 100);
    const width = clamp(
      ((task.end - task.start) / GANTT_DAY_COUNT) * 100,
      5,
      100 - left,
    );

    bar.style.left = `${left.toFixed(3)}%`;
    bar.style.width = `${width.toFixed(3)}%`;

    const fill = document.createElement("span");
    fill.className = "gantt-fill";
    fill.style.width = `${clamp(task.progress, 0, 100)}%`;

    const range = document.createElement("span");
    range.className = "gantt-label";
    range.textContent = `${formatDay(task.start)} - ${formatDay(task.end)}`;

    bar.append(fill, range);
    lane.append(bar);

    row.append(taskNode, lane);
    rowsNode.append(row);
  }
};

const applyClassPreset = (classId: ClassId): void => {
  const preset = CLASS_PRESETS[classId];

  setThemeVariables(preset.colors);

  setText("hero-class-tag", preset.name);
  setText("hero-theme-title", `${preset.name} · ${preset.themeTitle}`);
  setText("hero-theme-note", preset.themeNote);

  setText("hero-parse-input", `“${preset.parse.prompt}”`);
  setText("hero-parse-class", preset.name);
  setText("hero-parse-deadline", preset.parse.deadline);
  setText("hero-parse-deliverable", preset.parse.deliverable);
  setText("hero-parse-rubric", preset.parse.rubric);

  setText("parse-prompt", preset.parse.prompt);
  setText("parse-source-class", preset.name);
  setText("parse-output-class", preset.name);
  setText("parse-output-deadline", preset.parse.deadline);
  setText("parse-output-deliverable", preset.parse.deliverable);
  setText("parse-output-rubric", preset.parse.rubric);
  setText("parse-output-mention", preset.parse.mention);

  setText("class-stage-title", preset.stageTitle);
  setText("class-stage-desc", preset.stageDesc);
  setText("metric-active", String(preset.metrics.active));
  setText("metric-rules", String(preset.metrics.rules));
  setText("metric-agents", String(preset.metrics.agents));

  setText("class-preview-title", preset.name);
  setText("class-preview-subtitle", preset.previewSubtitle);
  setText("class-preview-note", preset.previewNote);

  setText("gantt-class-name", preset.name);
  setText("mcp-map-note", preset.mcpNote);
  setText("mcp-class-note", preset.mcpNote);

  renderGantt(preset);
};

let activeClassId: ClassId = "math";

for (const button of classButtons) {
  const id = button.dataset.class;
  if (!id || !isClassId(id)) {
    continue;
  }

  button.addEventListener("click", () => {
    activeClassId = id;

    for (const item of classButtons) {
      item.classList.toggle("is-active", item.dataset.class === id);
    }

    applyClassPreset(id);
  });
}

applyClassPreset(activeClassId);

if (reduceMotion.matches) {
  for (const node of revealNodes) {
    node.classList.add("is-visible");
  }
} else {
  const observer = new IntersectionObserver(
    (entries, self) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          self.unobserve(entry.target);
        }
      }
    },
    {
      rootMargin: "0px 0px -10% 0px",
      threshold: 0.18,
    },
  );

  for (const node of revealNodes) {
    observer.observe(node);
  }
}

if (!reduceMotion.matches) {
  window.addEventListener("pointermove", (event) => {
    const x = event.clientX / window.innerWidth - 0.5;
    const y = event.clientY / window.innerHeight - 0.5;

    root.style.setProperty("--pointer-x", x.toFixed(4));
    root.style.setProperty("--pointer-y", y.toFixed(4));
  });
}

const updateScrollDrivenStyles = (): void => {
  const viewportHeight = window.innerHeight;
  const maxScroll = Math.max(
    document.documentElement.scrollHeight - viewportHeight,
    1,
  );
  const pageProgress = clamp(window.scrollY / maxScroll, 0, 1);

  root.style.setProperty("--page-progress", pageProgress.toFixed(4));

  for (const zone of scrollZones) {
    const rect = zone.getBoundingClientRect();
    const span = viewportHeight + rect.height;
    const progress = clamp((viewportHeight - rect.top) / span, 0, 1);

    zone.style.setProperty("--zone-progress", progress.toFixed(4));

  }
};

if (reduceMotion.matches) {
  root.style.setProperty("--page-progress", "0");
  for (const zone of scrollZones) {
    zone.style.setProperty("--zone-progress", "1");
  }
} else {
  updateScrollDrivenStyles();

  let queued = false;
  const queueUpdate = (): void => {
    if (queued) {
      return;
    }

    queued = true;
    window.requestAnimationFrame(() => {
      queued = false;
      updateScrollDrivenStyles();
    });
  };

  window.addEventListener("scroll", queueUpdate, { passive: true });
  window.addEventListener("resize", queueUpdate);
}
