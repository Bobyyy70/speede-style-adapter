import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, PackageX } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface CreerRetourDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commandeId: string;
  commande: any;
}

export function CreerRetourDialog({
  open,
  onOpenChange,
  commandeId,
  commande,
}: CreerRetourDialogProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [motif, setMotif] = useState("");
  const [remarques, setRemarques] = useState("");
  const [selectedLignes, setSelectedLignes] = useState<Record<string, {
    selected: boolean;
    quantite: number;
    etat: string;
    raison: string;
  }>>({});

  // Fetch lignes de commande
  const { data: lignes, isLoading } = useQuery({
    queryKey: ["lignes_commande_retour", commandeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ligne_commande")
        .select("*")
        .eq("commande_id", commandeId)
        .order("date_creation", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const toggleLigne = (ligneId: string, checked: boolean, quantiteMax: number) => {
    setSelectedLignes(prev => ({
      ...prev,
      [ligneId]: checked 
        ? { selected: true, quantite: quantiteMax, etat: "defectueux", raison: "" }
        : { selected: false, quantite: 0, etat: "", raison: "" }
    }));
  };

  const updateLigneField = (ligneId: string, field: string, value: any) => {
    setSelectedLignes(prev => ({
      ...prev,
      [ligneId]: {
        ...prev[ligneId],
        [field]: value,
      }
    }));
  };

  const handleSubmit = async () => {
    const lignesSelectionnees = Object.entries(selectedLignes).filter(([_, v]) => v.selected);
    
    if (lignesSelectionnees.length === 0) {
      toast({
        title: "Attention",
        description: "Sélectionnez au moins un produit à retourner",
        variant: "destructive",
      });
      return;
    }

    if (!motif) {
      toast({
        title: "Attention",
        description: "Veuillez indiquer le motif du retour",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // 1. Créer le retour
      const { data: retour, error: retourError } = await supabase
        .from("retour_produit")
        .insert({
          numero_retour: `RET-${Date.now()}`,
          client_id: commande.client_id,
          commande_origine_id: commandeId,
          client_nom: commande.nom_client,
          raison_retour: motif,
          statut_retour: "en_attente",
          remarques: remarques || null,
        })
        .select()
        .single();

      if (retourError) throw retourError;

      // 2. Créer les lignes de retour
      const lignesRetour = lignesSelectionnees.map(([ligneId, data]) => {
        const ligne = lignes?.find(l => l.id === ligneId);
        return {
          retour_id: retour.id,
          produit_id: ligne?.produit_id,
          produit_reference: ligne?.produit_reference,
          produit_nom: ligne?.produit_nom,
          quantite_retournee: data.quantite,
          etat_produit: data.etat,
          raison_retour: data.raison || motif,
          action_souhaitee: "reintegration_stock",
          statut_produit: "en_attente",
        };
      });

      const { error: lignesError } = await supabase
        .from("ligne_retour_produit")
        .insert(lignesRetour);

      if (lignesError) throw lignesError;

      toast({
        title: "Retour créé",
        description: `Retour ${retour.numero_retour} créé avec succès`,
      });

      onOpenChange(false);
      navigate("/retours");
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedCount = Object.values(selectedLignes).filter(v => v.selected).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageX className="h-5 w-5" />
            Créer un retour depuis la commande {commande?.numero_commande}
          </DialogTitle>
          <DialogDescription>
            Sélectionnez les produits à retourner et indiquez leur état
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Motif du retour */}
          <div className="space-y-2">
            <Label htmlFor="motif">Motif du retour *</Label>
            <Select value={motif} onValueChange={setMotif}>
              <SelectTrigger id="motif">
                <SelectValue placeholder="Sélectionnez un motif" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="produit_defectueux">Produit défectueux</SelectItem>
                <SelectItem value="erreur_expedition">Erreur d'expédition</SelectItem>
                <SelectItem value="produit_endommage">Produit endommagé</SelectItem>
                <SelectItem value="non_conforme">Non conforme à la commande</SelectItem>
                <SelectItem value="autre">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Remarques */}
          <div className="space-y-2">
            <Label htmlFor="remarques">Remarques complémentaires</Label>
            <Textarea
              id="remarques"
              value={remarques}
              onChange={(e) => setRemarques(e.target.value)}
              placeholder="Détails supplémentaires..."
              rows={3}
            />
          </div>

          {/* Sélection des produits */}
          <div className="space-y-2">
            <Label>Produits à retourner ({selectedCount} sélectionné{selectedCount > 1 ? 's' : ''})</Label>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead>Qté cmd.</TableHead>
                    <TableHead>Qté retour</TableHead>
                    <TableHead>État</TableHead>
                    <TableHead>Raison détaillée</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lignes?.map((ligne) => {
                    const isSelected = selectedLignes[ligne.id]?.selected || false;
                    return (
                      <TableRow key={ligne.id}>
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => 
                              toggleLigne(ligne.id, checked as boolean, ligne.quantite_commandee)
                            }
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">{ligne.produit_reference}</TableCell>
                        <TableCell>{ligne.produit_nom}</TableCell>
                        <TableCell>{ligne.quantite_commandee}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            max={ligne.quantite_commandee}
                            value={selectedLignes[ligne.id]?.quantite || 0}
                            onChange={(e) => updateLigneField(ligne.id, "quantite", parseInt(e.target.value) || 0)}
                            disabled={!isSelected}
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={selectedLignes[ligne.id]?.etat || ""}
                            onValueChange={(value) => updateLigneField(ligne.id, "etat", value)}
                            disabled={!isSelected}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue placeholder="État" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="defectueux">Défectueux</SelectItem>
                              <SelectItem value="endommage">Endommagé</SelectItem>
                              <SelectItem value="non_conforme">Non conforme</SelectItem>
                              <SelectItem value="bon_etat">Bon état</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={selectedLignes[ligne.id]?.raison || ""}
                            onChange={(e) => updateLigneField(ligne.id, "raison", e.target.value)}
                            disabled={!isSelected}
                            placeholder="Optionnel"
                            className="w-full"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={loading || selectedCount === 0}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer le retour
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
