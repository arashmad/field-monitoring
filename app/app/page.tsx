import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { listFarms } from "@/features/farms/service";
import { createFarmAction } from "@/features/farms/actions";
import { FarmForm } from "@/components/farms/farm-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default async function AppPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const farms = await listFarms();
  return (
    <div className="space-y-8">
      <div><p className="mb-2 text-sm text-muted-foreground">Your workspace</p><h1 className="text-3xl font-semibold tracking-tight">Welcome, {user.name}</h1></div>
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Your farms</h2></CardHeader>
        <CardContent>
          {farms.length === 0 ? <p className="text-muted-foreground">You have no farms yet. Create one to get started.</p> : (
            <ul className="space-y-2">{farms.map((farm) => <li key={farm.id}><Link className="underline underline-offset-4" href={`/app/farms/${farm.id}`}>{farm.name}</Link></li>)}</ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Create a farm</h2></CardHeader>
        <CardContent><FarmForm mode="create" action={createFarmAction} /></CardContent>
      </Card>
    </div>
  );
}
