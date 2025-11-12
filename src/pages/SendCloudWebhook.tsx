import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, CheckCircle2, ExternalLink, Webhook, AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const SendCloudWebhook = () => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sendcloud-webhook`;

  const { data: recentEvents, refetch } = useQuery({
    queryKey: ["webhook-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sendcloud_event_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
  });

  const copyToClipboard = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success("URL copiée dans le presse-papier");
    setTimeout(() => setCopied(false), 2000);
  };

  const testWebhook = async () => {
    try {
      const testPayload = {
        action: "parcel_status_changed",
        timestamp: new Date().toISOString(),
        integration: 1,
        parcel: {
          id: 999999,
          external_reference: "TEST-ORDER",
          tracking_number: "TEST123456789",
          status: { id: 1, message: "Test" }
        }
      };

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-token": "test-token"
        },
        body: JSON.stringify(testPayload)
      });

      if (response.ok) {
        toast.success("Test du webhook réussi");
        refetch();
      } else {
        const error = await response.text();
        toast.error(`Erreur: ${error}`);
      }
    } catch (error) {
      toast.error("Erreur lors du test du webhook");
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate('/sendcloud-sync')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold mb-2">Configuration Webhook SendCloud</h1>
          <p className="text-muted-foreground">
            Configurez le webhook pour recevoir les commandes en temps réel depuis SendCloud
          </p>
        </div>
      </div>

      {/* Configuration principale */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            URL du Webhook
          </CardTitle>
          <CardDescription>
            Utilisez cette URL dans votre configuration SendCloud
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input 
              value={webhookUrl} 
              readOnly 
              className="font-mono text-sm"
            />
            <Button onClick={copyToClipboard} variant="outline">
              {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> Pour activer le webhook, vous devez configurer le secret dans les variables d'environnement.
              Contactez votre administrateur pour ajouter <code className="bg-muted px-1 rounded">SENDCLOUD_WEBHOOK_SECRET</code>.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Instructions de configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Instructions de configuration</CardTitle>
          <CardDescription>
            Suivez ces étapes pour configurer le webhook dans SendCloud
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex gap-3">
              <Badge className="h-6 w-6 flex items-center justify-center rounded-full">1</Badge>
              <div className="flex-1">
                <p className="font-medium">Connectez-vous à SendCloud</p>
                <p className="text-sm text-muted-foreground">
                  Accédez à votre compte SendCloud
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Badge className="h-6 w-6 flex items-center justify-center rounded-full">2</Badge>
              <div className="flex-1">
                <p className="font-medium">Allez dans Settings → Integrations → Webhooks</p>
                <p className="text-sm text-muted-foreground">
                  Cliquez sur "Add webhook" ou "Create new webhook"
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Badge className="h-6 w-6 flex items-center justify-center rounded-full">3</Badge>
              <div className="flex-1">
                <p className="font-medium">Configurez les événements</p>
                <p className="text-sm text-muted-foreground">
                  Sélectionnez les événements suivants:
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside mt-2 space-y-1">
                  <li><code>order_created</code> - Nouvelle commande</li>
                  <li><code>order_import</code> - Import de commande</li>
                  <li><code>parcel_status_changed</code> - Changement de statut</li>
                  <li><code>label_created</code> - Étiquette créée</li>
                  <li><code>tracking_updated</code> - Tracking mis à jour</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3">
              <Badge className="h-6 w-6 flex items-center justify-center rounded-full">4</Badge>
              <div className="flex-1">
                <p className="font-medium">Collez l'URL du webhook</p>
                <p className="text-sm text-muted-foreground">
                  Utilisez l'URL copiée ci-dessus dans le champ "Webhook URL"
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Badge className="h-6 w-6 flex items-center justify-center rounded-full">5</Badge>
              <div className="flex-1">
                <p className="font-medium">Activez le webhook</p>
                <p className="text-sm text-muted-foreground">
                  Enregistrez et activez le webhook dans SendCloud
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={testWebhook} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Tester le webhook
            </Button>
            <Button asChild variant="secondary">
              <a 
                href="https://panel.sendcloud.sc/settings/integrations/webhooks" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Ouvrir SendCloud
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Événements récents */}
      <Card>
        <CardHeader>
          <CardTitle>Événements récents</CardTitle>
          <CardDescription>
            Derniers événements reçus via le webhook
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentEvents && recentEvents.length > 0 ? (
            <div className="space-y-2">
              {recentEvents.map((event) => (
                <div 
                  key={event.id} 
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={event.success ? "default" : "destructive"}>
                      {event.event_type}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {new Date(event.created_at).toLocaleString('fr-FR')}
                    </span>
                  </div>
                  <div className="text-sm">
                    {event.success ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4" />
                        Traité
                      </span>
                    ) : (
                      <span className="text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        Erreur
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Webhook className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>Aucun événement reçu pour le moment</p>
              <p className="text-sm">
                Les événements apparaîtront ici dès que SendCloud enverra des données
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Événements supportés */}
      <Card>
        <CardHeader>
          <CardTitle>Événements supportés</CardTitle>
          <CardDescription>
            Liste complète des événements gérés par le webhook
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { event: "order_created", desc: "Création d'une nouvelle commande" },
              { event: "order_import", desc: "Import d'une commande" },
              { event: "parcel_status_changed", desc: "Changement de statut colis" },
              { event: "label_created", desc: "Étiquette d'expédition créée" },
              { event: "tracking_updated", desc: "Numéro de tracking mis à jour" },
              { event: "shipment_delayed", desc: "Expédition retardée" },
              { event: "delivery_failed", desc: "Échec de livraison" },
              { event: "return_initiated", desc: "Retour initié" },
              { event: "cancellation_requested", desc: "Annulation demandée" },
            ].map((item) => (
              <div 
                key={item.event}
                className="flex items-start gap-2 p-3 border rounded-lg"
              >
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">{item.event}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SendCloudWebhook;
