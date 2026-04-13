import { LocaleSwitcher } from "@/components/locale-switcher";
import { PageTransition } from "@/components/page-transition";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="absolute right-4 top-4">
        <LocaleSwitcher />
      </div>
      <PageTransition className="w-full max-w-md">{children}</PageTransition>
    </div>
  );
}
