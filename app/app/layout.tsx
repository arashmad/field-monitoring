import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { SessionSync } from "@/components/auth/session-sync";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return (
    <div className="min-h-screen bg-muted/20">
      <SessionSync />
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <nav aria-label="Application"><Link href="/app" className="font-semibold tracking-tight">Field Monitoring</Link></nav>
          <div className="flex items-center gap-4"><span className="text-sm text-muted-foreground">{user.email}</span><SignOutButton /></div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-12">{children}</main>
    </div>
  );
}
