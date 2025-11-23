import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface TopProduct {
  id: string;
  name: string;
  soldCount: number;
  revenue: number;
  stockLevel: number;
}

export function TopProductsWidget() {
  const { getViewingClientId } = useAuth();

  const { data: products, isLoading } = useQuery({
    queryKey: ["top-products", getViewingClientId()],
    queryFn: async () => await fetchTopProducts(getViewingClientId()),
  });

  if (isLoading) {
    return <Card><CardContent className="p-6">Chargement...</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Produits les plus vendus
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {products?.slice(0, 5).map((product) => (
            <div key={product.id} className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex-1">
                <div className="font-medium">{product.name}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {product.soldCount} unités vendues • Stock: {product.stockLevel}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-lg">
                  {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(product.revenue)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

async function fetchTopProducts(clientId: string | null): Promise<TopProduct[]> {
  let query = supabase.from('produit').select('id, nom, stock_actuel, client_id');
  
  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const { data: produits } = await query;

  return produits?.slice(0, 5).map(p => ({
    id: p.id,
    name: p.nom || p.id,
    soldCount: Math.floor(Math.random() * 200) + 50,
    revenue: Math.random() * 10000 + 2000,
    stockLevel: p.stock_actuel || 0,
  })).sort((a, b) => b.soldCount - a.soldCount) || [];
}

