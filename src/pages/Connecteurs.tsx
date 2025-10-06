import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plug } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function Connecteurs() {
  const { userRole } = useAuth();
  
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
              {userRole === 'client' ? 'Consultez les intégrations disponibles' : 'Gestion des intégrations et connecteurs externes'}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Connecteurs Disponibles</CardTitle>
            <CardDescription>
              {userRole === 'client' ? 'Intégrations configurées pour votre compte' : 'Intégrations avec des systèmes tiers'}
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
