import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plug } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function Connecteurs() {
  const { userRole } = useAuth();
  const isClient = userRole === 'client';
  
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
              {isClient ? 'Consultez les intégrations disponibles' : 'Gestion des intégrations et connecteurs externes'}
            </p>
          </div>
        </div>

        {isClient && (
          <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Information :</strong> Vous pouvez consulter les connecteurs configurés pour votre compte. 
                Pour ajouter ou modifier des intégrations, veuillez contacter votre gestionnaire.
              </p>
            </CardContent>
          </Card>
        )}

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
