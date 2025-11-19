import { useState } from "react";
import { PDALayout } from "@/components/pda/PDALayout";
import { ScannerInput } from "@/components/pda/ScannerInput";
import { PrintButton } from "@/components/pda/PrintButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, XCircle, AlertTriangle, Camera } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface ControleQualite {
  id: string;
  produit_id: string;
  produit_reference: string;
  produit_nom: string;
  resultat: "conforme" | "non_conforme" | "conditionnellement_conforme";
  defauts: string[];
  commentaires: string;
  date_controle: string;
}

const DEFAUTS_TYPES = [
  "Emballage endommagé",
  "Produit cassé",
  "Produit sale",
  "Date de péremption proche",
  "Étiquetage incorrect",
  "Quantité incorrecte",
  "Défaut de fabrication",
  "Autre"
];

export default function PDAControleQualite() {
  const [produit, setProduit] = useState<any>(null);
  const [resultat, setResultat] = useState<"conforme" | "non_conforme" | "conditionnellement_conforme">("conforme");
  const [defautsSelectionnes, setDefautsSelectionnes] = useState<string[]>([]);
  const [commentaires, setCommentaires] = useState("");
  const [numeroLot, setNumeroLot] = useState("");
  const [loading, setLoading] = useState(false);
  const [controles, setControles] = useState<ControleQualite[]>([]);

  const handleScanProduit = async (code: string) => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("produit")
        .select("id, reference, nom, description")
        .or(`reference.eq.${code},reference.ilike.%${code}%`)
        .limit(1)
        .single();

      if (error || !data) {
        toast.error("Produit non trouvé");
        return;
      }

      setProduit(data);
      setResultat("conforme");
      setDefautsSelectionnes([]);
      setCommentaires("");
      setNumeroLot("");

      toast.success(`Produit: ${data.nom}`);
    } catch (error: any) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du scan du produit");
    } finally {
      setLoading(false);
    }
  };

  const toggleDefaut = (defaut: string) => {
    if (defautsSelectionnes.includes(defaut)) {
      setDefautsSelectionnes(defautsSelectionnes.filter(d => d !== defaut));
    } else {
      setDefautsSelectionnes([...defautsSelectionnes, defaut]);
    }
  };

  const validerControle = async () => {
    if (!produit) {
      toast.error("Veuillez scanner un produit");
      return;
    }

    if (resultat !== "conforme" && defautsSelectionnes.length === 0) {
      toast.error("Veuillez sélectionner au moins un défaut");
      return;
    }

    try {
      setLoading(true);

      const controle: ControleQualite = {
        id: `CQ-${Date.now()}`,
        produit_id: produit.id,
        produit_reference: produit.reference,
        produit_nom: produit.nom,
        resultat: resultat,
        defauts: defautsSelectionnes,
        commentaires: commentaires,
        date_controle: new Date().toISOString()
      };

      // Enregistrer dans un log de contrôle qualité
      // Note: Vous devrez créer cette table dans Supabase
      // Pour l'instant, on stocke localement
      setControles([controle, ...controles]);

      // Si non conforme, créer une alerte ou un mouvement de quarantaine
      if (resultat === "non_conforme") {
        // Créer un mouvement vers zone de quarantaine
        await supabase
          .from("mouvement_stock")
          .insert({
            produit_id: produit.id,
            type_mouvement: "quarantaine",
            quantite: 1,
            numero_lot: numeroLot || null,
            reference: controle.id,
            commentaire: `Contrôle qualité NON CONFORME - ${defautsSelectionnes.join(", ")}`
          });
      }

      const messages = {
        conforme: "Produit conforme ✓",
        non_conforme: "Produit non conforme - Mis en quarantaine",
        conditionnellement_conforme: "Produit conditionnellement conforme"
      };

      toast.success(messages[resultat]);

      // Réinitialiser
      setProduit(null);
      setResultat("conforme");
      setDefautsSelectionnes([]);
      setCommentaires("");
      setNumeroLot("");
    } catch (error: any) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la validation du contrôle");
    } finally {
      setLoading(false);
    }
  };

  const getResultatBadge = (res: string) => {
    const variants: Record<string, any> = {
      conforme: { variant: "default", icon: CheckCircle2, color: "text-green-500" },
      non_conforme: { variant: "destructive", icon: XCircle, color: "text-red-500" },
      conditionnellement_conforme: { variant: "secondary", icon: AlertTriangle, color: "text-orange-500" }
    };
    const config = variants[res] || variants.conforme;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant}>
        <Icon className={`mr-1 h-3 w-3 ${config.color}`} />
        {res.replace(/_/g, " ")}
      </Badge>
    );
  };

  return (
    <PDALayout title="Contrôle Qualité">
      <div className="space-y-4">
        {/* Scanner produit */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Scanner le produit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ScannerInput
              onScan={handleScanProduit}
              placeholder="Scanner le code produit..."
              disabled={loading}
            />
            {produit && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="font-semibold">{produit.nom}</p>
                <p className="text-sm text-muted-foreground">Réf: {produit.reference}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Résultat du contrôle */}
        {produit && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Résultat du contrôle</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup value={resultat} onValueChange={(v: any) => setResultat(v)}>
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-green-50">
                  <RadioGroupItem value="conforme" id="conforme" />
                  <Label htmlFor="conforme" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="font-medium">Conforme</span>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-orange-50">
                  <RadioGroupItem value="conditionnellement_conforme" id="conditionnel" />
                  <Label htmlFor="conditionnel" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                      <span className="font-medium">Conditionnellement conforme</span>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-red-50">
                  <RadioGroupItem value="non_conforme" id="non_conforme" />
                  <Label htmlFor="non_conforme" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-red-500" />
                      <span className="font-medium">Non conforme</span>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        )}

        {/* Défauts détectés */}
        {produit && resultat !== "conforme" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Défauts détectés</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {DEFAUTS_TYPES.map((defaut) => (
                  <Button
                    key={defaut}
                    variant={defautsSelectionnes.includes(defaut) ? "default" : "outline"}
                    className="h-auto py-3 text-xs"
                    onClick={() => toggleDefaut(defaut)}
                  >
                    {defaut}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Photos et commentaires */}
        {produit && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Détails</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Photo */}
              <div>
                <Label>Photo (optionnel)</Label>
                <Button variant="outline" className="w-full mt-2">
                  <Camera className="mr-2 h-4 w-4" />
                  Prendre une photo
                </Button>
              </div>

              {/* Numéro de lot */}
              <div className="space-y-2">
                <Label>Numéro de lot (optionnel)</Label>
                <input
                  type="text"
                  value={numeroLot}
                  onChange={(e) => setNumeroLot(e.target.value)}
                  placeholder="LOT-2025-001"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              {/* Commentaires */}
              <div className="space-y-2">
                <Label>Commentaires</Label>
                <Textarea
                  value={commentaires}
                  onChange={(e) => setCommentaires(e.target.value)}
                  placeholder="Observations et remarques..."
                  rows={3}
                />
              </div>

              {/* Valider */}
              <div className="space-y-2">
                <Button
                  onClick={validerControle}
                  className="w-full"
                  size="lg"
                  disabled={loading}
                >
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  Valider le contrôle
                </Button>

                {resultat !== "conforme" && (
                  <PrintButton
                    label="Imprimer fiche non-conformité"
                    templateType="document"
                    data={{
                      Produit: produit.nom,
                      Référence: produit.reference,
                      Lot: numeroLot || "N/A",
                      Résultat: resultat,
                      Défauts: defautsSelectionnes.join(", "),
                      Commentaires: commentaires || "N/A"
                    }}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Historique des contrôles */}
        {controles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contrôles récents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {controles.slice(0, 5).map((ctrl) => (
                  <div key={ctrl.id} className="p-3 border rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{ctrl.produit_nom}</p>
                        <p className="text-xs text-muted-foreground">{ctrl.produit_reference}</p>
                      </div>
                      {getResultatBadge(ctrl.resultat)}
                    </div>
                    {ctrl.defauts.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Défauts: {ctrl.defauts.join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PDALayout>
  );
}
