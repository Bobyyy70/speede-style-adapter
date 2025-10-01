import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plug } from "lucide-react";

export default function Connecteurs() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Plug className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Connecteurs</h1>
            <p className="text-muted-foreground">
              Gestion des intégrations et connecteurs externes
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Connecteurs Disponibles</CardTitle>
            <CardDescription>
              Intégrations avec des systèmes tiers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Liste des connecteurs à venir
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
