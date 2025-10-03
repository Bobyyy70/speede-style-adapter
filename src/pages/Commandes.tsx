import { DashboardLayout } from "@/components/DashboardLayout";
import { CommandesList } from "@/components/CommandesList";

export default function Commandes() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Commandes</h1>
          <p className="text-muted-foreground">
            Gestion complète des commandes clients
          </p>
        </div>

        <CommandesList />
      </div>
    </DashboardLayout>
  );
}
