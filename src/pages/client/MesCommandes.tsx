import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Package, Clock, CheckCircle2, TrendingUp, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { CommandesKanban } from "@/components/CommandesKanban";
import { ViewSelector } from "@/components/ViewSelector";
import { CommandeDetailDialog } from "@/components/CommandeDetailDialog";

interface Commande {
  id: string;
  numero_commande: string;
  statut_wms: string;
  adresse_nom: string;
  date_creation: string;
  tracking_number?: string;
  tracking_url?: string;
  valeur_totale: number;
  source: string;
  ville?: string;
  pays_code?: string;
  nom_client: string;
}

export default function MesCommandes() {
  const { user, getViewingClientId } = useAuth();
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'kanban'>(() => {
    return (localStorage.getItem('client_commandes_view') as 'list' | 'kanban') || 'list';
  });
  const [selectedCommandeId, setSelectedCommandeId] = useState<string | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    enAttente: 0,
    prete: 0,
    enPreparation: 0
  });

  useEffect(() => {
    localStorage.setItem('client_commandes_view', view);
  }, [view]);

  useEffect(() => {
    fetchCommandes();
  }, [user]);

  const fetchCommandes = async () => {
    try {
      let clientId: string | null = null;
      const viewingClientId = getViewingClientId();
      if (viewingClientId) {
        clientId = viewingClientId;
      } else if (user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("client_id")
          .eq("id", user.id)
          .maybeSingle();
        clientId = profileData?.client_id || null;
      }

      if (!clientId) {
        toast.error("Client non identifié");
        return;
      }

      const { data, error } = await supabase
        .from("commande")
        .select("*")
        .eq("client_id", clientId)
        .order("date_creation", { ascending: false });

      if (error) throw error;

      setCommandes(data || []);
      setStats({
        total: data?.length || 0,
        enAttente: data?.filter(c => c.statut_wms === "En attente de réappro").length || 0,
        prete: data?.filter(c => c.statut_wms === "prete").length || 0,
        enPreparation: data?.filter(c => c.statut_wms === "En préparation").length || 0
      });
    } catch (error: any) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des commandes");
    } finally {
      setLoading(false);
    }
  };

  const getStatutBadge = (statut: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      "En attente de réappro": { variant: "secondary", label: "En attente" },
      "Prêt à préparer": { variant: "default", label: "Prête" },
      "En préparation": { variant: "default", label: "En préparation" },
      "prete": { variant: "default", label: "Prête" },
      "expediee": { variant: "secondary", label: "Expédiée" },
      "Expédiée": { variant: "secondary", label: "Expédiée" },
      "Livré": { variant: "outline", label: "Livrée" }
    };
    const config = variants[statut] || { variant: "outline", label: statut };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mes Commandes</h1>
            <p className="text-muted-foreground">
              Consultez toutes vos commandes et leur statut
            </p>
          </div>
          <ViewSelector view={view} onViewChange={setView} />
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total commandes</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Toutes les commandes</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En attente</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.enAttente}</div>
              <p className="text-xs text-muted-foreground">À traiter</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Prêtes</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.prete}</div>
              <p className="text-xs text-muted-foreground">À expédier</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En préparation</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.enPreparation}</div>
              <p className="text-xs text-muted-foreground">En cours</p>
            </CardContent>
          </Card>
        </div>

        {view === 'kanban' ? (
          <>
            <CommandesKanban
              commandes={commandes}
              onCommandeClick={(id) => {
                setSelectedCommandeId(id);
                setDetailDialogOpen(true);
              }}
              loading={loading}
            />
            {selectedCommandeId && (
              <CommandeDetailDialog
                open={detailDialogOpen}
                onOpenChange={setDetailDialogOpen}
                commandeId={selectedCommandeId}
              />
            )}
          </>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Liste de vos commandes</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground mt-2">Chargement...</p>
                </div>
              ) : commandes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucune commande trouvée
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N° Commande</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Destinataire</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Tracking</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commandes.map((commande) => (
                      <TableRow key={commande.id}>
                        <TableCell className="font-medium">
                          {commande.numero_commande}
                        </TableCell>
                        <TableCell>
                          {format(new Date(commande.date_creation), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell>{commande.adresse_nom}</TableCell>
                        <TableCell>{commande.valeur_totale.toFixed(2)} €</TableCell>
                        <TableCell>{getStatutBadge(commande.statut_wms)}</TableCell>
                        <TableCell>
                          {commande.tracking_url ? (
                            <a
                              href={commande.tracking_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              Suivre
                            </a>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
