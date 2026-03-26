export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-display mb-8">Terms of Service</h1>
      <div className="prose prose-stone dark:prose-invert space-y-4 text-sm text-muted-foreground">
        <p>
          These Terms of Service govern your use of TaskFlow. By creating an
          account or using the service, you agree to these terms.
        </p>
        <h2 className="text-heading-md !text-foreground">1. Acceptance of Terms</h2>
        <p>
          By accessing or using TaskFlow, you agree to be bound by these Terms of
          Service. If you do not agree, please do not use the service.
        </p>
        <h2 className="text-heading-md !text-foreground">2. User Accounts</h2>
        <p>
          You are responsible for maintaining the security of your account
          credentials and for all activities that occur under your account.
        </p>
        <h2 className="text-heading-md !text-foreground">3. Acceptable Use</h2>
        <p>
          You agree to use TaskFlow only for lawful educational purposes. You
          shall not misuse the service or attempt to access it through
          unauthorized means.
        </p>
        <h2 className="text-heading-md !text-foreground">4. Content</h2>
        <p>
          You retain ownership of content you upload. By uploading content, you
          grant TaskFlow a limited license to store and serve it within the
          platform.
        </p>
        <h2 className="text-heading-md !text-foreground">5. Termination</h2>
        <p>
          We reserve the right to suspend or terminate accounts that violate
          these terms.
        </p>
        <p className="pt-4 text-xs text-muted-foreground/60">
          This is a placeholder document. A complete Terms of Service will be
          published before the service becomes publicly available.
        </p>
      </div>
    </div>
  );
}
