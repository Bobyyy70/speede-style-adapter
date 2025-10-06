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
import { getClientId } from "@/lib/clientHelpers";
import { AlertCircle, Home } from "lucide-react";

interface Produit {
  id: string;
  reference: string;
  nom: string;
  stock_actuel: number;
  stock_minimum: number;
  stock_maximum: number;
  categorie_emballage: number;
}

export default function MesProduits() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientError, setClientError] = useState(false);

  useEffect(() => {
    fetchProduits();
  }, [user, searchParams]);

  const fetchProduits = async () => {
    try {
      if (!user) return;
      setLoading(true);
      setClientError(false);
      
      const { clientId } = await getClientId(user, searchParams, null);

      const { data, error } = await supabase
        .from("produit")
        .select("*")
        .eq("client_id", clientId)
        .eq("statut_actif", true)
        .order("nom");

      if (error) throw error;
      setProduits(data || []);
    } catch (error: any) {
      if (error.message.includes("Aucun client")) {
        setClientError(true);
      } else {
        toast({
          title: "Erreur",
          description: "Impossible de charger les produits",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const getStockBadge = (produit: Produit) => {
    if (produit.stock_actuel === 0) {
      return <Badge variant="destructive">Rupture</Badge>;
    }
    if (produit.stock_actuel <= produit.stock_minimum) {
      return <Badge variant="secondary">Stock faible</Badge>;
    }
    return <Badge variant="default">Disponible</Badge>;
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
          <h1 className="text-3xl font-bold tracking-tight">Mes Produits & Stock</h1>
          <p className="text-muted-foreground">
            Catalogue et niveaux de stock de vos produits
          </p>
        </div>

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
                    <TableHead>Stock Actuel</TableHead>
                    <TableHead>Stock Min.</TableHead>
                    <TableHead>Stock Max.</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {produits.map((produit) => (
                    <TableRow key={produit.id}>
                      <TableCell className="font-medium">{produit.reference}</TableCell>
                      <TableCell>{produit.nom}</TableCell>
                      <TableCell className="font-semibold">{produit.stock_actuel}</TableCell>
                      <TableCell className="text-muted-foreground">{produit.stock_minimum}</TableCell>
                      <TableCell className="text-muted-foreground">{produit.stock_maximum || "-"}</TableCell>
                      <TableCell>{getStockBadge(produit)}</TableCell>
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
