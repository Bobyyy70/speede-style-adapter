import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, TruckIcon, MapPin, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Commande {
  id: string;
  numero_commande: string;
  statut_wms: string;
  adresse_nom: string;
  date_creation: string;
  tracking_number?: string;
}

const Expedition = () => {
  const { toast } = useToast();
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCommandes();
  }, []);

  const fetchCommandes = async () => {
    try {
      const { data, error } = await supabase
        .from('commande')
        .select('*')
        .in('statut_wms', ['prete', 'expediee'])
        .order('date_creation', { ascending: false })
        .limit(50);

      if (error) throw error;
      setCommandes(data || []);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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
          <h1 className="text-3xl font-bold tracking-tight">Expédition</h1>
          <p className="text-muted-foreground">
            Gestion des expéditions et intégration SendCloud
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
              <TruckIcon className="h-4 w-4 text-muted-foreground" />
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
              <CardTitle className="text-sm font-medium">En transit</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
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
            <TabsTrigger value="liste">Liste des commandes</TabsTrigger>
            <TabsTrigger value="sendcloud">SendCloud</TabsTrigger>
            <TabsTrigger value="tracking">Suivi</TabsTrigger>
          </TabsList>

          <TabsContent value="liste" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Commandes à expédier</CardTitle>
                <CardDescription>
                  Liste des commandes prêtes pour expédition
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>N° Commande</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Tracking</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commandes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            Aucune commande à expédier
                          </TableCell>
                        </TableRow>
                      ) : (
                        commandes.map((commande) => (
                          <TableRow key={commande.id}>
                            <TableCell className="font-medium">{commande.numero_commande}</TableCell>
                            <TableCell>{commande.adresse_nom}</TableCell>
                            <TableCell>{new Date(commande.date_creation).toLocaleDateString()}</TableCell>
                            <TableCell>{getStatutBadge(commande.statut_wms)}</TableCell>
                            <TableCell>
                              {commande.tracking_number || (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button variant="outline" size="sm">
                                Créer expédition
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sendcloud" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Intégration SendCloud</CardTitle>
                <CardDescription>
                  Synchronisation et gestion des expéditions via SendCloud
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="font-medium">Connexion active</span>
                  </div>
                  <Badge variant="secondary">Webhook configuré</Badge>
                </div>
                
                <div className="space-y-2">
                  <Button className="w-full" variant="outline">
                    Synchroniser les commandes
                  </Button>
                  <Button className="w-full" variant="outline">
                    Créer des expéditions groupées
                  </Button>
                  <Button className="w-full" variant="outline">
                    Télécharger les étiquettes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tracking" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Suivi des expéditions</CardTitle>
                <CardDescription>
                  Suivez vos colis en temps réel
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <div className="text-center space-y-2">
                    <MapPin className="h-12 w-12 mx-auto opacity-50" />
                    <p>Aucune expédition en cours de suivi</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Expedition;
