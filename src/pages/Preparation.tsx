import { DashboardLayout } from "@/components/DashboardLayout";
import { SessionsList } from "@/components/SessionsList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, ScanLine } from "lucide-react";

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
              Gestion des sessions de préparation et picking mobile
            </p>
          </div>
        </div>

        <Tabs defaultValue="sessions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="sessions">
              <ClipboardList className="h-4 w-4 mr-2" />
              Sessions de préparation
            </TabsTrigger>
            <TabsTrigger value="picking">
              <ScanLine className="h-4 w-4 mr-2" />
              Préparation de commandes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sessions">
            <SessionsList />
          </TabsContent>

          <TabsContent value="picking">
            <div className="text-center py-12 text-muted-foreground">
              Sélectionnez une session dans l'onglet "Sessions de préparation" pour commencer le picking
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
