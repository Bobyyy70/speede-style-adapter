import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, Package, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getN8nConfig, getTransporteurRules } from '@/lib/expeditionConfig';
import { ParcelCreationPayload, ParcelCreationResponse } from '@/pages/expedition/types';

interface Order {
  id: string;
  numero_commande: string;
  poids_total?: number;
  items: any[];
}

interface ParcelCreationFormProps {
  order: Order;
  disabled?: boolean;
}

const CARRIERS = ['Auto', 'FedEx', 'Colissimo', 'Mondial Relay', 'Autre'] as const;

const SERVICES_BY_CARRIER: Record<string, string[]> = {
  'FedEx': ['Express', 'Economy'],
  'Colissimo': ['Domicile', 'Point Relais'],
  'Mondial Relay': ['Point Relais', 'Domicile Plus'],
  'Autre': ['Standard'],
  'Auto': ['Auto'],
};

export function ParcelCreationForm({ order, disabled }: ParcelCreationFormProps) {
  const [carrier, setCarrier] = useState<string>('Auto');
  const [service, setService] = useState<string>('Auto');
  const [servicePointId, setServicePointId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ParcelCreationResponse | null>(null);

  const availableServices = SERVICES_BY_CARRIER[carrier] || ['Auto'];

  useEffect(() => {
    setService(availableServices[0]);
  }, [carrier]);

  const requiresServicePoint = carrier === 'Mondial Relay' && service.includes('Point Relais');
  const canSubmit = !disabled && order.poids_total && (!requiresServicePoint || servicePointId.trim());

  const handleCreateParcel = async () => {
    if (!canSubmit) return;

    setLoading(true);
    setResult(null);

    try {
      const config = getN8nConfig();
      const rules = getTransporteurRules();

      const payload: ParcelCreationPayload = {
        order_id: order.id,
        carrier: carrier === 'Auto' ? '' : carrier,
        service: service === 'Auto' ? '' : service,
        shipping_method_id: carrier === 'Auto' ? null : undefined,
        service_point_id: servicePointId.trim() || null,
        request_label: true,
        mapping: rules,
        supabase: config,
      };

      const response = await fetch(`${config.baseUrl}/create-parcel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erreur HTTP ${response.status}`);
      }

      const data: ParcelCreationResponse = await response.json();
      setResult(data);

      // Update order in Supabase - bypass strict typing
      const updateData: any = {
        [config.fields.parcel_id]: data.parcel_id,
        [config.fields.label_url]: data.label_url,
        [config.fields.tracking_code]: data.tracking_code,
        [config.fields.carrier]: data.carrier,
        [config.fields.service]: data.service,
      };

      const { error: updateError } = await (supabase as any)
        .from(config.tables.orders)
        .update(updateData)
        .eq('id', order.id);

      if (updateError) {
        console.error('Error updating order:', updateError);
        toast.error('Colis créé mais erreur lors de la mise à jour de la commande');
      } else {
        toast.success('Colis créé avec succès et commande mise à jour');
      }
    } catch (error: any) {
      console.error('Error creating parcel:', error);
      toast.error(error.message || 'Erreur lors de la création du colis');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {disabled && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            La configuration est incomplète. Veuillez compléter la configuration dans l'onglet "Configuration" avant de créer un colis.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="carrier">Transporteur</Label>
          <Select value={carrier} onValueChange={setCarrier} disabled={disabled}>
            <SelectTrigger id="carrier">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CARRIERS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="service">Service</Label>
          <Select value={service} onValueChange={setService} disabled={disabled}>
            <SelectTrigger id="service">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableServices.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {requiresServicePoint && (
        <div className="space-y-2">
          <Label htmlFor="service-point-id">
            Service Point ID <span className="text-destructive">*</span>
          </Label>
          <Input
            id="service-point-id"
            placeholder="Ex: 12345"
            value={servicePointId}
            onChange={(e) => setServicePointId(e.target.value)}
            disabled={disabled}
          />
          <p className="text-sm text-muted-foreground">
            Requis pour Mondial Relay Point Relais
          </p>
        </div>
      )}

      <Button
        onClick={handleCreateParcel}
        disabled={!canSubmit || loading}
        size="lg"
        className="w-full"
      >
        <Package className="h-4 w-4 mr-2" />
        {loading ? 'Création en cours...' : 'Créer colis + étiquette'}
      </Button>

      {result && (
        <Card className="border-primary">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex-1 space-y-2">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Parcel ID</div>
                  <div className="font-mono text-sm">{result.parcel_id}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Code de suivi</div>
                  <div className="font-mono text-sm">{result.tracking_code}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Transporteur / Service</div>
                  <div className="text-sm">{result.carrier} - {result.service}</div>
                </div>
              </div>
            </div>

            <Button
              onClick={() => window.open(result.label_url, '_blank')}
              variant="outline"
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Télécharger l'étiquette
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
