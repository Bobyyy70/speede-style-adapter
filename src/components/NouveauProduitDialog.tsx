import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

export const NouveauProduitDialog = ({ onSuccess }: { onSuccess?: () => void }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    reference: "",
    nom: "",
    description: "",
    code_barre_ean: "",
    categorie_emballage: "",
    poids_unitaire: "",
    prix_unitaire: "",
    stock_minimum: "0",
    stock_maximum: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from("produit").insert({
        reference: formData.reference,
        nom: formData.nom,
        description: formData.description || null,
        code_barre_ean: formData.code_barre_ean || null,
        categorie_emballage: formData.categorie_emballage ? parseInt(formData.categorie_emballage) : null,
        poids_unitaire: formData.poids_unitaire ? parseFloat(formData.poids_unitaire) : null,
        prix_unitaire: formData.prix_unitaire ? parseFloat(formData.prix_unitaire) : null,
        stock_minimum: parseInt(formData.stock_minimum),
        stock_maximum: formData.stock_maximum ? parseInt(formData.stock_maximum) : null,
        stock_actuel: 0,
        statut_actif: true,
      });

      if (error) throw error;

      toast({
        title: "Produit créé",
        description: `Le produit ${formData.reference} a été créé avec succès.`,
      });

      setOpen(false);
      setFormData({
        reference: "",
        nom: "",
        description: "",
        code_barre_ean: "",
        categorie_emballage: "",
        poids_unitaire: "",
        prix_unitaire: "",
        stock_minimum: "0",
        stock_maximum: "",
      });

      if (onSuccess) onSuccess();
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau produit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer un nouveau produit</DialogTitle>
          <DialogDescription>
            Remplissez les informations du produit ci-dessous.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reference">Référence *</Label>
              <Input
                id="reference"
                required
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code_barre_ean">Code-barres EAN</Label>
              <Input
                id="code_barre_ean"
                value={formData.code_barre_ean}
                onChange={(e) => setFormData({ ...formData, code_barre_ean: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nom">Nom du produit *</Label>
            <Input
              id="nom"
              required
              value={formData.nom}
              onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="categorie_emballage">Catégorie emballage</Label>
              <Select
                value={formData.categorie_emballage}
                onValueChange={(value) => setFormData({ ...formData, categorie_emballage: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Catégorie 1 (Petit)</SelectItem>
                  <SelectItem value="2">Catégorie 2 (Moyen)</SelectItem>
                  <SelectItem value="3">Catégorie 3 (Grand)</SelectItem>
                  <SelectItem value="4">Catégorie 4 (Très grand)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="poids_unitaire">Poids unitaire (kg)</Label>
              <Input
                id="poids_unitaire"
                type="number"
                step="0.001"
                value={formData.poids_unitaire}
                onChange={(e) => setFormData({ ...formData, poids_unitaire: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prix_unitaire">Prix unitaire (€)</Label>
              <Input
                id="prix_unitaire"
                type="number"
                step="0.01"
                value={formData.prix_unitaire}
                onChange={(e) => setFormData({ ...formData, prix_unitaire: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stock_minimum">Stock minimum *</Label>
              <Input
                id="stock_minimum"
                type="number"
                required
                value={formData.stock_minimum}
                onChange={(e) => setFormData({ ...formData, stock_minimum: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stock_maximum">Stock maximum</Label>
            <Input
              id="stock_maximum"
              type="number"
              value={formData.stock_maximum}
              onChange={(e) => setFormData({ ...formData, stock_maximum: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Création..." : "Créer le produit"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
