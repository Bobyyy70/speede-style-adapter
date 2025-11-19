import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Settings,
  Plus,
  Save,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Truck,
} from 'lucide-react';
import type { CarrierConfig, CarrierConfigCreate } from '@/types/shipping';
import type { CarrierType } from '@/types/carriers';
import { CARRIER_CONFIGS } from '@/types/carriers';

export default function ConfigurationTransporteurs() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingCarrier, setEditingCarrier] = useState<CarrierType | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  // Query: Récupérer toutes les configurations
  const { data: configs, isLoading } = useQuery({
    queryKey: ['carrier-configs', profile?.client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('carrier_config')
        .select('*')
        .eq('client_id', profile?.client_id)
        .order('carrier_name');

      if (error) throw error;
      return data as CarrierConfig[];
    },
    enabled: !!profile?.client_id,
  });

  // Mutation: Créer/Mettre à jour configuration
  const saveMutation = useMutation({
    mutationFn: async (config: Partial<CarrierConfigCreate> & { id?: string }) => {
      const { id, ...configData } = config;

      if (id) {
        // Update
        const { data, error } = await supabase
          .from('carrier_config')
          .update(configData)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert
        const { data, error } = await supabase
          .from('carrier_config')
          .insert({
            ...configData,
            client_id: profile?.client_id,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carrier-configs'] });
      toast({
        title: 'Configuration enregistrée',
        description: 'La configuration du transporteur a été enregistrée avec succès',
      });
      setEditingCarrier(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Mutation: Supprimer configuration
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('carrier_config').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carrier-configs'] });
      toast({
        title: 'Configuration supprimée',
        description: 'La configuration a été supprimée avec succès',
      });
    },
  });

  const getCarrierConfig = (carrierType: CarrierType) => {
    return configs?.find((c) => c.carrier_type === carrierType);
  };

  const toggleShowSecret = (carrierId: string) => {
    setShowSecrets((prev) => ({ ...prev, [carrierId]: !prev[carrierId] }));
  };

  const availableCarriers: CarrierType[] = [
    'FEDEX',
    'MONDIAL_RELAY',
    'DHL',
    'UPS',
    'CHRONOPOST',
    'COLISSIMO',
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="h-8 w-8" />
            Configuration des Transporteurs
          </h1>
          <p className="text-gray-600 mt-2">
            Gérez vos API keys et paramètres pour chaque transporteur
          </p>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center">Chargement...</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {availableCarriers.map((carrierType) => {
            const existingConfig = getCarrierConfig(carrierType);
            const carrierInfo = CARRIER_CONFIGS[carrierType];
            const isEditing = editingCarrier === carrierType;

            return (
              <Card key={carrierType} className={isEditing ? 'border-blue-500' : ''}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Truck className="h-6 w-6 text-blue-600" />
                      <div>
                        <div>{carrierInfo.name}</div>
                        <div className="text-sm font-normal text-gray-500">
                          {carrierType}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {existingConfig?.is_active ? (
                        <span className="flex items-center gap-1 text-sm text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          Actif
                        </span>
                      ) : existingConfig ? (
                        <span className="flex items-center gap-1 text-sm text-gray-400">
                          <XCircle className="h-4 w-4" />
                          Inactif
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">Non configuré</span>
                      )}

                      {existingConfig && !isEditing && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingCarrier(carrierType)}
                          >
                            Modifier
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              if (
                                confirm(
                                  'Êtes-vous sûr de vouloir supprimer cette configuration ?'
                                )
                              ) {
                                deleteMutation.mutate(existingConfig.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}

                      {!existingConfig && !isEditing && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => setEditingCarrier(carrierType)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Configurer
                        </Button>
                      )}
                    </div>
                  </CardTitle>
                  <CardDescription>
                    {carrierInfo.supportsRelayPoints
                      ? 'Supporte les points relais'
                      : 'Livraison domicile uniquement'}{' '}
                    • Poids max: {carrierInfo.maxWeight}kg
                  </CardDescription>
                </CardHeader>

                {isEditing && (
                  <CardContent>
                    <CarrierConfigForm
                      carrierType={carrierType}
                      existingConfig={existingConfig}
                      onSave={(config) => saveMutation.mutate(config)}
                      onCancel={() => setEditingCarrier(null)}
                      showSecrets={showSecrets}
                      toggleShowSecret={toggleShowSecret}
                    />
                  </CardContent>
                )}

                {!isEditing && existingConfig && (
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <Label className="text-gray-500">API Key</Label>
                        <div className="font-mono">
                          {existingConfig.api_key ? '••••••••••••' : 'Non configuré'}
                        </div>
                      </div>
                      <div>
                        <Label className="text-gray-500">Account Number</Label>
                        <div className="font-mono">
                          {existingConfig.account_number || 'N/A'}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Form Component
// ============================================================================

interface CarrierConfigFormProps {
  carrierType: CarrierType;
  existingConfig?: CarrierConfig;
  onSave: (config: any) => void;
  onCancel: () => void;
  showSecrets: Record<string, boolean>;
  toggleShowSecret: (id: string) => void;
}

function CarrierConfigForm({
  carrierType,
  existingConfig,
  onSave,
  onCancel,
  showSecrets,
  toggleShowSecret,
}: CarrierConfigFormProps) {
  const [formData, setFormData] = useState({
    carrier_name: existingConfig?.carrier_name || CARRIER_CONFIGS[carrierType].name,
    carrier_type: carrierType,
    api_key: existingConfig?.api_key || '',
    secret_key: existingConfig?.secret_key || '',
    account_number: existingConfig?.account_number || '',
    merchant_id: existingConfig?.merchant_id || '',
    is_active: existingConfig?.is_active ?? true,
    is_default: existingConfig?.is_default ?? false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    onSave({
      ...(existingConfig ? { id: existingConfig.id } : {}),
      ...formData,
    });
  };

  const secretId = existingConfig?.id || 'new';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* FedEx */}
        {carrierType === 'FEDEX' && (
          <>
            <div className="col-span-2">
              <Label htmlFor="api_key">API Key *</Label>
              <div className="flex gap-2">
                <Input
                  id="api_key"
                  type={showSecrets[secretId] ? 'text' : 'password'}
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  required
                  placeholder="l7xx..."
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => toggleShowSecret(secretId)}
                >
                  {showSecrets[secretId] ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="col-span-2">
              <Label htmlFor="secret_key">Secret Key *</Label>
              <Input
                id="secret_key"
                type={showSecrets[secretId] ? 'text' : 'password'}
                value={formData.secret_key}
                onChange={(e) => setFormData({ ...formData, secret_key: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="account_number">Account Number *</Label>
              <Input
                id="account_number"
                value={formData.account_number}
                onChange={(e) =>
                  setFormData({ ...formData, account_number: e.target.value })
                }
                required
                placeholder="123456789"
              />
            </div>
          </>
        )}

        {/* Mondial Relay */}
        {carrierType === 'MONDIAL_RELAY' && (
          <>
            <div>
              <Label htmlFor="merchant_id">Merchant ID *</Label>
              <Input
                id="merchant_id"
                value={formData.merchant_id}
                onChange={(e) => setFormData({ ...formData, merchant_id: e.target.value })}
                required
                placeholder="BDXXXX"
              />
            </div>
            <div>
              <Label htmlFor="api_key">API Key *</Label>
              <Input
                id="api_key"
                type={showSecrets[secretId] ? 'text' : 'password'}
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                required
              />
            </div>
          </>
        )}

        {/* Autres transporteurs */}
        {!['FEDEX', 'MONDIAL_RELAY'].includes(carrierType) && (
          <>
            <div className="col-span-2">
              <Label htmlFor="api_key">API Key</Label>
              <Input
                id="api_key"
                type={showSecrets[secretId] ? 'text' : 'password'}
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                placeholder="Clé API du transporteur"
              />
            </div>
            <div>
              <Label htmlFor="account_number">Account Number</Label>
              <Input
                id="account_number"
                value={formData.account_number}
                onChange={(e) =>
                  setFormData({ ...formData, account_number: e.target.value })
                }
                placeholder="Numéro de compte"
              />
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch
            checked={formData.is_active}
            onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
          />
          <Label>Activer ce transporteur</Label>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={formData.is_default}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, is_default: checked })
            }
          />
          <Label>Transporteur par défaut</Label>
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit">
          <Save className="h-4 w-4 mr-2" />
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
