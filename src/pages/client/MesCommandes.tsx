import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getClientId } from "@/lib/clientHelpers";
import { AlertCircle, Home } from "lucide-react";

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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientError, setClientError] = useState(false);

  useEffect(() => {
    fetchCommandes();
  }, [user, searchParams]);

  const fetchCommandes = async () => {
    try {
      if (!user) return;
      setLoading(true);
      setClientError(false);
      
      const { clientId } = await getClientId(user, searchParams, null);

      const { data, error } = await supabase
        .from("commande")
        .select("*")
        .eq("client_id", clientId)
        .order("date_creation", { ascending: false });

      if (error) throw error;
      setCommandes(data || []);
    } catch (error: any) {
      if (error.message.includes("Aucun client")) {
        setClientError(true);
      } else {
        toast({
          title: "Erreur",
          description: "Impossible de charger les commandes",
          variant: "destructive",
        });
      }
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

  if (clientError) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg text-muted-foreground">
            Aucun client sélectionné. Veuillez utiliser le menu "Vue Client" pour en choisir un.
          </p>
          <Button onClick={() => navigate("/")}>
            <Home className="mr-2 h-4 w-4" />
            Retour au tableau de bord
          </Button>
        </div>
      </DashboardLayout>
    );
  }

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
