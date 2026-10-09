import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getFarm, FarmValidationError } from "@/features/farms/service";
import { updateFarmAction } from "@/features/farms/actions";
import { FarmForm } from "@/components/farms/farm-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default async function FarmPage({ params }: { params: Promise<{ farmId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const { farmId } = await params;
  let farm;
  try {
    farm = await getFarm(farmId);
  } catch (error) {
    if (error instanceof FarmValidationError) notFound();
    throw error;
  }
  if (!farm) notFound();
  return (
    <div className="space-y-8">
      <Link className="text-sm underline underline-offset-4" href="/app">← All farms</Link>
      <div><p className="mb-2 text-sm text-muted-foreground">Farm</p><h1 className="text-3xl font-semibold tracking-tight">{farm.name}</h1></div>
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Farm details</h2></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Created {farm.createdAt.toLocaleDateString()}</p>
          <p>Updated {farm.updatedAt.toLocaleDateString()}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Edit farm</h2></CardHeader>
        <CardContent><FarmForm mode="edit" initialName={farm.name} action={updateFarmAction.bind(null, farm.id)} /></CardContent>
      </Card>
    </div>
  );
}
