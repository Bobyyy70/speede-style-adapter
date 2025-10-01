import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList } from "lucide-react";

export default function Preparation() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <ClipboardList className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Préparation de Commandes</h1>
            <p className="text-muted-foreground">
              Gestion des ordres de picking et préparation
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ordres de Préparation</CardTitle>
            <CardDescription>
              Liste des commandes à préparer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Interface de préparation de commandes à venir
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
