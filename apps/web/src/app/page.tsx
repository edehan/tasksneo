import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-start justify-center gap-4 px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">TaskFlow</h1>
      <p className="text-muted-foreground">
        Frontend admin control plane is now available.
      </p>
      <Link
        href="/admin"
        className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Open Admin Control Plane
      </Link>
    </main>
  );
}
