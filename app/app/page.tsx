import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default async function AppPage() {
  // Page guards are required even when the parent layout checks authentication.
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return (
    <div className="space-y-8">
      <div><p className="mb-2 text-sm text-muted-foreground">Your workspace</p><h1 className="text-3xl font-semibold tracking-tight">Welcome, {user.name}</h1></div>
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Your farms and fields</h2></CardHeader>
        <CardContent><p className="text-muted-foreground">Farm and field management is coming next. Your workspace is ready.</p></CardContent>
      </Card>
    </div>
  );
}
