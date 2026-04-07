import "./style.css";

const loginUrl = import.meta.env.VITE_APP_LOGIN_URL || "/login";
const registerUrl = import.meta.env.VITE_APP_REGISTER_URL || "/register";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root element");
}

app.innerHTML = `
  <div class="page-wrap">
    <header class="topbar paper-panel" data-reveal>
      <a class="brand" href="#" aria-label="TaskNeo Home">
        <span class="brand-mark">TN</span>
        <span class="brand-text">
          <strong>TaskNeo</strong>
          <small>Morning Editorial Studio</small>
        </span>
      </a>
      <nav class="topbar-actions" aria-label="Account links">
        <a class="btn btn-quiet" href="${loginUrl}">登录</a>
        <a class="btn btn-primary" href="${registerUrl}">免费注册</a>
      </nav>
    </header>

    <main>
      <section class="hero section-curve" aria-labelledby="hero-title">
        <div class="hero-copy" data-reveal>
          <p class="eyebrow">
            <span class="dot"></span>
            晨光编辑室 · 教学工作流
          </p>
          <h1 id="hero-title">把课堂任务，排成一本<br />有节奏的教学杂志。</h1>
          <p class="hero-sub">
            TaskNeo 把发布、收集、反馈整理成一条清晰的编辑路径。
            老师专注教学判断，学生只需要跟着页面节奏前进。
          </p>

          <div class="cta-row">
            <a class="btn btn-primary" href="${registerUrl}">开始创建班级</a>
            <a class="btn btn-outline" href="${loginUrl}">已有账号，去登录</a>
          </div>

          <ul class="hero-metrics" aria-label="Product highlights">
            <li>
              <strong>3x</strong>
              发布-收集-反馈更连贯
            </li>
            <li>
              <strong>1 页</strong>
              同步任务、附件与批注
            </li>
            <li>
              <strong>0 迷路</strong>
              学生总知道下一步要做什么
            </li>
          </ul>
        </div>

        <div class="hero-collage" data-reveal>
          <div class="glass-chip" aria-hidden="true">
            <span>本周节奏</span>
            <strong>发布 14 · 反馈 11</strong>
          </div>

          <article class="collage-card tape-card">
            <p class="tag">Issue 01</p>
            <h3>发布像排版</h3>
            <p>标题、截止时间、评分说明与附件自然分栏，信息一眼可读。</p>
          </article>

          <article class="collage-card note-card">
            <span class="number-label">02</span>
            <h3>收集有秩序</h3>
            <p>学生提交自动归位，缺交与逾期被轻量标注，不打断阅读动线。</p>
          </article>

          <article class="collage-card line-card">
            <span class="line"></span>
            <h3>反馈成闭环</h3>
            <p>批注、评分、再提交在同一画面里收口，减少来回切换。</p>
          </article>
        </div>
      </section>

      <section class="story-strip" aria-labelledby="story-title">
        <div class="section-head" data-reveal>
          <p class="eyebrow">Story Strip</p>
          <h2 id="story-title">三个转变场景，连续发生</h2>
        </div>

        <div class="story-grid">
          <article class="story-card publish" data-reveal>
            <span class="number-label">01</span>
            <h3>发布：从“通知”到“可执行页面”</h3>
            <p>
              每个任务都像编辑页：目标、附件、截止和评分点整齐放好，学生无需猜题意。
            </p>
            <ul>
              <li>模板化任务结构</li>
              <li>暖灰细线与分层信息</li>
            </ul>
          </article>

          <article class="story-card collect" data-reveal>
            <span class="number-label">02</span>
            <h3>收集：从“催交”到“自然归档”</h3>
            <p>
              提交状态沿时间线推进，老师看到的是节奏，不是噪音。
            </p>
            <ul>
              <li>缺交 / 逾期轻标注</li>
              <li>班级视角实时聚合</li>
            </ul>
          </article>

          <article class="story-card feedback" data-reveal>
            <span class="number-label">03</span>
            <h3>反馈：从“一次打分”到“持续对话”</h3>
            <p>
              批注、建议、补交记录形成闭环，学生看见进步路线。
            </p>
            <ul>
              <li>上下文批注</li>
              <li>反馈可追踪</li>
            </ul>
          </article>
        </div>
      </section>

      <section class="dark-interlude" aria-labelledby="interlude-title" data-reveal>
        <div class="interlude-shell">
          <div>
            <p class="eyebrow">Dark Interlude</p>
            <h2 id="interlude-title">当一天变忙，页面节奏更要安静。</h2>
            <p>
              深色段落只负责拉开呼吸：在任务高峰期，TaskNeo 用低干扰信息密度帮你稳住判断。
            </p>
          </div>

          <div class="interlude-board">
            <div class="mini-glass" aria-hidden="true">Live · 27 条更新</div>
            <ol>
              <li><strong>08:10</strong> 发布实验报告 + 自动附上评分点</li>
              <li><strong>10:25</strong> 12 份提交到齐，2 份待补交</li>
              <li><strong>13:40</strong> 批注完成，学生收到定向反馈</li>
            </ol>
          </div>
        </div>
      </section>

      <section class="value-wall" aria-labelledby="value-title">
        <div class="section-head" data-reveal>
          <p class="eyebrow">Value Wall</p>
          <h2 id="value-title">同一条工作流，三种价值视角</h2>
        </div>

        <div class="value-grid">
          <article class="value-card teacher" data-reveal>
            <h3>教师视角</h3>
            <p>少切页、少催交，把时间还给教学判断与反馈质量。</p>
          </article>

          <article class="value-card student" data-reveal>
            <h3>学生视角</h3>
            <p>每个任务像一页清楚的说明书，知道目标、步骤和完成标准。</p>
          </article>

          <article class="value-card classroom" data-reveal>
            <h3>班级视角</h3>
            <p>全班进度被同一条版面叙事串起来，协作节奏稳定可见。</p>
          </article>
        </div>
      </section>

      <section class="final-cta" data-reveal>
        <p class="eyebrow">Final Call</p>
        <h2>让下一次作业发布，看起来就像一本会呼吸的教学杂志。</h2>
        <p>5 分钟创建班级，今晚就能用第一条编辑式任务流。</p>

        <div class="cta-row">
          <a class="btn btn-primary" href="${registerUrl}">立即注册 TaskNeo</a>
          <a class="btn btn-outline" href="${loginUrl}">先登录继续</a>
        </div>
      </section>
    </main>
  </div>
`;

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const revealItems = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));

if (reduceMotion) {
  revealItems.forEach((item) => item.classList.add("is-visible"));
  document.body.classList.add("is-loaded");
} else {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const target = entry.target as HTMLElement;
          target.classList.add("is-visible");
          observer.unobserve(target);
        }
      });
    },
    {
      threshold: 0.18,
      rootMargin: "0px 0px -8% 0px",
    },
  );

  revealItems.forEach((item, index) => {
    item.style.setProperty("--reveal-delay", `${Math.min(index * 0.06, 0.3)}s`);
    observer.observe(item);
  });

  requestAnimationFrame(() => {
    document.body.classList.add("is-loaded");
  });
}
