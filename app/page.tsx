import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-6 py-16">
      <div className="w-full max-w-xl space-y-6">
        <p className="text-sm font-medium text-muted-foreground">Your farm. Your fields.</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Field Monitoring</h1>
        <p className="max-w-md text-lg leading-relaxed text-muted-foreground">
          A workspace for your farms and fields, with vegetation monitoring to follow.
        </p>
        <Link href="/sign-in" className={buttonVariants({ size: "lg" })}>Sign in</Link>
      </div>
    </main>
  );
}
