import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, Truck, CheckCircle2, Clock, ExternalLink, Scale, Tags, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CalculateurVolumetrique } from "@/components/expedition/CalculateurVolumetrique";
import { GestionTransporteurs } from "@/components/expedition/GestionTransporteurs";
import { GestionTags } from "@/components/expedition/GestionTags";
import { useAutoRules } from "@/hooks/useAutoRules";

interface Commande {
  id: string;
  numero_commande: string;
  statut_wms: string;
  adresse_nom: string;
  date_creation: string;
  tracking_number?: string;
  tracking_url?: string;
  label_url?: string;
  tags?: string[];
  poids_reel_kg?: number;
  poids_volumetrique_kg?: number;
  transporteur_choisi?: string;
}

export default function Expedition() {
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);
  const { applyAutoRules } = useAutoRules();

  useEffect(() => {
    fetchCommandes();
  }, []);

  const fetchCommandes = async () => {
    try {
      const { data, error } = await supabase
        .from('commande')
        .select('*')
        .in('statut_wms', ['prete', 'expediee'])
        .order('date_creation', { ascending: false });

      if (error) throw error;
      setCommandes(data || []);
    } catch (error: any) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du chargement des commandes');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintLabel = (labelUrl: string) => {
    window.open(labelUrl, '_blank');
  };

  const handleApplyAutoRules = async (commandeId: string) => {
    await applyAutoRules(commandeId);
    fetchCommandes();
  };

  const getStatutBadge = (statut: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      prete: { variant: "default", label: "Prête" },
      expediee: { variant: "secondary", label: "Expédiée" },
    };
    const config = variants[statut] || { variant: "outline", label: statut };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expédition & TMS</h1>
          <p className="text-muted-foreground">
            Gestion des expéditions, calcul volumétrique et configuration transporteurs
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Prêtes à expédier</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {commandes.filter(c => c.statut_wms === 'prete').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expédiées aujourd'hui</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {commandes.filter(c => c.statut_wms === 'expediee' && 
                  new Date(c.date_creation).toDateString() === new Date().toDateString()
                ).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avec tracking</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {commandes.filter(c => c.tracking_number).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Délai moyen</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">2.4h</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="liste" className="space-y-4">
          <TabsList>
            <TabsTrigger value="liste">
              <Package className="h-4 w-4 mr-2" />
              Commandes
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

          <TabsContent value="liste">
            <Card>
              <CardHeader>
                <CardTitle>Commandes à expédier</CardTitle>
                <CardDescription>
                  Toutes les commandes prêtes (SendCloud et étiquettes externes)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Chargement...
                  </div>
                ) : commandes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Aucune commande à expédier
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>N° Commande</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Tags</TableHead>
                        <TableHead>Poids</TableHead>
                        <TableHead>Transporteur</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commandes.map((commande) => (
                        <TableRow key={commande.id}>
                          <TableCell className="font-medium">
                            {commande.numero_commande}
                          </TableCell>
                          <TableCell>{commande.adresse_nom}</TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {commande.tags?.map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            {commande.poids_volumetrique_kg ? (
                              <div className="text-sm">
                                <div>{commande.poids_reel_kg?.toFixed(2)} kg réel</div>
                                <div className="text-muted-foreground">
                                  {commande.poids_volumetrique_kg.toFixed(2)} kg vol.
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Non calculé</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {commande.transporteur_choisi || (
                              <span className="text-muted-foreground">Non assigné</span>
                            )}
                          </TableCell>
                          <TableCell>{getStatutBadge(commande.statut_wms)}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleApplyAutoRules(commande.id)}
                                title="Appliquer les règles automatiques"
                              >
                                <Zap className="h-4 w-4" />
                              </Button>
                              {commande.label_url ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handlePrintLabel(commande.label_url!)}
                                >
                                  Imprimer étiquette
                                </Button>
                              ) : (
                                <Button size="sm" variant="outline" disabled>
                                  Créer expédition
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
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
                <CardTitle>Interface SendCloud</CardTitle>
                <CardDescription>
                  Ship & Go intégré pour créer les expéditions
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
                  
                  <div className="aspect-video border rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <ExternalLink className="h-12 w-12 mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Interface SendCloud Ship & Go à intégrer ici
                      </p>
                    </div>
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
