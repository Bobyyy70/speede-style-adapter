import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Package,
  Truck,
  MapPin,
  Calendar,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface TrackingData {
  numero_commande: string;
  statut_actuel: string;
  date_commande: string;
  date_livraison_estimee: string;
  transporteur: string;
  numero_tracking: string;
  url_tracking_transporteur: string;
  adresse_livraison: {
    destinataire: string;
    adresse: string;
    code_postal: string;
    ville: string;
    pays: string;
  };
  historique: Array<{
    date: string;
    statut: string;
    description: string;
  }>;
}

// Ce composant peut être utilisé:
// 1. En page standalone: /public/tracking
// 2. En iframe: <iframe src="https://your-wms.com/public/tracking?token=xxx" />
// 3. Via widget JS: <script src="https://your-wms.com/widget/tracking.js" data-token="xxx"></script>

export default function TrackingPortail() {
  const [numeroCommande, setNumeroCommande] = useState("");
  const [numeroTracking, setNumeroTracking] = useState("");
  const [email, setEmail] = useState("");
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);

  // Récupérer le token depuis l'URL (pour iframe)
  const urlParams = new URLSearchParams(window.location.search);
  const apiToken = urlParams.get('token') || '';

  const trackMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('api_public_track_commande', {
        p_api_token: apiToken,
        p_numero_commande: numeroCommande || null,
        p_numero_tracking: numeroTracking || null,
        p_email_client: email || null,
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erreur lors de la recherche');
      }

      return data.data as TrackingData;
    },
    onSuccess: (data) => {
      setTrackingData(data);
    },
  });

  const getStatutIcon = (statut: string) => {
    if (statut === 'livre') return <CheckCircle2 className="w-5 h-5 text-green-600" />;
    if (statut.includes('expedition') || statut.includes('transit') || statut.includes('livraison')) {
      return <Truck className="w-5 h-5 text-blue-600" />;
    }
    return <Clock className="w-5 h-5 text-orange-600" />;
  };

  const getStatutLabel = (statut: string) => {
    const labels: Record<string, string> = {
      'stock_reserve': 'Commande validée',
      'en_picking': 'En préparation',
      'en_preparation': 'En emballage',
      'pret_expedition': 'Prêt à expédier',
      'expedie': 'Expédié',
      'en_transit': 'En transit',
      'en_livraison': 'En livraison',
      'livre': 'Livré',
    };
    return labels[statut] || statut;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            Suivez votre colis
          </h1>
          <p className="text-gray-600">
            Entrez votre numéro de commande ou de suivi
          </p>
        </div>

        {/* Formulaire de recherche */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Rechercher ma commande
            </CardTitle>
            <CardDescription>
              Utilisez votre numéro de commande ou le numéro de suivi transporteur
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="numero_commande">Numéro de commande</Label>
                <Input
                  id="numero_commande"
                  placeholder="Ex: CMD-20251118-00001"
                  value={numeroCommande}
                  onChange={(e) => setNumeroCommande(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="numero_tracking">Numéro de suivi</Label>
                <Input
                  id="numero_tracking"
                  placeholder="Ex: 1Z999AA10123456784"
                  value={numeroTracking}
                  onChange={(e) => setNumeroTracking(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email (optionnel)</Label>
              <Input
                id="email"
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={() => trackMutation.mutate()}
              disabled={trackMutation.isPending || (!numeroCommande && !numeroTracking)}
            >
              {trackMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Recherche en cours...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Suivre ma commande
                </>
              )}
            </Button>

            {trackMutation.isError && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  {(trackMutation.error as Error).message}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Résultats */}
        {trackingData && (
          <div className="space-y-4">
            {/* Info commande */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Commande {trackingData.numero_commande}
                  </span>
                  <Badge variant={trackingData.statut_actuel === 'livre' ? 'default' : 'secondary'}>
                    {getStatutIcon(trackingData.statut_actuel)}
                    <span className="ml-2">{getStatutLabel(trackingData.statut_actuel)}</span>
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">Date de commande</div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(trackingData.date_commande), 'PPP', { locale: fr })}
                      </div>
                    </div>
                  </div>

                  {trackingData.date_livraison_estimee && (
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <div className="text-sm font-medium">Livraison estimée</div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(trackingData.date_livraison_estimee), 'PPP', { locale: fr })}
                        </div>
                      </div>
                    </div>
                  )}

                  {trackingData.transporteur && (
                    <div className="flex items-start gap-3">
                      <Truck className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <div className="text-sm font-medium">Transporteur</div>
                        <div className="text-sm text-muted-foreground">
                          {trackingData.transporteur}
                        </div>
                        {trackingData.numero_tracking && (
                          <div className="text-xs text-muted-foreground mt-1">
                            N° suivi: {trackingData.numero_tracking}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">Adresse de livraison</div>
                      <div className="text-sm text-muted-foreground">
                        {trackingData.adresse_livraison.destinataire}<br />
                        {trackingData.adresse_livraison.adresse}<br />
                        {trackingData.adresse_livraison.code_postal} {trackingData.adresse_livraison.ville}
                      </div>
                    </div>
                  </div>
                </div>

                {trackingData.url_tracking_transporteur && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => window.open(trackingData.url_tracking_transporteur, '_blank')}
                  >
                    <Truck className="w-4 h-4 mr-2" />
                    Suivre sur le site du transporteur
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Historique */}
            <Card>
              <CardHeader>
                <CardTitle>Historique de livraison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {trackingData.historique.map((event, index) => (
                    <div key={index} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          index === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted'
                        }`}>
                          {getStatutIcon(event.statut)}
                        </div>
                        {index < trackingData.historique.length - 1 && (
                          <div className="w-0.5 h-full bg-muted mt-2" />
                        )}
                      </div>
                      <div className="flex-1 pb-6">
                        <div className="font-medium">{event.description}</div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(event.date), 'PPP à HH:mm', { locale: fr })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>Besoin d'aide ? Contactez notre service client</p>
        </div>
      </div>
    </div>
  );
}
