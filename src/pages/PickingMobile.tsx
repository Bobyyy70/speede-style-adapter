import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ArrowLeft, Package, CheckCircle2, AlertCircle, Scan } from "lucide-react";
import { ORDER_STATUSES } from "@/lib/orderStatuses";

interface LigneCommande {
  id: string;
  produit_reference: string;
  produit_nom: string;
  quantite_commandee: number;
  quantite_preparee: number;
  emplacement_picking_id: string | null;
  emplacement?: {
    code_emplacement: string;
  };
}

interface Commande {
  id: string;
  numero_commande: string;
  nom_client: string;
  statut_wms: string;
  lignes: LigneCommande[];
}

export default function PickingMobile() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [currentCommandeIndex, setCurrentCommandeIndex] = useState(0);
  const [scanInput, setScanInput] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessionCommandes();
  }, [sessionId]);

  const fetchSessionCommandes = async () => {
    try {
      const { data: sessionCommandes, error } = await supabase
        .from("session_commande")
        .select(`
          commande:commande_id (
            id,
            numero_commande,
            nom_client,
            statut_wms
          )
        `)
        .eq("session_id", sessionId)
        .eq("statut_session", "en_cours");

      if (error) throw error;

      const commandeIds = sessionCommandes?.map((sc: any) => sc.commande.id) || [];

      const { data: lignes, error: lignesError } = await supabase
        .from("ligne_commande")
        .select(`
          *,
          emplacement:emplacement_picking_id (
            code_emplacement
          )
        `)
        .in("commande_id", commandeIds);

      if (lignesError) throw lignesError;

      const commandesWithLignes = sessionCommandes?.map((sc: any) => ({
        ...sc.commande,
        lignes: lignes?.filter((l: any) => l.commande_id === sc.commande.id) || []
      }));

      setCommandes(commandesWithLignes || []);
    } catch (error: any) {
      toast.error("Erreur lors du chargement des commandes");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    if (!scanInput.trim()) return;

    const currentCommande = commandes[currentCommandeIndex];
    const ligne = currentCommande.lignes.find(
      (l) => l.produit_reference === scanInput || l.produit_reference.includes(scanInput)
    );

    if (!ligne) {
      toast.error("Produit non trouvé dans cette commande");
      setScanInput("");
      return;
    }

    if (ligne.quantite_preparee >= ligne.quantite_commandee) {
      toast.warning("Quantité déjà complète pour ce produit");
      setScanInput("");
      return;
    }

    try {
      // Enregistrer le scan
      const { error: scanError } = await supabase.from("scan_picking").insert({
        session_id: sessionId,
        commande_id: currentCommande.id,
        ligne_commande_id: ligne.id,
        produit_id: ligne.produit_reference,
        code_barre: scanInput,
        quantite_scannee: 1,
        statut_scan: "valide"
      });

      if (scanError) throw scanError;

      // Mettre à jour la ligne de commande
      const nouvelleQuantite = ligne.quantite_preparee + 1;
      const { error: updateError } = await supabase
        .from("ligne_commande")
        .update({ 
          quantite_preparee: nouvelleQuantite,
          statut_ligne: nouvelleQuantite >= ligne.quantite_commandee ? "complete" : "en_cours"
        })
        .eq("id", ligne.id);

      if (updateError) throw updateError;

      toast.success(`${ligne.produit_nom} scanné (${nouvelleQuantite}/${ligne.quantite_commandee})`);
      setScanInput("");
      await fetchSessionCommandes();

      // Vérifier si la commande est complète
      const commandeComplete = currentCommande.lignes.every(
        (l) => l.id === ligne.id 
          ? nouvelleQuantite >= ligne.quantite_commandee 
          : l.quantite_preparee >= l.quantite_commandee
      );

      if (commandeComplete) {
        await supabase
          .from("commande")
          .update({ statut_wms: ORDER_STATUSES.PRET_EXPEDITION })
          .eq("id", currentCommande.id);

        toast.success("Commande complète! Passage à la suivante...");
        setTimeout(() => {
          if (currentCommandeIndex < commandes.length - 1) {
            setCurrentCommandeIndex(currentCommandeIndex + 1);
          }
        }, 1500);
      }
    } catch (error: any) {
      toast.error("Erreur lors du scan");
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement de la session...</p>
        </div>
      </div>
    );
  }

  if (commandes.length === 0) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Button variant="ghost" onClick={() => navigate("/preparation")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux sessions
        </Button>
        <div className="text-center mt-12">
          <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Aucune commande à préparer dans cette session</p>
        </div>
      </div>
    );
  }

  const currentCommande = commandes[currentCommandeIndex];
  const totalLignes = currentCommande.lignes.length;
  const lignesCompletes = currentCommande.lignes.filter(
    (l) => l.quantite_preparee >= l.quantite_commandee
  ).length;
  const progressionCommande = (lignesCompletes / totalLignes) * 100;

  return (
    <div className="min-h-screen bg-background">
      {/* Header fixe */}
      <div className="sticky top-0 z-10 bg-background border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/preparation")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Badge variant="secondary">
            Commande {currentCommandeIndex + 1}/{commandes.length}
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{currentCommande.numero_commande}</h2>
            <Badge>{currentCommande.nom_client}</Badge>
          </div>
          <Progress value={progressionCommande} className="h-2" />
          <p className="text-sm text-muted-foreground">
            {lignesCompletes}/{totalLignes} produits préparés
          </p>
        </div>
      </div>

      {/* Zone de scan */}
      <div className="p-4">
        <Card className="mb-4">
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Scanner un code-barres..."
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleScan()}
                className="text-lg"
                autoFocus
              />
              <Button onClick={handleScan} size="lg">
                <Scan className="h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Liste des produits */}
        <div className="space-y-3">
          {currentCommande.lignes.map((ligne) => {
            const isComplete = ligne.quantite_preparee >= ligne.quantite_commandee;
            const progression = (ligne.quantite_preparee / ligne.quantite_commandee) * 100;

            return (
              <Card key={ligne.id} className={isComplete ? "border-green-500" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base">{ligne.produit_nom}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Réf: {ligne.produit_reference}
                      </p>
                      {ligne.emplacement && (
                        <Badge variant="outline" className="mt-2">
                          📍 {ligne.emplacement.code_emplacement}
                        </Badge>
                      )}
                    </div>
                    {isComplete ? (
                      <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="h-6 w-6 text-orange-500 flex-shrink-0" />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progression</span>
                      <span className="font-medium">
                        {ligne.quantite_preparee}/{ligne.quantite_commandee}
                      </span>
                    </div>
                    <Progress value={progression} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
