import { Children, type ReactNode } from "react";

export const dynamic = "force-static";

type LegalSection = {
  enTitle: string;
  en: ReactNode[];
  zhTitle: string;
  zh: ReactNode[];
};

const intro = {
  en: [
    <>
      Effective date: May 1, 2026. These Terms of Service (&quot;Terms&quot;)
      govern your access to and use of TaskNeo. By creating an account or using
      the service, you agree to these Terms.
    </>,
    <>
      Important: TaskNeo is currently operated as a personal hobby project and
      public beta. We will try to keep it useful and reliable, but we cannot
      guarantee long-term stability, availability, or data persistence. Please
      keep your own backups and do not store the only copy of important files,
      legal records, or critical information here.
    </>,
    <>
      If a translated version of these Terms is provided, it is for convenience
      only. The English version controls in case of any inconsistency.
    </>,
  ],
  zh: [
    <>
      生效日期：2026 年 5 月 1 日。本服务条款（“条款”）约定你访问和使用 TaskNeo
      的规则。创建账号或使用服务即表示你同意本条款。
    </>,
    <>
      重要提示：TaskNeo
      目前是个人兴趣运营的公测服务。我们会尽力保持它可用、好用，但无法保证长期稳定、持续可用或数据持久保存。请自行保留备份，不要把重要文件、法律记录或关键资料的唯一副本存放在这里。
    </>,
    <>
      如本条款提供翻译版本，翻译仅为方便阅读。如不同语言版本存在不一致，以英文版本为准。
    </>,
  ],
};

const sections: LegalSection[] = [
  {
    enTitle: "1. Service Status and Changes",
    en: [
      <>
        TaskNeo is provided &quot;as available.&quot; Features may change, be
        interrupted, or be removed at any time, especially while the service is
        in public beta.
      </>,
    ],
    zhTitle: "1. 服务状态和变更",
    zh: [
      <>
        TaskNeo 按“可用时”提供。尤其在公测期间，功能可能随时变更、中断或移除。
      </>,
    ],
  },
  {
    enTitle: "2. Accounts and Acceptable Use",
    en: [
      <>
        You must use the service in compliance with applicable law. You are
        responsible for activities under your account and for keeping your
        credentials secure. You must not misuse the service, interfere with
        security or performance, attempt unauthorized access, upload unlawful
        content, or use TaskNeo in a way that harms other users or the platform.
      </>,
    ],
    zhTitle: "2. 账号和可接受使用",
    zh: [
      <>
        你必须遵守适用法律使用本服务，并对账号下的活动负责、妥善保管账号凭证。你不得滥用服务、干扰安全或性能、尝试未经授权的访问、上传违法内容，或以伤害其他用户或平台的方式使用
        TaskNeo。
      </>,
    ],
  },
  {
    enTitle: "3. Your Content",
    en: [
      <>
        You retain ownership of your content. By uploading content, you grant
        TaskNeo a limited license to store, process, transmit, and display that
        content only as needed to operate the service features you request.
      </>,
    ],
    zhTitle: "3. 你的内容",
    zh: [
      <>
        你保留对自己内容的所有权。上传内容即表示你授予 TaskNeo
        一项有限许可，使我们可以在提供你请求的服务功能所需范围内存储、处理、传输和展示该内容。
      </>,
    ],
  },
  {
    enTitle: "4. Schools and Minors",
    en: [
      <>
        TaskNeo may be used by educators, schools, and students. If you are
        under the age required by applicable law to use an online service
        independently, you may use TaskNeo only with appropriate authorization
        from a parent, guardian, school, or teacher.
      </>,
      <>
        Educators and schools are responsible for obtaining any permissions or
        notices required for student use and for using the service in a manner
        consistent with their own student data obligations.
      </>,
    ],
    zhTitle: "4. 学校和未成年人",
    zh: [
      <>
        TaskNeo
        可能由教师、学校和学生使用。如果你未达到适用法律要求的可独立使用在线服务的年龄，你只能在父母、监护人、学校或教师适当授权下使用
        TaskNeo。
      </>,
      <>
        教师和学校负责取得学生使用所需的任何授权或通知，并以符合其自身学生数据义务的方式使用本服务。
      </>,
    ],
  },
  {
    enTitle: "5. Providers, Privacy, and Data Controls",
    en: [
      <>
        Some features depend on third-party providers, including hosting,
        storage, email, analytics, AI, and speech recognition providers. Their
        services may have separate terms, privacy practices, and availability
        conditions.
      </>,
      <>
        See the <a href="/privacy">Privacy Policy</a> for how we collect, use,
        store, share, retain, and delete personal data. You may export and
        delete your data through available product controls, subject to the
        service design and any legal, security, or abuse-prevention
        requirements.
      </>,
    ],
    zhTitle: "5. 服务商、隐私和数据控制",
    zh: [
      <>
        部分功能依赖第三方服务商，包括托管、存储、邮件、分析、AI
        和语音识别服务商。其服务可能适用单独的条款、隐私实践和可用性条件。
      </>,
      <>
        我们如何收集、使用、存储、共享、保留和删除个人数据，见
        <a href="/privacy">隐私政策</a>
        。你可以通过产品内可用控制功能导出和删除数据，但仍需受服务设计以及法律、安全或防滥用要求限制。
      </>,
    ],
  },
  {
    enTitle: "6. Removal, Suspension, and Termination",
    en: [
      <>
        If user-uploaded content contains terrorist content, child sexual abuse
        material (CSAM), or other content that violates applicable law or these
        Terms, we may remove the relevant violating content.
      </>,
      <>
        For removed violating content, we do not provide restoration, export, or
        re-download.
      </>,
      <>
        We may update, suspend, or discontinue any part of the service at any
        time. We may suspend or terminate access for violations of these Terms
        or for security, legal, or operational reasons.
      </>,
      <>
        We reserve the right to suspend or terminate accounts involved in
        serious or repeated violations.
      </>,
    ],
    zhTitle: "6. 内容移除、暂停和终止",
    zh: [
      <>
        如果用户上传内容包含恐怖主义内容、儿童性虐待材料（CSAM）或其他违反适用法律或本条款的内容，我们可能会移除相关违规内容。
      </>,
      <>对于被移除的违规内容，我们不提供恢复、导出或重新下载。</>,
      <>
        我们可能随时更新、暂停或停止服务的任何部分。对于违反本条款，或出于安全、法律或运营原因，我们可能暂停或终止访问。
      </>,
      <>我们保留暂停或终止严重或重复违规账号的权利。</>,
    ],
  },
  {
    enTitle: "7. Disclaimers and Liability",
    en: [
      <>
        To the maximum extent permitted by law, the service is provided &quot;as
        is&quot; and &quot;as available,&quot; without warranties of any kind,
        including availability, accuracy, fitness for a particular purpose, or
        non-infringement.
      </>,
      <>
        To the maximum extent permitted by law, we are not liable for indirect,
        incidental, special, consequential, or exemplary damages, including loss
        of data, revenue, or business opportunities.
      </>,
    ],
    zhTitle: "7. 免责声明和责任限制",
    zh: [
      <>
        在法律允许的最大范围内，本服务按“现状”和“可用”提供，不作任何形式的保证，包括可用性、准确性、特定用途适用性或不侵权保证。
      </>,
      <>
        在法律允许的最大范围内，我们不对间接、附带、特殊、后果性或惩罚性损害负责，包括数据、收入或商业机会损失。
      </>,
    ],
  },
  {
    enTitle: "8. Updates and Contact",
    en: [
      <>
        We may update these Terms from time to time. Material changes will be
        posted on this page with a revised effective date.
      </>,
      <>
        For legal or privacy-related questions about these Terms, contact us at
        <a href="mailto:privacy@taskneo.space"> privacy@taskneo.space </a>.
      </>,
    ],
    zhTitle: "8. 更新和联系方式",
    zh: [
      <>我们可能会不时更新本条款。重大变更将发布在本页面，并更新生效日期。</>,
      <>
        如有法律或隐私相关问题，请通过
        <a href="mailto:privacy@taskneo.space"> privacy@taskneo.space </a>
        联系我们。
      </>,
    ],
  },
];

function ParagraphList({ items }: { items: ReactNode[] }) {
  return Children.toArray(items).map((item) => (
    <p key={(item as { key?: string | null }).key ?? String(item)}>{item}</p>
  ));
}

function MobileArticle({
  id,
  title,
  introItems,
  titleKey,
  contentKey,
}: {
  id?: string;
  title: string;
  introItems: ReactNode[];
  titleKey: "enTitle" | "zhTitle";
  contentKey: "en" | "zh";
}) {
  return (
    <article
      id={id}
      className="prose prose-stone scroll-mt-8 dark:prose-invert space-y-4 text-sm text-muted-foreground"
    >
      <h2 className="text-display !text-foreground">{title}</h2>
      <ParagraphList items={introItems} />
      {sections.map((section) => (
        <section key={section[titleKey]} className="space-y-4">
          <h3 className="text-heading-md !text-foreground">
            {section[titleKey]}
          </h3>
          <ParagraphList items={section[contentKey]} />
        </section>
      ))}
    </article>
  );
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-display">Terms of Service</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            English controls. 简体中文译文仅供参考。
          </p>
        </div>
        <a
          href="#terms-zh"
          className="text-sm text-primary underline-offset-4 hover:underline lg:hidden"
        >
          跳到简体中文
        </a>
      </div>

      <div className="lg:hidden">
        <MobileArticle
          title="Terms of Service"
          introItems={intro.en}
          titleKey="enTitle"
          contentKey="en"
        />
        <MobileArticle
          id="terms-zh"
          title="服务条款"
          introItems={intro.zh}
          titleKey="zhTitle"
          contentKey="zh"
        />
      </div>

      <div className="hidden lg:block">
        <div className="grid grid-cols-2 gap-x-10 border-b border-border pb-8">
          <article className="prose prose-stone dark:prose-invert space-y-4 text-sm text-muted-foreground">
            <h2 className="text-display !text-foreground">Terms of Service</h2>
            <ParagraphList items={intro.en} />
          </article>
          <article className="prose prose-stone dark:prose-invert space-y-4 text-sm text-muted-foreground">
            <h2 className="text-display !text-foreground">服务条款</h2>
            <ParagraphList items={intro.zh} />
          </article>
        </div>
        <div className="divide-y divide-border">
          {sections.map((section) => (
            <div
              key={section.enTitle}
              className="grid grid-cols-2 gap-x-10 py-8"
            >
              <section className="prose prose-stone dark:prose-invert space-y-4 text-sm text-muted-foreground">
                <h3 className="text-heading-md !text-foreground">
                  {section.enTitle}
                </h3>
                <ParagraphList items={section.en} />
              </section>
              <section className="prose prose-stone dark:prose-invert space-y-4 text-sm text-muted-foreground">
                <h3 className="text-heading-md !text-foreground">
                  {section.zhTitle}
                </h3>
                <ParagraphList items={section.zh} />
              </section>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
