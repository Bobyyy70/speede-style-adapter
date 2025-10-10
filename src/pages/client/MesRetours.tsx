import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { RetoursKanban } from "@/components/RetoursKanban";
import { ViewSelector } from "@/components/ViewSelector";

interface Retour {
  id: string;
  numero_retour: string;
  date_retour: string;
  statut_retour: string;
  raison_retour: string;
  valeur_totale: number;
  client_id: string | null;
  date_creation: string;
  client?: {
    nom_entreprise: string;
  };
}

export default function MesRetours() {
  const { user, getViewingClientId } = useAuth();
  const [searchParams] = useSearchParams();
  const [retours, setRetours] = useState<Retour[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'kanban'>(() => {
    return (localStorage.getItem('client_retours_view') as 'list' | 'kanban') || 'list';
  });

  useEffect(() => {
    localStorage.setItem('client_retours_view', view);
  }, [view]);

  useEffect(() => {
    fetchRetours();
  }, [user, searchParams]);

  const fetchRetours = async () => {
    try {
      if (!user) return;

      const asClient = searchParams.get("asClient");
      let clientId = asClient;

      if (!clientId) {
        clientId = getViewingClientId();
      }

      if (!clientId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("client_id")
          .eq("id", user.id)
          .maybeSingle();
        clientId = profile?.client_id;
      }

      if (!clientId) return;

      const { data, error } = await supabase
        .from("retour_produit")
        .select("*")
        .eq("client_id", clientId)
        .order("date_retour", { ascending: false });

      if (error) throw error;
      setRetours(data || []);
    } catch (error: any) {
      console.error("Error fetching retours:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les retours",
        variant: "destructive",
      });
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mes Retours</h1>
            <p className="text-muted-foreground">
              Gestion et suivi de vos retours produits
            </p>
          </div>
          <ViewSelector view={view} onViewChange={setView} />
        </div>

        {view === 'kanban' ? (
          <RetoursKanban retours={retours} loading={loading} />
        ) : (
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
        )}
      </div>
    </DashboardLayout>
  );
}
