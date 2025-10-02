import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const NouveauProduitDialog = ({ onSuccess }: { onSuccess?: () => void }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    // Général
    reference: "",
    nom: "",
    description: "",
    code_barre_ean: "",
    marque: "",
    fournisseur: "",
    // Dimensions
    longueur_cm: "",
    largeur_cm: "",
    hauteur_cm: "",
    poids_unitaire: "",
    categorie_emballage: "",
    // Stock
    stock_minimum: "0",
    stock_maximum: "",
    prix_unitaire: "",
    valeur_douaniere: "",
    taux_tva: "20.00",
    // International
    code_sh: "",
    pays_origine: "",
    // Logistique
    temperature_stockage: "ambiante",
    matieres_dangereuses: false,
    classe_danger: "",
    numero_onu: "",
    // Traçabilité
    gestion_lots: false,
    gestion_serie: false,
    duree_vie_jours: "",
    delai_peremption_alerte_jours: "",
    // Instructions
    instructions_picking: "",
    instructions_stockage: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from("produit").insert([
        {
          reference: formData.reference,
          nom: formData.nom,
          description: formData.description || null,
          code_barre_ean: formData.code_barre_ean || null,
          marque: formData.marque || null,
          fournisseur: formData.fournisseur || null,
          // Dimensions
          longueur_cm: formData.longueur_cm ? parseFloat(formData.longueur_cm) : null,
          largeur_cm: formData.largeur_cm ? parseFloat(formData.largeur_cm) : null,
          hauteur_cm: formData.hauteur_cm ? parseFloat(formData.hauteur_cm) : null,
          poids_unitaire: formData.poids_unitaire ? parseFloat(formData.poids_unitaire) : null,
          categorie_emballage: formData.categorie_emballage ? parseInt(formData.categorie_emballage) : null,
          // Stock
          prix_unitaire: formData.prix_unitaire ? parseFloat(formData.prix_unitaire) : null,
          valeur_douaniere: formData.valeur_douaniere ? parseFloat(formData.valeur_douaniere) : null,
          taux_tva: formData.taux_tva ? parseFloat(formData.taux_tva) : 20.00,
          stock_minimum: formData.stock_minimum ? parseInt(formData.stock_minimum) : 0,
          stock_maximum: formData.stock_maximum ? parseInt(formData.stock_maximum) : null,
          stock_actuel: 0,
          // International
          code_sh: formData.code_sh || null,
          pays_origine: formData.pays_origine || null,
          // Logistique
          temperature_stockage: formData.temperature_stockage || 'ambiante',
          matieres_dangereuses: formData.matieres_dangereuses,
          classe_danger: formData.classe_danger || null,
          numero_onu: formData.numero_onu || null,
          // Traçabilité
          gestion_lots: formData.gestion_lots,
          gestion_serie: formData.gestion_serie,
          duree_vie_jours: formData.duree_vie_jours ? parseInt(formData.duree_vie_jours) : null,
          delai_peremption_alerte_jours: formData.delai_peremption_alerte_jours ? parseInt(formData.delai_peremption_alerte_jours) : null,
          // Instructions
          instructions_picking: formData.instructions_picking || null,
          instructions_stockage: formData.instructions_stockage || null,
          statut_actif: true,
        },
      ]);

      if (error) throw error;

      toast({
        title: "Produit créé",
        description: "Le produit a été créé avec succès",
      });

      setOpen(false);
      setFormData({
        reference: "",
        nom: "",
        description: "",
        code_barre_ean: "",
        marque: "",
        fournisseur: "",
        longueur_cm: "",
        largeur_cm: "",
        hauteur_cm: "",
        poids_unitaire: "",
        categorie_emballage: "",
        stock_minimum: "0",
        stock_maximum: "",
        prix_unitaire: "",
        valeur_douaniere: "",
        taux_tva: "20.00",
        code_sh: "",
        pays_origine: "",
        temperature_stockage: "ambiante",
        matieres_dangereuses: false,
        classe_danger: "",
        numero_onu: "",
        gestion_lots: false,
        gestion_serie: false,
        duree_vie_jours: "",
        delai_peremption_alerte_jours: "",
        instructions_picking: "",
        instructions_stockage: "",
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau produit</DialogTitle>
          <DialogDescription>
            Créer une nouvelle référence produit complète avec toutes les informations nécessaires
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="general">Général</TabsTrigger>
              <TabsTrigger value="dimensions">Dimensions</TabsTrigger>
              <TabsTrigger value="international">International</TabsTrigger>
              <TabsTrigger value="logistique">Logistique</TabsTrigger>
              <TabsTrigger value="tracabilite">Traçabilité</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="reference">Référence produit *</Label>
                  <Input
                    id="reference"
                    required
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    placeholder="REF-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nom">Nom du produit *</Label>
                  <Input
                    id="nom"
                    required
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    placeholder="Nom commercial"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description détaillée du produit"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code_barre_ean">Code-barres EAN</Label>
                  <Input
                    id="code_barre_ean"
                    value={formData.code_barre_ean}
                    onChange={(e) => setFormData({ ...formData, code_barre_ean: e.target.value })}
                    placeholder="3760123456789"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="marque">Marque</Label>
                  <Input
                    id="marque"
                    value={formData.marque}
                    onChange={(e) => setFormData({ ...formData, marque: e.target.value })}
                    placeholder="Marque du produit"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fournisseur">Fournisseur</Label>
                  <Input
                    id="fournisseur"
                    value={formData.fournisseur}
                    onChange={(e) => setFormData({ ...formData, fournisseur: e.target.value })}
                    placeholder="Nom du fournisseur"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prix_unitaire">Prix unitaire (€)</Label>
                  <Input
                    id="prix_unitaire"
                    type="number"
                    step="0.01"
                    value={formData.prix_unitaire}
                    onChange={(e) => setFormData({ ...formData, prix_unitaire: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taux_tva">TVA (%)</Label>
                  <Input
                    id="taux_tva"
                    type="number"
                    step="0.01"
                    value={formData.taux_tva}
                    onChange={(e) => setFormData({ ...formData, taux_tva: e.target.value })}
                    placeholder="20.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valeur_douaniere">Valeur douanière (€)</Label>
                  <Input
                    id="valeur_douaniere"
                    type="number"
                    step="0.01"
                    value={formData.valeur_douaniere}
                    onChange={(e) => setFormData({ ...formData, valeur_douaniere: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stock_minimum">Stock minimum</Label>
                  <Input
                    id="stock_minimum"
                    type="number"
                    value={formData.stock_minimum}
                    onChange={(e) => setFormData({ ...formData, stock_minimum: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock_maximum">Stock maximum</Label>
                  <Input
                    id="stock_maximum"
                    type="number"
                    value={formData.stock_maximum}
                    onChange={(e) => setFormData({ ...formData, stock_maximum: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="dimensions" className="space-y-4 mt-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="longueur_cm">Longueur (cm)</Label>
                  <Input
                    id="longueur_cm"
                    type="number"
                    step="0.01"
                    value={formData.longueur_cm}
                    onChange={(e) => setFormData({ ...formData, longueur_cm: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="largeur_cm">Largeur (cm)</Label>
                  <Input
                    id="largeur_cm"
                    type="number"
                    step="0.01"
                    value={formData.largeur_cm}
                    onChange={(e) => setFormData({ ...formData, largeur_cm: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hauteur_cm">Hauteur (cm)</Label>
                  <Input
                    id="hauteur_cm"
                    type="number"
                    step="0.01"
                    value={formData.hauteur_cm}
                    onChange={(e) => setFormData({ ...formData, hauteur_cm: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Volume (m³)</Label>
                  <Input
                    disabled
                    value={
                      formData.longueur_cm && formData.largeur_cm && formData.hauteur_cm
                        ? ((parseFloat(formData.longueur_cm) * parseFloat(formData.largeur_cm) * parseFloat(formData.hauteur_cm)) / 1000000).toFixed(6)
                        : "Auto"
                    }
                    placeholder="Calculé auto"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="poids_unitaire">Poids unitaire (kg)</Label>
                  <Input
                    id="poids_unitaire"
                    type="number"
                    step="0.001"
                    value={formData.poids_unitaire}
                    onChange={(e) => setFormData({ ...formData, poids_unitaire: e.target.value })}
                    placeholder="0.000"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="protection_individuelle"
                    checked={formData.categorie_emballage === "2"}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, categorie_emballage: checked ? "2" : "1" })
                    }
                  />
                  <Label htmlFor="protection_individuelle" className="cursor-pointer">
                    Protection individuelle
                  </Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructions_picking">Instructions de picking</Label>
                <Textarea
                  id="instructions_picking"
                  value={formData.instructions_picking}
                  onChange={(e) => setFormData({ ...formData, instructions_picking: e.target.value })}
                  placeholder="Instructions spécifiques pour la préparation"
                  rows={2}
                />
              </div>
            </TabsContent>

            <TabsContent value="international" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code_sh">Code SH (Système Harmonisé)</Label>
                  <Input
                    id="code_sh"
                    value={formData.code_sh}
                    onChange={(e) => setFormData({ ...formData, code_sh: e.target.value })}
                    placeholder="8517.12.00"
                    maxLength={10}
                  />
                  <p className="text-xs text-muted-foreground">
                    Code douanier pour l'export international
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pays_origine">Pays d'origine</Label>
                  <Input
                    id="pays_origine"
                    value={formData.pays_origine}
                    onChange={(e) => setFormData({ ...formData, pays_origine: e.target.value })}
                    placeholder="FR"
                    maxLength={2}
                  />
                  <p className="text-xs text-muted-foreground">
                    Code ISO 2 lettres (FR, DE, CN...)
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="logistique" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="temperature_stockage">Température de stockage</Label>
                <Select
                  value={formData.temperature_stockage}
                  onValueChange={(value) => setFormData({ ...formData, temperature_stockage: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ambiante">Ambiante (15-25°C)</SelectItem>
                    <SelectItem value="controlee">Contrôlée (10-15°C)</SelectItem>
                    <SelectItem value="refrigeree">Réfrigérée (2-8°C)</SelectItem>
                    <SelectItem value="congelee">Congelée (-18°C)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Matières dangereuses</Label>
                    <p className="text-xs text-muted-foreground">
                      Produit soumis à ADR/IATA
                    </p>
                  </div>
                  <Switch
                    checked={formData.matieres_dangereuses}
                    onCheckedChange={(checked) => setFormData({ ...formData, matieres_dangereuses: checked })}
                  />
                </div>

                {formData.matieres_dangereuses && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="classe_danger">Classe de danger</Label>
                      <Input
                        id="classe_danger"
                        value={formData.classe_danger}
                        onChange={(e) => setFormData({ ...formData, classe_danger: e.target.value })}
                        placeholder="3, 4.1, 6.1, 8, 9..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="numero_onu">Numéro ONU</Label>
                      <Input
                        id="numero_onu"
                        value={formData.numero_onu}
                        onChange={(e) => setFormData({ ...formData, numero_onu: e.target.value })}
                        placeholder="UN1170"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructions_stockage">Instructions de stockage</Label>
                <Textarea
                  id="instructions_stockage"
                  value={formData.instructions_stockage}
                  onChange={(e) => setFormData({ ...formData, instructions_stockage: e.target.value })}
                  placeholder="Conditions spéciales de stockage et manipulation"
                  rows={3}
                />
              </div>
            </TabsContent>

            <TabsContent value="tracabilite" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label>Gestion par lots</Label>
                    <p className="text-xs text-muted-foreground">
                      Active le suivi par numéro de lot
                    </p>
                  </div>
                  <Switch
                    checked={formData.gestion_lots}
                    onCheckedChange={(checked) => setFormData({ ...formData, gestion_lots: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label>Gestion par numéros de série</Label>
                    <p className="text-xs text-muted-foreground">
                      Active le suivi unitaire par N° de série
                    </p>
                  </div>
                  <Switch
                    checked={formData.gestion_serie}
                    onCheckedChange={(checked) => setFormData({ ...formData, gestion_serie: checked })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="duree_vie_jours">Durée de vie (jours)</Label>
                  <Input
                    id="duree_vie_jours"
                    type="number"
                    value={formData.duree_vie_jours}
                    onChange={(e) => setFormData({ ...formData, duree_vie_jours: e.target.value })}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">
                    DLC/DLUO en jours
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="delai_peremption_alerte_jours">Alerte péremption (jours)</Label>
                  <Input
                    id="delai_peremption_alerte_jours"
                    type="number"
                    value={formData.delai_peremption_alerte_jours}
                    onChange={(e) => setFormData({ ...formData, delai_peremption_alerte_jours: e.target.value })}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">
                    Jours avant péremption pour alerter
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
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
