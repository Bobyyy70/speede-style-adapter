import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit2, Save, X, Package, TrendingUp, AlertTriangle, MapPin, Barcode, Plus, Trash2, Upload, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface FicheProduitDialogProps {
  produitId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const FicheProduitDialog = ({ produitId, open, onOpenChange, onSuccess }: FicheProduitDialogProps) => {
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const { data: produit, refetch } = useQuery({
    queryKey: ["produit", produitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produit")
        .select("*")
        .eq("id", produitId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: open && !!produitId,
  });

  const { data: mouvements } = useQuery({
    queryKey: ["mouvements", produitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mouvement_stock")
        .select("*")
        .eq("produit_id", produitId)
        .order("date_mouvement", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
    enabled: open && !!produitId,
  });

  const { data: stockDisponible } = useQuery({
    queryKey: ["stock_disponible", produitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_disponible")
        .select("*")
        .eq("produit_id", produitId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: open && !!produitId,
  });

  const { data: emplacements } = useQuery({
    queryKey: ["emplacements_produit", produitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emplacement")
        .select("*")
        .eq("produit_actuel_id", produitId);
      
      if (error) throw error;
      return data;
    },
    enabled: open && !!produitId,
  });

  const { data: variantes } = useQuery({
    queryKey: ["variantes", produitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sku_variante")
        .select("*")
        .eq("produit_id", produitId)
        .eq("actif", true);
      
      if (error) throw error;
      return data;
    },
    enabled: open && !!produitId,
  });

  const { data: alertes, refetch: refetchAlertes } = useQuery({
    queryKey: ["alertes", produitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produit_alertes_stock")
        .select("*")
        .eq("produit_id", produitId)
        .eq("actif", true)
        .order("seuil", { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: open && !!produitId,
  });

  const [uploadingImage, setUploadingImage] = useState(false);

  const [formData, setFormData] = useState({
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
    image_url: "",
  });

  const [newAlerte, setNewAlerte] = useState({
    type_alerte: "critique",
    seuil: "",
    couleur: "#ef4444",
    message_alerte: "",
  });

  useEffect(() => {
    if (produit) {
      setFormData({
        reference: produit.reference || "",
        nom: produit.nom || "",
        description: produit.description || "",
        code_barre_ean: produit.code_barre_ean || "",
        marque: produit.marque || "",
        fournisseur: produit.fournisseur || "",
        longueur_cm: produit.longueur_cm?.toString() || "",
        largeur_cm: produit.largeur_cm?.toString() || "",
        hauteur_cm: produit.hauteur_cm?.toString() || "",
        poids_unitaire: produit.poids_unitaire?.toString() || "",
        categorie_emballage: produit.categorie_emballage?.toString() || "",
        stock_minimum: produit.stock_minimum?.toString() || "0",
        stock_maximum: produit.stock_maximum?.toString() || "",
        prix_unitaire: produit.prix_unitaire?.toString() || "",
        valeur_douaniere: produit.valeur_douaniere?.toString() || "",
        taux_tva: produit.taux_tva?.toString() || "20.00",
        code_sh: produit.code_sh || "",
        pays_origine: produit.pays_origine || "",
        temperature_stockage: produit.temperature_stockage || "ambiante",
        matieres_dangereuses: produit.matieres_dangereuses || false,
        classe_danger: produit.classe_danger || "",
        numero_onu: produit.numero_onu || "",
        gestion_lots: produit.gestion_lots || false,
        gestion_serie: produit.gestion_serie || false,
        duree_vie_jours: produit.duree_vie_jours?.toString() || "",
        delai_peremption_alerte_jours: produit.delai_peremption_alerte_jours?.toString() || "",
        instructions_picking: produit.instructions_picking || "",
        instructions_stockage: produit.instructions_stockage || "",
        image_url: produit.image_url || "",
      });
    }
  }, [produit]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Erreur",
        description: "Le fichier doit être une image",
        variant: "destructive",
      });
      return;
    }

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${produitId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('produits-images')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('produits-images')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('produit')
        .update({ image_url: publicUrl })
        .eq('id', produitId);

      if (updateError) throw updateError;

      setFormData({ ...formData, image_url: publicUrl });
      refetch();
      toast({
        title: "Succès",
        description: "Photo du produit mise à jour",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddAlerte = async () => {
    if (!newAlerte.seuil) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir un seuil",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('produit_alertes_stock')
        .insert({
          produit_id: produitId,
          type_alerte: newAlerte.type_alerte,
          seuil: parseInt(newAlerte.seuil),
          couleur: newAlerte.couleur,
          message_alerte: newAlerte.message_alerte,
        });

      if (error) throw error;

      refetchAlertes();
      setNewAlerte({
        type_alerte: "critique",
        seuil: "",
        couleur: "#ef4444",
        message_alerte: "",
      });

      toast({
        title: "Succès",
        description: "Alerte ajoutée",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteAlerte = async (alerteId: string) => {
    try {
      const { error } = await supabase
        .from('produit_alertes_stock')
        .delete()
        .eq('id', alerteId);

      if (error) throw error;

      refetchAlertes();
      toast({
        title: "Succès",
        description: "Alerte supprimée",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("produit")
        .update({
          reference: formData.reference,
          nom: formData.nom,
          description: formData.description || null,
          code_barre_ean: formData.code_barre_ean || null,
          marque: formData.marque || null,
          fournisseur: formData.fournisseur || null,
          longueur_cm: formData.longueur_cm ? parseFloat(formData.longueur_cm) : null,
          largeur_cm: formData.largeur_cm ? parseFloat(formData.largeur_cm) : null,
          hauteur_cm: formData.hauteur_cm ? parseFloat(formData.hauteur_cm) : null,
          poids_unitaire: formData.poids_unitaire ? parseFloat(formData.poids_unitaire) : null,
          categorie_emballage: formData.categorie_emballage ? parseInt(formData.categorie_emballage) : null,
          prix_unitaire: formData.prix_unitaire ? parseFloat(formData.prix_unitaire) : null,
          valeur_douaniere: formData.valeur_douaniere ? parseFloat(formData.valeur_douaniere) : null,
          taux_tva: formData.taux_tva ? parseFloat(formData.taux_tva) : 20.00,
          stock_minimum: formData.stock_minimum ? parseInt(formData.stock_minimum) : 0,
          stock_maximum: formData.stock_maximum ? parseInt(formData.stock_maximum) : null,
          code_sh: formData.code_sh || null,
          pays_origine: formData.pays_origine || null,
          temperature_stockage: formData.temperature_stockage || 'ambiante',
          matieres_dangereuses: formData.matieres_dangereuses,
          classe_danger: formData.classe_danger || null,
          numero_onu: formData.numero_onu || null,
          gestion_lots: formData.gestion_lots,
          gestion_serie: formData.gestion_serie,
          duree_vie_jours: formData.duree_vie_jours ? parseInt(formData.duree_vie_jours) : null,
          delai_peremption_alerte_jours: formData.delai_peremption_alerte_jours ? parseInt(formData.delai_peremption_alerte_jours) : null,
          instructions_picking: formData.instructions_picking || null,
          instructions_stockage: formData.instructions_stockage || null,
        })
        .eq("id", produitId);

      if (error) throw error;

      toast({
        title: "Produit modifié",
        description: "Les modifications ont été enregistrées",
      });

      setEditMode(false);
      refetch();
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

  if (!produit) return null;

  const isAlerte = produit.stock_actuel < produit.stock_minimum;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                {produit.reference} - {produit.nom}
              </DialogTitle>
              <DialogDescription>
                Fiche produit détaillée
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {editMode ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => setEditMode(false)}>
                    <X className="h-4 w-4 mr-1" />
                    Annuler
                  </Button>
                  <Button size="sm" onClick={handleSubmit} disabled={loading}>
                    <Save className="h-4 w-4 mr-1" />
                    Sauvegarder
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
                  <Edit2 className="h-4 w-4 mr-1" />
                  Modifier
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Stats rapides */}
        <div className="grid grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Stock physique</span>
            </div>
            <div className="text-2xl font-bold text-primary">
              {stockDisponible?.stock_actuel ?? produit.stock_actuel}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Stock réservé</span>
            </div>
            <div className="text-2xl font-bold text-orange-500">
              {stockDisponible?.stock_reserve ?? 0}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Stock disponible</span>
            </div>
            <div className="text-2xl font-bold text-green-600">
              {stockDisponible?.stock_disponible ?? produit.stock_actuel}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Valeur stock</span>
            </div>
            <div className="text-2xl font-bold">
              €{((produit.stock_actuel * (produit.prix_unitaire || 0))).toFixed(2)}
            </div>
          </div>
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-9">
            <TabsTrigger value="general">Général</TabsTrigger>
            <TabsTrigger value="dimensions">Dimensions</TabsTrigger>
            <TabsTrigger value="international">International</TabsTrigger>
            <TabsTrigger value="logistique">Logistique</TabsTrigger>
            <TabsTrigger value="tracabilite">Traçabilité</TabsTrigger>
            <TabsTrigger value="alertes">Alertes</TabsTrigger>
            <TabsTrigger value="emplacements">Emplacements</TabsTrigger>
            <TabsTrigger value="variantes">Références</TabsTrigger>
            <TabsTrigger value="mouvements">Mouvements</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reference">Référence produit</Label>
                <Input
                  id="reference"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  disabled={!editMode}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nom">Nom du produit</Label>
                <Input
                  id="nom"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  disabled={!editMode}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={!editMode}
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
                  disabled={!editMode}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="marque">Marque</Label>
                <Input
                  id="marque"
                  value={formData.marque}
                  onChange={(e) => setFormData({ ...formData, marque: e.target.value })}
                  disabled={!editMode}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fournisseur">Fournisseur</Label>
                <Input
                  id="fournisseur"
                  value={formData.fournisseur}
                  onChange={(e) => setFormData({ ...formData, fournisseur: e.target.value })}
                  disabled={!editMode}
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
                  disabled={!editMode}
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
                  disabled={!editMode}
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
                  disabled={!editMode}
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
                  disabled={!editMode}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock_maximum">Stock maximum</Label>
                <Input
                  id="stock_maximum"
                  type="number"
                  value={formData.stock_maximum}
                  onChange={(e) => setFormData({ ...formData, stock_maximum: e.target.value })}
                  disabled={!editMode}
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
                  disabled={!editMode}
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
                  disabled={!editMode}
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
                  disabled={!editMode}
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
                  disabled={!editMode}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="protection_individuelle"
                  checked={formData.categorie_emballage === "2"}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, categorie_emballage: checked ? "2" : "1" })
                  }
                  disabled={!editMode}
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
                disabled={!editMode}
                rows={2}
              />
            </div>
          </TabsContent>

          <TabsContent value="international" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code_sh">Code SH</Label>
                <Input
                  id="code_sh"
                  value={formData.code_sh}
                  onChange={(e) => setFormData({ ...formData, code_sh: e.target.value })}
                  disabled={!editMode}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pays_origine">Pays d'origine</Label>
                <Input
                  id="pays_origine"
                  value={formData.pays_origine}
                  onChange={(e) => setFormData({ ...formData, pays_origine: e.target.value })}
                  disabled={!editMode}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="logistique" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="temperature_stockage">Température de stockage</Label>
              <Select
                value={formData.temperature_stockage}
                onValueChange={(value) => setFormData({ ...formData, temperature_stockage: value })}
                disabled={!editMode}
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

            <div className="flex items-center space-x-2">
              <Switch
                id="matieres_dangereuses"
                checked={formData.matieres_dangereuses}
                onCheckedChange={(checked) => setFormData({ ...formData, matieres_dangereuses: checked })}
                disabled={!editMode}
              />
              <Label htmlFor="matieres_dangereuses">Matières dangereuses</Label>
            </div>

            {formData.matieres_dangereuses && (
              <div className="grid grid-cols-2 gap-4 pl-8">
                <div className="space-y-2">
                  <Label htmlFor="classe_danger">Classe de danger</Label>
                  <Input
                    id="classe_danger"
                    value={formData.classe_danger}
                    onChange={(e) => setFormData({ ...formData, classe_danger: e.target.value })}
                    disabled={!editMode}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numero_onu">Numéro ONU</Label>
                  <Input
                    id="numero_onu"
                    value={formData.numero_onu}
                    onChange={(e) => setFormData({ ...formData, numero_onu: e.target.value })}
                    disabled={!editMode}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="instructions_stockage">Instructions de stockage</Label>
              <Textarea
                id="instructions_stockage"
                value={formData.instructions_stockage}
                onChange={(e) => setFormData({ ...formData, instructions_stockage: e.target.value })}
                disabled={!editMode}
                rows={2}
              />
            </div>
          </TabsContent>

          <TabsContent value="tracabilite" className="space-y-4 mt-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="gestion_lots"
                checked={formData.gestion_lots}
                onCheckedChange={(checked) => setFormData({ ...formData, gestion_lots: checked })}
                disabled={!editMode}
              />
              <Label htmlFor="gestion_lots">Gestion par lots</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="gestion_serie"
                checked={formData.gestion_serie}
                onCheckedChange={(checked) => setFormData({ ...formData, gestion_serie: checked })}
                disabled={!editMode}
              />
              <Label htmlFor="gestion_serie">Gestion par numéro de série</Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duree_vie_jours">Durée de vie (jours)</Label>
                <Input
                  id="duree_vie_jours"
                  type="number"
                  value={formData.duree_vie_jours}
                  onChange={(e) => setFormData({ ...formData, duree_vie_jours: e.target.value })}
                  disabled={!editMode}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delai_peremption_alerte_jours">Délai alerte péremption (jours)</Label>
                <Input
                  id="delai_peremption_alerte_jours"
                  type="number"
                  value={formData.delai_peremption_alerte_jours}
                  onChange={(e) => setFormData({ ...formData, delai_peremption_alerte_jours: e.target.value })}
                  disabled={!editMode}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="alertes" className="space-y-4 mt-4">
            {/* Section Analyse de Stock */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Analyse de Stock</h3>
              </div>
              
              {/* Badge de statut global */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Statut actuel:</span>
                <Badge 
                  variant={
                    produit.stock_actuel === 0 ? "destructive" : 
                    produit.stock_actuel < produit.stock_minimum ? "outline" : 
                    "secondary"
                  }
                  className={
                    produit.stock_actuel === 0 ? "text-red-500" : 
                    produit.stock_actuel < produit.stock_minimum ? "text-orange-500" : 
                    "text-green-500"
                  }
                >
                  {produit.stock_actuel === 0 ? "Rupture de stock" : 
                   produit.stock_actuel < produit.stock_minimum ? "Alerte stock bas" : 
                   "Stock OK"}
                </Badge>
              </div>

              {/* Seuils de stock */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Stock minimum</div>
                  <div className="text-lg font-semibold text-orange-500">{produit.stock_minimum}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Stock actuel</div>
                  <div className={`text-lg font-semibold ${
                    produit.stock_actuel === 0 ? "text-red-500" : 
                    produit.stock_actuel < produit.stock_minimum ? "text-orange-500" : 
                    "text-green-500"
                  }`}>
                    {produit.stock_actuel}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Stock maximum</div>
                  <div className="text-lg font-semibold">{produit.stock_maximum || "N/A"}</div>
                </div>
              </div>

              {/* Historique des 7 derniers jours */}
              {mouvements && mouvements.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Derniers mouvements (7 jours)</h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {mouvements.slice(0, 7).map((mvt) => (
                      <div key={mvt.id} className="flex items-center justify-between text-xs p-2 bg-background rounded">
                        <span className="text-muted-foreground">
                          {new Date(mvt.date_mouvement).toLocaleDateString()}
                        </span>
                        <Badge variant={mvt.quantite > 0 ? "secondary" : "destructive"} className="text-xs">
                          {mvt.quantite > 0 ? "+" : ""}{mvt.quantite}
                        </Badge>
                        <span className="text-muted-foreground">{mvt.type_mouvement}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Alertes de stock personnalisables
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Définissez des seuils d'alerte personnalisés pour ce produit
                  </p>
                </div>
              </div>

              {editMode && (
                <div className="p-4 border rounded-lg bg-muted/50 space-y-3">
                  <h5 className="font-medium text-sm">Nouvelle alerte</h5>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="type_alerte" className="text-xs">Type</Label>
                      <Select
                        value={newAlerte.type_alerte}
                        onValueChange={(value) => setNewAlerte({ ...newAlerte, type_alerte: value })}
                      >
                        <SelectTrigger id="type_alerte">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="critique">Critique</SelectItem>
                          <SelectItem value="bas">Bas</SelectItem>
                          <SelectItem value="optimal">Optimal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="seuil_alerte" className="text-xs">Seuil</Label>
                      <Input
                        id="seuil_alerte"
                        type="number"
                        placeholder="100"
                        value={newAlerte.seuil}
                        onChange={(e) => setNewAlerte({ ...newAlerte, seuil: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="couleur_alerte" className="text-xs">Couleur</Label>
                      <Input
                        id="couleur_alerte"
                        type="color"
                        value={newAlerte.couleur}
                        onChange={(e) => setNewAlerte({ ...newAlerte, couleur: e.target.value })}
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs invisible">Action</Label>
                      <Button onClick={handleAddAlerte} size="sm" className="w-full">
                        <Plus className="h-4 w-4 mr-1" />
                        Ajouter
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="message_alerte" className="text-xs">Message personnalisé (optionnel)</Label>
                    <Input
                      id="message_alerte"
                      placeholder="Ex: Commander d'urgence chez le fournisseur"
                      value={newAlerte.message_alerte}
                      onChange={(e) => setNewAlerte({ ...newAlerte, message_alerte: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {alertes && alertes.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Seuil</TableHead>
                      <TableHead>Couleur</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Statut actuel</TableHead>
                      {editMode && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alertes.map((alerte) => {
                      const isActive = produit.stock_actuel <= alerte.seuil;
                      return (
                        <TableRow key={alerte.id} className={isActive ? "bg-muted/50" : ""}>
                          <TableCell>
                            <Badge variant="outline">{alerte.type_alerte}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">≤ {alerte.seuil}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-6 h-6 rounded border"
                                style={{ backgroundColor: alerte.couleur }}
                              />
                              <span className="text-xs font-mono">{alerte.couleur}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {alerte.message_alerte || "-"}
                          </TableCell>
                          <TableCell>
                            {isActive ? (
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Inactive</Badge>
                            )}
                          </TableCell>
                          {editMode && (
                            <TableCell>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteAlerte(alerte.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground border rounded-lg">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Aucune alerte configurée</p>
                  <p className="text-xs mt-2">
                    Ajoutez des alertes personnalisées pour être notifié selon vos besoins
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="emplacements" className="space-y-4 mt-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Emplacements du produit
                </h4>
              </div>
              {emplacements && emplacements.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code emplacement</TableHead>
                      <TableHead>Zone</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Quantité</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emplacements.map((emp) => (
                      <TableRow key={emp.id}>
                        <TableCell className="font-medium">{emp.code_emplacement}</TableCell>
                        <TableCell>{emp.zone}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{emp.type_emplacement}</Badge>
                        </TableCell>
                        <TableCell>{emp.quantite_actuelle}</TableCell>
                        <TableCell>
                          <Badge variant={emp.statut_actuel === 'disponible' ? 'default' : 'secondary'}>
                            {emp.statut_actuel}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground border rounded-lg">
                  Aucun emplacement assigné
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="variantes" className="space-y-4 mt-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2">
                  <Barcode className="h-4 w-4" />
                  Références supplémentaires (Variantes SKU)
                </h4>
                {editMode && (
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Ajouter
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Gérez les variantes de scanning (ex: carton de 40 unités)
              </p>
              {variantes && variantes.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU Principal</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Quantité par unité</TableHead>
                      <TableHead>Code-barres variante</TableHead>
                      {editMode && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variantes.map((variante) => (
                      <TableRow key={variante.id}>
                        <TableCell className="font-medium">{variante.sku_principal}</TableCell>
                        <TableCell>
                          <Badge>{variante.type_variante}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-primary">
                            {variante.quantite_par_unite}x
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {variante.code_barre_variante || '-'}
                        </TableCell>
                        {editMode && (
                          <TableCell>
                            <Button size="sm" variant="ghost">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground border rounded-lg">
                  <p>Aucune variante configurée</p>
                  <p className="text-xs mt-2">
                    Les variantes permettent de scanner un code-barres différent qui ajoute automatiquement plusieurs unités
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="mouvements" className="space-y-4 mt-4">
            <div className="space-y-2">
              <h4 className="font-medium">Derniers mouvements de stock</h4>
              {mouvements && mouvements.length > 0 ? (
                <div className="space-y-2">
                  {mouvements.map((mouvement) => (
                    <div key={mouvement.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{mouvement.type_mouvement}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(mouvement.date_mouvement).toLocaleString('fr-FR')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {mouvement.quantite > 0 ? '+' : ''}{mouvement.quantite}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {mouvement.numero_mouvement}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun mouvement enregistré
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
