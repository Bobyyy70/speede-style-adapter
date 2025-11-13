import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getN8nConfig } from '@/lib/expeditionConfig';

interface Order {
  id: string;
  numero_commande: string;
  client_name?: string;
  adresse_livraison?: string;
  montant_total?: number;
  poids_total?: number;
  items: OrderItem[];
}

interface OrderItem {
  id: string;
  produit_sku: string;
  quantite: number;
}

interface OrderSelectorProps {
  onSelect: (order: Order | null) => void;
}

export function OrderSelector({ onSelect }: OrderSelectorProps) {
  const [orderId, setOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [weightOverride, setWeightOverride] = useState('');

  const handleSearch = async () => {
    if (!orderId.trim()) {
      toast.error('Veuillez saisir un ID de commande');
      return;
    }

    setLoading(true);
    try {
      const config = getN8nConfig();
      
      // Fetch order - bypass strict typing
      const { data: orderData, error: orderError } = await (supabase as any)
        .from(config.tables.orders)
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      // Fetch order items
      const { data: itemsData, error: itemsError } = await (supabase as any)
        .from(config.tables.orderItems)
        .select('*')
        .eq('commande_id', orderId);

      if (itemsError) throw itemsError;

      const loadedOrder: Order = {
        id: orderData?.id || orderId,
        numero_commande: orderData?.numero_commande || orderId,
        client_name: orderData?.nom_destinataire || orderData?.client_name || 'N/A',
        adresse_livraison: orderData?.adresse_livraison || '',
        montant_total: orderData?.montant_total || 0,
        poids_total: orderData?.poids_total || undefined,
        items: (itemsData || []).map((item: any) => ({
          id: item.id,
          produit_sku: item.produit_sku || item.sku || 'N/A',
          quantite: item.quantite || 1,
        })),
      };

      setOrder(loadedOrder);
      onSelect(loadedOrder);
      toast.success('Commande chargée avec succès');
    } catch (error: any) {
      console.error('Error fetching order:', error);
      toast.error('Erreur lors du chargement de la commande');
      setOrder(null);
      onSelect(null);
    } finally {
      setLoading(false);
    }
  };

  const handleWeightChange = (value: string) => {
    setWeightOverride(value);
    if (order) {
      const updatedOrder = {
        ...order,
        poids_total: value ? parseFloat(value) : order.poids_total,
      };
      setOrder(updatedOrder);
      onSelect(updatedOrder);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="flex-1 space-y-2">
          <Label htmlFor="order-id">ID Commande</Label>
          <Input
            id="order-id"
            placeholder="Saisir l'ID de la commande"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <div className="self-end">
          <Button onClick={handleSearch} disabled={loading}>
            <Search className="h-4 w-4 mr-2" />
            {loading ? 'Chargement...' : 'Rechercher'}
          </Button>
        </div>
      </div>

      {loading && (
        <Card>
          <CardContent className="pt-6 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      )}

      {order && !loading && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Numéro de commande</div>
                <div className="text-lg font-semibold">{order.numero_commande}</div>
              </div>
              {order.client_name && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Client</div>
                  <div className="text-lg">{order.client_name}</div>
                </div>
              )}
              {order.adresse_livraison && (
                <div className="md:col-span-2">
                  <div className="text-sm font-medium text-muted-foreground">Adresse de livraison</div>
                  <div className="text-sm">{order.adresse_livraison}</div>
                </div>
              )}
              {order.montant_total && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Montant total</div>
                  <div className="text-lg font-semibold">{order.montant_total.toFixed(2)} €</div>
                </div>
              )}
            </div>

            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">Articles ({order.items.length})</div>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2 font-medium">SKU</th>
                      <th className="text-right p-2 font-medium">Quantité</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="p-2">{item.produit_sku}</td>
                        <td className="p-2 text-right">{item.quantite}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {!order.poids_total && (
              <div className="space-y-2">
                <Label htmlFor="weight-override">Poids total (kg) - Requis</Label>
                <Input
                  id="weight-override"
                  type="number"
                  step="0.01"
                  placeholder="Ex: 2.5"
                  value={weightOverride}
                  onChange={(e) => handleWeightChange(e.target.value)}
                />
              </div>
            )}

            {order.poids_total && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Poids total</div>
                <div className="text-lg font-semibold">{order.poids_total.toFixed(2)} kg</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
