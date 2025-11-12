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
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/orderStatuses";

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
  const [noClientId, setNoClientId] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    enAttente: 0,
    prete: 0,
    enPreparation: 0
  });

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
        setNoClientId(true);
        setLoading(false);
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
        enAttente: data?.filter(c => c.statut_wms === ORDER_STATUSES.EN_ATTENTE_REAPPRO).length || 0,
        prete: data?.filter(c => c.statut_wms === ORDER_STATUSES.PRET_EXPEDITION).length || 0,
        enPreparation: data?.filter(c => c.statut_wms === ORDER_STATUSES.EN_PREPARATION).length || 0
      });
    } catch (error: any) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des commandes");
    } finally {
      setLoading(false);
    }
  };

  const getStatutBadge = (statut: string) => {
    const label = ORDER_STATUS_LABELS[statut as keyof typeof ORDER_STATUS_LABELS] || statut;
    const variants: Record<string, any> = {
      [ORDER_STATUSES.EN_ATTENTE_REAPPRO]: "secondary",
      [ORDER_STATUSES.STOCK_RESERVE]: "default",
      [ORDER_STATUSES.EN_PREPARATION]: "default",
      [ORDER_STATUSES.PRET_EXPEDITION]: "default",
      [ORDER_STATUSES.EXPEDIE]: "secondary",
      [ORDER_STATUSES.LIVRE]: "outline"
    };
    return <Badge variant={variants[statut] || "outline"}>{label}</Badge>;
  };

  // If no client_id, show error message
  if (noClientId) {
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
          </div>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
                <div className="rounded-full bg-red-100 p-3">
                  <Package className="h-8 w-8 text-red-600" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-red-900">Compte Non Configuré</h2>
                  <p className="text-red-700 max-w-md">
                    Votre compte n'est pas encore lié à un client. Vous ne pouvez pas accéder à vos commandes pour le moment.
                  </p>
                  <p className="text-sm text-red-600 mt-4">
                    Veuillez contacter l'administrateur à <strong>admin@speedelog.net</strong> pour configurer votre compte.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

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
      </div>
    </DashboardLayout>
  );
}
