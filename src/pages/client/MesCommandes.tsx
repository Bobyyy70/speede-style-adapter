import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useSearchParams } from "react-router-dom";

interface Commande {
  id: string;
  numero_commande: string;
  statut_wms: string;
  date_creation: string;
  nom_client: string;
  ville: string;
  valeur_totale: number;
}

export default function MesCommandes() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCommandes();
  }, [user, searchParams]);

  const fetchCommandes = async () => {
    try {
      if (!user) return;

      const asClient = searchParams.get('asClient');
      let clientId: string | null = asClient;

      if (!clientId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("client_id")
          .eq("id", user.id)
          .single();
        clientId = profile?.client_id || null;
      }

      if (!clientId) return;

      const { data, error } = await supabase
        .from("commande")
        .select("*")
        .eq("client_id", clientId)
        .order("date_creation", { ascending: false });

      if (error) throw error;
      setCommandes(data || []);
    } catch (error: any) {
      console.error("Error fetching commandes:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les commandes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatutBadge = (statut: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      "En attente de réappro": "secondary",
      "Prêt à préparer": "outline",
      "En préparation": "default",
      "Prêt à expédier": "default",
      "Expédié": "default",
    };

    return <Badge variant={variants[statut] || "default"}>{statut}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mes Commandes</h1>
          <p className="text-muted-foreground">
            Suivi de vos commandes en temps réel
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Liste des commandes</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Chargement...</div>
            ) : commandes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucune commande pour le moment
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Commande</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Valeur</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commandes.map((commande) => (
                    <TableRow key={commande.id}>
                      <TableCell className="font-medium">
                        {commande.numero_commande}
                      </TableCell>
                      <TableCell>
                        {format(new Date(commande.date_creation), "dd/MM/yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell>{commande.ville}</TableCell>
                      <TableCell>{commande.valeur_totale.toFixed(2)} €</TableCell>
                      <TableCell>{getStatutBadge(commande.statut_wms)}</TableCell>
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
