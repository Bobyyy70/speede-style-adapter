import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getN8nConfig, saveN8nConfig } from '@/lib/expeditionConfig';
import { N8nConfig } from '@/pages/expedition/types';

export function N8nConnectionForm() {
  const [config, setConfig] = useState<N8nConfig>(getN8nConfig());

  const handleSave = () => {
    try {
      saveN8nConfig(config);
      toast.success('Configuration sauvegardée avec succès');
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde de la configuration');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Connexions API</CardTitle>
          <CardDescription>
            Configurez les URLs et clés d'API nécessaires. Utilisez des placeholders pour la sécurité.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="n8n-base-url">N8N Base URL</Label>
            <Input
              id="n8n-base-url"
              placeholder="{{N8N_BASE_URL}}"
              value={config.baseUrl}
              onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="supabase-url">Supabase URL</Label>
            <Input
              id="supabase-url"
              placeholder="{{SUPABASE_URL}}"
              value={config.supabaseUrl}
              onChange={(e) => setConfig({ ...config, supabaseUrl: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="supabase-anon-key">Supabase Anon Key</Label>
            <Input
              id="supabase-anon-key"
              type="password"
              placeholder="{{SUPABASE_ANON_KEY}}"
              value={config.supabaseAnonKey}
              onChange={(e) => setConfig({ ...config, supabaseAnonKey: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Noms des tables</CardTitle>
          <CardDescription>Personnalisez les noms des tables utilisées dans Supabase</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="table-orders">Table des commandes</Label>
            <Input
              id="table-orders"
              value={config.tables.orders}
              onChange={(e) =>
                setConfig({
                  ...config,
                  tables: { ...config.tables, orders: e.target.value },
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="table-order-items">Table des lignes de commande</Label>
            <Input
              id="table-order-items"
              value={config.tables.orderItems}
              onChange={(e) =>
                setConfig({
                  ...config,
                  tables: { ...config.tables, orderItems: e.target.value },
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Noms des champs</CardTitle>
          <CardDescription>Personnalisez les noms des champs dans la table commandes</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="field-shipping-method">Shipping Method ID</Label>
            <Input
              id="field-shipping-method"
              value={config.fields.shipping_method_id}
              onChange={(e) =>
                setConfig({
                  ...config,
                  fields: { ...config.fields, shipping_method_id: e.target.value },
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="field-parcel-id">Parcel ID</Label>
            <Input
              id="field-parcel-id"
              value={config.fields.parcel_id}
              onChange={(e) =>
                setConfig({
                  ...config,
                  fields: { ...config.fields, parcel_id: e.target.value },
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="field-label-url">Label URL</Label>
            <Input
              id="field-label-url"
              value={config.fields.label_url}
              onChange={(e) =>
                setConfig({
                  ...config,
                  fields: { ...config.fields, label_url: e.target.value },
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="field-tracking">Tracking Code</Label>
            <Input
              id="field-tracking"
              value={config.fields.tracking_code}
              onChange={(e) =>
                setConfig({
                  ...config,
                  fields: { ...config.fields, tracking_code: e.target.value },
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="field-carrier">Carrier</Label>
            <Input
              id="field-carrier"
              value={config.fields.carrier}
              onChange={(e) =>
                setConfig({
                  ...config,
                  fields: { ...config.fields, carrier: e.target.value },
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="field-service">Service</Label>
            <Input
              id="field-service"
              value={config.fields.service}
              onChange={(e) =>
                setConfig({
                  ...config,
                  fields: { ...config.fields, service: e.target.value },
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} size="lg">
          Enregistrer la configuration
        </Button>
      </div>
    </div>
  );
}
