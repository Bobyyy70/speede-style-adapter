import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Package,
  Truck,
  FileText,
  MapPin,
  CheckCircle,
  Printer,
  ChevronRight,
  AlertCircle,
  DollarSign,
  Weight,
  Calendar,
} from 'lucide-react';
import type { CommandePretExpedition, CN23Article, ShipmentWorkflowStep } from '@/types/shipping';
import type { CarrierType } from '@/types/carriers';
import { CARRIER_CONFIGS, formatFedExService } from '@/types/carriers';
import { requiresCN23, calculateCN23Totals, formatCurrency } from '@/types/shipping';
import { RelayPointSelector } from '@/components/RelayPointSelector';

export default function Expedition() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState<ShipmentWorkflowStep>('select_order');
  const [selectedOrder, setSelectedOrder] = useState<CommandePretExpedition | null>(null);
  const [selectedCarrier, setSelectedCarrier] = useState<CarrierType | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [rates, setRates] = useState<any[]>([]);
  const [cn23Articles, setCn23Articles] = useState<CN23Article[]>([]);
  const [relayPointCode, setRelayPointCode] = useState<string | null>(null);
  const [generatedLabel, setGeneratedLabel] = useState<any>(null);

  // Query: Commandes prêtes pour expédition
  const { data: orders, isLoading } = useQuery({
    queryKey: ['commandes-pret-expedition', profile?.client_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_commandes_pret_expedition')
        .select('*')
        .eq('client_id', profile?.client_id)
        .is('label_id', null) // Seulement celles sans étiquette
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CommandePretExpedition[];
    },
    enabled: !!profile?.client_id,
  });

  // Mutation: Obtenir tarifs
  const getRatesMutation = useMutation({
    mutationFn: async ({
      carrier,
      order,
    }: {
      carrier: CarrierType;
      order: CommandePretExpedition;
    }) => {
      const functionName =
        carrier === 'FEDEX'
          ? 'tms-fedex-api'
          : carrier === 'MONDIAL_RELAY'
          ? 'tms-mondialrelay-api'
          : null;

      if (!functionName) {
        throw new Error('Transporteur non supporté pour la tarification');
      }

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          action: 'rate',
          origin: {
            postalCode: order.adresse_livraison?.code_postal || '75001',
            countryCode: 'FR',
          },
          destination: {
            postalCode: order.adresse_livraison?.code_postal || '',
            countryCode: order.adresse_livraison?.pays || '',
          },
          packages: [
            {
              weight: order.poids_total_kg || 1,
            },
          ],
        },
      });

      if (error) throw error;
      return data;
    },
  });

  // Mutation: Créer étiquette
  const createShipmentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrder || !selectedCarrier || !selectedService) {
        throw new Error('Données incomplètes');
      }

      const functionName =
        selectedCarrier === 'FEDEX'
          ? 'tms-fedex-api'
          : selectedCarrier === 'MONDIAL_RELAY'
          ? 'tms-mondialrelay-api'
          : null;

      if (!functionName) {
        throw new Error('Transporteur non supporté');
      }

      // Appeler l'API du transporteur
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          action: 'ship',
          planTransportId: selectedOrder.plan_transport_id,
          service: selectedService,
          relayPointCode: selectedCarrier === 'MONDIAL_RELAY' ? relayPointCode : undefined,
        },
      });

      if (error) throw error;

      // Créer l'enregistrement shipping_label
      const { data: label, error: labelError } = await supabase
        .from('shipping_label')
        .insert({
          client_id: profile?.client_id,
          plan_transport_id: selectedOrder.plan_transport_id,
          carrier_type: selectedCarrier,
          carrier_service: selectedService,
          tracking_number: data.trackingNumber,
          label_url: data.labelUrl,
          label_format: 'PDF',
        })
        .select()
        .single();

      if (labelError) throw labelError;

      return { ...data, label };
    },
    onSuccess: (data) => {
      setGeneratedLabel(data);
      setCurrentStep('print');
      queryClient.invalidateQueries({ queryKey: ['commandes-pret-expedition'] });
      toast({
        title: 'Étiquette générée !',
        description: `Numéro de suivi : ${data.trackingNumber}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSelectOrder = (order: CommandePretExpedition) => {
    setSelectedOrder(order);
    setCurrentStep('select_carrier');

    // Initialiser CN23 si nécessaire
    if (order.cn23_required && order.adresse_livraison) {
      const destCountry = order.adresse_livraison.pays || '';
      if (requiresCN23(destCountry)) {
        // Créer articles par défaut
        setCn23Articles([
          {
            description: `Commande ${order.numero_commande}`,
            quantity: 1,
            weight_kg: order.poids_total_kg || 1,
            value_eur: order.montant_total || 100,
            origin_country: 'FR',
          },
        ]);
      }
    }
  };

  const handleSelectCarrier = async (carrier: CarrierType) => {
    setSelectedCarrier(carrier);

    // Obtenir les tarifs
    if (selectedOrder) {
      const ratesData = await getRatesMutation.mutateAsync({
        carrier,
        order: selectedOrder,
      });

      setRates(ratesData?.rates || []);
    }
  };

  const handleSelectService = (service: string) => {
    setSelectedService(service);

    // Déterminer prochaine étape
    if (selectedOrder?.cn23_required) {
      setCurrentStep('fill_cn23');
    } else if (selectedCarrier === 'MONDIAL_RELAY') {
      setCurrentStep('select_relay_point');
    } else {
      setCurrentStep('confirm');
    }
  };

  const handleCN23Complete = () => {
    if (selectedCarrier === 'MONDIAL_RELAY') {
      setCurrentStep('select_relay_point');
    } else {
      setCurrentStep('confirm');
    }
  };

  const handleConfirmShipment = async () => {
    await createShipmentMutation.mutateAsync();
  };

  const handlePrintAndClose = () => {
    // Ouvrir les PDFs dans de nouveaux onglets
    if (generatedLabel?.labelUrl) {
      window.open(generatedLabel.labelUrl, '_blank');
    }
    if (generatedLabel?.cn23Url) {
      window.open(generatedLabel.cn23Url, '_blank');
    }

    // Réinitialiser
    setCurrentStep('select_order');
    setSelectedOrder(null);
    setSelectedCarrier(null);
    setSelectedService(null);
    setRates([]);
    setCn23Articles([]);
    setRelayPointCode(null);
    setGeneratedLabel(null);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Package className="h-8 w-8" />
          Expédition de Commandes
        </h1>
        <p className="text-gray-600 mt-2">
          Créez les étiquettes et documents d'expédition pour vos commandes
        </p>
      </div>

      {/* Stepper */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            {[
              { key: 'select_order', label: 'Commande', icon: Package },
              { key: 'select_carrier', label: 'Transporteur', icon: Truck },
              { key: 'fill_cn23', label: 'CN23', icon: FileText },
              { key: 'select_relay_point', label: 'Point Relais', icon: MapPin },
              { key: 'confirm', label: 'Confirmation', icon: CheckCircle },
              { key: 'print', label: 'Impression', icon: Printer },
            ].map((step, index) => {
              const Icon = step.icon;
              const isActive = step.key === currentStep;
              const isCompleted =
                ['select_order', 'select_carrier', 'fill_cn23', 'select_relay_point'].indexOf(
                  currentStep
                ) >
                ['select_order', 'select_carrier', 'fill_cn23', 'select_relay_point'].indexOf(
                  step.key as ShipmentWorkflowStep
                );

              // Skip CN23 si pas requis
              if (step.key === 'fill_cn23' && !selectedOrder?.cn23_required) return null;
              // Skip relay point si pas Mondial Relay
              if (
                step.key === 'select_relay_point' &&
                selectedCarrier !== 'MONDIAL_RELAY'
              )
                return null;

              return (
                <div key={step.key} className="flex items-center">
                  <div
                    className={`flex flex-col items-center ${
                      isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                    }`}
                  >
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                        isActive
                          ? 'border-blue-600 bg-blue-50'
                          : isCompleted
                          ? 'border-green-600 bg-green-50'
                          : 'border-gray-300'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs mt-1 font-medium">{step.label}</span>
                  </div>
                  {index < 5 && (
                    <ChevronRight className="h-5 w-5 mx-2 text-gray-400" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step: Select Order */}
      {currentStep === 'select_order' && (
        <OrderSelectionStep
          orders={orders || []}
          isLoading={isLoading}
          onSelect={handleSelectOrder}
        />
      )}

      {/* Step: Select Carrier */}
      {currentStep === 'select_carrier' && selectedOrder && (
        <CarrierSelectionStep
          order={selectedOrder}
          rates={rates}
          isLoading={getRatesMutation.isPending}
          onSelectCarrier={handleSelectCarrier}
          onSelectService={handleSelectService}
          selectedCarrier={selectedCarrier}
          selectedService={selectedService}
        />
      )}

      {/* Step: CN23 */}
      {currentStep === 'fill_cn23' && selectedOrder && (
        <CN23Step
          order={selectedOrder}
          articles={cn23Articles}
          setArticles={setCn23Articles}
          onComplete={handleCN23Complete}
        />
      )}

      {/* Step: Relay Point */}
      {currentStep === 'select_relay_point' && selectedOrder && (
        <RelayPointStep
          order={selectedOrder}
          onSelect={(code) => {
            setRelayPointCode(code);
            setCurrentStep('confirm');
          }}
        />
      )}

      {/* Step: Confirm */}
      {currentStep === 'confirm' && (
        <ConfirmStep
          order={selectedOrder}
          carrier={selectedCarrier}
          service={selectedService}
          cn23Articles={cn23Articles}
          relayPointCode={relayPointCode}
          onConfirm={handleConfirmShipment}
          isLoading={createShipmentMutation.isPending}
        />
      )}

      {/* Step: Print */}
      {currentStep === 'print' && generatedLabel && (
        <PrintStep label={generatedLabel} onClose={handlePrintAndClose} />
      )}
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

function OrderSelectionStep({
  orders,
  isLoading,
  onSelect,
}: {
  orders: CommandePretExpedition[];
  isLoading: boolean;
  onSelect: (order: CommandePretExpedition) => void;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">Chargement...</CardContent>
      </Card>
    );
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Aucune commande prête</h3>
          <p className="text-gray-600">
            Aucune commande n'est actuellement prête pour l'expédition
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Sélectionnez une commande</h2>
      {orders.map((order) => (
        <Card
          key={order.commande_id}
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onSelect(order)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{order.numero_commande}</h3>
                  <Badge>{order.statut_wms}</Badge>
                  {order.cn23_required && (
                    <Badge variant="outline" className="gap-1">
                      <AlertCircle className="h-3 w-3" />
                      CN23 Requis
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  <p>
                    Destination: {order.adresse_livraison?.ville},{' '}
                    {order.adresse_livraison?.pays}
                  </p>
                  <p className="flex items-center gap-4 mt-1">
                    <span className="flex items-center gap-1">
                      <Weight className="h-4 w-4" />
                      {order.poids_total_kg?.toFixed(2)} kg
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      {formatCurrency(order.montant_total)}
                    </span>
                  </p>
                </div>
              </div>
              <ChevronRight className="h-6 w-6 text-gray-400" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CarrierSelectionStep({
  order,
  rates,
  isLoading,
  onSelectCarrier,
  onSelectService,
  selectedCarrier,
  selectedService,
}: any) {
  const availableCarriers: CarrierType[] = ['FEDEX', 'MONDIAL_RELAY'];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Choisissez le transporteur et le service</h2>

      {/* Carriers */}
      <div className="grid grid-cols-2 gap-4">
        {availableCarriers.map((carrier) => {
          const config = CARRIER_CONFIGS[carrier];
          return (
            <Card
              key={carrier}
              className={`cursor-pointer transition-all ${
                selectedCarrier === carrier ? 'border-blue-500 bg-blue-50' : 'hover:shadow-md'
              }`}
              onClick={() => onSelectCarrier(carrier)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Truck className="h-6 w-6 text-blue-600" />
                  <div>
                    <h3 className="font-semibold">{config.name}</h3>
                    <p className="text-xs text-gray-500">{carrier}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Services/Rates */}
      {isLoading && (
        <Card>
          <CardContent className="py-12 text-center">Chargement des tarifs...</CardContent>
        </Card>
      )}

      {!isLoading && rates.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">Services disponibles</h3>
          {rates.map((rate: any) => (
            <Card
              key={rate.service}
              className={`cursor-pointer transition-all ${
                selectedService === rate.service
                  ? 'border-green-500 bg-green-50'
                  : 'hover:shadow-md'
              }`}
              onClick={() => onSelectService(rate.service)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">
                      {formatFedExService(rate.service) || rate.serviceType}
                    </h4>
                    {rate.transitTime && (
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {rate.transitTime}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">
                      {formatCurrency(rate.totalCharge.amount, rate.totalCharge.currency)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CN23Step({
  order,
  articles,
  setArticles,
  onComplete,
}: any) {
  const addArticle = () => {
    setArticles([
      ...articles,
      {
        description: '',
        quantity: 1,
        weight_kg: 0.5,
        value_eur: 10,
        origin_country: 'FR',
      },
    ]);
  };

  const updateArticle = (index: number, field: string, value: any) => {
    const updated = [...articles];
    updated[index] = { ...updated[index], [field]: value };
    setArticles(updated);
  };

  const totals = calculateCN23Totals(articles);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Déclaration Douanière CN23</CardTitle>
        <CardDescription>
          Export hors UE détecté - Déclaration CN23 obligatoire
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {articles.map((article: CN23Article, index: number) => (
          <div key={index} className="grid grid-cols-6 gap-3 p-3 border rounded">
            <div className="col-span-2">
              <Label>Description</Label>
              <Input
                value={article.description}
                onChange={(e) => updateArticle(index, 'description', e.target.value)}
                placeholder="Ex: Vêtements"
              />
            </div>
            <div>
              <Label>Quantité</Label>
              <Input
                type="number"
                value={article.quantity}
                onChange={(e) =>
                  updateArticle(index, 'quantity', parseInt(e.target.value))
                }
              />
            </div>
            <div>
              <Label>Poids (kg)</Label>
              <Input
                type="number"
                step="0.1"
                value={article.weight_kg}
                onChange={(e) =>
                  updateArticle(index, 'weight_kg', parseFloat(e.target.value))
                }
              />
            </div>
            <div>
              <Label>Valeur (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={article.value_eur}
                onChange={(e) =>
                  updateArticle(index, 'value_eur', parseFloat(e.target.value))
                }
              />
            </div>
            <div>
              <Label>Code HS</Label>
              <Input
                value={article.hs_code || ''}
                onChange={(e) => updateArticle(index, 'hs_code', e.target.value)}
                placeholder="6201"
              />
            </div>
          </div>
        ))}

        <Button type="button" variant="outline" onClick={addArticle}>
          + Ajouter un article
        </Button>

        <div className="border-t pt-4">
          <div className="text-right space-y-1">
            <p>
              <strong>Poids total:</strong> {totals.poids_total_kg.toFixed(2)} kg
            </p>
            <p>
              <strong>Valeur totale:</strong> {formatCurrency(totals.valeur_totale_eur)}
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={onComplete}>Continuer</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RelayPointStep({ order, onSelect }: any) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Sélectionnez un point relais</h2>
      <RelayPointSelector
        defaultPostalCode={order.adresse_livraison?.code_postal}
        onSelect={(point: any) => onSelect(point.id)}
      />
      <div className="mt-4 flex justify-end">
        <Button onClick={() => onSelect(null)}>Continuer sans point relais</Button>
      </div>
    </div>
  );
}

function ConfirmStep({ order, carrier, service, cn23Articles, relayPointCode, onConfirm, isLoading }: any) {
  const carrierConfig = carrier ? CARRIER_CONFIGS[carrier] : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Confirmation de l'expédition</CardTitle>
        <CardDescription>Vérifiez les informations avant de générer l'étiquette</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Commande</Label>
            <p className="font-semibold">{order?.numero_commande}</p>
          </div>
          <div>
            <Label>Transporteur</Label>
            <p className="font-semibold">{carrierConfig?.name}</p>
          </div>
          <div>
            <Label>Service</Label>
            <p className="font-semibold">{service}</p>
          </div>
          <div>
            <Label>Poids</Label>
            <p className="font-semibold">{order?.poids_total_kg?.toFixed(2)} kg</p>
          </div>
        </div>

        {cn23Articles.length > 0 && (
          <div>
            <Label>Articles CN23</Label>
            <p className="text-sm text-gray-600">{cn23Articles.length} article(s) déclaré(s)</p>
          </div>
        )}

        {relayPointCode && (
          <div>
            <Label>Point Relais</Label>
            <p className="font-semibold">{relayPointCode}</p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => window.location.reload()}>
            Annuler
          </Button>
          <Button onClick={onConfirm} disabled={isLoading}>
            {isLoading ? 'Génération...' : 'Générer l\'étiquette'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PrintStep({ label, onClose }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-600">
          <CheckCircle className="h-6 w-6" />
          Étiquette générée avec succès !
        </CardTitle>
        <CardDescription>Numéro de suivi: {label.trackingNumber}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <Button onClick={() => window.open(label.labelUrl, '_blank')} className="flex-1">
            <Printer className="h-4 w-4 mr-2" />
            Imprimer l'étiquette
          </Button>
          {label.cn23Url && (
            <Button onClick={() => window.open(label.cn23Url, '_blank')} variant="outline" className="flex-1">
              <FileText className="h-4 w-4 mr-2" />
              Imprimer CN23
            </Button>
          )}
        </div>

        <div className="text-center pt-4">
          <Button onClick={onClose} variant="outline">
            Terminer et nouvelle expédition
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
