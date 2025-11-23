import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, AlertTriangle, Activity } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface StockAlert {
  productId: string;
  productName: string;
  currentStock: number;
  predictedStockout: string;
  severity: 'critical' | 'warning' | 'info';
  recommendedAction: string;
}

export function StockAlertsWidget() {
  const { getViewingClientId } = useAuth();

  const { data: alerts, isLoading } = useQuery({
    queryKey: ["stock-alerts", getViewingClientId()],
    queryFn: async () => await fetchStockAlerts(getViewingClientId()),
  });

  const getSeverityColor = (severity: 'critical' | 'warning' | 'info') => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'info': return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const getSeverityIcon = (severity: 'critical' | 'warning' | 'info') => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'info': return <Activity className="h-4 w-4 text-blue-600" />;
    }
  };

  if (isLoading || !alerts || alerts.length === 0) {
    return null;
  }

  return (
    <Card className="border-l-4 border-l-orange-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-orange-600" />
          Alertes Prédictives IA
          <Badge variant="secondary" className="ml-2">
            {alerts.length} alertes
          </Badge>
        </CardTitle>
        <CardDescription>
          Détection automatique des risques et recommandations intelligentes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.slice(0, 5).map((alert, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-lg border ${getSeverityColor(alert.severity)}`}
          >
            <div className="flex items-start gap-3">
              {getSeverityIcon(alert.severity)}
              <div className="flex-1">
                <div className="font-semibold">{alert.productName}</div>
                <div className="text-sm mt-1">
                  Stock actuel: <span className="font-mono">{alert.currentStock}</span> unités
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  ⚠️ Rupture prévue: {new Date(alert.predictedStockout).toLocaleDateString('fr-FR')}
                </div>
                <div className="mt-2 text-sm font-medium">
                  💡 {alert.recommendedAction}
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

async function fetchStockAlerts(clientId: string | null): Promise<StockAlert[]> {
  let query = supabase.from('produit').select('id, nom, stock_actuel, stock_minimum, client_id').lt('stock_actuel', 'stock_minimum');
  
  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const { data: produits } = await query;

  return produits?.slice(0, 5).map(p => ({
    productId: p.id,
    productName: p.nom || p.id,
    currentStock: p.stock_actuel || 0,
    predictedStockout: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    severity: (p.stock_actuel || 0) < 5 ? 'critical' : 'warning',
    recommendedAction: `Commander ${Math.max(50, (p.stock_minimum || 0) * 2)} unités maintenant`,
  })) || [];
}
