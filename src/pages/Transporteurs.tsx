import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Cloud, TruckIcon, Tag, DollarSign, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";

export default function Transporteurs() {
  const { userRole } = useAuth();
  const isClient = userRole === 'client';
  const queryClient = useQueryClient();

  // Fetch transporteurs
  const { data: transporteurs, isLoading } = useQuery({
    queryKey: ['transporteur_configuration'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transporteur_configuration')
        .select(`
          *,
          transporteur_service(*)
        `)
        .order('nom_complet');
      
      if (error) throw error;
      return data;
    }
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, actif }: { id: string; actif: boolean }) => {
      const { error } = await supabase
        .from('transporteur_configuration')
        .update({ actif })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transporteur_configuration'] });
      toast.success('Transporteur mis à jour');
    },
    onError: () => toast.error('Erreur lors de la mise à jour')
  });
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transporteurs</h1>
          <p className="text-muted-foreground">
            {isClient ? 'Consultez les transporteurs disponibles' : 'Gestion des transporteurs et intégrations'}
          </p>
        </div>

        {isClient && (
          <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Information :</strong> Vous pouvez consulter les transporteurs configurés pour votre compte. 
                Pour modifier la configuration, veuillez contacter votre gestionnaire.
              </p>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="liste" className="space-y-4">
          <TabsList>
            <TabsTrigger value="liste">
              <TruckIcon className="mr-2 h-4 w-4" />
              Liste des transporteurs
            </TabsTrigger>
            <TabsTrigger value="sendcloud">
              <Cloud className="mr-2 h-4 w-4" />
              Intégration Sendcloud
            </TabsTrigger>
            <TabsTrigger value="services">
              <Tag className="mr-2 h-4 w-4" />
              Services disponibles
            </TabsTrigger>
          </TabsList>

          <TabsContent value="liste" className="space-y-4">
            {isLoading ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground">Chargement...</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {transporteurs?.map((transporteur) => (
                  <Card key={transporteur.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{transporteur.nom_complet}</CardTitle>
                          <CardDescription className="font-mono text-xs">
                            {transporteur.code_transporteur}
                          </CardDescription>
                        </div>
                        <Badge variant={transporteur.actif ? "default" : "secondary"}>
                          {transporteur.actif ? 'Actif' : 'Inactif'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="text-sm">
                          <span className="font-medium">Services:</span>{' '}
                          {transporteur.transporteur_service?.length || 0}
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">Zones:</span>{' '}
                          {Array.isArray(transporteur.zones_couverture) 
                            ? transporteur.zones_couverture.join(', ')
                            : 'Non configuré'}
                        </div>
                        {!isClient && (
                          <div className="flex gap-2 pt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleActiveMutation.mutate({
                                id: transporteur.id,
                                actif: !transporteur.actif
                              })}
                              disabled={toggleActiveMutation.isPending}
                            >
                              {transporteur.actif ? 'Désactiver' : 'Activer'}
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="sendcloud" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Intégration Sendcloud</CardTitle>
                <CardDescription>
                  Configuration de l'API Sendcloud pour gestion multi-transporteurs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    SendCloud permet de gérer plusieurs transporteurs via une seule intégration.
                    Les commandes sont automatiquement synchronisées et les étiquettes générées
                    selon vos règles de routage.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline">
                      Configurer API
                    </Button>
                    <Button variant="outline">
                      Tester connexion
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="services" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Services disponibles par transporteur</CardTitle>
                <CardDescription>
                  Consultez et configurez les services de livraison disponibles
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {transporteurs?.map((transporteur) => (
                    <div key={transporteur.id} className="border-b pb-4 last:border-0">
                      <h3 className="font-semibold mb-2">{transporteur.nom_complet}</h3>
                      {transporteur.transporteur_service?.length > 0 ? (
                        <div className="grid gap-2">
                          {transporteur.transporteur_service.map((service: any) => (
                            <div key={service.id} className="flex justify-between items-center p-2 bg-muted rounded">
                              <div>
                                <p className="font-medium text-sm">{service.nom_affichage}</p>
                                <p className="text-xs text-muted-foreground">{service.code_service}</p>
                              </div>
                              <Badge variant={service.actif ? "default" : "secondary"}>
                                {service.actif ? 'Actif' : 'Inactif'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Aucun service configuré</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
