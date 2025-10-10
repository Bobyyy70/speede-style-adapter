import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { ProduitsKanban } from "@/components/ProduitsKanban";
import { ViewSelector } from "@/components/ViewSelector";

interface Produit {
  id: string;
  reference: string;
  nom: string;
  stock_actuel: number;
  stock_minimum: number;
  stock_maximum: number;
  categorie_emballage: number;
  prix_unitaire: number;
  image_url: string;
  code_barre_ean: string;
}

export default function MesProduits() {
  const { user, getViewingClientId } = useAuth();
  const [searchParams] = useSearchParams();
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'kanban'>(() => {
    return (localStorage.getItem('client_produits_view') as 'list' | 'kanban') || 'list';
  });

  useEffect(() => {
    localStorage.setItem('client_produits_view', view);
  }, [view]);

  useEffect(() => {
    fetchProduits();
  }, [user, searchParams]);

  const fetchProduits = async () => {
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
        .from("produit")
        .select("*")
        .eq("client_id", clientId)
        .eq("statut_actif", true)
        .order("nom");

      if (error) throw error;
      setProduits(data || []);
    } catch (error: any) {
      console.error("Error fetching produits:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les produits",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mes Produits & Stock</h1>
            <p className="text-muted-foreground">
              Catalogue et niveaux de stock de vos produits
            </p>
          </div>
          <ViewSelector view={view} onViewChange={setView} />
        </div>

        {view === 'kanban' ? (
          <ProduitsKanban 
            produits={produits} 
            onRefetch={fetchProduits}
            loading={loading}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Mes références produits</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Chargement...</div>
              ) : produits.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun produit enregistré
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Référence</TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead className="text-center">Stock Actuel</TableHead>
                      <TableHead>Stock Min.</TableHead>
                      <TableHead>Stock Max.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {produits.map((produit) => (
                      <TableRow key={produit.id}>
                        <TableCell className="font-medium">{produit.reference}</TableCell>
                        <TableCell>{produit.nom}</TableCell>
                        <TableCell className="text-center">
                          <span className="text-2xl font-bold">{produit.stock_actuel}</span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{produit.stock_minimum}</TableCell>
                        <TableCell className="text-muted-foreground">{produit.stock_maximum || "-"}</TableCell>
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
