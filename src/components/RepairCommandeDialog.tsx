import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RepairCommandeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commandeId: string;
  onRepaired: () => void;
}

interface LigneProduit {
  id: string;
  produit_id: string;
  produit_reference: string;
  produit_nom: string;
  quantite_commandee: number;
}

export function RepairCommandeDialog({ open, onOpenChange, commandeId, onRepaired }: RepairCommandeDialogProps) {
  const [loading, setLoading] = useState(false);
  const [commande, setCommande] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [produits, setProduits] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [lignes, setLignes] = useState<LigneProduit[]>([]);

  useEffect(() => {
    if (open && commandeId) {
      loadData();
    }
  }, [open, commandeId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Charger commande
      const { data: cmd } = await supabase
        .from("commande")
        .select("*")
        .eq("id", commandeId)
        .single();
      
      setCommande(cmd);
      setSelectedClientId(cmd?.client_id || "");

      // Charger clients actifs
      const { data: cls } = await supabase
        .from("client")
        .select("id, nom_entreprise")
        .eq("actif", true)
        .order("nom_entreprise");
      
      setClients(cls || []);

      // Charger lignes existantes
      const { data: lignesData } = await supabase
        .from("ligne_commande")
        .select("*")
        .eq("commande_id", commandeId);
      
      if (lignesData && lignesData.length > 0) {
        setLignes(lignesData.map(l => ({
          id: l.id,
          produit_id: l.produit_id || "",
          produit_reference: l.produit_reference,
          produit_nom: l.produit_nom,
          quantite_commandee: l.quantite_commandee
        })));
      }

      // Charger produits pour le client sélectionné
      if (cmd?.client_id) {
        loadProduitsForClient(cmd.client_id);
      }

    } catch (error: any) {
      console.error(error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const loadProduitsForClient = async (clientId: string) => {
    const { data } = await supabase
      .from("produit")
      .select("id, reference, nom, stock_actuel")
      .eq("client_id", clientId)
      .eq("statut_actif", true)
      .order("reference");
    
    setProduits(data || []);
  };

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    loadProduitsForClient(clientId);
  };

  const addLigne = () => {
    setLignes([...lignes, {
      id: `new-${Date.now()}`,
      produit_id: "",
      produit_reference: "",
      produit_nom: "",
      quantite_commandee: 1
    }]);
  };

  const removeLigne = (index: number) => {
    setLignes(lignes.filter((_, i) => i !== index));
  };

  const updateLigne = (index: number, field: string, value: any) => {
    const newLignes = [...lignes];
    
    if (field === "produit_id") {
      const produit = produits.find(p => p.id === value);
      if (produit) {
        newLignes[index] = {
          ...newLignes[index],
          produit_id: value,
          produit_reference: produit.reference,
          produit_nom: produit.nom
        };
      }
    } else {
      newLignes[index] = { ...newLignes[index], [field]: value };
    }
    
    setLignes(newLignes);
  };

  const handleSave = async () => {
    if (!selectedClientId) {
      toast.error("Veuillez sélectionner un client");
      return;
    }

    if (lignes.length === 0) {
      toast.error("Veuillez ajouter au moins un produit");
      return;
    }

    const invalidLignes = lignes.filter(l => !l.produit_id || l.quantite_commandee <= 0);
    if (invalidLignes.length > 0) {
      toast.error("Toutes les lignes doivent avoir un produit et une quantité > 0");
      return;
    }

    setLoading(true);
    try {
      // 1. Mettre à jour le client_id de la commande
      await supabase
        .from("commande")
        .update({ client_id: selectedClientId })
        .eq("id", commandeId);

      // 2. Supprimer les anciennes lignes si elles existent
      await supabase
        .from("ligne_commande")
        .delete()
        .eq("commande_id", commandeId);

      // 3. Créer les nouvelles lignes
      const { error: lignesError } = await supabase
        .from("ligne_commande")
        .insert(
          lignes.map(l => ({
            commande_id: commandeId,
            produit_id: l.produit_id,
            produit_reference: l.produit_reference,
            produit_nom: l.produit_nom,
            quantite_commandee: l.quantite_commandee,
            quantite_preparee: 0,
            statut_ligne: "en_attente"
          }))
        );

      if (lignesError) throw lignesError;

      // 4. Récupérer config expéditeur par défaut du client et MAJ commande
      const { data: expediteur } = await supabase
        .from("configuration_expediteur")
        .select("*")
        .eq("client_id", selectedClientId)
        .eq("est_defaut", true)
        .eq("actif", true)
        .maybeSingle();

      if (expediteur) {
        await supabase
          .from("commande")
          .update({
            expediteur_nom: expediteur.nom,
            expediteur_entreprise: expediteur.entreprise,
            expediteur_email: expediteur.email,
            expediteur_telephone: expediteur.telephone,
            expediteur_adresse_ligne_1: expediteur.adresse_ligne_1,
            expediteur_adresse_ligne_2: expediteur.adresse_ligne_2,
            expediteur_code_postal: expediteur.code_postal,
            expediteur_ville: expediteur.ville,
            expediteur_pays_code: expediteur.pays_code
          })
          .eq("id", commandeId);
      }

      toast.success("Commande réparée avec succès !");
      onRepaired();
      onOpenChange(false);

    } catch (error: any) {
      console.error(error);
      toast.error("Erreur : " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Réparer la commande
          </DialogTitle>
          <DialogDescription>
            Commande <Badge variant="outline">{commande?.numero_commande}</Badge> - Assigner client et produits
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Sélection du client */}
            <div className="space-y-2">
              <Label>Client propriétaire *</Label>
              <Select value={selectedClientId} onValueChange={handleClientChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.nom_entreprise}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Liste des lignes de produits */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Produits commandés *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLigne}
                  disabled={!selectedClientId}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter produit
                </Button>
              </div>

              {lignes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-lg">
                  Aucun produit - Cliquez "Ajouter produit" pour commencer
                </div>
              ) : (
                <div className="space-y-3">
                  {lignes.map((ligne, index) => (
                    <div key={ligne.id} className="flex gap-2 items-end">
                      <div className="flex-1 space-y-2">
                        <Select
                          value={ligne.produit_id}
                          onValueChange={(val) => updateLigne(index, "produit_id", val)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un produit" />
                          </SelectTrigger>
                          <SelectContent>
                            {produits.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.reference} - {p.nom} (Stock: {p.stock_actuel})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-32">
                        <Input
                          type="number"
                          min="1"
                          placeholder="Qté"
                          value={ligne.quantite_commandee}
                          onChange={(e) =>
                            updateLigne(index, "quantite_commandee", parseInt(e.target.value) || 0)
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLigne(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enregistrer les corrections
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
