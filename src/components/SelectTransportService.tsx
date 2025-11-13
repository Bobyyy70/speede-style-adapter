import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Package, Shield, FileSignature, MapPin } from "lucide-react";
import { toast } from "sonner";
import { RelayPointSelector } from "./RelayPointSelector";

interface SelectTransportServiceProps {
  commandeId: string;
  poidsTotal?: number;
  paysDestination?: string;
  onServiceSelected?: () => void;
}

export function SelectTransportService({
  commandeId,
  poidsTotal = 0,
  paysDestination = "FR",
  onServiceSelected,
}: SelectTransportServiceProps) {
  const [selectedService, setSelectedService] = useState<string>("");
  const [withInsurance, setWithInsurance] = useState(false);
  const [insuranceAmount, setInsuranceAmount] = useState<number>(0);
  const [withSignature, setWithSignature] = useState(false);
  const [relayPointId, setRelayPointId] = useState<string>("");
  const [showRelaySelector, setShowRelaySelector] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch available transport services
  const { data: services, isLoading } = useQuery({
    queryKey: ["transporteur_service", poidsTotal, paysDestination],
    queryFn: async () => {
      let query = supabase
        .from("transporteur_service")
        .select("*")
        .eq("actif", true);

      // Filter by weight if provided
      if (poidsTotal > 0) {
        query = query
          .or(`poids_min_kg.is.null,poids_min_kg.lte.${poidsTotal}`)
          .or(`poids_max_kg.is.null,poids_max_kg.gte.${poidsTotal}`);
      }

      const { data, error } = await query.order("nom_affichage");

      if (error) throw error;
      return data;
    },
  });

  const handleSave = async () => {
    if (!selectedService) {
      toast.error("Veuillez sélectionner un service de transport");
      return;
    }

    setSaving(true);
    try {
      const selectedServiceData = services?.find((s) => s.code_service === selectedService);

      const updates: any = {
        transporteur_choisi: selectedService,
        methode_expedition: selectedServiceData?.nom_affichage,
        date_modification: new Date().toISOString(),
      };

      if (withInsurance) {
        updates.assurance_demandee = true;
        updates.valeur_assuree = insuranceAmount;
      }

      if (relayPointId) {
        updates.point_relais_id = relayPointId;
      }

      const { error } = await supabase
        .from("commande")
        .update(updates)
        .eq("id", commandeId);

      if (error) throw error;

      toast.success("Service de transport enregistré");
      onServiceSelected?.();
    } catch (error: any) {
      console.error("Error saving transport service:", error);
      toast.error("Erreur lors de l'enregistrement du service");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Chargement des services...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Choix du Service de Transport
        </CardTitle>
        <CardDescription>
          Sélectionnez le service et les options pour cette expédition
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Service Selection */}
        <div className="space-y-2">
          <Label htmlFor="service">Service de transport *</Label>
          <Select value={selectedService} onValueChange={setSelectedService}>
            <SelectTrigger id="service">
              <SelectValue placeholder="Sélectionner un service..." />
            </SelectTrigger>
            <SelectContent>
              {services?.map((service) => (
                <SelectItem key={service.id} value={service.code_service}>
                  <div className="flex flex-col">
                    <span className="font-medium">{service.nom_affichage}</span>
                    {service.description && (
                      <span className="text-xs text-muted-foreground">
                        {service.description}
                      </span>
                    )}
                    {(service.delai_min_jours || service.delai_max_jours) && (
                      <span className="text-xs text-muted-foreground">
                        Délai: {service.delai_min_jours}-{service.delai_max_jours} jours
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {services?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aucun service disponible pour ce poids ({poidsTotal}kg)
            </p>
          )}
        </div>

        {/* Insurance Option */}
        <div className="flex items-center justify-between space-x-2">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="insurance" className="cursor-pointer">
              Assurance transport
            </Label>
          </div>
          <Switch
            id="insurance"
            checked={withInsurance}
            onCheckedChange={setWithInsurance}
          />
        </div>

        {withInsurance && (
          <div className="space-y-2 pl-6">
            <Label htmlFor="insurance-amount">Montant assuré (€)</Label>
            <Input
              id="insurance-amount"
              type="number"
              min="0"
              step="0.01"
              value={insuranceAmount}
              onChange={(e) => setInsuranceAmount(parseFloat(e.target.value) || 0)}
              placeholder="Valeur à assurer"
            />
          </div>
        )}

        {/* Signature Option */}
        <div className="flex items-center justify-between space-x-2">
          <div className="flex items-center gap-2">
            <FileSignature className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="signature" className="cursor-pointer">
              Signature à la livraison
            </Label>
          </div>
          <Switch
            id="signature"
            checked={withSignature}
            onCheckedChange={setWithSignature}
          />
        </div>

        {/* Relay Point Option */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            Point relais (optionnel)
          </Label>
          {relayPointId ? (
            <div className="flex items-center gap-2">
              <Input
                type="text"
                value={relayPointId}
                disabled
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRelayPointId("");
                  setShowRelaySelector(false);
                }}
              >
                Retirer
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowRelaySelector(!showRelaySelector)}
            >
              <MapPin className="h-4 w-4 mr-2" />
              Choisir un point relais
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Laissez vide pour une livraison à domicile
          </p>
        </div>

        {/* Relay Point Selector */}
        {showRelaySelector && (
          <RelayPointSelector
            onSelect={(point) => {
              setRelayPointId(point.service_point_id || point.id);
              setShowRelaySelector(false);
            }}
            selectedPointId={relayPointId}
            defaultPostalCode={paysDestination === "FR" ? "" : ""}
          />
        )}

        {/* Info Box */}
        {poidsTotal > 0 && (
          <div className="rounded-lg bg-muted p-3 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <Package className="h-4 w-4" />
              Informations colis
            </div>
            <div className="mt-2 space-y-1 text-muted-foreground">
              <div>Poids total: {poidsTotal.toFixed(2)} kg</div>
              <div>Destination: {paysDestination}</div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={!selectedService || saving}
          className="w-full"
        >
          {saving ? "Enregistrement..." : "Enregistrer le service"}
        </Button>
      </CardContent>
    </Card>
  );
}