import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Filter, Clock, Settings } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface SessionDetailsProps {
  sessionId: string;
  onBack: () => void;
}

interface SessionData {
  id: string;
  nom_session: string;
  description: string | null;
  statut: string;
  filtres: any;
  max_commandes: number | null;
  cron_enabled: boolean;
  cron_expression: string | null;
  date_creation: string;
  derniere_execution: string | null;
}

export function SessionDetails({ sessionId, onBack }: SessionDetailsProps) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessionDetails();
  }, [sessionId]);

  const fetchSessionDetails = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("session_preparation")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (error) throw error;
      setSession(data);
    } catch (error) {
      console.error("Erreur lors du chargement de la session:", error);
      toast.error("Erreur lors du chargement des détails");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!session) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Session non trouvée
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <div>
          <h2 className="text-2xl font-bold">{session.nom_session}</h2>
          <p className="text-sm text-muted-foreground">
            Créée le {new Date(session.date_creation).toLocaleDateString("fr-FR")}
          </p>
        </div>
        <Badge variant={session.statut === "active" ? "default" : "outline"}>
          {session.statut}
        </Badge>
      </div>

      <Tabs defaultValue="filtres" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="filtres">
            <Filter className="h-4 w-4 mr-2" />
            Filtres
          </TabsTrigger>
          <TabsTrigger value="cronjob">
            <Clock className="h-4 w-4 mr-2" />
            Planification
          </TabsTrigger>
          <TabsTrigger value="configuration">
            <Settings className="h-4 w-4 mr-2" />
            Configuration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="filtres" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Filtres appliqués</CardTitle>
              <CardDescription>
                Critères de sélection des commandes pour cette session
              </CardDescription>
            </CardHeader>
            <CardContent>
              {session.filtres && Object.keys(session.filtres).length > 0 ? (
                <div className="space-y-3">
                  {session.filtres.selectedCommandeIds && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium mb-2">Commandes sélectionnées</p>
                      <p className="text-sm text-muted-foreground">
                        {session.filtres.selectedCommandeIds.length} commande(s)
                      </p>
                    </div>
                  )}
                  {session.filtres.statut_wms && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium mb-2">Statut WMS</p>
                      <Badge>{session.filtres.statut_wms}</Badge>
                    </div>
                  )}
                  {session.filtres.source && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium mb-2">Source</p>
                      <Badge>{session.filtres.source}</Badge>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun filtre appliqué</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cronjob" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Planification automatique</CardTitle>
              <CardDescription>
                Configuration du lancement automatique de la session
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">Cronjob activé</p>
                  <p className="text-sm text-muted-foreground">
                    Lancement automatique selon planification
                  </p>
                </div>
                <Badge variant={session.cron_enabled ? "default" : "outline"}>
                  {session.cron_enabled ? "Activé" : "Désactivé"}
                </Badge>
              </div>

              {session.cron_enabled && session.cron_expression && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">Expression Cron</p>
                  <code className="text-sm bg-background px-3 py-1 rounded">
                    {session.cron_expression}
                  </code>
                </div>
              )}

              {session.derniere_execution && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">Dernière exécution</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(session.derniere_execution).toLocaleString("fr-FR")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuration de la session</CardTitle>
              <CardDescription>
                Paramètres généraux de la session
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Nom de la session</p>
                <p className="text-sm">{session.nom_session}</p>
              </div>

              {session.description && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">Description</p>
                  <p className="text-sm">{session.description}</p>
                </div>
              )}

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Maximum de commandes</p>
                <p className="text-sm">
                  {session.max_commandes ? `${session.max_commandes} commandes` : "Illimité"}
                </p>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Statut</p>
                <Badge variant={session.statut === "active" ? "default" : "outline"}>
                  {session.statut}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
