import { useCallback, useEffect, useRef, useState } from "react";

const APP_URL = (import.meta.env.VITE_APP_URL ?? "").replace(/\/$/, "");
const DOCS_URL = import.meta.env.VITE_DOCS_URL ?? "";
const LINKS = {
	login: `${APP_URL}/login`,
	register: `${APP_URL}/register`,
	getStarted: `${APP_URL}/dashboard`,
	docs: DOCS_URL,
	terms: `${APP_URL}/terms`,
	privacy: `${APP_URL}/privacy`,
};

const PALETTE = [
	{ name: "数学", color: "#5B8C6A" },
	{ name: "物理", color: "#7B6CB0" },
	{ name: "文学", color: "#C4785B" },
	{ name: "历史", color: "#5886A5" },
	{ name: "计算机", color: "#8B7355" },
	{ name: "艺术", color: "#B07090" },
];

function useInView() {
	const ref = useRef(null);
	const [entered, setEntered] = useState(false);
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const ob = new IntersectionObserver(
			([e]) => {
				if (e.intersectionRatio > 0.08) setEntered(true);
			},
			{ threshold: [0, 0.08, 0.2] },
		);
		ob.observe(el);
		return () => ob.disconnect();
	}, []);
	return { ref, entered };
}

function useScrollProgress() {
	const ref = useRef(null);
	const [progress, setProgress] = useState(0);
	useEffect(() => {
		const handler = () => {
			if (!ref.current) return;
			const rect = ref.current.getBoundingClientRect();
			const vh = window.innerHeight;
			setProgress(
				Math.max(0, Math.min(1, (vh - rect.top) / (vh + rect.height))),
			);
		};
		window.addEventListener("scroll", handler, { passive: true });
		handler();
		return () => window.removeEventListener("scroll", handler);
	}, []);
	return { ref, progress };
}

function Reveal({ children, delay = 0, direction = "up", style = {} }) {
	const { ref, entered } = useInView();
	const offsets = {
		up: "translateY(48px)",
		down: "translateY(-48px)",
		left: "translateX(60px)",
		right: "translateX(-60px)",
	};
	return (
		<div
			ref={ref}
			style={{
				...style,
				opacity: entered ? 1 : 0,
				transform: entered ? "translate(0,0)" : offsets[direction],
				transition: `opacity 0.8s cubic-bezier(.16,1,.3,1) ${delay}s, transform 0.8s cubic-bezier(.16,1,.3,1) ${delay}s`,
			}}
		>
			{children}
		</div>
	);
}

const FeatureIcons = {
	Workflow: ({ color }) => (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<circle cx="5" cy="6" r="3" />
			<circle cx="19" cy="6" r="3" />
			<circle cx="12" cy="18" r="3" />
			<line x1="5" y1="9" x2="12" y2="15" />
			<line x1="19" y1="9" x2="12" y2="15" />
		</svg>
	),
	Grading: ({ color }) => (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M9 11l3 3L22 4" />
			<path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
		</svg>
	),
	Sync: ({ color }) => (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<polyline points="17 1 21 5 17 9" />
			<path d="M3 11V9a4 4 0 014-4h14" />
			<polyline points="7 23 3 19 7 15" />
			<path d="M21 13v2a4 4 0 01-4 4H3" />
		</svg>
	),
};

function FeishuLogo({ s = 36 }) {
	return (
		<svg width={s} height={s} viewBox="0 0 48 48" fill="none">
			<path d="M8 14l14 8-4 14L8 28V14z" fill="#3370FF" />
			<path d="M22 22l14-8v14l-10 8-4-14z" fill="#00D6B9" />
			<path d="M22 22l-4 14 10 0 10-8-14-8-2 2z" fill="#0FC6C2" opacity=".7" />
		</svg>
	);
}
function SlackLogo({ s = 36 }) {
	return (
		<svg width={s} height={s} viewBox="0 0 48 48" fill="none">
			<path
				d="M19 10a3 3 0 10-3 3h3v-3zm0 4H10a3 3 0 100 6h9v-6z"
				fill="#E01E5A"
			/>
			<path
				d="M38 17a3 3 0 10-3-3v3h3zm-4 0h-9v6h9a3 3 0 100-6z"
				fill="#36C5F0"
			/>
			<path
				d="M31 38a3 3 0 10-3-3h-3v3h6zm-6-4V25h-6v9a3 3 0 006 0z"
				fill="#2EB67D"
			/>
			<path
				d="M10 31a3 3 0 106 0v-3h-3a3 3 0 00-3 3zm4-4h9v-6H14a3 3 0 000 6z"
				fill="#ECB22E"
			/>
		</svg>
	);
}
function EvernoteLogo({ s = 36 }) {
	return (
		<svg width={s} height={s} viewBox="0 0 48 48" fill="none">
			<path
				d="M24 6C14 6 10 16 10 24s4 18 14 18 14-8 14-18S34 6 24 6z"
				fill="#00A82D"
				opacity=".85"
			/>
			<path d="M21 18h6v4h-6v-4zm0 8h8v2h-8v-2zm0 5h6v2h-6v-2z" fill="#fff" />
		</svg>
	);
}
function NotionLogo({ s = 36 }) {
	return (
		<svg width={s} height={s} viewBox="0 0 48 48" fill="none">
			<rect
				x="10"
				y="8"
				width="28"
				height="32"
				rx="4"
				stroke="#333"
				strokeWidth="2.5"
				fill="none"
			/>
			<path d="M16 16h8l6 6v10H16V16z" fill="#333" opacity=".12" />
			<path
				d="M16 16h8v6h6"
				stroke="#333"
				strokeWidth="1.5"
				fill="none"
				strokeLinejoin="round"
			/>
			<line x1="16" y1="28" x2="30" y2="28" stroke="#333" strokeWidth="1.5" />
			<line x1="16" y1="24" x2="26" y2="24" stroke="#333" strokeWidth="1.5" />
		</svg>
	);
}
function GmailLogo({ s = 36 }) {
	return (
		<svg width={s} height={s} viewBox="0 0 48 48" fill="none">
			<rect
				x="8"
				y="12"
				width="32"
				height="24"
				rx="3"
				fill="#fff"
				stroke="#E0E0E0"
				strokeWidth="1.5"
			/>
			<path
				d="M8 15l16 11 16-11"
				stroke="#D44638"
				strokeWidth="2.5"
				fill="none"
				strokeLinejoin="round"
			/>
			<path d="M8 15v18l10-9z" fill="#D44638" opacity=".25" />
			<path d="M40 15v18l-10-9z" fill="#D44638" opacity=".25" />
		</svg>
	);
}
function DingTalkLogo({ s = 36 }) {
	return (
		<svg width={s} height={s} viewBox="0 0 48 48" fill="none">
			<circle cx="24" cy="24" r="16" fill="#3089EC" opacity=".85" />
			<path
				d="M30 18l-6 8h4l-6 8 2-5h-4l4-8h-4l6-6z"
				fill="#fff"
				fillOpacity=".95"
			/>
		</svg>
	);
}

const INTEGRATIONS = [
	{
		name: "飞书",
		Logo: FeishuLogo,
		desc: "将任务和班级动态实时同步到飞书群组。",
	},
	{
		name: "Slack",
		Logo: SlackLogo,
		desc: "向 Slack 频道推送作业提醒和截止通知。",
	},
	{
		name: "印象笔记",
		Logo: EvernoteLogo,
		desc: "导入学习笔记，自动关联到对应作业。",
	},
	{
		name: "Notion",
		Logo: NotionLogo,
		desc: "与 Notion 数据库和看板进行双向同步。",
	},
	{
		name: "Gmail",
		Logo: GmailLogo,
		desc: "自动发送作业摘要和截止日期提醒邮件。",
	},
	{
		name: "钉钉",
		Logo: DingTalkLogo,
		desc: "通过钉钉工作流发布任务并收集提交。",
	},
];

const AI_EXAMPLES = [
	{
		input:
			"学生需要在下周五之前提交关于现代主义诗歌的论文，这个周末可以开始写。",
		output: {
			task: "论文：现代主义诗歌",
			start: "3月15日",
			due: "3月21日",
			cls: "英语文学",
			color: "#C4785B",
		},
	},
	{
		input: "波动干涉实验报告两周后截止，学生可以在周三实验结束后开始写。",
		output: {
			task: "实验报告：波动干涉",
			start: "3月19日",
			due: "4月2日",
			cls: "物理实验",
			color: "#7B6CB0",
		},
	},
	{
		input: "完成微积分练习 5.1-5.8，关于积分的内容。今天布置，下周四截止。",
		output: {
			task: "微积分练习 5.1-5.8",
			start: "3月18日",
			due: "3月26日",
			cls: "高等数学",
			color: "#5B8C6A",
		},
	},
];

const GANTT_TASKS = [
	{ title: "研究论文初稿", color: "#5B8C6A", start: 0, width: 28 },
	{ title: "物理实验报告", color: "#7B6CB0", start: 5, width: 18 },
	{ title: "诗歌分析论文", color: "#C4785B", start: 10, width: 22 },
	{ title: "历史课堂展示", color: "#5886A5", start: 2, width: 30 },
	{ title: "算法作业", color: "#8B7355", start: 15, width: 20 },
	{ title: "雕塑作品集", color: "#B07090", start: 8, width: 25 },
	{ title: "微积分习题集", color: "#5B8C6A", start: 20, width: 15 },
	{ title: "电路实验分析", color: "#7B6CB0", start: 12, width: 24 },
	{ title: "读书报告", color: "#C4785B", start: 25, width: 14 },
	{ title: "二战纪录片笔记", color: "#5886A5", start: 18, width: 20 },
];

const DAYS = [
	"3月1日",
	"3月4日",
	"3月7日",
	"3月10日",
	"3月13日",
	"3月16日",
	"3月19日",
	"3月22日",
	"3月25日",
	"3月28日",
	"3月31日",
	"4月3日",
	"4月6日",
	"4月9日",
];

export default function LandingPage() {
	const [activeColor, setActiveColor] = useState(PALETTE[1].color);
	const [aiExample, setAiExample] = useState(0);
	const [aiTyping, setAiTyping] = useState(false);
	const [aiDone, setAiDone] = useState(true);
	const [hoveredIntg, setHoveredIntg] = useState(null);
	const [mcpAutoIdx, setMcpAutoIdx] = useState(0);
	const [isMobile, setIsMobile] = useState(false);
	const ganttScroll = useScrollProgress();

	useEffect(() => {
		const check = () => setIsMobile(window.innerWidth < 900);
		check();
		window.addEventListener("resize", check);
		return () => window.removeEventListener("resize", check);
	}, []);

	useEffect(() => {
		if (hoveredIntg !== null) return;
		const timer = setInterval(
			() => setMcpAutoIdx((p) => (p + 1) % INTEGRATIONS.length),
			2800,
		);
		return () => clearInterval(timer);
	}, [hoveredIntg]);

	const activeLineIdx = hoveredIntg !== null ? hoveredIntg : mcpAutoIdx;

	const cycleAi = useCallback(() => {
		setAiTyping(true);
		setAiDone(false);
		setTimeout(() => {
			setAiTyping(false);
			setAiDone(true);
		}, 1600);
		setAiExample((p) => (p + 1) % AI_EXAMPLES.length);
	}, []);

	const bg = "#faf7f2";
	const textPrimary = "#2c2825";
	const textSecondary = "#8a8078";
	const textMuted = "#c0b8ad";
	const borderColor = "#e8e2d8";
	const cardBg = "#fffdf8";
	const ganttOffset = ganttScroll.progress * (isMobile ? -200 : -520);

	return (
		<div
			style={{
				background: bg,
				color: textPrimary,
				fontFamily: "'DM Sans', sans-serif",
				overflowX: "hidden",
				minHeight: "100vh",
			}}
		>
			<style>{`
* { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { background: #faf7f2; }
        ::selection { background: ${activeColor}30; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #ddd5c8; border-radius: 10px; }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes pulseRing { 0%{transform:scale(1);opacity:.5} 100%{transform:scale(2.2);opacity:0} }
        @keyframes cursorBlink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes fadeSlideUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .hover-lift { transition: transform 0.35s cubic-bezier(.16,1,.3,1), box-shadow 0.35s ease; }
        .hover-lift:hover { transform: translateY(-6px); box-shadow: 0 16px 48px rgba(0,0,0,0.08); }
      `}</style>

			{/* NAV */}
			<nav
				style={{
					position: "fixed",
					top: 0,
					left: 0,
					right: 0,
					zIndex: 100,
					padding: isMobile ? "12px 20px" : "12px 56px",
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					background: "rgba(250,247,242,0.8)",
					backdropFilter: "blur(16px) saturate(1.8)",
					borderBottom: `1px solid ${borderColor}`,
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
					<div
						style={{
							width: 30,
							height: 30,
							borderRadius: 9,
							background: `linear-gradient(135deg, ${activeColor}, ${activeColor}88)`,
							transition: "background 0.6s",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="#fff"
							strokeWidth="2.5"
						>
							<path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
							<path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
						</svg>
					</div>
					<span
						style={{
							fontSize: 17,
							fontWeight: 700,
							fontFamily: "'Source Serif 4', Georgia, serif",
							letterSpacing: "-0.02em",
						}}
					>
						TaskNeo
					</span>
					<span
						style={{
							fontSize: 10,
							fontWeight: 600,
							color: activeColor,
							background: `${activeColor}12`,
							padding: "2px 8px",
							borderRadius: 5,
							marginLeft: 4,
							transition: "all 0.5s",
							letterSpacing: "0.04em",
						}}
					>
						BETA
					</span>
				</div>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: isMobile ? 12 : 28,
					}}
				>
					{!isMobile &&
						["功能特性", "生态集成", "关于我们"].map((l, i) => (
							<a
								key={l}
								href={`#sec${i}`}
								style={{
									fontSize: 13,
									fontWeight: 500,
									color: textSecondary,
									textDecoration: "none",
									transition: "color 0.2s",
									fontFamily: "'Noto Sans SC', sans-serif",
								}}
								onMouseEnter={(e) => (e.target.style.color = activeColor)}
								onMouseLeave={(e) => (e.target.style.color = textSecondary)}
							>
								{l}
							</a>
						))}
					<div style={{ display: "flex", gap: 8 }}>
						<a
							href={LINKS.register}
							style={{
								padding: "8px 18px",
								borderRadius: 9,
								border: `1.5px solid ${borderColor}`,
								background: "transparent",
								color: textSecondary,
								fontSize: 13,
								fontWeight: 500,
								cursor: "pointer",
								fontFamily: "'Noto Sans SC', sans-serif",
								textDecoration: "none",
								display: "flex",
								alignItems: "center",
							}}
						>
							注册
						</a>
						<a
							href={LINKS.login}
							style={{
								padding: "8px 18px",
								borderRadius: 9,
								border: "none",
								background: activeColor,
								color: "#fff",
								fontSize: 13,
								fontWeight: 600,
								cursor: "pointer",
								fontFamily: "'Noto Sans SC', sans-serif",
								transition: "background 0.5s",
								boxShadow: `0 2px 14px ${activeColor}30`,
								textDecoration: "none",
								display: "flex",
								alignItems: "center",
							}}
						>
							登录
						</a>
					</div>
				</div>
			</nav>

			{/* HERO */}
			<section
				style={{
					minHeight: "100vh",
					display: "flex",
					flexDirection: "column",
					justifyContent: "center",
					position: "relative",
					overflow: "hidden",
					padding: isMobile ? "110px 28px 60px" : "100px 56px 80px",
				}}
			>
				{PALETTE.map((p, i) => (
					<div
						key={i}
						onMouseEnter={() => setActiveColor(p.color)}
						style={{
							position: "absolute",
							width: isMobile ? 100 : 180,
							height: isMobile ? 100 : 180,
							borderRadius: "50%",
							background: `radial-gradient(circle, ${p.color}18, transparent 70%)`,
							top: `${12 + (i % 3) * 25}%`,
							left: `${3 + i * 16}%`,
							animation: `float 3.5s ease-in-out ${i * 0.5}s infinite`,
							cursor: "default",
							zIndex: 0,
						}}
					/>
				))}

				<div
					style={{
						position: "relative",
						zIndex: 1,
						width: "100%",
						maxWidth: 1400,
						margin: "0 auto",
						display: "flex",
						flexDirection: isMobile ? "column" : "row",
						alignItems: isMobile ? "center" : "center",
						gap: isMobile ? 40 : 60,
						textAlign: isMobile ? "center" : "left",
					}}
				>
					<div
						style={{
							flex: 1,
							maxWidth: isMobile ? "100%" : 640,
							display: "flex",
							flexDirection: "column",
							alignItems: isMobile ? "center" : "flex-start",
						}}
					>
						<Reveal delay={0}>
							<div
								style={{
									display: "inline-flex",
									alignItems: "center",
									gap: 8,
									padding: "6px 16px",
									borderRadius: 20,
									background: `${activeColor}10`,
									border: `1px solid ${activeColor}25`,
									marginBottom: 28,
									transition: "all 0.5s",
								}}
							>
								<div
									style={{
										width: 6,
										height: 6,
										borderRadius: "50%",
										background: activeColor,
										transition: "background 0.5s",
									}}
								/>
								<span
									style={{
										fontSize: 11,
										fontWeight: 600,
										color: activeColor,
										letterSpacing: "0.04em",
										transition: "color 0.5s",
										fontFamily: "'Noto Sans SC', sans-serif",
									}}
								>
									公测中
								</span>
							</div>
						</Reveal>
						<Reveal delay={0.08}>
							<h1
								style={{
									fontSize: isMobile ? 36 : 64,
									fontWeight: 700,
									fontFamily:
										"'Noto Serif SC', 'Source Serif 4', Georgia, serif",
									letterSpacing: "-0.02em",
									lineHeight: 1.2,
									marginBottom: 24,
								}}
							>
								让教学
								<br />
								回归
								<span style={{ color: activeColor, transition: "color 0.5s" }}>
									清晰
								</span>
							</h1>
						</Reveal>
						<Reveal delay={0.16}>
							<p
								style={{
									fontSize: isMobile ? 15 : 17,
									color: textSecondary,
									lineHeight: 1.85,
									maxWidth: 480,
									marginBottom: 36,
									fontFamily: "'Noto Sans SC', sans-serif",
								}}
							>
								一个简洁、专注的工作空间。教师用自然语言创建作业，学生一目了然地看到所有任务——分类清晰、颜色编码、按时完成。
							</p>
						</Reveal>
						<Reveal delay={0.24}>
							<div
								style={{
									display: "flex",
									gap: 12,
									flexWrap: "wrap",
									justifyContent: isMobile ? "center" : "flex-start",
								}}
							>
								<a
									href={LINKS.getStarted}
									style={{
										padding: "14px 36px",
										borderRadius: 12,
										border: "none",
										background: activeColor,
										color: "#fff",
										fontSize: 15,
										fontWeight: 600,
										cursor: "pointer",
										fontFamily: "'Noto Sans SC', sans-serif",
										transition: "all 0.5s",
										boxShadow: `0 4px 24px ${activeColor}30`,
										textDecoration: "none",
										display: "inline-block",
									}}
								>
									开始使用
								</a>
								<a
									href={LINKS.docs}
									style={{
										padding: "14px 36px",
										borderRadius: 12,
										border: `1.5px solid ${borderColor}`,
										background: "transparent",
										color: textSecondary,
										fontSize: 15,
										fontWeight: 500,
										cursor: "pointer",
										fontFamily: "'Noto Sans SC', sans-serif",
										textDecoration: "none",
										display: "inline-block",
									}}
								>
									阅读文档
								</a>
							</div>
						</Reveal>
						<Reveal delay={0.35}>
							<div
								style={{
									display: "flex",
									gap: 8,
									marginTop: 44,
									justifyContent: isMobile ? "center" : "flex-start",
								}}
							>
								{PALETTE.map((p, i) => (
									<div
										key={i}
										onMouseEnter={() => setActiveColor(p.color)}
										style={{
											width: activeColor === p.color ? 28 : 10,
											height: 10,
											borderRadius: 5,
											background: p.color,
											cursor: "pointer",
											transition: "all 0.4s cubic-bezier(.16,1,.3,1)",
											opacity: activeColor === p.color ? 1 : 0.35,
										}}
									/>
								))}
							</div>
						</Reveal>
					</div>

					{/* Desktop only preview card */}
					{!isMobile && (
						<Reveal
							delay={0.2}
							direction="left"
							style={{ flex: 1, display: "flex", justifyContent: "center" }}
						>
							<div
								style={{
									width: "100%",
									maxWidth: 520,
									borderRadius: 16,
									overflow: "hidden",
									background: cardBg,
									border: `1px solid ${borderColor}`,
									boxShadow: "0 12px 48px rgba(0,0,0,0.06)",
								}}
							>
								<div
									style={{
										padding: "14px 20px",
										borderBottom: `1px solid ${borderColor}`,
										display: "flex",
										alignItems: "center",
										gap: 8,
									}}
								>
									<div
										style={{
											width: 10,
											height: 10,
											borderRadius: "50%",
											background: "#e8e2d8",
										}}
									/>
									<div
										style={{
											width: 10,
											height: 10,
											borderRadius: "50%",
											background: "#e8e2d8",
										}}
									/>
									<div
										style={{
											width: 10,
											height: 10,
											borderRadius: "50%",
											background: "#e8e2d8",
										}}
									/>
									<div style={{ flex: 1 }} />
									<div
										style={{
											width: 80,
											height: 6,
											borderRadius: 3,
											background: "#e8e2d8",
										}}
									/>
								</div>
								<div style={{ display: "flex", height: 260 }}>
									<div
										style={{
											width: 60,
											borderRight: `1px solid ${borderColor}`,
											padding: "12px 8px",
											display: "flex",
											flexDirection: "column",
											gap: 6,
										}}
									>
										{PALETTE.map((p, i) => (
											<div
												key={i}
												style={{
													width: "100%",
													height: 6,
													borderRadius: 3,
													background: p.color,
													opacity: 0.5,
												}}
											/>
										))}
									</div>
									<div
										style={{
											flex: 1,
											padding: "14px 16px",
											overflow: "hidden",
										}}
									>
										<div
											style={{
												width: 100,
												height: 8,
												borderRadius: 4,
												background: textPrimary,
												opacity: 0.15,
												marginBottom: 12,
											}}
										/>
										{GANTT_TASKS.slice(0, 5).map((t, i) => (
											<div
												key={i}
												style={{
													display: "flex",
													alignItems: "center",
													gap: 8,
													height: 36,
												}}
											>
												<div
													style={{
														width: 5,
														height: 5,
														borderRadius: "50%",
														background: t.color,
														flexShrink: 0,
													}}
												/>
												<div
													style={{
														width: 50,
														height: 5,
														borderRadius: 3,
														background: textPrimary,
														opacity: 0.08,
													}}
												/>
												<div
													style={{
														marginLeft: t.start * 3,
														width: t.width * 2.5,
														height: 14,
														borderRadius: 4,
														background: `${t.color}30`,
													}}
												/>
											</div>
										))}
									</div>
								</div>
							</div>
						</Reveal>
					)}
				</div>

				<div
					style={{
						position: isMobile ? "relative" : "absolute",
						bottom: isMobile ? 0 : 28,
						left: "50%",
						transform: "translateX(-50%)",
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						gap: 8,
						opacity: 0.35,
						paddingTop: isMobile ? 28 : 0,
						paddingBottom: isMobile ? 10 : 0,
					}}
				>
					<span
						style={{
							fontSize: 9,
							fontWeight: 700,
							letterSpacing: "0.12em",
							color: textMuted,
							textTransform: "uppercase",
						}}
					>
						向下滚动
					</span>
					<svg
						width="14"
						height="22"
						viewBox="0 0 16 24"
						fill="none"
						stroke={textMuted}
						strokeWidth="1.5"
					>
						<rect x="4" y="1" width="8" height="14" rx="4" />
						<line x1="8" y1="5" x2="8" y2="8" strokeLinecap="round">
							<animate
								attributeName="y1"
								values="4;7;4"
								dur="1.5s"
								repeatCount="indefinite"
							/>
							<animate
								attributeName="y2"
								values="7;10;7"
								dur="1.5s"
								repeatCount="indefinite"
							/>
						</line>
					</svg>
				</div>
			</section>

			{/* AI PARSING */}
			<section
				id="sec0"
				style={{ padding: isMobile ? "80px 20px" : "120px 56px" }}
			>
				<div
					style={{
						maxWidth: 1400,
						margin: "0 auto",
						display: "flex",
						flexDirection: isMobile ? "column" : "row",
						alignItems: "center",
						gap: isMobile ? 36 : 64,
					}}
				>
					<Reveal
						delay={0.1}
						direction="right"
						style={{ flex: 1.15, minWidth: 0 }}
					>
						<div
							onMouseEnter={cycleAi}
							className="hover-lift"
							style={{
								background: cardBg,
								borderRadius: 16,
								border: `1px solid ${borderColor}`,
								overflow: "hidden",
								cursor: "default",
								boxShadow: "0 4px 32px rgba(0,0,0,0.04)",
							}}
						>
							<div
								style={{
									padding: isMobile ? "24px 20px" : "28px 32px",
									borderBottom: `1px solid ${borderColor}`,
								}}
							>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: 8,
										marginBottom: 14,
									}}
								>
									<div
										style={{
											width: 8,
											height: 8,
											borderRadius: "50%",
											background: activeColor,
											transition: "background 0.5s",
										}}
									/>
									<span
										style={{
											fontSize: 10,
											fontWeight: 700,
											color: textMuted,
											letterSpacing: "0.06em",
											textTransform: "uppercase",
										}}
									>
										教师输入
									</span>
								</div>
								<p
									style={{
										fontSize: isMobile ? 15 : 17,
										lineHeight: 1.8,
										color: textPrimary,
										fontFamily:
											"'Noto Serif SC', 'Source Serif 4', Georgia, serif",
										fontWeight: 400,
										fontStyle: "italic",
										minHeight: 48,
										transition: "opacity 0.3s",
										opacity: aiTyping ? 0.3 : 1,
									}}
								>
									"{AI_EXAMPLES[aiExample].input}"
								</p>
							</div>
							<div
								style={{
									padding: isMobile ? "24px 20px" : "28px 32px",
									background: `${activeColor}04`,
									transition: "background 0.5s",
								}}
							>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: 8,
										marginBottom: 16,
									}}
								>
									<svg
										width="15"
										height="15"
										viewBox="0 0 24 24"
										fill="none"
										stroke={activeColor}
										strokeWidth="2"
										style={{ transition: "stroke 0.5s" }}
									>
										<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
									</svg>
									<span
										style={{
											fontSize: 10,
											fontWeight: 700,
											color: activeColor,
											letterSpacing: "0.06em",
											textTransform: "uppercase",
											transition: "color 0.5s",
										}}
									>
										AI 解析结果
									</span>
									{aiTyping && (
										<span
											style={{ fontSize: 11, color: textMuted, marginLeft: 6 }}
										>
											解析中
											<span style={{ animation: "cursorBlink 1s infinite" }}>
												...
											</span>
										</span>
									)}
								</div>
								<div
									style={{
										display: "grid",
										gridTemplateColumns: "1fr 1fr",
										gap: 12,
										opacity: aiDone ? 1 : 0.2,
										transform: aiDone ? "translateY(0)" : "translateY(6px)",
										transition: "all 0.5s cubic-bezier(.16,1,.3,1)",
									}}
								>
									{[
										{
											label: "任务名称",
											value: AI_EXAMPLES[aiExample].output.task,
										},
										{
											label: "所属班级",
											value: AI_EXAMPLES[aiExample].output.cls,
										},
										{
											label: "开始日期",
											value: AI_EXAMPLES[aiExample].output.start,
										},
										{
											label: "截止日期",
											value: AI_EXAMPLES[aiExample].output.due,
										},
									].map((f, i) => (
										<div
											key={i}
											style={{
												padding: "12px 16px",
												borderRadius: 10,
												background: cardBg,
												border: `1px solid ${borderColor}`,
											}}
										>
											<div
												style={{
													fontSize: 9,
													fontWeight: 700,
													color: textMuted,
													textTransform: "uppercase",
													letterSpacing: "0.06em",
													marginBottom: 5,
													fontFamily: "'Noto Sans SC', sans-serif",
												}}
											>
												{f.label}
											</div>
											<div
												style={{
													fontSize: 13,
													fontWeight: 600,
													color:
														f.label === "所属班级"
															? AI_EXAMPLES[aiExample].output.color
															: textPrimary,
													transition: "color 0.4s",
													fontFamily: "'Noto Sans SC', sans-serif",
												}}
											>
												{f.label === "所属班级" && (
													<span
														style={{
															display: "inline-block",
															width: 7,
															height: 7,
															borderRadius: 3,
															background: AI_EXAMPLES[aiExample].output.color,
															marginRight: 7,
															verticalAlign: "middle",
														}}
													/>
												)}
												{f.value}
											</div>
										</div>
									))}
								</div>
								<p
									style={{
										fontSize: 11,
										color: textMuted,
										marginTop: 14,
										textAlign: "center",
										fontFamily: "'Noto Sans SC', sans-serif",
									}}
								>
									悬停查看更多示例
								</p>
							</div>
						</div>
					</Reveal>

					<div style={{ flex: 1, minWidth: 0 }}>
						<Reveal>
							<span
								style={{
									fontSize: 11,
									fontWeight: 700,
									color: activeColor,
									letterSpacing: "0.1em",
									textTransform: "uppercase",
									transition: "color 0.5s",
								}}
							>
								智能输入
							</span>
						</Reveal>
						<Reveal delay={0.06}>
							<h2
								style={{
									fontSize: isMobile ? 28 : 42,
									fontWeight: 700,
									fontFamily:
										"'Noto Serif SC', 'Source Serif 4', Georgia, serif",
									letterSpacing: "-0.01em",
									marginTop: 14,
									lineHeight: 1.3,
									marginBottom: 20,
								}}
							>
								用自然语言描述，
								<br />
								剩下的交给 AI。
							</h2>
						</Reveal>
						<Reveal delay={0.12}>
							<p
								style={{
									fontSize: 15,
									color: textSecondary,
									lineHeight: 1.8,
									marginBottom: 28,
									maxWidth: 440,
									fontFamily: "'Noto Sans SC', sans-serif",
								}}
							>
								像平时说话一样输入作业要求，AI
								自动提取任务名称、截止日期和班级信息，一键生成结构化任务。
							</p>
						</Reveal>
						<Reveal delay={0.18}>
							<div
								style={{ display: "flex", flexDirection: "column", gap: 14 }}
							>
								{[
									"自然语言自动转换为结构化任务",
									"智能识别日期、时长和班级",
									"支持 12 种语言",
								].map((t, i) => (
									<div
										key={i}
										style={{ display: "flex", alignItems: "center", gap: 10 }}
									>
										<div
											style={{
												width: 22,
												height: 22,
												borderRadius: 6,
												background: `${activeColor}12`,
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
												transition: "background 0.5s",
												flexShrink: 0,
											}}
										>
											<svg
												width="12"
												height="12"
												viewBox="0 0 24 24"
												fill="none"
												stroke={activeColor}
												strokeWidth="3"
												strokeLinecap="round"
												strokeLinejoin="round"
												style={{ transition: "stroke 0.5s" }}
											>
												<polyline points="20 6 9 17 4 12" />
											</svg>
										</div>
										<span
											style={{
												fontSize: 14,
												color: textPrimary,
												fontWeight: 500,
												fontFamily: "'Noto Sans SC', sans-serif",
											}}
										>
											{t}
										</span>
									</div>
								))}
							</div>
						</Reveal>
					</div>
				</div>
			</section>

			{/* GANTT */}
			<section
				ref={ganttScroll.ref}
				style={{ padding: isMobile ? "80px 0" : "120px 0", overflow: "hidden" }}
			>
				<div
					style={{
						maxWidth: 1400,
						margin: "0 auto",
						padding: isMobile ? "0 20px" : "0 56px",
					}}
				>
					<div
						style={{
							display: "flex",
							flexDirection: isMobile ? "column" : "row",
							alignItems: isMobile ? "flex-start" : "flex-end",
							gap: isMobile ? 16 : 48,
							marginBottom: isMobile ? 32 : 48,
						}}
					>
						<div style={{ flex: 1 }}>
							<Reveal>
								<span
									style={{
										fontSize: 11,
										fontWeight: 700,
										color: activeColor,
										letterSpacing: "0.1em",
										textTransform: "uppercase",
										transition: "color 0.5s",
									}}
								>
									可视化时间线
								</span>
								<h2
									style={{
										fontSize: isMobile ? 28 : 42,
										fontWeight: 700,
										fontFamily:
											"'Noto Serif SC', 'Source Serif 4', Georgia, serif",
										letterSpacing: "-0.01em",
										marginTop: 14,
										lineHeight: 1.3,
									}}
								>
									每项任务，清晰排列在时间轴上。
								</h2>
							</Reveal>
						</div>
						<Reveal delay={0.1} style={{ flex: 1 }}>
							<p
								style={{
									fontSize: 15,
									color: textSecondary,
									lineHeight: 1.8,
									maxWidth: 460,
									fontFamily: "'Noto Sans SC', sans-serif",
								}}
							>
								按班级颜色编码，按日期排列。甘特图让学生和教师一目了然地看到即将到来和已逾期的任务。
							</p>
						</Reveal>
					</div>
				</div>
				<div
					style={{
						transform: `translateX(${ganttOffset}px)`,
						transition: "transform 0.08s linear",
						padding: isMobile ? "0 20px" : "0 56px",
						willChange: "transform",
					}}
				>
					<div
						style={{
							display: "flex",
							gap: 0,
							marginBottom: 8,
							paddingLeft: isMobile ? 120 : 200,
						}}
					>
						{DAYS.map((d, i) => (
							<div
								key={i}
								style={{
									width: isMobile ? 70 : 110,
									flexShrink: 0,
									fontSize: 10,
									color: textMuted,
									fontWeight: 500,
								}}
							>
								{d}
							</div>
						))}
					</div>
					<div style={{ position: "relative" }}>
						<div
							style={{
								position: "absolute",
								left: isMobile ? `${120 + 6 * 70}px` : `${200 + 6 * 110}px`,
								top: -4,
								bottom: -4,
								width: 2,
								background: "#d6394c",
								opacity: 0.5,
								zIndex: 2,
							}}
						/>
						<div
							style={{
								position: "absolute",
								left: isMobile
									? `${120 + 6 * 70 - 14}px`
									: `${200 + 6 * 110 - 14}px`,
								top: -20,
								fontSize: 9,
								fontWeight: 700,
								color: "#fff",
								background: "#d6394c",
								padding: "2px 8px",
								borderRadius: 4,
								letterSpacing: "0.04em",
								zIndex: 3,
								fontFamily: "'Noto Sans SC', sans-serif",
							}}
						>
							今天
						</div>
						{GANTT_TASKS.map((task, i) => (
							<div
								key={i}
								style={{
									display: "flex",
									alignItems: "center",
									height: 44,
									borderBottom: `1px solid ${borderColor}`,
								}}
							>
								<div
									style={{
										width: isMobile ? 120 : 200,
										flexShrink: 0,
										display: "flex",
										alignItems: "center",
										gap: 10,
										paddingRight: 12,
									}}
								>
									<div
										style={{
											width: 8,
											height: 8,
											borderRadius: "50%",
											background: task.color,
											flexShrink: 0,
										}}
									/>
									<span
										style={{
											fontSize: 12,
											fontWeight: 500,
											whiteSpace: "nowrap",
											overflow: "hidden",
											textOverflow: "ellipsis",
											fontFamily: "'Noto Sans SC', sans-serif",
										}}
									>
										{task.title}
									</span>
								</div>
								<div
									style={{
										flex: 1,
										position: "relative",
										height: "100%",
										display: "flex",
										alignItems: "center",
									}}
								>
									<div
										style={{
											position: "absolute",
											left: (task.start * (isMobile ? 70 : 110)) / 3,
											width: (task.width * (isMobile ? 70 : 110)) / 3,
											height: 24,
											borderRadius: 6,
											background: `${task.color}25`,
											display: "flex",
											alignItems: "center",
											paddingLeft: 10,
										}}
									>
										<span
											style={{
												fontSize: 10,
												fontWeight: 600,
												color: task.color,
												whiteSpace: "nowrap",
											}}
										>
											{Math.ceil(task.width / 3)}天
										</span>
									</div>
								</div>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* MCP INTEGRATIONS */}
			<section
				id="sec1"
				style={{ padding: isMobile ? "80px 20px" : "120px 56px" }}
			>
				<div
					style={{
						maxWidth: 1400,
						margin: "0 auto",
						display: "flex",
						flexDirection: isMobile ? "column" : "row",
						alignItems: isMobile ? "stretch" : "center",
						gap: isMobile ? 40 : 72,
					}}
				>
					<div style={{ flex: 1, minWidth: 0 }}>
						<Reveal>
							<span
								style={{
									fontSize: 11,
									fontWeight: 700,
									color: activeColor,
									letterSpacing: "0.1em",
									textTransform: "uppercase",
									transition: "color 0.5s",
								}}
							>
								互联互通
							</span>
						</Reveal>
						<Reveal delay={0.06}>
							<h2
								style={{
									fontSize: isMobile ? 28 : 42,
									fontWeight: 700,
									fontFamily:
										"'Noto Serif SC', 'Source Serif 4', Georgia, serif",
									letterSpacing: "-0.01em",
									marginTop: 14,
									lineHeight: 1.3,
									marginBottom: 20,
								}}
							>
								无缝连接你已有的工具。
							</h2>
						</Reveal>
						<Reveal delay={0.12}>
							<p
								style={{
									fontSize: 15,
									color: textSecondary,
									lineHeight: 1.8,
									maxWidth: 440,
									marginBottom: 24,
									fontFamily: "'Noto Sans SC', sans-serif",
								}}
							>
								通过{" "}
								<strong style={{ color: textPrimary }}>
									MCP（模型上下文协议）
								</strong>
								，TaskNeo
								与你现有的工具栈原生对话。任务、截止日期和反馈在各平台间自动流转。
							</p>
						</Reveal>
						<Reveal delay={0.16}>
							<div
								style={{
									padding: "16px 20px",
									borderRadius: 12,
									background: `${activeColor}06`,
									border: `1px solid ${activeColor}15`,
									marginBottom: 28,
									transition: "all 0.5s",
								}}
							>
								<div
									style={{
										fontSize: 11,
										fontWeight: 700,
										color: activeColor,
										letterSpacing: "0.04em",
										marginBottom: 8,
										transition: "color 0.5s",
									}}
								>
									什么是 MCP？
								</div>
								<p
									style={{
										fontSize: 13,
										color: textSecondary,
										lineHeight: 1.8,
										fontFamily: "'Noto Sans SC', sans-serif",
									}}
								>
									模型上下文协议是一个连接 AI
									应用与外部工具的开放标准，实现跨平台的实时双向数据流转。
								</p>
							</div>
						</Reveal>
						<Reveal delay={0.22}>
							<div
								style={{ display: "flex", flexDirection: "column", gap: 16 }}
							>
								{[
									{
										Icon: FeatureIcons.Workflow,
										title: "自动规划任务工作流",
										desc: "AI 根据一段描述自动生成任务序列和依赖关系。",
									},
									{
										Icon: FeatureIcons.Grading,
										title: "智能批改辅助",
										desc: "学生提交的作业自动审阅，生成结构化反馈。",
									},
									{
										Icon: FeatureIcons.Sync,
										title: "全平台双向同步",
										desc: "Notion、Slack 或飞书中的变更即时同步回来。",
									},
								].map((f, i) => (
									<div
										key={i}
										style={{
											display: "flex",
											gap: 14,
											alignItems: "flex-start",
										}}
									>
										<div
											style={{
												width: 36,
												height: 36,
												borderRadius: 10,
												background: `${activeColor}10`,
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
												flexShrink: 0,
												transition: "background 0.5s",
											}}
										>
											<f.Icon color={activeColor} />
										</div>
										<div>
											<div
												style={{
													fontSize: 14,
													fontWeight: 700,
													color: textPrimary,
													marginBottom: 3,
													fontFamily: "'Noto Sans SC', sans-serif",
												}}
											>
												{f.title}
											</div>
											<div
												style={{
													fontSize: 13,
													color: textSecondary,
													lineHeight: 1.7,
													fontFamily: "'Noto Sans SC', sans-serif",
												}}
											>
												{f.desc}
											</div>
										</div>
									</div>
								))}
							</div>
						</Reveal>
					</div>

					<Reveal
						delay={0.1}
						direction="left"
						style={{
							flex: 1.1,
							minWidth: 0,
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
						}}
					>
						{isMobile ? (
							<div style={{ width: "100%" }}>
								<div
									style={{
										display: "flex",
										justifyContent: "center",
										marginBottom: 24,
									}}
								>
									<div
										style={{
											width: 60,
											height: 60,
											borderRadius: 16,
											background: `linear-gradient(135deg, ${activeColor}, ${activeColor}88)`,
											transition: "background 0.5s",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											boxShadow: `0 6px 24px ${activeColor}25`,
										}}
									>
										<svg
											width="26"
											height="26"
											viewBox="0 0 24 24"
											fill="none"
											stroke="#fff"
											strokeWidth="2"
										>
											<path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
											<path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
										</svg>
									</div>
								</div>
								<div
									style={{
										display: "grid",
										gridTemplateColumns: "1fr 1fr 1fr",
										gap: 10,
									}}
								>
									{INTEGRATIONS.map((intg, i) => {
										const isHov = hoveredIntg === i;
										return (
											<div key={i} style={{ position: "relative" }}>
												<div
													onClick={() =>
														setHoveredIntg(hoveredIntg === i ? null : i)
													}
													style={{
														padding: "14px 8px",
														borderRadius: 12,
														background: cardBg,
														border: `1.5px solid ${isHov ? activeColor : borderColor}`,
														display: "flex",
														flexDirection: "column",
														alignItems: "center",
														gap: 5,
														cursor: "pointer",
														transition: "all 0.3s",
														boxShadow: isHov
															? `0 4px 20px ${activeColor}12`
															: "none",
													}}
												>
													<intg.Logo s={26} />
													<span
														style={{
															fontSize: 9,
															fontWeight: 700,
															color: isHov ? activeColor : textMuted,
															letterSpacing: "0.04em",
															transition: "color 0.3s",
															fontFamily: "'Noto Sans SC', sans-serif",
														}}
													>
														{intg.name}
													</span>
												</div>
												{isHov && (
													<div
														style={{
															position: "absolute",
															top: "100%",
															left: "50%",
															transform: "translateX(-50%)",
															width: 200,
															marginTop: 8,
															zIndex: 20,
															padding: "10px 14px",
															borderRadius: 10,
															background: cardBg,
															border: `1px solid ${activeColor}25`,
															boxShadow: `0 6px 24px ${activeColor}10`,
															animation: "fadeSlideUp 0.25s ease",
															textAlign: "center",
														}}
													>
														<div
															style={{
																fontSize: 11,
																fontWeight: 700,
																color: textPrimary,
																marginBottom: 4,
																fontFamily: "'Noto Sans SC', sans-serif",
															}}
														>
															{intg.name}{" "}
															<span
																style={{
																	fontSize: 8,
																	color: activeColor,
																	background: `${activeColor}12`,
																	padding: "1px 5px",
																	borderRadius: 3,
																	marginLeft: 4,
																}}
															>
																MCP
															</span>
														</div>
														<p
															style={{
																fontSize: 11,
																color: textSecondary,
																lineHeight: 1.6,
																fontFamily: "'Noto Sans SC', sans-serif",
															}}
														>
															{intg.desc}
														</p>
													</div>
												)}
											</div>
										);
									})}
								</div>
							</div>
						) : (
							<div
								style={{ position: "relative", width: 480, height: 480 }}
								onMouseLeave={() => setHoveredIntg(null)}
							>
								<svg
									style={{
										position: "absolute",
										inset: 0,
										width: 480,
										height: 480,
										zIndex: 1,
										pointerEvents: "none",
									}}
								>
									{INTEGRATIONS.map((_, i) => {
										const angle =
											(i / INTEGRATIONS.length) * Math.PI * 2 - Math.PI / 2;
										const r = 175,
											cx = 240,
											cy = 240;
										const ex = cx + Math.cos(angle) * r,
											ey = cy + Math.sin(angle) * r;
										const isActive = activeLineIdx === i;
										return (
											<g key={i}>
												<line
													x1={cx}
													y1={cy}
													x2={ex}
													y2={ey}
													stroke={isActive ? activeColor : borderColor}
													strokeWidth={isActive ? 2 : 1}
													strokeDasharray={isActive ? "none" : "5,5"}
													style={{ transition: "all 0.4s ease" }}
												/>
												{isActive &&
													[0, 0.5, 1].map((d) => (
														<circle key={d} r="3" fill={activeColor}>
															<animate
																attributeName="cx"
																values={`${cx};${ex}`}
																dur="1.6s"
																begin={`${d}s`}
																repeatCount="indefinite"
															/>
															<animate
																attributeName="cy"
																values={`${cy};${ey}`}
																dur="1.6s"
																begin={`${d}s`}
																repeatCount="indefinite"
															/>
															<animate
																attributeName="opacity"
																values="0;1;1;0"
																dur="1.6s"
																begin={`${d}s`}
																repeatCount="indefinite"
															/>
														</circle>
													))}
												{isActive &&
													[0.3, 0.8].map((d) => (
														<circle
															key={`r${d}`}
															r="2.5"
															fill={activeColor}
															opacity="0.6"
														>
															<animate
																attributeName="cx"
																values={`${ex};${cx}`}
																dur="2s"
																begin={`${d}s`}
																repeatCount="indefinite"
															/>
															<animate
																attributeName="cy"
																values={`${ey};${cy}`}
																dur="2s"
																begin={`${d}s`}
																repeatCount="indefinite"
															/>
															<animate
																attributeName="opacity"
																values="0;0.6;0.6;0"
																dur="2s"
																begin={`${d}s`}
																repeatCount="indefinite"
															/>
														</circle>
													))}
											</g>
										);
									})}
								</svg>
								<div
									style={{
										position: "absolute",
										left: "50%",
										top: "50%",
										transform: "translate(-50%, -50%)",
										width: 88,
										height: 88,
										borderRadius: 20,
										background: `linear-gradient(135deg, ${activeColor}, ${activeColor}88)`,
										transition: "background 0.5s",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										boxShadow: `0 8px 40px ${activeColor}25`,
										zIndex: 4,
									}}
								>
									<svg
										width="32"
										height="32"
										viewBox="0 0 24 24"
										fill="none"
										stroke="#fff"
										strokeWidth="2"
									>
										<path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
										<path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
									</svg>
								</div>
								<div
									style={{
										position: "absolute",
										left: "50%",
										top: "50%",
										transform: "translate(-50%, -50%)",
										width: 88,
										height: 88,
										borderRadius: 20,
										border: `2px solid ${activeColor}30`,
										animation: "pulseRing 2.2s ease-out infinite",
										zIndex: 1,
										pointerEvents: "none",
									}}
								/>

								{INTEGRATIONS.map((intg, i) => {
									const angle =
										(i / INTEGRATIONS.length) * Math.PI * 2 - Math.PI / 2;
									const r = 175;
									const x = Math.cos(angle) * r,
										y = Math.sin(angle) * r;
									const isHov = hoveredIntg === i;
									const isActiveLine = activeLineIdx === i;
									const tooltipAbove = y < 0;
									return (
										<div
											key={i}
											onMouseEnter={() => setHoveredIntg(i)}
											style={{
												position: "absolute",
												left: `calc(50% + ${x}px)`,
												top: `calc(50% + ${y}px)`,
												transform: `translate(-50%, -50%) scale(${isHov ? 1.18 : 1})`,
												transition:
													"transform 0.35s cubic-bezier(.16,1,.3,1), box-shadow 0.35s ease, border-color 0.3s ease",
												zIndex: isHov ? 20 : 3,
											}}
										>
											<div
												style={{
													width: 72,
													height: 72,
													borderRadius: 16,
													background: cardBg,
													border: `1.5px solid ${isHov || isActiveLine ? activeColor : borderColor}`,
													display: "flex",
													flexDirection: "column",
													alignItems: "center",
													justifyContent: "center",
													gap: 3,
													boxShadow: isHov
														? `0 8px 32px ${activeColor}18`
														: "0 2px 12px rgba(0,0,0,0.04)",
													cursor: "pointer",
													transition: "all 0.3s",
												}}
											>
												<intg.Logo s={32} />
												<span
													style={{
														fontSize: 7.5,
														fontWeight: 700,
														color:
															isHov || isActiveLine ? activeColor : textMuted,
														letterSpacing: "0.04em",
														transition: "color 0.3s",
														fontFamily: "'Noto Sans SC', sans-serif",
													}}
												>
													{intg.name}
												</span>
											</div>
											{isHov && (
												<div
													style={{
														position: "absolute",
														[tooltipAbove ? "bottom" : "top"]:
															"calc(100% + 12px)",
														left: "50%",
														transform: "translateX(-50%)",
														width: 220,
														padding: "12px 16px",
														borderRadius: 12,
														background: cardBg,
														border: `1px solid ${activeColor}25`,
														boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
														animation: "fadeSlideUp 0.2s ease",
														textAlign: "center",
														zIndex: 30,
														pointerEvents: "none",
													}}
												>
													<div
														style={{
															display: "flex",
															alignItems: "center",
															justifyContent: "center",
															gap: 6,
															marginBottom: 6,
														}}
													>
														<span
															style={{
																fontSize: 12,
																fontWeight: 700,
																color: textPrimary,
																fontFamily: "'Noto Sans SC', sans-serif",
															}}
														>
															{intg.name}
														</span>
														<span
															style={{
																fontSize: 8,
																fontWeight: 700,
																color: activeColor,
																background: `${activeColor}12`,
																padding: "2px 6px",
																borderRadius: 4,
																transition: "all 0.5s",
															}}
														>
															MCP
														</span>
													</div>
													<p
														style={{
															fontSize: 12,
															color: textSecondary,
															lineHeight: 1.6,
															margin: 0,
															fontFamily: "'Noto Sans SC', sans-serif",
														}}
													>
														{intg.desc}
													</p>
												</div>
											)}
										</div>
									);
								})}
							</div>
						)}
					</Reveal>
				</div>
			</section>

			{/* NUMBERS */}
			<section
				style={{
					padding: isMobile ? "60px 20px" : "80px 56px",
					background: `linear-gradient(180deg, transparent 0%, ${activeColor}05 50%, transparent 100%)`,
					transition: "background 1s",
				}}
			>
				<div
					style={{
						maxWidth: 1400,
						margin: "0 auto",
						display: "grid",
						gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr",
						gap: isMobile ? 24 : 0,
						textAlign: "center",
					}}
				>
					{[
						{ num: "12,000+", label: "已注册学生" },
						{ num: "860", label: "已创建班级" },
						{ num: "98%", label: "任务按时完成" },
						{ num: "4.9", label: "平均评分" },
					].map((s, i) => (
						<Reveal key={i} delay={i * 0.08}>
							<div style={{ padding: "20px 0" }}>
								<div
									style={{
										fontSize: isMobile ? 32 : 44,
										fontWeight: 700,
										fontFamily: "'Source Serif 4', Georgia, serif",
										color: activeColor,
										transition: "color 0.5s",
										letterSpacing: "-0.02em",
									}}
								>
									{s.num}
								</div>
								<div
									style={{
										fontSize: 13,
										color: textSecondary,
										fontWeight: 500,
										marginTop: 4,
										fontFamily: "'Noto Sans SC', sans-serif",
									}}
								>
									{s.label}
								</div>
							</div>
						</Reveal>
					))}
				</div>
			</section>

			{/* TESTIMONIAL */}
			<section style={{ padding: isMobile ? "60px 20px" : "100px 56px" }}>
				<Reveal>
					<div style={{ maxWidth: 780, margin: "0 auto", textAlign: "center" }}>
						<div
							style={{
								fontSize: isMobile ? 18 : 26,
								fontFamily: "'Noto Serif SC', 'Source Serif 4', Georgia, serif",
								fontWeight: 400,
								lineHeight: 1.8,
								color: textPrimary,
								fontStyle: "italic",
								marginBottom: 28,
							}}
						>
							"为什么不用学习通"
						</div>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								gap: 14,
							}}
						>
							<div
								style={{
									width: 42,
									height: 42,
									borderRadius: 12,
									background: `linear-gradient(135deg, ${PALETTE[0].color}, ${PALETTE[3].color})`,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									color: "#fff",
									fontSize: 13,
									fontWeight: 700,
									letterSpacing: "0.02em",
								}}
							>
								cc
							</div>
							<div style={{ textAlign: "left" }}>
								<div
									style={{
										fontSize: 14,
										fontWeight: 600,
										fontFamily: "'Noto Sans SC', sans-serif",
									}}
								>
									cc
								</div>
								<div
									style={{
										fontSize: 12,
										color: textSecondary,
										fontFamily: "'Noto Sans SC', sans-serif",
									}}
								>
									优秀毕业生，某大学
								</div>
							</div>
						</div>
					</div>
				</Reveal>
			</section>

			{/* CTA */}
			<section
				id="sec2"
				style={{ padding: isMobile ? "40px 20px 80px" : "60px 56px 120px" }}
			>
				<Reveal>
					<div
						style={{
							maxWidth: 1400,
							margin: "0 auto",
							padding: isMobile ? "48px 24px" : "72px 64px",
							borderRadius: 24,
							background: `linear-gradient(135deg, ${activeColor}06, ${activeColor}12)`,
							border: `1px solid ${activeColor}18`,
							transition: "all 0.6s",
							position: "relative",
							overflow: "hidden",
							display: "flex",
							flexDirection: isMobile ? "column" : "row",
							alignItems: "center",
							gap: isMobile ? 32 : 64,
						}}
					>
						{PALETTE.map((p, i) => (
							<div
								key={i}
								style={{
									position: "absolute",
									width: 80,
									height: 80,
									borderRadius: "50%",
									background: `radial-gradient(circle, ${p.color}10, transparent 70%)`,
									top: `${10 + ((i * 17) % 80)}%`,
									left: `${5 + ((i * 18) % 90)}%`,
									animation: `float 3.5s ease-in-out ${i * 0.7}s infinite`,
									pointerEvents: "none",
								}}
							/>
						))}
						<div style={{ flex: 1, position: "relative", zIndex: 1 }}>
							<h2
								style={{
									fontSize: isMobile ? 26 : 38,
									fontWeight: 700,
									fontFamily:
										"'Noto Serif SC', 'Source Serif 4', Georgia, serif",
									letterSpacing: "-0.01em",
									marginBottom: 16,
								}}
							>
								准备好让课堂回归清晰了吗？
							</h2>
							<p
								style={{
									fontSize: 15,
									color: textSecondary,
									maxWidth: 440,
									lineHeight: 1.8,
									fontFamily: "'Noto Sans SC', sans-serif",
								}}
							>
								加入数千名已在使用 TaskNeo
								组织作业、节省时间、让学生保持进度的教育者。
							</p>
						</div>
						<div
							style={{
								position: "relative",
								zIndex: 1,
								display: "flex",
								flexDirection: "column",
								alignItems: isMobile ? "flex-start" : "flex-end",
								gap: 12,
							}}
						>
							<a
								href={LINKS.getStarted}
								style={{
									padding: "16px 44px",
									borderRadius: 12,
									border: "none",
									background: activeColor,
									color: "#fff",
									fontSize: 16,
									fontWeight: 600,
									cursor: "pointer",
									fontFamily: "'Noto Sans SC', sans-serif",
									transition: "all 0.5s",
									boxShadow: `0 4px 28px ${activeColor}30`,
									whiteSpace: "nowrap",
									textDecoration: "none",
									display: "inline-block",
								}}
							>
								开始使用
							</a>
						</div>
					</div>
				</Reveal>
			</section>

			{/* ASK AI */}
			{(() => {
				const q = encodeURIComponent(
					`请告诉我 TaskNeo 是否适合我？这是产品文档：${LINKS.docs}`,
				);
				const aiLinks = [
					{
						label: "询问 ChatGPT",
						href: `https://chat.openai.com/?q=${q}`,
						icon: (
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="currentColor"
							>
								<path d="M22.28 9.28a5.998 5.998 0 00-.52-4.93 6.07 6.07 0 00-6.53-2.92A6.007 6.007 0 0010.32 0a6.07 6.07 0 00-5.78 4.2 6.007 6.007 0 00-4 2.92 6.07 6.07 0 00.75 7.12 5.998 5.998 0 00.52 4.93 6.07 6.07 0 006.53 2.92A6.007 6.007 0 0013.68 24a6.07 6.07 0 005.78-4.2 6.007 6.007 0 004-2.92 6.07 6.07 0 00-.75-7.12l-.43.42zM13.68 22.5a4.5 4.5 0 01-2.89-1.05l.14-.08 4.8-2.77a.78.78 0 00.39-.68v-6.78l2.03 1.17a.07.07 0 01.04.05v5.6a4.51 4.51 0 01-4.51 4.54zM3.6 18.38a4.5 4.5 0 01-.54-3.02l.14.09 4.8 2.77a.78.78 0 00.78 0l5.86-3.38v2.34a.07.07 0 01-.03.06L9.74 19.9A4.51 4.51 0 013.6 18.38zm-1.17-9.9A4.49 4.49 0 014.8 6.14v5.67a.78.78 0 00.39.68l5.86 3.38-2.03 1.17a.07.07 0 01-.07 0L4.2 14.3a4.51 4.51 0 01-.77-5.82zm16.69 3.87l-5.86-3.38 2.03-1.17a.07.07 0 01.07 0l4.75 2.74a4.5 4.5 0 01-.7 8.12v-5.67a.78.78 0 00-.29-.64zm2.02-3.03l-.14-.09-4.8-2.77a.78.78 0 00-.78 0L9.56 10.84V8.5a.07.07 0 01.03-.06l4.75-2.74a4.51 4.51 0 016.8 4.68v-.06zM8.53 13.1L6.5 11.93a.07.07 0 01-.04-.05V6.3a4.51 4.51 0 017.39-3.46l-.14.08-4.8 2.77a.78.78 0 00-.39.68l.01 6.73zm1.1-2.37L12 9.25l2.37 1.37v2.74L12 14.73l-2.37-1.37V10.73z" />
							</svg>
						),
					},
					{
						label: "询问 Claude",
						href: `https://claude.ai/new?q=${q}`,
						icon: (
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="currentColor"
							>
								<path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-1.89-.17-.784-.243-.54-.492-.233-.68.36-.773.705-.494 1.048-.097.887.097 1.913.34 2.073.364 1.84.388h.222l.032-.137-.095-.106-1.203-1.664-1.622-2.01-1.236-1.556-.925-1.313-.56-1.121-.122-.88.439-.73.756-.43.932.064.714.43.581.63 1.2 1.896 1.3 1.856 1.106 1.664.205.34.16-.017.08-.119V8.395l-.042-2.017V4.49l.104-1.96.46-1.337.831-.704 1.08-.097.826.412.524.777.128 1.088-.048.992-.25 2.405-.2 2.017-.024.574.16.008.12-.137 1.267-1.735 1.3-1.63 1.186-1.28.975-.895.96-.526.847-.073.62.267.377.445.136.623-.16.851-.582.947-.992 1.023-1.622 1.461-1.186 1.234-.976 1.2.016.137.16.016h.128l2.103-.46 2.199-.315 1.889-.024 1.105.267.54.567.16.826-.33.728-.782.494-1.322.267-2.264.024-2.37-.145-1.817-.194h-.177l-.016.16.08.098 1.114 1.059 1.839 1.832 1.2 1.354.678 1.063.17.928-.281.832-.718.501-1.042-.024-.726-.43-.896-1.128-1.832-2.32-1.237-1.898-.629-.944-.24.008v.137l.073.79.104 2.586.016 1.9-.122 1.605-.378 1.023-.79.582-.99.049-.735-.364-.538-.753-.128-1.128.209-2.391z" />
							</svg>
						),
					},
					{
						label: "询问 Perplexity",
						href: `https://www.perplexity.ai/?q=${q}`,
						icon: (
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="currentColor"
							>
								<path d="M22.197 0h-3.052l-6.957 6.803H9.5V0H7.017v6.803H3.734L.031 2.995v4.625l2.486 2.43v7.209l-2.486 2.43V24l3.703-3.808h3.283V24H9.5v-3.808h2.688L22.197 24V0zm-3.57 2.432v16.714l-6.44-6.299V8.73l6.44-6.299zM3.53 9.4h3.487v5.268H3.53V9.4zm5.97 0h2.688v5.268H9.5V9.4z" />
							</svg>
						),
					},
				];
				return (
					<section
						style={{
							position: "relative",
							overflow: "hidden",
							padding: isMobile ? "64px 20px 80px" : "80px 56px 100px",
							textAlign: "center",
							background: bg,
						}}
					>
						<div
							style={{
								position: "absolute",
								inset: 0,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								pointerEvents: "none",
								userSelect: "none",
							}}
						>
							<span
								style={{
									fontSize: isMobile ? 80 : 160,
									fontWeight: 800,
									fontFamily: "'Source Serif 4', Georgia, serif",
									color: textPrimary,
									opacity: 0.04,
									letterSpacing: "-0.04em",
									whiteSpace: "nowrap",
								}}
							>
								TaskNeo
							</span>
						</div>
						<Reveal>
							<h2
								style={{
									fontSize: isMobile ? 22 : 30,
									fontWeight: 700,
									fontFamily:
										"'Noto Serif SC', 'Source Serif 4', Georgia, serif",
									marginBottom: 32,
									position: "relative",
								}}
							>
								不确定 TaskNeo 是否适合您？
							</h2>
							<div
								style={{
									display: "flex",
									gap: 12,
									justifyContent: "center",
									flexWrap: "wrap",
									position: "relative",
								}}
							>
								{aiLinks.map(({ label, href, icon }) => (
									<a
										key={label}
										href={href}
										target="_blank"
										rel="noopener noreferrer"
										style={{
											display: "inline-flex",
											alignItems: "center",
											gap: 8,
											padding: "10px 22px",
											borderRadius: 100,
											border: `1.5px solid ${borderColor}`,
											background: cardBg,
											color: textPrimary,
											fontSize: 13,
											fontWeight: 500,
											fontFamily: "'Noto Sans SC', sans-serif",
											textDecoration: "none",
											boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
											transition: "border-color 0.2s, box-shadow 0.2s",
										}}
										onMouseEnter={(e) => {
											e.currentTarget.style.borderColor = textMuted;
											e.currentTarget.style.boxShadow =
												"0 4px 20px rgba(0,0,0,0.08)";
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.borderColor = borderColor;
											e.currentTarget.style.boxShadow =
												"0 2px 12px rgba(0,0,0,0.04)";
										}}
									>
										{icon}
										{label}
									</a>
								))}
							</div>
						</Reveal>
					</section>
				);
			})()}

			{/* FOOTER */}
			<footer
				style={{
					borderTop: `1px solid ${borderColor}`,
					padding: isMobile ? "40px 20px 32px" : "56px 56px 40px",
					overflowX: "hidden",
				}}
			>
				<div style={{ maxWidth: 1400, margin: "0 auto" }}>
					{/* top row: logo + columns */}
					<div
						style={{
							display: "flex",
							flexDirection: isMobile ? "column" : "row",
							gap: isMobile ? 40 : 32,
						}}
					>
						{/* logo */}
						<div style={{ flex: isMobile ? "none" : "0 0 200px" }}>
							<div
								style={{
									display: "flex",
									alignItems: "center",
									gap: 8,
									marginBottom: 0,
								}}
							>
								<div
									style={{
										width: 26,
										height: 26,
										borderRadius: 7,
										background: `linear-gradient(135deg, ${activeColor}, ${activeColor}88)`,
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										transition: "background 0.5s",
									}}
								>
									<svg
										width="12"
										height="12"
										viewBox="0 0 24 24"
										fill="none"
										stroke="#fff"
										strokeWidth="2.5"
									>
										<path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
										<path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
									</svg>
								</div>
								<span
									style={{
										fontSize: 16,
										fontWeight: 700,
										fontFamily: "'Source Serif 4', Georgia, serif",
									}}
								>
									TaskNeo
								</span>
							</div>
						</div>

						{/* link columns */}
						<div
							style={{
								flex: 1,
								display: "grid",
								gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
								gap: isMobile ? "32px 24px" : "0 16px",
							}}
						>
							{[
								{
									title: "产品",
									links: [
										{ label: "功能特性", href: "#sec0" },
										{ label: "甘特视图", href: "#" },
										{ label: "AI 解析", href: "#" },
										{ label: "更新日志", href: "#" },
									],
								},
								{
									title: "资源",
									links: [
										{ label: "帮助文档", href: LINKS.docs },
										{ label: "快速入门", href: "#" },
										{ label: "常见问题", href: "#" },
										{ label: "API 文档", href: "#" },
									],
								},
								{
									title: "公司",
									links: [
										{ label: "关于我们", href: "#" },
										{ label: "博客", href: "#" },
										{ label: "联系我们", href: null },
									],
								},
								{
									title: "法律",
									links: [
										{ label: "隐私政策", href: LINKS.privacy },
										{ label: "服务条款", href: LINKS.terms },
										{ label: "Cookie 政策", href: "#" },
									],
								},
							].map(({ title, links }) => (
								<div key={title}>
									<div
										style={{
											fontSize: 11,
											fontWeight: 700,
											color: textMuted,
											letterSpacing: "0.06em",
											textTransform: "uppercase",
											fontFamily: "'Noto Sans SC', sans-serif",
											marginBottom: 14,
										}}
									>
										{title}
									</div>
									<div
										style={{
											display: "flex",
											flexDirection: "column",
											gap: 10,
										}}
									>
										{links.map(({ label, href }) =>
											href ? (
												<a
													key={label}
													href={href}
													style={{
														fontSize: 13,
														color: textSecondary,
														textDecoration: "none",
														fontFamily: "'Noto Sans SC', sans-serif",
														transition: "color 0.15s",
													}}
													onMouseEnter={(e) =>
														(e.target.style.color = textPrimary)
													}
													onMouseLeave={(e) =>
														(e.target.style.color = textSecondary)
													}
												>
													{label}
												</a>
											) : (
												<span
													key={label}
													style={{
														fontSize: 13,
														color: textMuted,
														fontFamily: "'Noto Sans SC', sans-serif",
														cursor: "default",
													}}
												>
													{label}
												</span>
											),
										)}
									</div>
								</div>
							))}
						</div>
					</div>

					{/* bottom row */}
					<div
						style={{
							marginTop: 48,
							paddingTop: 24,
							borderTop: `1px solid ${borderColor}`,
							display: "flex",
							flexDirection: isMobile ? "column" : "row",
							alignItems: "center",
							justifyContent: "space-between",
							gap: 12,
							textAlign: isMobile ? "center" : "left",
						}}
					>
						<span
							style={{
								fontSize: 12,
								color: textMuted,
								fontFamily: "'Noto Sans SC', sans-serif",
							}}
						>
							© 2026 TaskNeo
						</span>
						<div style={{ display: "flex", gap: 20 }}>
							{[
								{ label: "服务条款", href: LINKS.terms },
								{ label: "隐私政策", href: LINKS.privacy },
							].map(({ label, href }) => (
								<a
									key={label}
									href={href}
									style={{
										fontSize: 12,
										color: textMuted,
										textDecoration: "none",
										fontFamily: "'Noto Sans SC', sans-serif",
										transition: "color 0.15s",
									}}
									onMouseEnter={(e) => (e.target.style.color = textSecondary)}
									onMouseLeave={(e) => (e.target.style.color = textMuted)}
								>
									{label}
								</a>
							))}
						</div>
					</div>
				</div>
			</footer>
		</div>
	);
}
