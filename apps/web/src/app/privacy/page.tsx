export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-display mb-8">Privacy Policy</h1>
      <div className="prose prose-stone dark:prose-invert space-y-4 text-sm text-muted-foreground">
        <p>
          Effective date: April 10, 2026. This Privacy Policy
          explains how TaskFlow collects, uses, stores, shares, and protects
          personal data.
        </p>
        <p>
          We value your privacy. We use standard technical and organizational
          safeguards designed to protect your data and handle it responsibly.
        </p>
        <h2 className="text-heading-md !text-foreground">
          1. Scope
        </h2>
        <p>
          This Policy applies to information processed when you use TaskFlow
          websites and services.
        </p>
        <h2 className="text-heading-md !text-foreground">
          2. Information We Collect
        </h2>
        <p>
          We collect information you provide directly, including account data
          (such as email, nickname, and school affiliation), classroom and task
          data, submissions, uploaded files, and support communications.
        </p>
        <p>
          We also collect limited technical and usage information needed to
          secure, operate, and improve the service.
        </p>
        <h2 className="text-heading-md !text-foreground">
          3. How We Use Your Information
        </h2>
        <p>
          Your information is used to provide the TaskFlow service, including
          account management, authentication, collaboration, notifications,
          storage, customer support, fraud prevention, and requested product
          features.
        </p>
        <h2 className="text-heading-md !text-foreground">
          4. Data Storage Location and International Transfers
        </h2>
        <p>
          To improve system performance and response times, we may transfer,
          store, and process your personal data outside the European Economic
          Area (EEA). Uploaded files are stored in our object storage system
          and are accessible only to authorized users under the relevant access
          controls.
        </p>
        <p>
          If you do not agree to this change, you must delete your account and
          stop using the service before April 10, 2026, 00:00 UTC.
        </p>
        <h2 className="text-heading-md !text-foreground">
          5. Security and Compliance by Design
        </h2>
        <p>
          During development, we applied significant compliance considerations
          to data ownership, deletion behavior, and recoverability. These
          controls are reflected in our system design, code, and data
          structures.
        </p>
        <h2 className="text-heading-md !text-foreground">
          6. Data Sharing and Subprocessors
        </h2>
        <p>
          We may share data with trusted infrastructure providers that help us
          operate TaskFlow (for example, hosting, storage, and email vendors),
          under appropriate contractual and security controls.
        </p>
        <h2 className="text-heading-md !text-foreground">
          7. AI Parsing and Cross-Border Transfers
        </h2>
        <p>
          When you use AI parsing while creating a task, selected task content
          is sent to our subprocessor OpenAI for processing. This may involve
          cross-border transfer outside the EEA.
        </p>
        <p>
          For this AI parsing request, we are designed not to intentionally
          include directly identifiable personal information in the payload.
        </p>
        <h2 className="text-heading-md !text-foreground">
          8. Email Communications
        </h2>
        <p>
          We send transactional emails for account verification, password
          resets, and task notifications. You can manage notification
          preferences in your account settings.
        </p>
        <h2 className="text-heading-md !text-foreground">
          9. Data Retention and Demo Service Notice
        </h2>
        <p>
          We retain data for as long as needed to operate the service, satisfy
          legal requirements, and enforce agreements.
        </p>
        <p>
          If you delete your account, relevant data may remain in backup
          systems for up to 30 days and will then be deleted on a rolling
          basis.
        </p>
        <p>
          TaskFlow is a demonstration website. We do not guarantee persistence
          or long-term retention of user data. Please do not store important
          files or critical records in this service.
        </p>
        <h2 className="text-heading-md !text-foreground">
          10. Content Removal for Legal and Terms Violations
        </h2>
        <p>
          If user-uploaded content contains terrorist content, child sexual
          abuse material (CSAM), or other content that violates applicable law
          or our Terms of Service, we may remove the relevant violating
          content.
        </p>
        <p>
          For removed violating content, we do not provide restoration, export,
          or re-download.
        </p>
        <p>
          We also reserve the right to suspend or terminate accounts involved
          in serious or repeated violations.
        </p>
        <h2 className="text-heading-md !text-foreground">
          11. Your Privacy Rights
        </h2>
        <p>
          Depending on your location and applicable law, you may have rights to
          access, correct, delete, or export your data, and to object to or
          restrict certain processing.
        </p>
        <p>
          You can export and delete your data through available account controls
          or by contacting us.
        </p>
        <h2 className="text-heading-md !text-foreground">
          12. Children
        </h2>
        <p>
          TaskFlow is not intended for children under the age required by
          applicable law to use this kind of service independently.
        </p>
        <h2 className="text-heading-md !text-foreground">
          13. Policy Updates
        </h2>
        <p>
          We may update this Privacy Policy from time to time. Material changes
          will be posted on this page with an updated effective date.
        </p>
        <h2 className="text-heading-md !text-foreground">14. Contact</h2>
        <p>
          For privacy-related questions or requests, contact us at
          <a href="mailto:privacy@taskneo.space"> privacy@taskneo.space </a>.
        </p>
      </div>
    </div>
  );
}
