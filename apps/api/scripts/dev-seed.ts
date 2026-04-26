import fs from "node:fs";
import path from "node:path";
import { AuthProvider, ClassRole, prisma } from "@taskflow/db";
import dotenv from "dotenv";

import { hashPassword } from "../src/lib/password.js";
import { updateConfig } from "../src/services/system-config.service.js";

const repoRoot = path.resolve(process.cwd(), "../..");
const localEnvPath = path.join(repoRoot, ".env");

if (fs.existsSync(localEnvPath)) {
	dotenv.config({ path: localEnvPath });
}

function assertLocalDatabase() {
	const databaseUrl = process.env.DATABASE_URL ?? "";

	if (!databaseUrl) {
		throw new Error("DATABASE_URL is required for dev seed");
	}

	const isLocalHost =
		databaseUrl.includes("@localhost:") || databaseUrl.includes("@127.0.0.1:");

	if (!isLocalHost) {
		throw new Error(
			"Refusing to seed non-local database. This script is local-only.",
		);
	}
}

async function upsertUser(
	email: string,
	nickname: string,
	passwordHash: string,
) {
	const user = await prisma.user.upsert({
		where: { email },
		update: {
			nickname,
			isActive: true,
			schoolId: null,
			studentId: null,
			timezone: "Asia/Shanghai",
		},
		create: {
			email,
			nickname,
			isActive: true,
			timezone: "Asia/Shanghai",
		},
	});

	await prisma.userCredential.upsert({
		where: {
			userId_provider: {
				userId: user.id,
				provider: AuthProvider.LOCAL,
			},
		},
		update: {
			passwordHash,
			providerUid: null,
		},
		create: {
			userId: user.id,
			provider: AuthProvider.LOCAL,
			providerUid: null,
			passwordHash,
		},
	});

	return user;
}

async function upsertClass(
	ownerId: string,
	input: {
		name: string;
		inviteCode: string;
		color: string;
		description?: string;
	},
) {
	return prisma.class.upsert({
		where: {
			inviteCode: input.inviteCode,
		},
		update: {
			name: input.name,
			ownerId,
			isPersonal: false,
			schoolId: null,
			color: input.color,
			description: input.description ?? `${input.name}（本地开发数据）`,
		},
		create: {
			name: input.name,
			ownerId,
			isPersonal: false,
			schoolId: null,
			inviteCode: input.inviteCode,
			color: input.color,
			description: input.description ?? `${input.name}（本地开发数据）`,
		},
	});
}

async function ensureMember(classId: string, userId: string, role: ClassRole) {
	await prisma.classMember.upsert({
		where: {
			classId_userId: {
				classId,
				userId,
			},
		},
		update: {
			role,
		},
		create: {
			classId,
			userId,
			role,
		},
	});
}

async function ensurePersonalClass(user: {
	id: string;
	email: string;
	nickname: string | null;
}) {
	const className = `${user.nickname ?? user.email} 的个人空间`;

	const existing = await prisma.class.findFirst({
		where: {
			ownerId: user.id,
			isPersonal: true,
		},
		select: {
			id: true,
		},
	});

	const personalClass = existing
		? await prisma.class.update({
				where: { id: existing.id },
				data: {
					name: className,
					isPersonal: true,
					inviteCode: null,
					schoolId: null,
					description: "个人工作空间",
					color: "#6366f1",
				},
			})
		: await prisma.class.create({
				data: {
					name: className,
					ownerId: user.id,
					isPersonal: true,
					inviteCode: null,
					schoolId: null,
					description: "个人工作空间",
					color: "#6366f1",
				},
			});

	await ensureMember(personalClass.id, user.id, ClassRole.OWNER);
}

async function upsertTask(input: {
	classId: string;
	createdBy: string;
	title: string;
	startAtIso: string;
	dueAtIso: string;
	description: string;
	isPublished?: boolean;
	blockedBy?: string[];
}) {
	const existing = await prisma.task.findFirst({
		where: {
			classId: input.classId,
			title: input.title,
			deletedAt: null,
		},
	});

	const data = {
		createdBy: input.createdBy,
		startAt: new Date(input.startAtIso),
		dueAt: new Date(input.dueAtIso),
		description: input.description,
		allowLateSubmission: true,
		blockedBy: input.blockedBy ?? [],
		isPublished: input.isPublished ?? true,
		publishedAt:
			(input.isPublished ?? true) ? new Date(input.startAtIso) : null,
		deletedAt: null,
	};

	if (existing) {
		return prisma.task.update({
			where: { id: existing.id },
			data,
		});
	}

	return prisma.task.create({
		data: {
			classId: input.classId,
			title: input.title,
			...data,
		},
	});
}

async function upsertSubmission(input: {
	taskId: string;
	userId: string;
	submittedAtIso: string;
	content: string;
	score?: number;
	reviewNote?: string;
	reviewerId?: string;
}) {
	const submittedAt = new Date(input.submittedAtIso);

	await prisma.submission.upsert({
		where: {
			taskId_userId: {
				taskId: input.taskId,
				userId: input.userId,
			},
		},
		update: {
			content: input.content,
			firstSubmittedAt: submittedAt,
			lastUpdatedAt: submittedAt,
			score: input.score ?? null,
			reviewerId: input.reviewerId ?? null,
			reviewedAt: input.reviewerId ? submittedAt : null,
			reviewNote: input.reviewNote ?? null,
		},
		create: {
			taskId: input.taskId,
			userId: input.userId,
			content: input.content,
			firstSubmittedAt: submittedAt,
			lastUpdatedAt: submittedAt,
			score: input.score ?? null,
			reviewerId: input.reviewerId ?? null,
			reviewedAt: input.reviewerId ? submittedAt : null,
			reviewNote: input.reviewNote ?? null,
		},
	});

	await prisma.taskUserState.upsert({
		where: {
			taskId_userId: {
				taskId: input.taskId,
				userId: input.userId,
			},
		},
		update: {
			viewedAt: submittedAt,
		},
		create: {
			taskId: input.taskId,
			userId: input.userId,
			viewedAt: submittedAt,
			tags: [],
		},
	});
}

async function markViewed(taskId: string, userId: string, viewedAtIso: string) {
	const viewedAt = new Date(viewedAtIso);
	await prisma.taskUserState.upsert({
		where: { taskId_userId: { taskId, userId } },
		update: { viewedAt },
		create: { taskId, userId, viewedAt, tags: [] },
	});
}

function readSeedEnv(...keys: string[]) {
	for (const key of keys) {
		const value = process.env[key];

		if (value?.trim()) {
			return value.trim();
		}
	}

	return null;
}

async function seedAiConfig() {
	const entries: Record<string, string> = {};

	const provider = readSeedEnv("DEV_SEED_LLM_PROVIDER", "LLM_PROVIDER");
	const baseUrl = readSeedEnv("DEV_SEED_LLM_BASE_URL", "LLM_BASE_URL");
	const model = readSeedEnv("DEV_SEED_LLM_MODEL", "LLM_MODEL");
	const apiKey = readSeedEnv("DEV_SEED_LLM_API_KEY", "LLM_API_KEY");

	if (provider) {
		entries["llm.provider"] = provider;
	}

	if (baseUrl) {
		entries["llm.base_url"] = baseUrl;
	}

	if (model) {
		entries["llm.model"] = model;
	}

	if (apiKey) {
		entries["llm.api_key"] = apiKey;
	}

	entries["llm.prompt_task_parse"] =
		readSeedEnv("DEV_SEED_LLM_PROMPT_PARSE") ??
		"You are a task parser for an educational platform. Teachers provide task descriptions (assignments, homework, project specs) as text, sometimes with attached files (PDFs, images). Extract structured metadata and produce a formatted markdown document.";

	// STT (AssemblyAI)
	const sttApiKey = readSeedEnv("DEV_SEED_STT_API_KEY", "ASSEMBLYAI_API_KEY");

	if (sttApiKey) {
		entries["stt.api_key"] = sttApiKey;
	}

	await updateConfig(entries);
	console.log("Seeded admin AI config keys:", Object.keys(entries).join(", "));
}

// ─── 主流程 ────────────────────────────────────────────────────────────────────

async function main() {
	assertLocalDatabase();

	const passwordHash = await hashPassword("12345678");

	// 三位用户：张老师（老师/管理员角色），李明 & 王芳（学生）
	const userA = await upsertUser("zhang@example.com", "张晓梅", passwordHash);
	const userB = await upsertUser("liming@example.com", "李明", passwordHash);
	const userC = await upsertUser("wangfang@example.com", "王芳", passwordHash);

	await ensurePersonalClass(userA);
	await ensurePersonalClass(userB);
	await ensurePersonalClass(userC);

	// ── 班级一：旅游管理实务 ──────────────────────────────────────────────────
	const classTourism = await upsertClass(userA.id, {
		name: "旅游管理实务",
		inviteCode: "DEV-TOURISM-2026",
		color: "#0891b2",
		description: "旅游行业实务与案例分析，涵盖目的地规划、导游技能与危机管理。",
	});

	for (const userId of [userA.id, userB.id, userC.id]) {
		await ensureMember(
			classTourism.id,
			userId,
			userId === userA.id ? ClassRole.OWNER : ClassRole.MEMBER,
		);
	}

	const taskTourism1 = await upsertTask({
		classId: classTourism.id,
		createdBy: userA.id,
		title: "国内热门景区客流量分析报告",
		startAtIso: "2026-02-20T00:00:00.000Z",
		dueAtIso: "2026-03-10T23:59:59.000Z",
		description: `# 国内热门景区客流量分析报告

## 任务背景

近年来，国内旅游市场快速复苏，部分 5A 级景区在节假日出现严重拥堵问题，引发游客满意度下降与安全隐患。

## 任务要求

请选取 **三个不同类型** 的国内热门景区（自然风光、历史文化、主题公园各一），分析其近三年客流量变化趋势，并从以下角度展开：

1. 数据来源与统计口径说明
2. 淡旺季分布规律及成因
3. 超载时段的应对措施评价
4. 针对景区容量管理的改进建议

## 提交格式

- Markdown 正文，不少于 1500 字
- 附数据图表（截图或链接均可）

## 截止时间

**2026 年 3 月 10 日 23:59**，逾期可补交，但将酌情扣分。`,
	});

	const taskTourism2 = await upsertTask({
		classId: classTourism.id,
		createdBy: userA.id,
		title: "导游词创作：西湖十景",
		startAtIso: "2026-03-01T00:00:00.000Z",
		dueAtIso: "2026-03-25T23:59:59.000Z",
		description: `# 导游词创作：西湖十景

## 任务说明

导游词是旅游服务的核心表达载体。一篇好的导游词，应兼顾历史文化深度、语言生动性与现场互动感。

## 要求

请为西湖十景中的 **任意两处** 各创作一篇导游词，每篇需满足：

- 时长：口述约 **5～8 分钟**（约 800～1200 字）
- 结构：开场白 → 景点介绍 → 文化典故 → 互动提问 → 收尾
- 语言：书面语与口语兼顾，避免生硬照本宣科

## 加分项

引用古诗词并结合现场场景进行恰当解说。

## 提交方式

Markdown 格式，两篇导游词分别用 \`---\` 分隔。`,
		blockedBy: [taskTourism1.id],
	});

	const taskTourism3 = await upsertTask({
		classId: classTourism.id,
		createdBy: userA.id,
		title: "旅游危机事件应急预案设计",
		startAtIso: "2026-03-15T00:00:00.000Z",
		dueAtIso: "2026-04-05T23:59:59.000Z",
		description: `# 旅游危机事件应急预案设计

## 背景

旅游突发事件（恶劣天气、游客伤亡、舆情危机）对旅游企业的声誉与运营影响深远。

## 任务

请选取以下场景之一，设计一份完整的应急预案：

**场景 A**：某山岳型景区在暴风雪中有 200 名游客被困
**场景 B**：跟团游客在境外发生严重交通事故
**场景C**：知名景区因环境污染视频在社交媒体病毒式传播

## 预案结构（参考）

1. 事件分级标准
2. 响应启动条件与指挥体系
3. 各部门职责清单（表格形式）
4. 对外信息发布口径与时间节点
5. 复盘与改进机制

**字数要求**：不少于 2000 字`,
	});

	// 提交记录
	await upsertSubmission({
		taskId: taskTourism1.id,
		userId: userB.id,
		submittedAtIso: "2026-03-08T14:30:00.000Z",
		content: `## 国内热门景区客流量分析报告

### 一、研究对象与数据来源

本报告选取**黄山风景区**（自然风光）、**故宫博物院**（历史文化）、**上海迪士尼乐园**（主题公园）三类代表性景区，数据来源为文化和旅游部官方统计、各景区年报及中国旅游研究院发布的季度报告。

### 二、客流量变化趋势（2023—2025）

| 景区 | 2023年（万人次） | 2024年（万人次） | 2025年（万人次） |
|------|------|------|------|
| 黄山 | 342 | 398 | 421 |
| 故宫 | 1680 | 1820 | 1950 |
| 上海迪士尼 | 1100 | 1240 | 1380 |

三处景区均呈稳步增长态势，增速在 8%～16% 之间。

### 三、淡旺季规律分析

- **黄山**：旺季集中于 4—5 月（花季）与 10 月（秋叶），春节期间受限流政策影响反而低于五一。
- **故宫**：寒暑假、法定节假日显著拉升客流，工作日与周末差距可达 3 倍。
- **迪士尼**：受儿童节、万圣节活动驱动明显，暑假为全年最高峰。

### 四、超载应对措施评价

故宫实行全面实名预约制，效果最为显著；黄山采用分时段限流但预约系统用户体验有待优化；迪士尼依赖动态定价与虚拟排队，整体满意度较高。

### 五、改进建议

1. 推广"弹性票价"机制，引导错峰出行
2. 建立景区实时客流数字大屏，向公众开放
3. 与周边交通部门联动，优化抵离时段分布`,
		score: 88,
		reviewNote:
			"数据引用规范，分析逻辑清晰。建议增加一手调研数据佐证，结论部分可更有针对性。",
		reviewerId: userA.id,
	});

	await upsertSubmission({
		taskId: taskTourism1.id,
		userId: userC.id,
		submittedAtIso: "2026-03-09T21:00:00.000Z",
		content: `## 客流量分析报告——张家界、苏州园林、长隆旅游度假区

本报告以湖南张家界（自然风光）、苏州古典园林（历史文化）、广州长隆（主题公园）为研究对象。

### 数据概览

张家界近三年接待游客分别为 4820万、5160万、5430万人次，整体呈上升趋势。苏州园林（以拙政园为核心统计）年均接待约 900 万人次，波动较小。长隆度假区依托多业态组合，年均客流突破 2000 万人次。

### 淡旺季分布

张家界受气候影响明显，雨雾天气较多的 7—8 月客流反而低于预期，国庆及五一是绝对旺季。苏州园林客流与上海外溢游客高度相关，周末占比超过 60%。

### 管理痛点

张家界百龙天梯等核心节点在旺季形成严重瓶颈，排队时长超过 90 分钟的投诉占景区差评总量的 43%（数据来自大众点评抓取，仅供参考）。

### 建议

引入 AI 客流预测系统，提前 48 小时向旅行社推送限流预警，协助旅行社动态调整行程安排。`,
		score: 82,
		reviewNote:
			"选取景区有新意，长隆数据部分缺乏来源说明。整体结构完整，语言流畅。",
		reviewerId: userA.id,
	});

	await upsertSubmission({
		taskId: taskTourism2.id,
		userId: userB.id,
		submittedAtIso: "2026-03-20T16:00:00.000Z",
		content: `# 导游词：断桥残雪 & 平湖秋月

---

## 断桥残雪

各位朋友，大家好！我是今天的导游李明，很高兴陪伴大家游览西湖。我们现在所在的位置，正是西湖十景之一——**断桥残雪**。

断桥，其实从未断过。它的名字来源于冬雪初霁之时，桥上残雪在阳光下渐渐消融，远看桥面若断若续，如诗如画，由此得名。大诗人白居易曾在这里留下"最爱湖东行不足，绿杨阴里白沙堤"的千古名句，可见此处风光早在千年之前便已令人流连忘返。

当然，提到断桥，很多朋友脑海中浮现的，或许是许仙与白娘子在这里相逢的动人传说……

---

## 平湖秋月

穿过白堤，我们来到了另一处醉人之所——**平湖秋月**。

每逢中秋之夜，皓月当空，湖面宁静如镜，月影与波光相映成趣，令人心旷神怡。清代康熙皇帝南巡时曾在此驻足，御题"平湖秋月"四字，从此成为西湖赏月的第一胜地。

这里也是摄影爱好者的天堂，建议大家在日落后的蓝调时刻，将相机架设在湖边栏杆处，捕捉城市灯光与湖月交织的绝美一幕。`,
	});

	await markViewed(taskTourism3.id, userB.id, "2026-03-16T09:00:00.000Z");
	await markViewed(taskTourism3.id, userC.id, "2026-03-17T11:00:00.000Z");

	// ── 班级二：现代汉语文学与创作 ──────────────────────────────────────────
	const classLiterature = await upsertClass(userA.id, {
		name: "现代汉语文学与创作",
		inviteCode: "DEV-LIT-2026",
		color: "#9333ea",
		description: "精读现当代文学经典，兼顾散文、小说与诗歌创作实践。",
	});

	for (const userId of [userA.id, userB.id, userC.id]) {
		await ensureMember(
			classLiterature.id,
			userId,
			userId === userA.id ? ClassRole.OWNER : ClassRole.MEMBER,
		);
	}

	const taskLit1 = await upsertTask({
		classId: classLiterature.id,
		createdBy: userA.id,
		title: "《活着》叙事视角分析",
		startAtIso: "2026-02-25T00:00:00.000Z",
		dueAtIso: "2026-03-15T23:59:59.000Z",
		description: `# 《活着》叙事视角分析

## 导读

余华的《活着》采用双重叙事框架：外层叙述者"我"（收集民谣的青年）与内层叙述者福贵（亲历者）。这一结构设计并非偶然，而是作者刻意选择的叙事伦理立场。

## 分析要求

请围绕以下问题展开 1000～1500 字的分析文章：

1. 外层叙述者的设置有何功能？去掉这一层次会有什么影响？
2. 福贵以第一人称"自述"，与第三人称转述相比，在情感距离和可信度上有何差异？
3. 余华如何通过叙事节奏（快慢切换）处理死亡场景，使读者不至于麻木？

## 格式要求

- 学术文风，可引用原文，注明页码（人民文学出版社 2012 年版）
- 不得使用 AI 生成内容（助教会通过风格比对检查）`,
	});

	const taskLit2 = await upsertTask({
		classId: classLiterature.id,
		createdBy: userA.id,
		title: "自由写作：一座城市的气味",
		startAtIso: "2026-03-10T00:00:00.000Z",
		dueAtIso: "2026-03-30T23:59:59.000Z",
		description: `# 自由写作：一座城市的气味

## 写作提示

气味是最直接的记忆触发器。普鲁斯特用一块浸在茶水里的玛德莱娜蛋糕，唤回了整个贡布雷小城；鲁迅用"油菜花的香"牵出了童年。

请以 **一座你熟悉的城市** 为对象，写一篇以"气味"为线索的散文或非虚构文章。

## 要求

- 字数：800～2000 字
- 不限文体（散文、随笔、非虚构叙事均可）
- 至少围绕 **三种不同气味** 展开，每种气味需与具体的人、事、时间或空间相连
- 避免空洞的抒情，细节优先

## 评分维度

| 维度 | 权重 |
|------|------|
| 细节真实感 | 40% |
| 语言表达 | 30% |
| 结构与节奏 | 20% |
| 原创性 | 10% |`,
		blockedBy: [taskLit1.id],
	});

	const taskLit3 = await upsertTask({
		classId: classLiterature.id,
		createdBy: userA.id,
		title: "诗歌朗诵稿：为当代青年重写《将进酒》",
		startAtIso: "2026-03-20T00:00:00.000Z",
		dueAtIso: "2026-04-10T23:59:59.000Z",
		description: `# 诗歌朗诵稿：为当代青年重写《将进酒》

## 背景

李白的《将进酒》是豪放派诗歌的巅峰之作，其"天生我材必有用"的自信与"人生得意须尽欢"的及时行乐观，在当代青年语境下引发了截然不同的解读——有人视之为鼓励，也有人认为这种及时行乐助长了"躺平"文化。

## 任务

请创作一首 **现代诗或新古典诗** 的朗诵稿，以当代青年视角对《将进酒》主题进行**回应、对话或颠覆**。

## 要求

- 长度：可朗诵 3～5 分钟（约 300～600 字）
- 必须包含对原诗至少一处意象或句式的显性引用并加以改造
- 附上 200 字以内的**创作说明**，解释你的立场与选择

## 提示

不需要赞同或反对，真正好的写作是呈现矛盾张力，而不是给出答案。`,
	});

	// 文学班提交
	await upsertSubmission({
		taskId: taskLit1.id,
		userId: userB.id,
		submittedAtIso: "2026-03-13T20:00:00.000Z",
		content: `# 《活着》的叙事视角：距离、伦理与生存的重量

## 一、外层叙述者的功能

余华在小说开篇安排了一位收集民谣的年轻人，这一设计看似可有可无，实则是全书叙事伦理的关键支撑。外层叙述者的在场，使福贵的故事从"历史事件的陈述"变成了"一个活生生的人正在向另一个人讲述"。这种口头性赋予了叙事一种天然的不完整与主观色彩——福贵会遗漏、会回避、会以他自己的逻辑重新排列时序。

如果去掉外层叙述者，小说将不得不采用更加全知的视角，那种庄严的命运感将取代现有的草根气息。福贵的苦难会变得"被观看"，而不是"被倾听"。

## 二、第一人称的情感距离

福贵说"家珍死得很安详"（第 192 页），而非"家珍痛苦地死去"，这种克制恰恰让读者更加心痛。第一人称的自述创造了一种奇特的悖论：叙述者越冷静，情绪的穿透力越强。余华在访谈中坦言，他想让福贵以一个"过来人"的口吻讲述，苦难已经被时间消化，剩下的是一种近乎超然的平静。

## 三、叙事节奏与死亡处理

余华处理有庆之死的方式尤为典型。医院场景的细节铺垫极为克制，死亡本身几乎是一句话带过，而后续福贵寻找儿子尸体的行走路线却写得极为详细——速度的反转制造了强烈的情感震荡，使读者在还没意识到发生了什么时，已经被那种空白击中。

综上，余华的叙事视角选择是一种伦理决策：不以作者身份消费苦难，而是让苦难以最日常的声音缓缓流出。`,
		score: 93,
		reviewNote:
			"分析深入，引文精准，对第一人称悖论的阐发尤为精彩。语言略可再凝练。优秀。",
		reviewerId: userA.id,
	});

	await upsertSubmission({
		taskId: taskLit1.id,
		userId: userC.id,
		submittedAtIso: "2026-03-14T22:30:00.000Z",
		content: `# 双重叙述与苦难的合法性——《活着》叙事视角浅析

余华在《活着》中构建了一个精巧的叙事套层。表面上，外层叙述者不过是引出故事的引子，但仔细阅读可以发现，这个"我"对福贵故事的反应——从好奇、同情到最终的沉默——其实是在代替读者完成情绪定位。

最值得关注的是第一人称叙述所带来的"可靠性"悬疑。福贵是否是一个可靠的叙述者？他对自己早年的荒唐有没有刻意美化？他对亲人死亡的接受是真正的豁达，还是一种防御性的遗忘？余华从不回答这些问题，正是这种不确定性构成了小说最深的张力。

死亡节奏方面，余华的策略是"积累—骤断"：在每一次重要死亡之前，用大量日常细节（食物、天气、劳作）拉高读者的代入感，然后死亡以最简短的叙述出现，留白让读者自行填充悲痛。这与索尔仁尼琴"把最大的恐惧放进最小的句子"的主张有异曲同工之妙。`,
	});

	await upsertSubmission({
		taskId: taskLit2.id,
		userId: userC.id,
		submittedAtIso: "2026-03-28T19:00:00.000Z",
		content: `# 成都的气味

成都是一座用嗅觉记住的城市。

第一次去成都是十七岁的冬天，从高铁站出来，扑面而来的是一股混着柴火烟与辣椒油的气息——不算好闻，却莫名地令人安心。后来我才明白，那是整座城市的底色气味：人间烟火，慢腾腾的，不着急。

**麻辣的气味**是成都最外向的表达。在宽窄巷子附近的苍蝇馆子里，花椒在热油里爆香的瞬间，会有一种细小的刺激感窜进鼻腔，不是呛，是一种清醒。我在那里吃了一碗夫妻肺片，坐在塑料凳上，对面是两个讨论麻将的中年男人，窗外是冬日难得的阳光。那一刻我觉得所谓"活在当下"不是一个哲学命题，而就是一碗拌匀的红油。

**茶馆里湿茶叶的气味**是成都的另一个维度。人民公园的露天茶馆，竹椅、长桌、白瓷盖碗，空气里漂着潮湿的茉莉香，混着一点发酵的陈旧。坐在那里喝茶的老人们不看手机，只是晒太阳、聊天、看别人。时间在那里以一种非线性的方式流动，一个下午可以和一辈子一样长。

**银杏叶腐化的气味**——这是成都秋末特有的，略带甜腻，像雨后被踩烂的果实。武侯祠外的银杏道，金黄叶片堆积成厚厚一层，行人踩过，发出的不是脆响，而是一种湿软的摩擦声，伴随着那种独特的腐殖气息。那是时间留下来的气味，和庙里的香烟一起，提醒人：一切都会过去，包括你的焦虑。

我离开成都时，行李箱里不知怎么混进了一小包花椒。在家里打开箱子的那一刻，成都扑面而来。`,
		score: 91,
		reviewNote:
			'细节生动，三种气味层次分明，结尾余韵悠长。"一碗拌匀的红油"是全文最好的一句，克制而有力。',
		reviewerId: userA.id,
	});

	await markViewed(taskLit3.id, userB.id, "2026-03-21T10:00:00.000Z");
	await markViewed(taskLit3.id, userC.id, "2026-03-22T08:30:00.000Z");

	// ── 班级三：金融市场分析基础 ────────────────────────────────────────────
	const classFinance = await upsertClass(userA.id, {
		name: "金融市场分析基础",
		inviteCode: "DEV-FINANCE-2026",
		color: "#16a34a",
		description:
			"股票、债券、外汇市场基础理论与量化分析实践，配合 Python 工具链。",
	});

	for (const userId of [userA.id, userB.id, userC.id]) {
		await ensureMember(
			classFinance.id,
			userId,
			userId === userA.id ? ClassRole.OWNER : ClassRole.MEMBER,
		);
	}

	const taskFin1 = await upsertTask({
		classId: classFinance.id,
		createdBy: userA.id,
		title: "A 股市场波动率研究：VIX 指标的本土化改造",
		startAtIso: "2026-02-15T00:00:00.000Z",
		dueAtIso: "2026-03-05T23:59:59.000Z",
		description: `# A 股市场波动率研究：VIX 指标的本土化改造

## 背景

芝加哥期权交易所的 VIX 指数被称为"恐慌指数"，是基于 S&P 500 指数期权隐含波动率计算的市场情绪指标。然而，由于 A 股市场的结构差异（散户占比高、涨跌停板制度、期权品种有限），直接套用 VIX 方法论存在显著局限。

## 任务要求

1. 简述 VIX 的计算原理（不超过 300 字）
2. 指出至少 **三点** A 股市场与美股的结构性差异，并分析其对波动率测量的影响
3. 查阅文献，介绍国内已有的 A 股波动率指标（如 iVIX、CBOE/CFFEX 联合产品），评价其优缺点
4. 提出你认为更适合 A 股的波动率测量改进方向（可以是定性论述，无需实现）

## 提交要求

- Markdown 格式，配合必要的公式（LaTeX 语法）
- 引用文献需附 DOI 或可访问链接`,
	});

	const taskFin2 = await upsertTask({
		classId: classFinance.id,
		createdBy: userA.id,
		title: "Python 实战：沪深 300 成分股相关性热力图",
		startAtIso: "2026-03-05T00:00:00.000Z",
		dueAtIso: "2026-03-28T23:59:59.000Z",
		description: `# Python 实战：沪深 300 成分股相关性热力图

## 任务说明

通过量化工具直观展示市场内部相关性结构，是资产配置的重要基础。本次作业要求使用 Python 计算并可视化沪深 300 成分股的收益率相关矩阵。

## 步骤要求

\`\`\`python
# 参考工具链
import akshare as ak        # 数据获取
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt
from scipy.cluster import hierarchy
\`\`\`

1. 使用 \`akshare\` 获取沪深 300 成分股近一年日收益率数据
2. 计算 Pearson 相关系数矩阵
3. 使用层次聚类对股票排序，生成聚类热力图
4. 识别相关性最强的 **三个行业板块组合**，简要分析原因

## 提交内容

- Python 脚本（.py 或 Jupyter Notebook）
- 最终热力图截图（PNG）
- 不超过 500 字的分析说明（Markdown）

## 注意事项

数据获取日期请统一为截至 2026-03-01，确保结果可复现。`,
		blockedBy: [taskFin1.id],
	});

	const taskFin3 = await upsertTask({
		classId: classFinance.id,
		createdBy: userA.id,
		title: "期中论文：人民币国际化进程的阶段性评估",
		startAtIso: "2026-03-20T00:00:00.000Z",
		dueAtIso: "2026-04-20T23:59:59.000Z",
		description: `# 期中论文：人民币国际化进程的阶段性评估

## 选题背景

人民币自 2009 年启动跨境贸易结算试点以来，国际化程度持续提升，2016 年正式加入 SDR 篮子货币。近年来地缘政治格局变化加速了部分经济体"去美元化"动作，为人民币提供了新机遇，也带来了新挑战。

## 论文要求

- 字数：3000～5000 字
- 结构：摘要（200 字以内）→ 引言 → 现状评估 → 关键障碍分析 → 路径建议 → 结论 → 参考文献
- 必须引用 **至少 8 篇** 学术文献（中英文各不限）
- 数据截止至 2025 年底

## 评分标准

| 维度 | 权重 |
|------|------|
| 论点清晰度与逻辑严谨性 | 35% |
| 数据与文献引用质量 | 30% |
| 现实洞察与政策建议原创性 | 25% |
| 格式规范 | 10% |

**截止日期**：2026 年 4 月 20 日，不接受延期提交（成绩截止节点）。`,
		allowLateSubmission: false,
	} as Parameters<typeof upsertTask>[0]);

	// 金融班提交
	await upsertSubmission({
		taskId: taskFin1.id,
		userId: userC.id,
		submittedAtIso: "2026-03-04T17:00:00.000Z",
		content: `# A 股波动率研究小结

## VIX 计算原理简述

VIX 由 CBOE 于 2003 年重新设计，基于 S&P 500 指数近月与次月期权的加权平均隐含波动率，反映市场对未来 30 天价格波动的预期。核心公式通过积分各行权价期权的加权价差计算方差互换价值，再取平方根得到年化波动率百分比。

## A 股结构性差异

**差异一：涨跌停板制度**
A 股日内波动被限制在 ±10%（ST 股为 ±5%），导致极端事件期间价格发现功能受损，期权隐含波动率会大幅高估实际风险，VIX 方法论在此失真。

**差异二：散户主导的市场结构**
A 股散户交易量占比长期超过 70%，与机构主导的美股相比，情绪传导更快、羊群效应更强，波动率的"回均"速度明显更快，影响模型参数设定。

**差异三：期权品种有限**
A 股期权目前仅限于上证 50 ETF 期权、沪深 300 ETF 期权等少数产品，市场深度与流动性不及美股，导致边缘行权价期权价格失真风险上升。

## 国内现有指标评述

上交所与中金所合作推出的 iVIX（上证 50 波动率指数）在国内实践中具有一定参考价值，但由于成交量集中在平值附近期权，虚值期权流动性不足导致计算精度受限。部分学者建议结合已实现波动率（Realized Volatility）构建混合指标，实证效果更稳定。

## 改进方向

建议探索"高频已实现波动率 + 期权隐含波动率 + 情绪指数"三因子融合模型，同时引入涨跌停触板率作为极端情绪修正项，以提升 A 股特殊制度背景下的预测效度。`,
		score: 85,
		reviewNote:
			"结构清晰，对三点差异的分析到位。改进方向有创意，但建议进一步查阅已有文献，避免重复已有成果。",
		reviewerId: userA.id,
	});

	await upsertSubmission({
		taskId: taskFin1.id,
		userId: userB.id,
		submittedAtIso: "2026-03-05T23:00:00.000Z",
		content: `# VIX 与 A 股适用性分析

## 原理简述

VIX 本质上是一个方差互换（Variance Swap）的公允价值近似，利用跨式组合对冲原理，从各行权价期权的价格中提炼出市场的隐含波动率预期。模型假设标的资产收益服从连续扩散过程，不存在跳跃风险。

## 三点结构差异

1. **制度差异**：A 股涨跌停板机制使极端行情期间期权定价失真
2. **投资者结构**：散户高比例带来更强的非理性波动，与有效市场假说偏差更大
3. **衍生品市场成熟度**：期权种类和流动性均远低于美股，导致波动率曲面（Volatility Surface）构建困难

## iVIX 评价

iVIX 的优点在于有官方背书、数据可靠性高。缺点是覆盖标的有限（仅上证 50），无法代表整体市场情绪，且虚值期权流动性问题尚未解决。

## 改进建议

鉴于 A 股特殊性，可考虑引入基于历史高频数据的 HAR-RV 模型（Heterogeneous Autoregressive Model of Realized Volatility），其对短中长期波动率的分解思路更契合 A 股投资者的异质性特征。`,
	});

	await markViewed(taskFin2.id, userB.id, "2026-03-06T08:00:00.000Z");
	await markViewed(taskFin2.id, userC.id, "2026-03-07T10:00:00.000Z");
	await markViewed(taskFin3.id, userB.id, "2026-03-21T09:00:00.000Z");

	// ── 班级四：校史研究与地方历史文献整理 ─────────────────────────────────
	const classHistory = await upsertClass(userA.id, {
		name: "校史研究与地方历史文献",
		inviteCode: "DEV-HISTORY-2026",
		color: "#b45309",
		description: "地方史志与校史档案整理，口述历史采集，历史叙事写作实践。",
	});

	for (const userId of [userA.id, userB.id, userC.id]) {
		await ensureMember(
			classHistory.id,
			userId,
			userId === userA.id ? ClassRole.OWNER : ClassRole.MEMBER,
		);
	}

	const taskHist1 = await upsertTask({
		classId: classHistory.id,
		createdBy: userA.id,
		title: "口述历史采集：访谈一位见证改革开放的长辈",
		startAtIso: "2026-02-28T00:00:00.000Z",
		dueAtIso: "2026-03-20T23:59:59.000Z",
		description: `# 口述历史采集：访谈一位见证改革开放的长辈

## 课程背景

口述历史（Oral History）是弥补文字档案空白、记录普通人生命经验的重要方法论。本次作业要求同学们走出课堂，以采访者的身份与历史对话。

## 采访对象要求

- 年龄不低于 **60 周岁**（1966 年以前出生）
- 亲身经历过改革开放初期（1978—1992）某一重要时刻
- 可以是家庭成员、社区邻居或经老师介绍的联系人

## 采访提纲（参考）

1. 您在 1978 年前后的生活状态是怎样的？
2. 改革开放对您个人或家庭最直接的影响是什么？
3. 您印象最深的一个细节或场景是什么？（鼓励挖掘具体物件、地点、对话）
4. 您如何看待那一段历史对当下的意义？

## 提交内容

- 采访录音或视频文件（附件上传，≥ 20 分钟）
- **文字整理稿**（不少于 2000 字，Markdown 格式）
- 受访者基本信息表（姓名可匿名，生年、职业背景需注明）
- 采访反思（300～500 字：你在这次采访中学到了什么，或遇到了什么困难）

## 伦理提示

务必提前告知受访者录音/录像用途，获得明确口头同意后方可录制。`,
	});

	const taskHist2 = await upsertTask({
		classId: classHistory.id,
		createdBy: userA.id,
		title: "校史专题：图书馆馆藏老照片的数字化描述与历史情境还原",
		startAtIso: "2026-03-10T00:00:00.000Z",
		dueAtIso: "2026-04-02T23:59:59.000Z",
		description: `# 校史专题：图书馆馆藏老照片的数字化描述与历史情境还原

## 任务说明

图书馆特藏室存有 1950—1980 年代校园老照片约 200 张（已完成初步数字化扫描）。本次任务要求同学们以 **小组形式（2 人一组）** 认领若干照片，完成历史情境的研究与文字还原。

## 分工说明

- 每组认领 **5 张**（从图书馆系统申请，先到先得）
- 角色分工：一人负责历史文献查阅，一人负责撰写与排版

## 每张照片需提供

1. **技术描述**：拍摄时间（估算区间）、地点、人物数量与可辨识特征
2. **情境还原**：结合校史档案或时代背景，说明照片可能记录的是什么场景
3. **物质文化分析**：照片中的服饰、建筑、道具能反映哪个时代的特征？
4. **疑问与存疑**：照片中有哪些信息无法确认，需要进一步考证？

## 提交格式

每张照片对应一个 Markdown 段落，统一按照片编号排序，附原始扫描图（已由图书馆授权使用）。

## 评分重点

情境还原的扎实程度（有文献依据）与历史分析的深度，而非写作文采。`,
		blockedBy: [taskHist1.id],
	});

	// 历史班提交
	await upsertSubmission({
		taskId: taskHist1.id,
		userId: userB.id,
		submittedAtIso: "2026-03-18T21:00:00.000Z",
		content: `# 口述历史整理稿：外婆的供销社岁月

**受访者**：李奶奶（化名），1948 年生，湖南省邵阳市人，曾在县供销社工作 22 年（1970—1992）
**采访时间**：2026 年 3 月 15 日上午 10:00—12:30
**采访地点**：受访者家中

---

## 一、开场：一枚布票的记忆

"你们现在的孩子不知道布票是什么，"李奶奶一开口就笑了，"买布要票，买油要票，连买块豆腐都要豆腐票。"

她从卧室里取出一个铁饼干盒，里面整齐叠放着几十张发黄的纸片——全是票证。棉花票、肉票、自行车票……她一张张摩挲，像在翻阅一本无字的日记。

---

## 二、供销社：县城的"购物中心"

1970 年，22 岁的她通过考试进入邵阳县供销社布匹部门，成为一名售货员。那时的供销社不像现在的超市，商品陈列简单，买卖讲究凭票按量，售货员的职责更像是"守门人"而非"销售员"。

"有一年国庆，上面配了一批确良布（涤纶混纺布），那个抢啊……我们站在柜台后面，外面的人把玻璃都挤碎了一块。我当时手里捏着剪刀，心里害怕得很。"

---

## 三、1984 年：第一次见到个体户

"那是我第一次觉得不对劲——不是坏的不对劲，是好的不对劲。"

1984 年，县里开始允许个体户经营，隔壁街道冒出几家私人布店。起初李奶奶不以为然，但很快发现："他们的布比我们还便宜，还多，还不用票。"

那一年春节前，供销社布匹部门的营业额下滑了将近三成。

---

## 四、1992 年：最后一个冬天

供销社在 1992 年正式启动改制，李奶奶选择了内退。离职那天，她把柜台钥匙交还给主任，转身走出那扇玻璃门，"眼泪没有流，但心里空了一块，说不清是什么感受"。

---

## 采访反思

这次采访让我意识到历史教科书里的"改革开放"是一个整体性叙事，但对于每一个普通人而言，它是以非常具体的方式降临的——一批确良布、一扇被挤碎的玻璃、一把柜台钥匙。外婆的经历提醒我，历史不只存在于政策文件里，也存在于那些被放进铁盒子保存的布票里。`,
		score: 95,
		reviewNote:
			'极为出色的口述历史作品。细节真实，叙事克制而有力，"空了一块"的结尾令人动容。"确良布"作为时代符号的使用尤为精准。强烈推荐作为本学期范文。',
		reviewerId: userA.id,
	});

	await upsertSubmission({
		taskId: taskHist1.id,
		userId: userC.id,
		submittedAtIso: "2026-03-19T15:00:00.000Z",
		content: `# 口述历史整理稿：下岗再就业的父辈

**受访者**：王叔叔（化名），1961 年生，辽宁沈阳人，曾就职于某国营机床厂，1997 年下岗
**采访时间**：2026 年 3 月 16 日
**采访地点**：视频通话

---

"你说要写我们这代人？"王叔叔在视频那头笑了，"我们这代人，是最倒霉的一代，也是最能扛的一代。"

1997 年，他所在的沈阳某国营机床厂以"减员增效"为由，一次性裁员 2000 人，王叔叔是其中之一。那年他 36 岁，上有老母，下有读小学的女儿。

"下岗证发下来那天，我一个人在机床旁边站了很久。那台机床我操作了十二年，我比任何人都了解它的脾气。"

他没有沉沦太久。三个月后，他通过社区介绍去学了电焊，后来自己开了一个小修理铺，慢慢做起来了。"没有办法，不能等死嘛。"

最让我触动的是他说的一句话："我们那时候的人，不会说'躺平'这个词——不是因为比你们勇敢，是因为躺下去真的会死。"

---

## 采访反思

受限于视频采访，现场感有所缺失，无法记录受访者的肢体语言与环境细节，这是本次采访最大的遗憾。但王叔叔的语言本身极具感染力，"躺平会死"这句话让我久久无法释怀——它是一个时代的注脚，也是对当下某种情绪的无声回应。`,
		score: 88,
		reviewNote:
			'主题选取有现实关怀，"躺平会死"的对比很有张力。建议下次尽量争取线下采访，补充环境与非语言细节。整体完成质量良好。',
		reviewerId: userA.id,
	});

	await markViewed(taskHist2.id, userB.id, "2026-03-11T09:00:00.000Z");
	await markViewed(taskHist2.id, userC.id, "2026-03-12T14:00:00.000Z");

	// ── 班级五：张晓梅个人 — 草稿任务示例 ───────────────────────────────────
	// 找到张晓梅的个人班级
	const userAPersonalClass = await prisma.class.findFirst({
		where: { ownerId: userA.id, isPersonal: true },
		select: { id: true },
	});

	if (userAPersonalClass) {
		await upsertTask({
			classId: userAPersonalClass.id,
			createdBy: userA.id,
			title: "【草稿】下学期课程大纲初稿",
			startAtIso: "2026-03-01T00:00:00.000Z",
			dueAtIso: "2026-04-30T23:59:59.000Z",
			description: `# 下学期课程大纲（草稿）

> 注意：这是一份未完成的草稿，尚未发布给学生。

## 拟定课题

1. 第一周：旅游业供需模型概述
2. 第二周：目的地品牌塑造与 DMO 实践
3. 第三周：可持续旅游认证体系对比（GSTC vs. 绿色旅游）
4. 第四周：…（待补充）

## 待办事项

- [ ] 补充第 4—8 周内容
- [ ] 联系行业导师确认实地参访日期
- [ ] 整理往届学生优秀报告作为案例库`,
			isPublished: false,
		});
	}

	await seedAiConfig();

	console.log("\n========================================");
	console.log("  本地开发数据注入完成");
	console.log("========================================");
	console.log("\n用户账号（密码均为 12345678）：");
	console.log("  张晓梅（教师）: zhang@example.com");
	console.log("  李明（学生）:   liming@example.com");
	console.log("  王芳（学生）:   wangfang@example.com");
	console.log("\n班级及邀请码：");
	console.log("  旅游管理实务:           DEV-TOURISM-2026");
	console.log("  现代汉语文学与创作:     DEV-LIT-2026");
	console.log("  金融市场分析基础:       DEV-FINANCE-2026");
	console.log("  校史研究与地方历史文献: DEV-HISTORY-2026");
	console.log("\n数据概览：");
	console.log("  - 4 个班级，每班 3 人（1 教师 + 2 学生）");
	console.log("  - 11 个已发布任务 + 1 个草稿任务");
	console.log("  - 9 份提交记录，7 份已评分");
	console.log("  - 含任务依赖（blockedBy）演示数据");
	console.log("========================================\n");
}

main()
	.catch((error) => {
		console.error("Dev seed failed:", error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
