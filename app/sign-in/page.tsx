import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { SignInForm } from "@/components/auth/sign-in-form";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

export default async function SignInPage() {
  if (await getCurrentUser()) redirect("/app");
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-sm space-y-6">
        <Link href="/" className="block text-center text-sm font-semibold tracking-tight">Field Monitoring</Link>
        <Card>
          <CardHeader>
            <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
            <CardDescription>Welcome back. Sign in to your workspace.</CardDescription>
          </CardHeader>
          <CardContent><SignInForm /></CardContent>
        </Card>
        <p className="text-center text-sm text-muted-foreground">Use the account provided by your administrator.</p>
      </div>
    </main>
  );
}
