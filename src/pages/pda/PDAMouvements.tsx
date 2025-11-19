import { useState } from "react";
import { PDALayout } from "@/components/pda/PDALayout";
import { ScannerInput } from "@/components/pda/ScannerInput";
import { VoiceInput } from "@/components/pda/VoiceInput";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRight, Plus, Minus, CheckCircle2 } from "lucide-react";
import { Label } from "@/components/ui/label";

export default function PDAMouvements() {
  const [emplacementSource, setEmplacementSource] = useState("");
  const [emplacementDestination, setEmplacementDestination] = useState("");
  const [produit, setProduit] = useState<any>(null);
  const [quantite, setQuantite] = useState(0);
  const [numeroLot, setNumeroLot] = useState("");
  const [loading, setLoading] = useState(false);
  const [stockDisponible, setStockDisponible] = useState(0);

  const handleScanEmplacementSource = async (code: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("emplacement")
        .select("code_emplacement")
        .eq("code_emplacement", code)
        .single();

      if (error || !data) {
        toast.error("Emplacement source non trouvé");
        return;
      }

      setEmplacementSource(code);
      toast.success(`Emplacement source: ${code}`);
    } catch (error: any) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du scan");
    } finally {
      setLoading(false);
    }
  };

  const handleScanEmplacementDestination = async (code: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("emplacement")
        .select("code_emplacement")
        .eq("code_emplacement", code)
        .single();

      if (error || !data) {
        toast.error("Emplacement destination non trouvé");
        return;
      }

      if (code === emplacementSource) {
        toast.error("L'emplacement destination doit être différent de la source");
        return;
      }

      setEmplacementDestination(code);
      toast.success(`Emplacement destination: ${code}`);
    } catch (error: any) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du scan");
    } finally {
      setLoading(false);
    }
  };

  const handleScanProduit = async (code: string) => {
    if (!emplacementSource) {
      toast.error("Veuillez d'abord scanner l'emplacement source");
      return;
    }

    try {
      setLoading(true);

      // Récupérer le produit
      const { data: produitData, error: produitError } = await supabase
        .from("produit")
        .select("id, reference, nom")
        .or(`reference.eq.${code},reference.ilike.%${code}%`)
        .limit(1)
        .single();

      if (produitError || !produitData) {
        toast.error("Produit non trouvé");
        return;
      }

      // Récupérer le stock disponible
      const { data: stockData } = await supabase
        .from("stock_disponible")
        .select("quantite_disponible")
        .eq("produit_id", produitData.id)
        .single();

      setProduit(produitData);
      setStockDisponible(stockData?.quantite_disponible || 0);
      setQuantite(1);
      setNumeroLot("");

      toast.success(`Produit: ${produitData.nom}`);
    } catch (error: any) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du scan du produit");
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceInput = (text: string) => {
    const numberMatch = text.match(/\d+/);
    if (numberMatch) {
      setQuantite(parseInt(numberMatch[0]));
    }
  };

  const validerMouvement = async () => {
    if (!emplacementSource || !emplacementDestination || !produit) {
      toast.error("Veuillez compléter tous les champs");
      return;
    }

    if (quantite <= 0) {
      toast.error("La quantité doit être supérieure à 0");
      return;
    }

    if (quantite > stockDisponible) {
      toast.error(`Stock insuffisant (disponible: ${stockDisponible})`);
      return;
    }

    try {
      setLoading(true);

      // Récupérer les IDs des emplacements
      const { data: empSource } = await supabase
        .from("emplacement")
        .select("id")
        .eq("code_emplacement", emplacementSource)
        .single();

      const { data: empDest } = await supabase
        .from("emplacement")
        .select("id")
        .eq("code_emplacement", emplacementDestination)
        .single();

      if (!empSource || !empDest) {
        throw new Error("Emplacements non trouvés");
      }

      // Créer le mouvement de déplacement
      const { error } = await supabase
        .from("mouvement_stock")
        .insert({
          produit_id: produit.id,
          type_mouvement: "deplacement",
          quantite: quantite,
          emplacement_source_id: empSource.id,
          emplacement_destination_id: empDest.id,
          numero_lot: numeroLot || null,
          reference: `MOVE-${new Date().toISOString().split('T')[0]}`,
          commentaire: `Déplacement ${emplacementSource} → ${emplacementDestination}`
        });

      if (error) throw error;

      toast.success("Mouvement validé avec succès");

      // Réinitialiser
      setEmplacementSource("");
      setEmplacementDestination("");
      setProduit(null);
      setQuantite(0);
      setNumeroLot("");
      setStockDisponible(0);
    } catch (error: any) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la validation du mouvement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PDALayout title="Mouvements de Stock">
      <div className="space-y-4">
        {/* Emplacement Source */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">1. Emplacement source</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ScannerInput
              onScan={handleScanEmplacementSource}
              placeholder="Scanner l'emplacement source..."
              disabled={loading}
            />
            {emplacementSource && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="font-semibold">📍 {emplacementSource}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Emplacement Destination */}
        {emplacementSource && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">2. Emplacement destination</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ScannerInput
                onScan={handleScanEmplacementDestination}
                placeholder="Scanner l'emplacement destination..."
                disabled={loading}
              />
              {emplacementDestination && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="font-semibold">📍 {emplacementDestination}</p>
                </div>
              )}

              {/* Visualisation du mouvement */}
              {emplacementDestination && (
                <div className="flex items-center justify-center gap-3 p-4 bg-muted rounded-lg">
                  <Badge variant="outline">{emplacementSource}</Badge>
                  <ArrowRight className="h-5 w-5 text-primary" />
                  <Badge variant="outline">{emplacementDestination}</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Produit */}
        {emplacementDestination && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">3. Produit à déplacer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ScannerInput
                onScan={handleScanProduit}
                placeholder="Scanner le produit..."
                disabled={loading}
              />
              {produit && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="font-semibold">{produit.nom}</p>
                  <p className="text-sm text-muted-foreground">Réf: {produit.reference}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Stock disponible: {stockDisponible}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quantité */}
        {produit && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">4. Quantité à déplacer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Quantité */}
              <div className="space-y-2">
                <Label>Quantité</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantite(Math.max(0, quantite - 1))}
                    disabled={loading}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    value={quantite}
                    onChange={(e) => setQuantite(parseInt(e.target.value) || 0)}
                    className="text-center text-2xl font-bold"
                    max={stockDisponible}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantite(Math.min(stockDisponible, quantite + 1))}
                    disabled={loading}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {quantite > stockDisponible && (
                  <p className="text-sm text-red-500">
                    Quantité supérieure au stock disponible
                  </p>
                )}
              </div>

              {/* Mode vocal */}
              <VoiceInput onVoiceInput={handleVoiceInput} disabled={loading} />

              {/* Numéro de lot */}
              <div className="space-y-2">
                <Label>Numéro de lot (optionnel)</Label>
                <Input
                  value={numeroLot}
                  onChange={(e) => setNumeroLot(e.target.value)}
                  placeholder="LOT-2025-001"
                />
              </div>

              {/* Valider */}
              <Button
                onClick={validerMouvement}
                className="w-full"
                size="lg"
                disabled={loading || quantite <= 0 || quantite > stockDisponible}
              >
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Valider le mouvement
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        {!emplacementSource && (
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="font-semibold">Instructions :</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Scanner l'emplacement source</li>
                  <li>Scanner l'emplacement destination</li>
                  <li>Scanner le produit à déplacer</li>
                  <li>Saisir la quantité</li>
                  <li>Valider le mouvement</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PDALayout>
  );
}
