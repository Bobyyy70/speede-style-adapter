import { useState, useEffect } from "react";
import { PDALayout } from "@/components/pda/PDALayout";
import { ScannerInput } from "@/components/pda/ScannerInput";
import { VoiceInput } from "@/components/pda/VoiceInput";
import { PrintButton } from "@/components/pda/PrintButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, Plus, Minus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AttenduReception {
  id: string;
  numero_attendu: string;
  fournisseur_nom: string;
  statut_attendu: string;
  date_attendue: string;
  lignes: LigneAttendu[];
}

interface LigneAttendu {
  id: string;
  produit_id: string;
  produit_reference: string;
  produit_nom: string;
  quantite_attendue: number;
  quantite_recue: number;
  numero_lot?: string;
  date_fabrication?: string;
  date_peremption?: string;
}

export default function PDAReception() {
  const [attendus, setAttendus] = useState<AttenduReception[]>([]);
  const [selectedAttendu, setSelectedAttendu] = useState<AttenduReception | null>(null);
  const [selectedLigne, setSelectedLigne] = useState<LigneAttendu | null>(null);
  const [quantiteRecue, setQuantiteRecue] = useState(0);
  const [numeroLot, setNumeroLot] = useState("");
  const [dateFabrication, setDateFabrication] = useState("");
  const [datePeremption, setDatePeremption] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttendus();
  }, []);

  const fetchAttendus = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("attendu_reception")
        .select(`
          id,
          numero_attendu,
          fournisseur_nom,
          statut_attendu,
          date_attendue,
          ligne_attendu_reception (
            id,
            produit_id,
            produit_reference,
            produit_nom,
            quantite_attendue,
            quantite_recue,
            numero_lot,
            date_fabrication,
            date_peremption
          )
        `)
        .in("statut_attendu", ["arrivé", "en_cours_réception", "réceptionné_partiellement"])
        .order("date_attendue", { ascending: true });

      if (error) throw error;

      const attendusFormatted = data?.map((a: any) => ({
        id: a.id,
        numero_attendu: a.numero_attendu,
        fournisseur_nom: a.fournisseur_nom,
        statut_attendu: a.statut_attendu,
        date_attendue: a.date_attendue,
        lignes: a.ligne_attendu_reception || []
      })) || [];

      setAttendus(attendusFormatted);
    } catch (error: any) {
      console.error("Erreur chargement attendus:", error);
      toast.error("Erreur lors du chargement des réceptions");
    } finally {
      setLoading(false);
    }
  };

  const handleScanAttendu = async (code: string) => {
    const attendu = attendus.find(a =>
      a.numero_attendu === code || a.numero_attendu.includes(code)
    );

    if (attendu) {
      setSelectedAttendu(attendu);
      toast.success(`Attendu ${attendu.numero_attendu} sélectionné`);
    } else {
      toast.error("Attendu non trouvé");
    }
  };

  const handleScanProduit = async (code: string) => {
    if (!selectedAttendu) {
      toast.error("Veuillez d'abord sélectionner un attendu");
      return;
    }

    const ligne = selectedAttendu.lignes.find(l =>
      l.produit_reference === code || l.produit_reference.includes(code)
    );

    if (ligne) {
      setSelectedLigne(ligne);
      setQuantiteRecue(1);
      setNumeroLot(ligne.numero_lot || "");
      setDateFabrication(ligne.date_fabrication || "");
      setDatePeremption(ligne.date_peremption || "");
      toast.success(`Produit ${ligne.produit_nom} sélectionné`);
    } else {
      toast.error("Produit non trouvé dans cet attendu");
    }
  };

  const handleVoiceInput = (text: string) => {
    // Essayer de parser la commande vocale
    const numberMatch = text.match(/\d+/);
    if (numberMatch) {
      setQuantiteRecue(parseInt(numberMatch[0]));
    }
  };

  const validerReception = async () => {
    if (!selectedAttendu || !selectedLigne) {
      toast.error("Veuillez sélectionner un attendu et un produit");
      return;
    }

    try {
      // Mettre à jour la ligne d'attendu
      const nouvelleQuantiteRecue = (selectedLigne.quantite_recue || 0) + quantiteRecue;

      const { error: updateError } = await supabase
        .from("ligne_attendu_reception")
        .update({
          quantite_recue: nouvelleQuantiteRecue,
          numero_lot: numeroLot || null,
          date_fabrication: dateFabrication || null,
          date_peremption: datePeremption || null
        })
        .eq("id", selectedLigne.id);

      if (updateError) throw updateError;

      // Ajouter le mouvement de stock
      const { error: mouvementError } = await supabase
        .from("mouvement_stock")
        .insert({
          produit_id: selectedLigne.produit_id,
          type_mouvement: "entrée",
          quantite: quantiteRecue,
          numero_lot: numeroLot || null,
          date_fabrication: dateFabrication || null,
          date_peremption: datePeremption || null,
          attendu_reception_id: selectedAttendu.id,
          reference: `REC-${selectedAttendu.numero_attendu}`
        });

      if (mouvementError) throw mouvementError;

      toast.success(`${quantiteRecue} unité(s) réceptionnée(s)`);

      // Réinitialiser
      setSelectedLigne(null);
      setQuantiteRecue(0);
      setNumeroLot("");
      setDateFabrication("");
      setDatePeremption("");

      // Recharger les données
      await fetchAttendus();

      // Mettre à jour l'attendu sélectionné
      const updatedAttendu = attendus.find(a => a.id === selectedAttendu.id);
      if (updatedAttendu) {
        setSelectedAttendu(updatedAttendu);
      }
    } catch (error: any) {
      console.error("Erreur validation réception:", error);
      toast.error("Erreur lors de la validation");
    }
  };

  const getStatutBadge = (statut: string) => {
    const variants: Record<string, any> = {
      "arrivé": "default",
      "en_cours_réception": "secondary",
      "réceptionné_partiellement": "outline"
    };
    return <Badge variant={variants[statut] || "default"}>{statut}</Badge>;
  };

  if (loading) {
    return (
      <PDALayout title="Réception">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </PDALayout>
    );
  }

  return (
    <PDALayout
      title="Réception"
      badge={selectedAttendu ? selectedAttendu.numero_attendu : undefined}
    >
      <Tabs defaultValue="scan" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="scan">Scanner</TabsTrigger>
          <TabsTrigger value="list">Liste</TabsTrigger>
        </TabsList>

        <TabsContent value="scan" className="space-y-4">
          {/* Scanner attendu */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">1. Scanner l'attendu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ScannerInput
                onScan={handleScanAttendu}
                placeholder="Scanner le numéro d'attendu..."
              />
              {selectedAttendu && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">{selectedAttendu.numero_attendu}</span>
                    {getStatutBadge(selectedAttendu.statut_attendu)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {selectedAttendu.fournisseur_nom}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedAttendu.lignes.length} produit(s)
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scanner produit */}
          {selectedAttendu && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">2. Scanner le produit</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ScannerInput
                  onScan={handleScanProduit}
                  placeholder="Scanner le code produit..."
                />
                {selectedLigne && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="font-semibold">{selectedLigne.produit_nom}</p>
                    <p className="text-sm text-muted-foreground">
                      Réf: {selectedLigne.produit_reference}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Attendu: {selectedLigne.quantite_attendue} | Reçu: {selectedLigne.quantite_recue || 0}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Saisie quantité et détails */}
          {selectedLigne && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">3. Quantité et détails</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Quantité */}
                <div className="space-y-2">
                  <Label>Quantité reçue</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantiteRecue(Math.max(0, quantiteRecue - 1))}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      value={quantiteRecue}
                      onChange={(e) => setQuantiteRecue(parseInt(e.target.value) || 0)}
                      className="text-center text-2xl font-bold"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantiteRecue(quantiteRecue + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Mode vocal */}
                <VoiceInput onVoiceInput={handleVoiceInput} />

                {/* Numéro de lot */}
                <div className="space-y-2">
                  <Label>Numéro de lot (optionnel)</Label>
                  <Input
                    value={numeroLot}
                    onChange={(e) => setNumeroLot(e.target.value)}
                    placeholder="LOT-2025-001"
                  />
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label>Date fabrication</Label>
                    <Input
                      type="date"
                      value={dateFabrication}
                      onChange={(e) => setDateFabrication(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Date péremption</Label>
                    <Input
                      type="date"
                      value={datePeremption}
                      onChange={(e) => setDatePeremption(e.target.value)}
                    />
                  </div>
                </div>

                {/* Boutons d'action */}
                <div className="space-y-2 pt-2">
                  <Button
                    onClick={validerReception}
                    className="w-full"
                    size="lg"
                    disabled={quantiteRecue <= 0}
                  >
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    Valider la réception
                  </Button>

                  <PrintButton
                    label="Imprimer étiquette"
                    templateType="etiquette"
                    data={{
                      Produit: selectedLigne.produit_nom,
                      Référence: selectedLigne.produit_reference,
                      Lot: numeroLot || "N/A",
                      Quantité: quantiteRecue,
                      "Date fab.": dateFabrication || "N/A",
                      "Date pér.": datePeremption || "N/A"
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="list" className="space-y-3">
          {attendus.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun attendu en cours</p>
            </div>
          ) : (
            attendus.map((attendu) => (
              <Card
                key={attendu.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedAttendu(attendu)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{attendu.numero_attendu}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {attendu.fournisseur_nom}
                      </p>
                    </div>
                    {getStatutBadge(attendu.statut_attendu)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {attendu.lignes.length} produit(s)
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(attendu.date_attendue).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </PDALayout>
  );
}
