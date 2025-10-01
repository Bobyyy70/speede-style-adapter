import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Cloud, TruckIcon, Tag, DollarSign } from "lucide-react";

export default function Transporteurs() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transporteurs</h1>
          <p className="text-muted-foreground">
            Gestion des transporteurs et intégrations
          </p>
        </div>

        <Tabs defaultValue="sendcloud" className="space-y-4">
          <TabsList>
            <TabsTrigger value="sendcloud">
              <Cloud className="mr-2 h-4 w-4" />
              Intégration Sendcloud
            </TabsTrigger>
            <TabsTrigger value="gestion">
              <TruckIcon className="mr-2 h-4 w-4" />
              Gestion des transporteurs
            </TabsTrigger>
            <TabsTrigger value="etiquettes">
              <Tag className="mr-2 h-4 w-4" />
              Étiquettes et tracking
            </TabsTrigger>
            <TabsTrigger value="tarifs">
              <DollarSign className="mr-2 h-4 w-4" />
              Tarifs et zones
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sendcloud" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Intégration Sendcloud</CardTitle>
                <CardDescription>
                  Configuration de l'API Sendcloud
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Interface de configuration Sendcloud à venir
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gestion" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Gestion des transporteurs</CardTitle>
                <CardDescription>
                  DHL, Chronopost, Colissimo et autres
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Interface de gestion des transporteurs à venir
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="etiquettes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Étiquettes et tracking</CardTitle>
                <CardDescription>
                  Génération d'étiquettes et numéros de suivi
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Interface de gestion des étiquettes à venir
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tarifs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Tarifs et zones</CardTitle>
                <CardDescription>
                  Configuration tarifaire par transporteur et zone
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Interface de configuration tarifaire à venir
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
