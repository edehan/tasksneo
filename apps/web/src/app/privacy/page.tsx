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
      Effective date: May 1, 2026. This Privacy Policy explains how TaskNeo
      collects, uses, stores, shares, and protects personal data.
    </>,
    <>
      Important: TaskNeo is currently operated as a personal hobby project and
      public beta. We use reasonable safeguards, but we cannot guarantee
      long-term stability, availability, or data persistence. Please keep your
      own backups and do not store the only copy of important files, legal
      records, or critical information here.
    </>,
    <>
      If a translated version of this Policy is provided, it is for convenience
      only. The English version controls in case of any inconsistency.
    </>,
  ],
  zh: [
    <>
      生效日期：2026 年 5 月 1 日。本隐私政策说明 TaskNeo
      如何收集、使用、存储、共享和保护个人数据。
    </>,
    <>
      重要提示：TaskNeo
      目前是个人兴趣运营的公测服务。我们会采用合理的安全措施，但无法保证长期稳定、持续可用或数据持久保存。请自行保留备份，不要把重要文件、法律记录或关键资料的唯一副本存放在这里。
    </>,
    <>
      如本政策提供翻译版本，翻译仅为方便阅读。如不同语言版本存在不一致，以英文版本为准。
    </>,
  ],
};

const sections: LegalSection[] = [
  {
    enTitle: "1. Information We Collect and Use",
    en: [
      <>
        This Policy applies when you use TaskNeo websites and services. We
        collect information you provide directly, including account data (such
        as email, nickname, and school affiliation), classroom and task data,
        submissions, uploaded files, and support communications.
      </>,
      <>
        We also collect limited technical and usage information needed to
        secure, operate, measure reliability, and improve the service. Your
        information is used to provide the TaskNeo service, including account
        management, authentication, collaboration, notifications, storage,
        customer support, fraud prevention, and requested product features.
      </>,
    ],
    zhTitle: "1. 我们收集和使用的信息",
    zh: [
      <>
        本政策适用于你使用 TaskNeo
        网站和服务时被处理的信息。我们会收集你直接提供的信息，包括账号信息（例如邮箱、昵称和学校信息）、班级和任务数据、提交内容、上传文件以及支持沟通内容。
      </>,
      <>
        我们也会收集有限的技术和使用信息，用于保障安全、运行服务、衡量可靠性和改进产品。我们使用你的信息来提供
        TaskNeo
        服务，包括账号管理、身份验证、协作、通知、存储、客户支持、防止滥用以及你请求的产品功能。
      </>,
    ],
  },
  {
    enTitle: "2. Storage, Transfers, and Security",
    en: [
      <>
        Our primary servers and user data are currently hosted in Hong Kong SAR,
        China. Uploaded files are stored in our object storage system and are
        accessible only to authorized users under the relevant access controls.
      </>,
      <>
        Depending on the features you use, selected data may be processed by
        subprocessors outside your country or region. We use these providers
        only as needed to deliver the requested service features.
      </>,
      <>
        We use reasonable technical and organizational safeguards and have
        designed the service with data ownership, deletion behavior, and
        recoverability in mind.
      </>,
    ],
    zhTitle: "2. 存储、跨境处理和安全",
    zh: [
      <>
        我们的主要服务器和用户数据目前托管在中国香港特别行政区。上传文件存储在我们的对象存储系统中，并仅向通过相关访问控制授权的用户开放。
      </>,
      <>
        根据你使用的功能，部分选定数据可能会由你所在国家或地区以外的次级数据处理方处理。我们仅在提供相关服务功能所必需的范围内使用这些服务商。
      </>,
      <>
        我们采用合理的技术和组织安全措施，并在服务设计中考虑数据所有权、删除行为和可恢复性。
      </>,
    ],
  },
  {
    enTitle: "3. Sharing and Feature Providers",
    en: [
      <>
        We may share data with trusted infrastructure providers that help us
        operate TaskNeo (for example, hosting, storage, and email vendors),
        under appropriate contractual and security controls.
      </>,
      <>
        When you use AI-assisted features, such as AI parsing while creating a
        task, selected task content may be sent to our subprocessor OpenAI for
        processing. When you use speech recognition features, audio or speech
        data is processed by our subprocessor AssemblyAI.
      </>,
      <>
        OpenAI and AssemblyAI are used as zero data retention (ZDR)
        subprocessors for these requests. We do not use these feature payloads
        to identify you beyond what is needed to operate the request, and we
        design these integrations not to intentionally include directly
        identifiable personal information unless it is part of the content you
        choose to submit.
      </>,
    ],
    zhTitle: "3. 数据共享和功能服务商",
    zh: [
      <>
        我们可能会与帮助我们运行 TaskNeo
        的可信基础设施服务商共享数据，例如托管、存储和邮件服务商，并采用适当的合同和安全控制。
      </>,
      <>
        当你使用 AI 辅助功能（例如创建任务时的 AI
        解析）时，选定的任务内容可能会发送给我们的次级处理方 OpenAI
        进行处理。当你使用语音识别功能时，音频或语音数据由我们的次级处理方
        AssemblyAI 处理。
      </>,
      <>
        OpenAI 和 AssemblyAI
        在这些请求中作为零数据保留（ZDR）次级处理方使用。除运行请求所需外，我们不会使用这些功能载荷来识别你；除非你主动提交的内容中包含可直接识别个人身份的信息，我们也会尽量避免在这些集成中主动包含此类信息。
      </>,
    ],
  },
  {
    enTitle: "4. Public Beta Analytics",
    en: [
      <>
        During the public beta, our frontend pages may include scripts from New
        Relic, Inc. that collect real user monitoring (RUM), performance, and
        usage analytics. This data is used only to understand reliability,
        latency, errors, and product usage during the beta.
      </>,
      <>
        Beta analytics data is not linked to your user account, is not used for
        advertising or sale, and will be deleted within 30 days after the public
        beta ends.
      </>,
    ],
    zhTitle: "4. 公测分析",
    zh: [
      <>
        公测期间，我们的前端页面可能包含来自 New Relic, Inc.
        的脚本，用于收集真实用户监控（RUM）、性能和使用分析数据。这些数据仅用于了解公测期间的可靠性、延迟、错误和产品使用情况。
      </>,
      <>
        公测分析数据不会与你的用户账号关联，不会用于广告或出售，并将在公测结束后
        30 天内删除。
      </>,
    ],
  },
  {
    enTitle: "5. Retention and Deletion",
    en: [
      <>
        We retain data for as long as needed to operate the service, satisfy
        legal requirements, and enforce agreements.
      </>,
      <>
        If you delete your account, relevant data may remain in backup systems
        for up to 30 days and will then be deleted on a rolling basis.
      </>,
      <>
        Because TaskNeo is a public beta, product changes or service
        interruptions may affect data availability as described in the{" "}
        <a href="/terms">Terms of Service</a>.
      </>,
    ],
    zhTitle: "5. 保留和删除",
    zh: [
      <>我们会在运行服务、满足法律要求和执行协议所需的期限内保留数据。</>,
      <>
        如果你删除账号，相关数据可能会在备份系统中保留最多 30
        天，随后按滚动机制删除。
      </>,
      <>
        由于 TaskNeo 处于公测阶段，产品变更或服务中断可能会影响数据可用性，详见
        <a href="/terms">服务条款</a>。
      </>,
    ],
  },
  {
    enTitle: "6. Your Privacy Rights",
    en: [
      <>
        Depending on your location and applicable law, you may have rights to
        access, correct, delete, or export your data, and to object to or
        restrict certain processing.
      </>,
      <>
        You can export and delete your data through available account controls
        or by contacting us.
      </>,
    ],
    zhTitle: "6. 你的隐私权利",
    zh: [
      <>
        根据你所在地和适用法律，你可能拥有访问、更正、删除或导出数据，以及反对或限制某些处理活动的权利。
      </>,
      <>你可以通过产品内可用的账号控制功能或联系我们来导出和删除数据。</>,
    ],
  },
  {
    enTitle: "7. Updates and Contact",
    en: [
      <>
        We may update this Privacy Policy from time to time. Material changes
        will be posted on this page with an updated effective date.
      </>,
      <>
        For privacy-related questions or requests, contact us at
        <a href="mailto:privacy@taskneo.space"> privacy@taskneo.space </a>.
      </>,
    ],
    zhTitle: "7. 更新和联系方式",
    zh: [
      <>
        我们可能会不时更新本隐私政策。重大变更将发布在本页面，并更新生效日期。
      </>,
      <>
        如有隐私相关问题或请求，请通过
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

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-display">Privacy Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            English controls. 简体中文译文仅供参考。
          </p>
        </div>
        <a
          href="#privacy-zh"
          className="text-sm text-primary underline-offset-4 hover:underline lg:hidden"
        >
          跳到简体中文
        </a>
      </div>

      <div className="lg:hidden">
        <MobileArticle
          title="Privacy Policy"
          introItems={intro.en}
          titleKey="enTitle"
          contentKey="en"
        />
        <MobileArticle
          id="privacy-zh"
          title="隐私政策"
          introItems={intro.zh}
          titleKey="zhTitle"
          contentKey="zh"
        />
      </div>

      <div className="hidden lg:block">
        <div className="grid grid-cols-2 gap-x-10 border-b border-border pb-8">
          <article className="prose prose-stone dark:prose-invert space-y-4 text-sm text-muted-foreground">
            <h2 className="text-display !text-foreground">Privacy Policy</h2>
            <ParagraphList items={intro.en} />
          </article>
          <article className="prose prose-stone dark:prose-invert space-y-4 text-sm text-muted-foreground">
            <h2 className="text-display !text-foreground">隐私政策</h2>
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
