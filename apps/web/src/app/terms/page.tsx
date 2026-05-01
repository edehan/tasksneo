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
      如本条款提供翻译版本，翻译仅为方便阅读。如不同语言版本存在不一致，以英文版本为准。
    </>,
  ],
};

const sections: LegalSection[] = [
  {
    enTitle: "1. Service Scope and Public Beta Status",
    en: [
      <>
        TaskNeo is currently provided as a public beta, pre-release, and
        personal hobby project. Features may change, be interrupted, or be
        removed at any time.
      </>,
      <>
        We do not guarantee long-term availability or persistence of user data.
        Please do not upload or store important files, legal records, or other
        critical information in this service.
      </>,
    ],
    zhTitle: "1. 服务范围和公测状态",
    zh: [
      <>
        TaskNeo 目前作为公测、预发布和个人 hobby
        项目提供。功能可能随时变更、中断或移除。
      </>,
      <>
        我们不保证服务的长期可用性或用户数据的持久保存。请不要在本服务中上传或存储重要文件、法律记录或其他关键资料。
      </>,
    ],
  },
  {
    enTitle: "2. Eligibility and Account Responsibility",
    en: [
      <>
        You must use the service in compliance with applicable law. You are
        responsible for activities under your account and for keeping your
        credentials secure.
      </>,
    ],
    zhTitle: "2. 资格和账号责任",
    zh: [
      <>
        你必须遵守适用法律使用本服务。你需要对账号下的活动负责，并妥善保管账号凭证。
      </>,
    ],
  },
  {
    enTitle: "3. Acceptable Use",
    en: [
      <>
        You must not misuse the service, interfere with security or performance,
        attempt unauthorized access, upload unlawful content, or use TaskNeo in
        a way that harms other users or the platform.
      </>,
    ],
    zhTitle: "3. 可接受使用",
    zh: [
      <>
        你不得滥用服务、干扰安全或性能、尝试未经授权的访问、上传违法内容，或以伤害其他用户或平台的方式使用
        TaskNeo。
      </>,
    ],
  },
  {
    enTitle: "4. Content",
    en: [
      <>
        You retain ownership of your content. By uploading content, you grant
        TaskNeo a limited license to store, process, transmit, and display that
        content only as needed to operate the service features you request.
      </>,
    ],
    zhTitle: "4. 内容",
    zh: [
      <>
        你保留对自己内容的所有权。上传内容即表示你授予 TaskNeo
        一项有限许可，使我们可以在提供你请求的服务功能所需范围内存储、处理、传输和展示该内容。
      </>,
    ],
  },
  {
    enTitle: "5. Data Storage and International Processing",
    en: [
      <>
        Our primary servers and user data are currently hosted in Hong Kong SAR, China.
        Depending on the features you use, selected data may be processed by
        subprocessors outside your country or region.
      </>,
    ],
    zhTitle: "5. 数据存储和跨境处理",
    zh: [
      <>
        我们的主要服务器和用户数据目前托管在中国香港特别行政区。根据你使用的功能，部分选定数据可能会由你所在国家或地区以外的次级处理方处理。
      </>,
    ],
  },
  {
    enTitle: "6. AI and Speech Processing Features",
    en: [
      <>
        If you use AI-assisted features, selected task content may be sent to
        our subprocessor OpenAI for processing. If you use speech recognition
        features, audio or speech data is processed by our subprocessor
        AssemblyAI.
      </>,
      <>
        OpenAI and AssemblyAI are used as zero data retention (ZDR)
        subprocessors for these requests. We design these integrations not to
        intentionally include directly identifiable personal information unless
        it is part of the content you choose to submit.
      </>,
    ],
    zhTitle: "6. AI 和语音处理功能",
    zh: [
      <>
        如果你使用 AI 辅助功能，选定的任务内容可能会发送给我们的次级处理方
        OpenAI
        进行处理。如果你使用语音识别功能，音频或语音数据由我们的次级处理方
        AssemblyAI 处理。
      </>,
      <>
        OpenAI 和 AssemblyAI
        在这些请求中作为零数据保留（ZDR）次级处理方使用。除非你主动提交的内容中包含可直接识别个人身份的信息，我们会尽量避免在这些集成中主动包含此类信息。
      </>,
    ],
  },
  {
    enTitle: "7. Public Beta Analytics",
    en: [
      <>
        During the public beta, frontend pages may include scripts from New
        Relic, Inc. that collect real user monitoring (RUM), performance, and
        usage analytics. This data is used only to understand reliability,
        latency, errors, and product usage during the beta, is not linked to
        your user account, and will be deleted within 30 days after the public
        beta ends.
      </>,
    ],
    zhTitle: "7. 公测分析",
    zh: [
      <>
        公测期间，前端页面可能包含来自 New Relic, Inc.
        的脚本，用于收集真实用户监控（RUM）、性能和使用分析数据。这些数据仅用于了解公测期间的可靠性、延迟、错误和产品使用情况，不会与你的用户账号关联，并将在公测结束后
        30 天内删除。
      </>,
    ],
  },
  {
    enTitle: "8. Schools and Minors",
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
    zhTitle: "8. 学校和未成年人",
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
    enTitle: "9. Data Controls and Deletion Retention",
    en: [
      <>
        You may export and delete your data through available product controls.
        Data deletion and lifecycle handling follow our platform rules and
        technical design.
      </>,
      <>
        After account deletion, relevant data may remain in backup systems for
        up to 30 days and will then be deleted on a rolling basis.
      </>,
    ],
    zhTitle: "9. 数据控制和删除保留",
    zh: [
      <>
        你可以通过产品内可用控制功能导出和删除数据。数据删除和生命周期处理遵循我们的平台规则和技术设计。
      </>,
      <>
        账号删除后，相关数据可能会在备份系统中保留最多 30
        天，随后按滚动机制删除。
      </>,
    ],
  },
  {
    enTitle: "10. Content Removal for Legal and Terms Violations",
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
    ],
    zhTitle: "10. 因违法或违反条款而移除内容",
    zh: [
      <>
        如果用户上传内容包含恐怖主义内容、儿童性虐待材料（CSAM）或其他违反适用法律或本条款的内容，我们可能会移除相关违规内容。
      </>,
      <>对于被移除的违规内容，我们不提供恢复、导出或重新下载。</>,
    ],
  },
  {
    enTitle: "11. Suspension and Termination",
    en: [
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
    zhTitle: "11. 暂停和终止",
    zh: [
      <>
        我们可能随时更新、暂停或停止服务的任何部分。对于违反本条款，或出于安全、法律或运营原因，我们可能暂停或终止访问。
      </>,
      <>我们保留暂停或终止严重或重复违规账号的权利。</>,
    ],
  },
  {
    enTitle: "12. Third-Party Services",
    en: [
      <>
        The service may rely on third-party providers, including hosting,
        storage, email, analytics, AI, and speech recognition providers. Their
        services may have separate terms, privacy practices, and availability
        conditions.
      </>,
    ],
    zhTitle: "12. 第三方服务",
    zh: [
      <>
        本服务可能依赖第三方服务商，包括托管、存储、邮件、分析、AI
        和语音识别服务商。其服务可能适用单独的条款、隐私实践和可用性条件。
      </>,
    ],
  },
  {
    enTitle: "13. Warranty Disclaimer",
    en: [
      <>
        To the maximum extent permitted by law, the service is provided &quot;as
        is&quot; and &quot;as available,&quot; without warranties of any kind,
        including availability, accuracy, fitness for a particular purpose, or
        non-infringement.
      </>,
    ],
    zhTitle: "13. 免责声明",
    zh: [
      <>
        在法律允许的最大范围内，本服务按“现状”和“可用”提供，不作任何形式的保证，包括可用性、准确性、特定用途适用性或不侵权保证。
      </>,
    ],
  },
  {
    enTitle: "14. Limitation of Liability",
    en: [
      <>
        To the maximum extent permitted by law, we are not liable for indirect,
        incidental, special, consequential, or exemplary damages, including loss
        of data, revenue, or business opportunities.
      </>,
    ],
    zhTitle: "14. 责任限制",
    zh: [
      <>
        在法律允许的最大范围内，我们不对间接、附带、特殊、后果性或惩罚性损害负责，包括数据、收入或商业机会损失。
      </>,
    ],
  },
  {
    enTitle: "15. Changes to These Terms",
    en: [
      <>
        We may update these Terms from time to time. Material changes will be
        posted on this page with a revised effective date.
      </>,
    ],
    zhTitle: "15. 条款变更",
    zh: [
      <>我们可能会不时更新本条款。重大变更将发布在本页面，并更新生效日期。</>,
    ],
  },
  {
    enTitle: "16. Contact",
    en: [
      <>
        For legal or privacy-related questions about these Terms, contact us at
        <a href="mailto:privacy@taskneo.space"> privacy@taskneo.space </a>.
      </>,
    ],
    zhTitle: "16. 联系方式",
    zh: [
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
