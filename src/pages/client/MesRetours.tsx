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

interface Retour {
  id: string;
  numero_retour: string;
  date_retour: string;
  statut_retour: string;
  raison_retour: string;
  valeur_totale: number;
}

export default function MesRetours() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [retours, setRetours] = useState<Retour[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientError, setClientError] = useState(false);

  useEffect(() => {
    fetchRetours();
  }, [user, searchParams]);

  const fetchRetours = async () => {
    try {
      if (!user) return;
      setLoading(true);
      setClientError(false);
      
      const { clientId } = await getClientId(user, searchParams, null);

      const { data, error } = await supabase
        .from("retour_produit")
        .select("*")
        .eq("client_id", clientId)
        .order("date_retour", { ascending: false });

      if (error) throw error;
      setRetours(data || []);
    } catch (error: any) {
      if (error.message.includes("Aucun client")) {
        setClientError(true);
      } else {
        toast({
          title: "Erreur",
          description: "Impossible de charger les retours",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatutBadge = (statut: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      "recu": "secondary",
      "inspecte": "outline",
      "reintegre": "default",
      "detruit": "destructive",
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
          <h1 className="text-3xl font-bold tracking-tight">Mes Retours</h1>
          <p className="text-muted-foreground">
            Gestion et suivi de vos retours produits
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Liste des retours</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Chargement...</div>
            ) : retours.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucun retour enregistré
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Retour</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Raison</TableHead>
                    <TableHead>Valeur</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {retours.map((retour) => (
                    <TableRow key={retour.id}>
                      <TableCell className="font-medium">{retour.numero_retour}</TableCell>
                      <TableCell>
                        {format(new Date(retour.date_retour), "dd/MM/yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell>{retour.raison_retour || "-"}</TableCell>
                      <TableCell>{retour.valeur_totale?.toFixed(2) || "0.00"} €</TableCell>
                      <TableCell>{getStatutBadge(retour.statut_retour)}</TableCell>
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
