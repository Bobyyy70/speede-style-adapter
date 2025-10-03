import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, ClipboardList, TruckIcon } from "lucide-react";
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

        <Tabs defaultValue="liste" className="space-y-4">
          <TabsList>
            <TabsTrigger value="liste">
              <Package className="mr-2 h-4 w-4" />
              Liste des commandes
            </TabsTrigger>
            <TabsTrigger value="preparation">
              <ClipboardList className="mr-2 h-4 w-4" />
              Préparation
            </TabsTrigger>
            <TabsTrigger value="expedition">
              <TruckIcon className="mr-2 h-4 w-4" />
              Expédition
            </TabsTrigger>
          </TabsList>

          <TabsContent value="liste" className="space-y-4">
            <CommandesList />
          </TabsContent>

          <TabsContent value="preparation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Préparation de commandes</CardTitle>
                <CardDescription>
                  Interface de préparation et picking
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Interface de préparation à venir
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expedition" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Expédition</CardTitle>
                <CardDescription>
                  Préparation des départs et coordination transporteurs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Interface d'expédition à venir
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
