import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { Icon } from "leaflet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, MapPin, Navigation, Phone, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import "leaflet/dist/leaflet.css";

interface RelayPoint {
  id: string;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  country: string;
  latitude: number;
  longitude: number;
  phone?: string;
  opening_hours?: string;
  distance?: number;
}

interface RelayPointSelectorProps {
  onSelect: (relayPoint: RelayPoint) => void;
  selectedPointId?: string;
  defaultPostalCode?: string;
}

// Custom map component to handle view changes
function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

export function RelayPointSelector({
  onSelect,
  selectedPointId,
  defaultPostalCode = "",
}: RelayPointSelectorProps) {
  const [postalCode, setPostalCode] = useState(defaultPostalCode);
  const [searchLoading, setSearchLoading] = useState(false);
  const [relayPoints, setRelayPoints] = useState<RelayPoint[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([48.8566, 2.3522]); // Paris par défaut
  const [mapZoom, setMapZoom] = useState(13);
  const [selectedPoint, setSelectedPoint] = useState<RelayPoint | null>(null);

  // Icon personnalisé pour les marqueurs
  const defaultIcon = new Icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

  const selectedIcon = new Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

  // Rechercher les points relais par code postal
  const handleSearch = async () => {
    if (!postalCode || postalCode.length < 4) {
      toast.error("Veuillez entrer un code postal valide");
      return;
    }

    setSearchLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('mondial-relay-search-points', {
        body: {
          postal_code: postalCode,
          country_code: 'FR',
          max_results: 20,
        },
      });

      if (error) throw error;

      if (data.success && data.points && data.points.length > 0) {
        setRelayPoints(data.points);
        
        // Centrer la carte sur le premier point
        const firstPoint = data.points[0];
        setMapCenter([firstPoint.latitude, firstPoint.longitude]);
        setMapZoom(14);
        
        if (data.demo_mode) {
          toast.info("Mode démo: Données Mondial Relay simulées");
        } else {
          toast.success(`${data.count} points relais trouvés`);
        }
      } else {
        setRelayPoints([]);
        toast.info("Aucun point relais trouvé pour ce code postal");
      }
    } catch (error) {
      console.error("Error searching relay points:", error);
      toast.error("Erreur lors de la recherche des points relais");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectPoint = (point: RelayPoint) => {
    setSelectedPoint(point);
    onSelect(point);
    setMapCenter([point.latitude, point.longitude]);
    setMapZoom(16);
    toast.success(`Point relais sélectionné: ${point.name}`);
  };

  // Recherche initiale si code postal fourni
  useEffect(() => {
    if (defaultPostalCode && defaultPostalCode.length >= 4) {
      handleSearch();
    }
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Sélecteur de Point Relais
        </CardTitle>
        <CardDescription>
          Recherchez et sélectionnez un point relais pour la livraison
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recherche par code postal */}
        <div className="flex gap-2">
          <div className="flex-1 space-y-2">
            <Label htmlFor="postal-code">Code postal</Label>
            <Input
              id="postal-code"
              type="text"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="Ex: 75001"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleSearch}
              disabled={searchLoading}
              className="gap-2"
            >
              <Search className="h-4 w-4" />
              {searchLoading ? "Recherche..." : "Rechercher"}
            </Button>
          </div>
        </div>

        {/* Carte et liste des points */}
        {relayPoints.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {/* Carte */}
            <div className="space-y-2">
              <Label>Carte des points relais</Label>
              <div className="h-[400px] rounded-lg overflow-hidden border">
                <MapContainer
                  center={mapCenter}
                  zoom={mapZoom}
                  style={{ height: "100%", width: "100%" }}
                  scrollWheelZoom={true}
                >
                  <ChangeView center={mapCenter} zoom={mapZoom} />
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {relayPoints.map((point) => (
                    <Marker
                      key={point.id}
                      position={[point.latitude, point.longitude]}
                      icon={
                        selectedPoint?.id === point.id || selectedPointId === point.id
                          ? selectedIcon
                          : defaultIcon
                      }
                      eventHandlers={{
                        click: () => handleSelectPoint(point),
                      }}
                    >
                      <Popup>
                        <div className="space-y-1 text-sm">
                          <p className="font-semibold">{point.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {point.address}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {point.postal_code} {point.city}
                          </p>
                          {point.distance !== undefined && (
                            <p className="text-xs font-medium text-primary">
                              <Navigation className="h-3 w-3 inline mr-1" />
                              {point.distance} km
                            </p>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            </div>

            {/* Liste des points */}
            <div className="space-y-2">
              <Label>Points relais disponibles</Label>
              <ScrollArea className="h-[400px] rounded-lg border">
                <div className="p-2 space-y-2">
                  {relayPoints.map((point) => (
                    <Card
                      key={point.id}
                      className={`cursor-pointer transition-colors hover:bg-accent ${
                        selectedPoint?.id === point.id || selectedPointId === point.id
                          ? "border-primary bg-accent"
                          : ""
                      }`}
                      onClick={() => handleSelectPoint(point)}
                    >
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <p className="font-medium text-sm">{point.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {point.address}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {point.postal_code} {point.city}
                            </p>
                          </div>
                          {point.distance !== undefined && (
                            <div className="text-xs font-medium text-primary flex items-center gap-1">
                              <Navigation className="h-3 w-3" />
                              {point.distance} km
                            </div>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {point.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {point.phone}
                            </div>
                          )}
                          {point.opening_hours && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {point.opening_hours}
                            </div>
                          )}
                        </div>

                        {(selectedPoint?.id === point.id || selectedPointId === point.id) && (
                          <div className="pt-2 border-t">
                            <div className="text-xs font-medium text-primary flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              Point sélectionné
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}

        {/* État initial */}
        {relayPoints.length === 0 && !searchLoading && (
          <div className="text-center py-8 text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">
              Entrez un code postal pour rechercher des points relais à proximité
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
