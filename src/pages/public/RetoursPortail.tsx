import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  RotateCcw,
  Package,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Upload,
  X,
  Search,
} from "lucide-react";

const MOTIFS_RETOUR = [
  { value: 'produit_defectueux', label: 'Produit défectueux' },
  { value: 'erreur_commande', label: 'Erreur de commande' },
  { value: 'taille_inadaptee', label: 'Taille inadaptée' },
  { value: 'produit_endommage', label: 'Produit endommagé' },
  { value: 'delai_livraison', label: 'Délai de livraison trop long' },
  { value: 'changement_avis', label: 'Changement d\'avis' },
  { value: 'autre', label: 'Autre raison' },
];

interface RetourData {
  numero_retour: string;
  retour_id: string;
  statut: string;
  message: string;
}

interface ConsultationRetourData {
  numero_retour: string;
  statut: string;
  date_demande: string;
  motif: string;
  details: string;
  numero_tracking_retour: string;
  transporteur_retour: string;
  decision: string;
  montant_rembourse: number;
  produits: Array<{
    produit_sku: string;
    produit_nom: string;
    quantite_demandee: number;
    quantite_recue: number;
    etat: string;
  }>;
  historique: Array<{
    date: string;
    statut: string;
    commentaire: string;
  }>;
}

export default function RetoursPortail() {
  const [step, setStep] = useState<'form' | 'success' | 'consult'>('form');
  const [numeroCommande, setNumeroCommande] = useState("");
  const [email, setEmail] = useState("");
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [motif, setMotif] = useState("");
  const [details, setDetails] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [retourData, setRetourData] = useState<RetourData | null>(null);

  // Pour consultation
  const [numeroRetour, setNumeroRetour] = useState("");
  const [consultationData, setConsultationData] = useState<ConsultationRetourData | null>(null);

  const urlParams = new URLSearchParams(window.location.search);
  const apiToken = urlParams.get('token') || '';

  const creerRetourMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('api_public_creer_retour', {
        p_api_token: apiToken,
        p_numero_commande: numeroCommande,
        p_email_client: email,
        p_motif_retour: motif,
        p_details_motif: details || null,
        p_client_nom: nom || null,
        p_client_telephone: telephone || null,
        p_photos_urls: photos.length > 0 ? JSON.stringify(photos) : '[]',
        p_produits: '[]', // À enrichir avec sélection produits
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erreur lors de la création du retour');
      }

      return data.data as RetourData;
    },
    onSuccess: (data) => {
      setRetourData(data);
      setStep('success');
    },
  });

  const consulterRetourMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('api_public_consulter_retour', {
        p_api_token: apiToken,
        p_numero_retour: numeroRetour,
        p_email_client: email,
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Retour non trouvé');
      }

      return data.data as ConsultationRetourData;
    },
    onSuccess: (data) => {
      setConsultationData(data);
    },
  });

  const getStatutLabel = (statut: string) => {
    const labels: Record<string, string> = {
      'demande_recue': 'Demande reçue',
      'validee': 'Validée',
      'etiquette_generee': 'Étiquette générée',
      'en_transit': 'En transit',
      'recue': 'Reçue',
      'en_controle': 'En contrôle qualité',
      'traitee': 'Traitée',
      'remboursee': 'Remboursée',
      'refusee': 'Refusée',
    };
    return labels[statut] || statut;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            Retourner un produit
          </h1>
          <p className="text-gray-600">
            Faites une demande de retour simple et rapide
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 justify-center">
          <Button
            variant={step === 'form' ? 'default' : 'outline'}
            onClick={() => {
              setStep('form');
              setConsultationData(null);
            }}
          >
            Nouveau retour
          </Button>
          <Button
            variant={step === 'consult' ? 'default' : 'outline'}
            onClick={() => {
              setStep('consult');
              setRetourData(null);
            }}
          >
            Suivre un retour
          </Button>
        </div>

        {/* Formulaire nouveau retour */}
        {step === 'form' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5" />
                Demande de retour
              </CardTitle>
              <CardDescription>
                Remplissez le formulaire pour demander un retour
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="numero_commande">Numéro de commande *</Label>
                  <Input
                    id="numero_commande"
                    placeholder="CMD-20251118-00001"
                    value={numeroCommande}
                    onChange={(e) => setNumeroCommande(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="votre@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nom">Nom complet</Label>
                  <Input
                    id="nom"
                    placeholder="Jean Dupont"
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telephone">Téléphone</Label>
                  <Input
                    id="telephone"
                    placeholder="+33 6 12 34 56 78"
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="motif">Motif du retour *</Label>
                <Select value={motif} onValueChange={setMotif}>
                  <SelectTrigger id="motif">
                    <SelectValue placeholder="Sélectionnez un motif" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOTIFS_RETOUR.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="details">Détails (optionnel)</Label>
                <Textarea
                  id="details"
                  placeholder="Décrivez le problème rencontré..."
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Photos (optionnel)</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Glissez vos photos ici ou cliquez pour sélectionner
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    (Fonctionnalité à implémenter - upload vers storage)
                  </p>
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={() => creerRetourMutation.mutate()}
                disabled={creerRetourMutation.isPending || !numeroCommande || !email || !motif}
              >
                {creerRetourMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Envoyer la demande
                  </>
                )}
              </Button>

              {creerRetourMutation.isError && (
                <Alert variant="destructive">
                  <AlertCircle className="w-4 h-4" />
                  <AlertDescription>
                    {(creerRetourMutation.error as Error).message}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Succès */}
        {step === 'success' && retourData && (
          <Card className="border-green-200 bg-green-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="w-6 h-6" />
                Demande de retour envoyée !
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-white rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Numéro de retour</span>
                  <span className="font-mono font-bold text-lg">{retourData.numero_retour}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Statut</span>
                  <Badge>{getStatutLabel(retourData.statut)}</Badge>
                </div>
              </div>

              <Alert>
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  {retourData.message}
                </AlertDescription>
              </Alert>

              <div className="text-sm text-muted-foreground space-y-1">
                <p>✅ Conservez votre numéro de retour: <strong>{retourData.numero_retour}</strong></p>
                <p>📧 Vous allez recevoir un email avec les instructions</p>
                <p>📦 Une étiquette de retour vous sera envoyée</p>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setStep('form');
                  setRetourData(null);
                  setNumeroCommande("");
                  setEmail("");
                  setMotif("");
                  setDetails("");
                }}
              >
                Faire une nouvelle demande
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Consultation retour */}
        {step === 'consult' && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Suivre mon retour
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="numero_retour">Numéro de retour *</Label>
                    <Input
                      id="numero_retour"
                      placeholder="RET-20251118-00001"
                      value={numeroRetour}
                      onChange={(e) => setNumeroRetour(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email_consult">Email *</Label>
                    <Input
                      id="email_consult"
                      type="email"
                      placeholder="votre@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={() => consulterRetourMutation.mutate()}
                  disabled={consulterRetourMutation.isPending || !numeroRetour || !email}
                >
                  {consulterRetourMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Recherche...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Consulter le retour
                    </>
                  )}
                </Button>

                {consulterRetourMutation.isError && (
                  <Alert variant="destructive">
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription>
                      {(consulterRetourMutation.error as Error).message}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Résultat consultation */}
            {consultationData && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Retour {consultationData.numero_retour}</span>
                    <Badge variant={consultationData.statut === 'remboursee' ? 'default' : 'secondary'}>
                      {getStatutLabel(consultationData.statut)}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Date demande</div>
                      <div className="font-medium">
                        {format(new Date(consultationData.date_demande), 'PPP', { locale: fr })}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Motif</div>
                      <div className="font-medium">
                        {MOTIFS_RETOUR.find(m => m.value === consultationData.motif)?.label}
                      </div>
                    </div>
                    {consultationData.transporteur_retour && (
                      <>
                        <div>
                          <div className="text-muted-foreground">Transporteur</div>
                          <div className="font-medium">{consultationData.transporteur_retour}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">N° suivi retour</div>
                          <div className="font-medium">{consultationData.numero_tracking_retour}</div>
                        </div>
                      </>
                    )}
                    {consultationData.montant_rembourse > 0 && (
                      <div className="col-span-2">
                        <div className="text-muted-foreground">Montant remboursé</div>
                        <div className="font-bold text-lg text-green-600">
                          {consultationData.montant_rembourse.toFixed(2)} €
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Historique */}
                  {consultationData.historique.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-medium">Historique</div>
                      <div className="space-y-2">
                        {consultationData.historique.map((event, index) => (
                          <div key={index} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                            <div className="flex-1">
                              <div className="font-medium">{getStatutLabel(event.statut)}</div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(event.date), 'PPP à HH:mm', { locale: fr })}
                              </div>
                              {event.commentaire && (
                                <div className="text-xs mt-1">{event.commentaire}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
