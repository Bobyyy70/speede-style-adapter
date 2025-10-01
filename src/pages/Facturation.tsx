import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Package, Download, BarChart3 } from "lucide-react";

export default function Facturation() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Facturation</h1>
          <p className="text-muted-foreground">
            Gestion de la facturation et du chiffre d'affaires
          </p>
        </div>

        <Tabs defaultValue="factures" className="space-y-4">
          <TabsList>
            <TabsTrigger value="factures">
              <FileText className="mr-2 h-4 w-4" />
              Factures clients
            </TabsTrigger>
            <TabsTrigger value="prestations">
              <Package className="mr-2 h-4 w-4" />
              Prestations logistiques
            </TabsTrigger>
            <TabsTrigger value="exports">
              <Download className="mr-2 h-4 w-4" />
              Exports comptables
            </TabsTrigger>
            <TabsTrigger value="ca">
              <BarChart3 className="mr-2 h-4 w-4" />
              Tableau de bord CA
            </TabsTrigger>
          </TabsList>

          <TabsContent value="factures" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Factures clients</CardTitle>
                <CardDescription>
                  Génération et envoi de factures
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Interface de facturation à venir
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="prestations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Prestations logistiques</CardTitle>
                <CardDescription>
                  Tarification des services logistiques
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Interface de gestion des prestations à venir
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="exports" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Exports comptables</CardTitle>
                <CardDescription>
                  Interface avec ERP et systèmes comptables
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Interface d'export comptable à venir
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ca" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Tableau de bord CA</CardTitle>
                <CardDescription>
                  Suivi du chiffre d'affaires et indicateurs financiers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Tableau de bord financier à venir
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
