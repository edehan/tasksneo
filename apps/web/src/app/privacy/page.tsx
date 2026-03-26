export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-display mb-8">Privacy Policy</h1>
      <div className="prose prose-stone dark:prose-invert space-y-4 text-sm text-muted-foreground">
        <p>
          This Privacy Policy describes how TaskFlow collects, uses, and
          protects your personal information.
        </p>
        <h2 className="text-heading-md !text-foreground">1. Information We Collect</h2>
        <p>
          We collect information you provide directly, including your email
          address, nickname, school affiliation, and any files you upload as
          task submissions.
        </p>
        <h2 className="text-heading-md !text-foreground">2. How We Use Your Information</h2>
        <p>
          Your information is used to provide the TaskFlow service, including
          account management, task notifications, and class collaboration
          features.
        </p>
        <h2 className="text-heading-md !text-foreground">3. Data Storage</h2>
        <p>
          Your data is stored securely on our servers. Uploaded files are stored
          in our object storage system and are only accessible to authorized
          users within the relevant class context.
        </p>
        <h2 className="text-heading-md !text-foreground">4. Email Communications</h2>
        <p>
          We send transactional emails for account verification, password
          resets, and task notifications. You can manage notification
          preferences in your account settings.
        </p>
        <h2 className="text-heading-md !text-foreground">5. Data Deletion</h2>
        <p>
          You can delete your account at any time from the account settings
          page. This will permanently remove your personal data and
          submissions.
        </p>
        <p className="pt-4 text-xs text-muted-foreground/60">
          This is a placeholder document. A complete Privacy Policy will be
          published before the service becomes publicly available.
        </p>
      </div>
    </div>
  );
}
