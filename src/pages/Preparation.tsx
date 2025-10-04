import { DashboardLayout } from "@/components/DashboardLayout";
import { SessionsList } from "@/components/SessionsList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, ScanLine, Scale, Truck, Tags, ExternalLink } from "lucide-react";
import { CalculateurVolumetrique } from "@/components/expedition/CalculateurVolumetrique";
import { GestionTransporteurs } from "@/components/expedition/GestionTransporteurs";
import { GestionTags } from "@/components/expedition/GestionTags";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";

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
              Sessions
            </TabsTrigger>
            <TabsTrigger value="picking">
              <ScanLine className="h-4 w-4 mr-2" />
              Picking
            </TabsTrigger>
            <TabsTrigger value="volumetrique">
              <Scale className="h-4 w-4 mr-2" />
              Volumétrique
            </TabsTrigger>
            <TabsTrigger value="transporteurs">
              <Truck className="h-4 w-4 mr-2" />
              Transporteurs
            </TabsTrigger>
            <TabsTrigger value="tags">
              <Tags className="h-4 w-4 mr-2" />
              Tags
            </TabsTrigger>
            <TabsTrigger value="sendcloud">
              <ExternalLink className="h-4 w-4 mr-2" />
              SendCloud
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sessions">
            <SessionsList />
          </TabsContent>

          <TabsContent value="picking">
            <div className="text-center py-12 text-muted-foreground">
              Sélectionnez une session dans l'onglet "Sessions" pour commencer le picking
            </div>
          </TabsContent>

          <TabsContent value="volumetrique">
            <CalculateurVolumetrique />
          </TabsContent>

          <TabsContent value="transporteurs">
            <GestionTransporteurs />
          </TabsContent>

          <TabsContent value="tags">
            <GestionTags />
          </TabsContent>

          <TabsContent value="sendcloud">
            <Card>
              <CardHeader>
                <CardTitle>Interface SendCloud Ship & Go</CardTitle>
                <CardDescription>
                  Créez vos expéditions directement depuis l'interface SendCloud
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="font-medium">Connexion active</span>
                    </div>
                    <Badge variant="secondary">Webhook configuré</Badge>
                  </div>
                  
                  <div className="border rounded-lg overflow-hidden" style={{ height: '800px' }}>
                    <iframe 
                      src="https://panel.sendcloud.sc/shipping/" 
                      className="w-full h-full" 
                      title="SendCloud Ship & Go" 
                      allow="clipboard-write" 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
