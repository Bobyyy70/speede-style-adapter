import { useState, useEffect } from "react";
import { PDALayout } from "@/components/pda/PDALayout";
import { ScannerInput } from "@/components/pda/ScannerInput";
import { VoiceInput } from "@/components/pda/VoiceInput";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Plus, Minus, Save, AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ComptageItem {
  id: string;
  produit_id: string;
  produit_reference: string;
  produit_nom: string;
  emplacement_code: string;
  stock_theorique: number;
  quantite_comptee: number;
  ecart: number;
  numero_lot?: string;
}

export default function PDAInventaire() {
  const [comptages, setComptages] = useState<ComptageItem[]>([]);
  const [currentEmplacement, setCurrentEmplacement] = useState("");
  const [currentProduit, setCurrentProduit] = useState<any>(null);
  const [quantiteComptee, setQuantiteComptee] = useState(0);
  const [numeroLot, setNumeroLot] = useState("");
  const [loading, setLoading] = useState(false);

  const handleScanEmplacement = async (code: string) => {
    try {
      setLoading(true);
      // Vérifier que l'emplacement existe
      const { data: emplacement, error } = await supabase
        .from("emplacement")
        .select("code_emplacement")
        .eq("code_emplacement", code)
        .single();

      if (error || !emplacement) {
        toast.error("Emplacement non trouvé");
        return;
      }

      setCurrentEmplacement(code);
      setCurrentProduit(null);
      toast.success(`Emplacement ${code} sélectionné`);
    } catch (error: any) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du scan de l'emplacement");
    } finally {
      setLoading(false);
    }
  };

  const handleScanProduit = async (code: string) => {
    if (!currentEmplacement) {
      toast.error("Veuillez d'abord scanner un emplacement");
      return;
    }

    try {
      setLoading(true);

      // Récupérer le produit et son stock
      const { data: produit, error: produitError } = await supabase
        .from("produit")
        .select("id, reference, nom")
        .or(`reference.eq.${code},reference.ilike.%${code}%`)
        .limit(1)
        .single();

      if (produitError || !produit) {
        toast.error("Produit non trouvé");
        return;
      }

      // Récupérer le stock actuel
      const { data: stock } = await supabase
        .from("stock_disponible")
        .select("*")
        .eq("produit_id", produit.id)
        .maybeSingle();

      setCurrentProduit({
        ...produit,
        stock_theorique: stock?.stock_disponible || 0
      });
      setQuantiteComptee(0);
      setNumeroLot("");

      toast.success(`Produit ${produit.nom} sélectionné`);
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
      setQuantiteComptee(parseInt(numberMatch[0]));
    }
  };

  const validerComptage = () => {
    if (!currentProduit || !currentEmplacement) {
      toast.error("Veuillez scanner un emplacement et un produit");
      return;
    }

    const ecart = quantiteComptee - currentProduit.stock_theorique;

    const nouveauComptage: ComptageItem = {
      id: `${Date.now()}-${currentProduit.id}`,
      produit_id: currentProduit.id,
      produit_reference: currentProduit.reference,
      produit_nom: currentProduit.nom,
      emplacement_code: currentEmplacement,
      stock_theorique: currentProduit.stock_theorique,
      quantite_comptee: quantiteComptee,
      ecart: ecart,
      numero_lot: numeroLot || undefined
    };

    setComptages([...comptages, nouveauComptage]);

    if (ecart !== 0) {
      toast.warning(`Écart détecté: ${ecart > 0 ? '+' : ''}${ecart}`, {
        description: `Stock théorique: ${currentProduit.stock_theorique}, Compté: ${quantiteComptee}`
      });
    } else {
      toast.success("Comptage validé - Aucun écart");
    }

    // Réinitialiser pour le prochain comptage
    setCurrentProduit(null);
    setQuantiteComptee(0);
    setNumeroLot("");
  };

  const sauvegarderInventaire = async () => {
    if (comptages.length === 0) {
      toast.error("Aucun comptage à sauvegarder");
      return;
    }

    try {
      setLoading(true);

      // Pour chaque comptage avec écart, créer un mouvement de stock
      for (const comptage of comptages) {
        if (comptage.ecart !== 0) {
          const { error } = await supabase
            .from("mouvement_stock")
            .insert({
              produit_id: comptage.produit_id,
              type_mouvement: comptage.ecart > 0 ? "ajustement_positif" : "ajustement_negatif",
              quantite: Math.abs(comptage.ecart),
              numero_lot: comptage.numero_lot || null,
              reference: `INV-${new Date().toISOString().split('T')[0]}`,
              commentaire: `Inventaire - Écart: ${comptage.ecart}`
            });

          if (error) {
            console.error("Erreur mouvement:", error);
            throw error;
          }
        }
      }

      toast.success(`${comptages.length} comptage(s) sauvegardé(s)`);
      setComptages([]);
      setCurrentEmplacement("");
      setCurrentProduit(null);
    } catch (error: any) {
      console.error("Erreur sauvegarde:", error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setLoading(false);
    }
  };

  const totalEcarts = comptages.reduce((acc, c) => acc + Math.abs(c.ecart), 0);
  const comptagesAvecEcart = comptages.filter(c => c.ecart !== 0).length;

  return (
    <PDALayout
      title="Inventaire"
      badge={currentEmplacement || undefined}
    >
      <Tabs defaultValue="comptage" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="comptage">Comptage</TabsTrigger>
          <TabsTrigger value="recap">
            Récapitulatif
            {comptages.length > 0 && (
              <Badge variant="secondary" className="ml-2">{comptages.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="comptage" className="space-y-4">
          {/* Scanner emplacement */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">1. Scanner l'emplacement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ScannerInput
                onScan={handleScanEmplacement}
                placeholder="Scanner le code emplacement..."
                disabled={loading}
              />
              {currentEmplacement && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="font-semibold">📍 {currentEmplacement}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scanner produit */}
          {currentEmplacement && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">2. Scanner le produit</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ScannerInput
                  onScan={handleScanProduit}
                  placeholder="Scanner le code produit..."
                  disabled={loading}
                />
                {currentProduit && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="font-semibold">{currentProduit.nom}</p>
                    <p className="text-sm text-muted-foreground">
                      Réf: {currentProduit.reference}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Stock théorique: {currentProduit.stock_theorique}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Comptage */}
          {currentProduit && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">3. Quantité comptée</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Quantité */}
                <div className="space-y-2">
                  <Label>Quantité physique</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantiteComptee(Math.max(0, quantiteComptee - 1))}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      value={quantiteComptee}
                      onChange={(e) => setQuantiteComptee(parseInt(e.target.value) || 0)}
                      className="text-center text-2xl font-bold"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantiteComptee(quantiteComptee + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Mode vocal */}
                <VoiceInput onVoiceInput={handleVoiceInput} disabled={loading} />

                {/* Écart */}
                {quantiteComptee !== currentProduit.stock_theorique && (
                  <div className={`p-3 rounded-lg border ${
                    quantiteComptee > currentProduit.stock_theorique
                      ? 'bg-orange-50 border-orange-200'
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      <div>
                        <p className="font-semibold">
                          Écart: {quantiteComptee - currentProduit.stock_theorique > 0 ? '+' : ''}
                          {quantiteComptee - currentProduit.stock_theorique}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Théorique: {currentProduit.stock_theorique} | Compté: {quantiteComptee}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

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
                  onClick={validerComptage}
                  className="w-full"
                  size="lg"
                  disabled={loading}
                >
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  Valider le comptage
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="recap" className="space-y-4">
          {/* Statistiques */}
          {comptages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Statistiques</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">{comptages.length}</p>
                    <p className="text-xs text-muted-foreground">Comptages</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-orange-500">{comptagesAvecEcart}</p>
                    <p className="text-xs text-muted-foreground">Avec écart</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-500">{totalEcarts}</p>
                    <p className="text-xs text-muted-foreground">Total écarts</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Liste des comptages */}
          <div className="space-y-3">
            {comptages.map((comptage) => (
              <Card key={comptage.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{comptage.produit_nom}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        📍 {comptage.emplacement_code}
                      </p>
                    </div>
                    {comptage.ecart !== 0 && (
                      <Badge variant={comptage.ecart > 0 ? "default" : "destructive"}>
                        {comptage.ecart > 0 ? '+' : ''}{comptage.ecart}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Théorique:</span>
                      <span className="ml-2 font-medium">{comptage.stock_theorique}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Compté:</span>
                      <span className="ml-2 font-medium">{comptage.quantite_comptee}</span>
                    </div>
                    {comptage.numero_lot && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Lot:</span>
                        <span className="ml-2 font-medium">{comptage.numero_lot}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {comptages.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>Aucun comptage enregistré</p>
            </div>
          )}

          {/* Sauvegarder */}
          {comptages.length > 0 && (
            <Button
              onClick={sauvegarderInventaire}
              className="w-full"
              size="lg"
              disabled={loading}
            >
              <Save className="mr-2 h-5 w-5" />
              Sauvegarder l'inventaire
            </Button>
          )}
        </TabsContent>
      </Tabs>
    </PDALayout>
  );
}
