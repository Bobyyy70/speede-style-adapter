import { useState, useEffect } from "react";
import { PDALayout } from "@/components/pda/PDALayout";
import { ScannerInput } from "@/components/pda/ScannerInput";
import { PrintButton } from "@/components/pda/PrintButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Plus, Minus, AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Retour {
  id: string;
  numero_retour: string;
  client_nom: string;
  statut_retour: string;
  date_creation: string;
  lignes: LigneRetour[];
}

interface LigneRetour {
  id: string;
  produit_id: string;
  produit_reference: string;
  produit_nom: string;
  quantite_attendue: number;
  quantite_recue: number;
  etat_produit?: string;
  action_a_faire?: string;
  motif_retour?: string;
}

const ETATS_PRODUIT = [
  "neuf",
  "bon_etat",
  "usage_normal",
  "endommage",
  "defectueux",
  "incomplet"
];

const ACTIONS = [
  "reintegrer_stock",
  "reparation",
  "destruction",
  "retour_fournisseur",
  "avoir_client"
];

export default function PDARetours() {
  const [retours, setRetours] = useState<Retour[]>([]);
  const [selectedRetour, setSelectedRetour] = useState<Retour | null>(null);
  const [selectedLigne, setSelectedLigne] = useState<LigneRetour | null>(null);
  const [quantiteRecue, setQuantiteRecue] = useState(0);
  const [etatProduit, setEtatProduit] = useState("bon_etat");
  const [action, setAction] = useState("reintegrer_stock");
  const [commentaires, setCommentaires] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRetours();
  }, []);

  const fetchRetours = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("retour_produit")
        .select(`
          id,
          numero_retour,
          client_nom,
          statut_retour,
          date_creation,
          ligne_retour_produit (
            id,
            produit_id,
            produit_reference,
            produit_nom,
            quantite_retournee,
            quantite_recue_entrepot,
            etat_produit,
            action_a_faire,
            motif_retour
          )
        `)
        .in("statut_retour", ["recu", "en_inspection"])
        .order("date_creation", { ascending: false });

      if (error) throw error;

      const retoursFormatted = data?.map((r: any) => ({
        id: r.id,
        numero_retour: r.numero_retour,
        client_nom: r.client_nom,
        statut_retour: r.statut_retour,
        date_creation: r.date_creation,
        lignes: r.ligne_retour_produit?.map((l: any) => ({
          id: l.id,
          produit_id: l.produit_id,
          produit_reference: l.produit_reference,
          produit_nom: l.produit_nom,
          quantite_attendue: l.quantite_retournee || 0,
          quantite_recue: l.quantite_recue_entrepot || 0,
          etat_produit: l.etat_produit,
          action_a_faire: l.action_a_faire,
          motif_retour: l.motif_retour
        })) || []
      })) || [];

      setRetours(retoursFormatted);
    } catch (error: any) {
      console.error("Erreur chargement retours:", error);
      toast.error("Erreur lors du chargement des retours");
    } finally {
      setLoading(false);
    }
  };

  const handleScanRetour = async (code: string) => {
    const retour = retours.find(r =>
      r.numero_retour === code || r.numero_retour.includes(code)
    );

    if (retour) {
      setSelectedRetour(retour);
      toast.success(`Retour ${retour.numero_retour} sélectionné`);
    } else {
      toast.error("Retour non trouvé");
    }
  };

  const handleScanProduit = async (code: string) => {
    if (!selectedRetour) {
      toast.error("Veuillez d'abord sélectionner un retour");
      return;
    }

    const ligne = selectedRetour.lignes.find(l =>
      l.produit_reference === code || l.produit_reference.includes(code)
    );

    if (ligne) {
      setSelectedLigne(ligne);
      setQuantiteRecue(1);
      setEtatProduit("bon_etat");
      setAction("reintegrer_stock");
      setCommentaires("");
      toast.success(`Produit ${ligne.produit_nom} sélectionné`);
    } else {
      toast.error("Produit non trouvé dans ce retour");
    }
  };

  const validerReceptionRetour = async () => {
    if (!selectedRetour || !selectedLigne) {
      toast.error("Veuillez sélectionner un retour et un produit");
      return;
    }

    if (quantiteRecue <= 0) {
      toast.error("La quantité doit être supérieure à 0");
      return;
    }

    try {
      setLoading(true);

      const nouvelleQuantiteRecue = (selectedLigne.quantite_recue || 0) + quantiteRecue;

      // Mettre à jour la ligne de retour
      const { error: updateError } = await supabase
        .from("ligne_retour_produit")
        .update({
          quantite_recue_entrepot: nouvelleQuantiteRecue,
          etat_produit: etatProduit,
          action_a_faire: action,
          commentaire_reception: commentaires
        })
        .eq("id", selectedLigne.id);

      if (updateError) throw updateError;

      // Si on réintègre au stock, créer le mouvement
      if (action === "reintegrer_stock" && (etatProduit === "neuf" || etatProduit === "bon_etat")) {
        const { error: mouvementError } = await supabase
          .from("mouvement_stock")
          .insert({
            produit_id: selectedLigne.produit_id,
            type_mouvement: "retour_client",
            quantite: quantiteRecue,
            reference: selectedRetour.numero_retour,
            commentaire: `Retour client - ${etatProduit}`
          });

        if (mouvementError) throw mouvementError;
      }

      toast.success(`${quantiteRecue} unité(s) réceptionnée(s)`);

      // Réinitialiser
      setSelectedLigne(null);
      setQuantiteRecue(0);
      setEtatProduit("bon_etat");
      setAction("reintegrer_stock");
      setCommentaires("");

      // Recharger
      await fetchRetours();
      const updatedRetour = retours.find(r => r.id === selectedRetour.id);
      if (updatedRetour) {
        setSelectedRetour(updatedRetour);
      }
    } catch (error: any) {
      console.error("Erreur validation:", error);
      toast.error("Erreur lors de la validation");
    } finally {
      setLoading(false);
    }
  };

  const getStatutBadge = (statut: string) => {
    const variants: Record<string, any> = {
      recu: "default",
      en_inspection: "secondary",
      traite: "outline"
    };
    return <Badge variant={variants[statut] || "default"}>{statut}</Badge>;
  };

  if (loading && retours.length === 0) {
    return (
      <PDALayout title="Retours">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </PDALayout>
    );
  }

  return (
    <PDALayout
      title="Retours"
      badge={selectedRetour ? selectedRetour.numero_retour : undefined}
    >
      <Tabs defaultValue="scan" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="scan">Scanner</TabsTrigger>
          <TabsTrigger value="list">Liste</TabsTrigger>
        </TabsList>

        <TabsContent value="scan" className="space-y-4">
          {/* Scanner retour */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">1. Scanner le retour</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ScannerInput
                onScan={handleScanRetour}
                placeholder="Scanner le numéro de retour..."
              />
              {selectedRetour && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">{selectedRetour.numero_retour}</span>
                    {getStatutBadge(selectedRetour.statut_retour)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {selectedRetour.client_nom}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedRetour.lignes.length} produit(s)
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scanner produit */}
          {selectedRetour && (
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
                    {selectedLigne.motif_retour && (
                      <p className="text-xs text-orange-600 mt-1">
                        Motif: {selectedLigne.motif_retour}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Inspection et traitement */}
          {selectedLigne && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">3. Inspection</CardTitle>
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

                {/* État du produit */}
                <div className="space-y-2">
                  <Label>État du produit</Label>
                  <RadioGroup value={etatProduit} onValueChange={setEtatProduit}>
                    {ETATS_PRODUIT.map((etat) => (
                      <div key={etat} className="flex items-center space-x-2">
                        <RadioGroupItem value={etat} id={etat} />
                        <Label htmlFor={etat} className="cursor-pointer">
                          {etat.replace(/_/g, " ")}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                {/* Action à faire */}
                <div className="space-y-2">
                  <Label>Action à effectuer</Label>
                  <RadioGroup value={action} onValueChange={setAction}>
                    {ACTIONS.map((act) => (
                      <div key={act} className="flex items-center space-x-2">
                        <RadioGroupItem value={act} id={act} />
                        <Label htmlFor={act} className="cursor-pointer">
                          {act.replace(/_/g, " ")}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                {/* Commentaires */}
                <div className="space-y-2">
                  <Label>Commentaires</Label>
                  <Textarea
                    value={commentaires}
                    onChange={(e) => setCommentaires(e.target.value)}
                    placeholder="Observations sur l'état du produit..."
                    rows={3}
                  />
                </div>

                {/* Valider */}
                <div className="space-y-2 pt-2">
                  <Button
                    onClick={validerReceptionRetour}
                    className="w-full"
                    size="lg"
                    disabled={loading || quantiteRecue <= 0}
                  >
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    Valider la réception
                  </Button>

                  <PrintButton
                    label="Imprimer fiche retour"
                    templateType="document"
                    data={{
                      Retour: selectedRetour?.numero_retour || "",
                      Produit: selectedLigne.produit_nom,
                      Référence: selectedLigne.produit_reference,
                      Quantité: quantiteRecue,
                      État: etatProduit,
                      Action: action,
                      Commentaires: commentaires || "N/A"
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="list" className="space-y-3">
          {retours.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun retour en cours</p>
            </div>
          ) : (
            retours.map((retour) => (
              <Card
                key={retour.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedRetour(retour)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{retour.numero_retour}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {retour.client_nom}
                      </p>
                    </div>
                    {getStatutBadge(retour.statut_retour)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {retour.lignes.length} produit(s)
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(retour.date_creation).toLocaleDateString("fr-FR")}
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
