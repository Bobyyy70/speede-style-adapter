import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ConfigWarning } from '@/components/expedition/ConfigWarning';
import { OrderSelector } from '@/components/expedition/OrderSelector';
import { ParcelCreationForm } from '@/components/expedition/ParcelCreationForm';
import { validateConfig } from '@/lib/expeditionConfig';
import { Package, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface Order {
  id: string;
  numero_commande: string;
  poids_total?: number;
  items: any[];
}

export default function PreparerExpedition() {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const validation = validateConfig();
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-6 w-6" />
            <h1 className="text-3xl font-bold">Préparer Expédition</h1>
          </div>
          <p className="text-muted-foreground">
            Créez des colis et générez des étiquettes d'expédition via SendCloud.
          </p>
        </div>

        {!validation.isValid && (
          <>
            <ConfigWarning errors={validation.errors} />
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>
                  La configuration est incomplète. Veuillez compléter la configuration avant de créer des colis.
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/expedition/configuration')}
                >
                  Aller à la configuration
                </Button>
              </AlertDescription>
            </Alert>
          </>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Sélection de la commande</CardTitle>
          </CardHeader>
          <CardContent>
            <OrderSelector onSelect={setSelectedOrder} />
          </CardContent>
        </Card>

        {selectedOrder && (
          <Card>
            <CardHeader>
              <CardTitle>Créer le colis</CardTitle>
            </CardHeader>
            <CardContent>
              <ParcelCreationForm
                order={selectedOrder}
                disabled={!validation.isValid}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
