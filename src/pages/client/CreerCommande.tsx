import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Trash2, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface LigneCommande {
  produit_id: string;
  produit_reference: string;
  produit_nom: string;
  quantite: number;
  prix_unitaire: number;
}

interface Produit {
  id: string;
  reference: string;
  nom: string;
  prix_unitaire: number;
  stock_actuel: number;
  poids_unitaire?: number;
}

const CreerCommande = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [produits, setProduits] = useState<Produit[]>([]);
  const [lignes, setLignes] = useState<LigneCommande[]>([]);
  const [labelFile, setLabelFile] = useState<File | null>(null);
  const [labelUrl, setLabelUrl] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  
  const [formData, setFormData] = useState({
    nom_client: "",
    email_client: "",
    telephone_client: "",
    adresse_nom: "",
    adresse_ligne_1: "",
    adresse_ligne_2: "",
    code_postal: "",
    ville: "",
    pays_code: "FR",
    transporteur: "",
    remarques: "",
  });

  useEffect(() => {
    if (user) {
      fetchProduits();
    }
  }, [user]);

  const fetchProduits = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("client_id")
        .eq("id", user?.id)
        .single();

      if (!profile?.client_id) return;

      const { data, error } = await supabase
        .from("produit")
        .select("id, reference, nom, prix_unitaire, stock_actuel, poids_unitaire")
        .eq("client_id", profile.client_id)
        .eq("statut_actif", true)
        .order("nom");

      if (error) throw error;
      setProduits(data || []);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const ajouterLigne = () => {
    if (produits.length === 0) {
      toast({
        title: "Attention",
        description: "Aucun produit disponible",
        variant: "destructive",
      });
      return;
    }

    const premierProduit = produits[0];
    setLignes([
      ...lignes,
      {
        produit_id: premierProduit.id,
        produit_reference: premierProduit.reference,
        produit_nom: premierProduit.nom,
        quantite: 1,
        prix_unitaire: premierProduit.prix_unitaire || 0,
      },
    ]);
  };

  const supprimerLigne = (index: number) => {
    setLignes(lignes.filter((_, i) => i !== index));
  };

  const modifierLigne = (index: number, field: keyof LigneCommande, value: any) => {
    const nouvelleLignes = [...lignes];
    
    if (field === "produit_id") {
      const produit = produits.find(p => p.id === value);
      if (produit) {
        nouvelleLignes[index] = {
          ...nouvelleLignes[index],
          produit_id: produit.id,
          produit_reference: produit.reference,
          produit_nom: produit.nom,
          prix_unitaire: produit.prix_unitaire || 0,
        };
      }
    } else {
      nouvelleLignes[index] = { ...nouvelleLignes[index], [field]: value };
    }
    
    setLignes(nouvelleLignes);
  };

  const handleLabelUpload = async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents-commande')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('documents-commande')
        .getPublicUrl(filePath);

      setLabelUrl(publicUrl);
      toast({
        title: "Succès",
        description: "Étiquette téléchargée",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (lignes.length === 0) {
      toast({
        title: "Attention",
        description: "Ajoutez au moins un produit",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("client_id")
        .eq("id", user?.id)
        .single();

      if (!profile?.client_id) {
        toast({
          title: "Erreur",
          description: "Client non trouvé",
          variant: "destructive",
        });
        return;
      }

      const valeurTotale = lignes.reduce((sum, l) => sum + (l.quantite * l.prix_unitaire), 0);
      const poidsTotal = lignes.reduce((sum, l) => {
        const produit = produits.find(p => p.id === l.produit_id);
        return sum + (l.quantite * (produit?.poids_unitaire || 0));
      }, 0);

      // Créer la commande
      const { data: commande, error: commandeError } = await supabase
        .from("commande")
        .insert({
          client_id: profile.client_id,
          numero_commande: `CMD-${Date.now()}`,
          source: "manuel",
          statut_wms: "En attente de réappro",
          valeur_totale: valeurTotale,
          poids_total: poidsTotal,
          label_pregenere: !!labelUrl && !!trackingNumber,
          label_source: labelUrl && trackingNumber ? "manuel" : null,
          label_url: labelUrl || null,
          tracking_number: trackingNumber || null,
          ...formData,
        })
        .select()
        .single();

      if (commandeError) throw commandeError;

      // Créer les lignes
      const lignesData = lignes.map(l => ({
        commande_id: commande.id,
        produit_id: l.produit_id,
        produit_reference: l.produit_reference,
        produit_nom: l.produit_nom,
        quantite_commandee: l.quantite,
        prix_unitaire: l.prix_unitaire,
        valeur_totale: l.quantite * l.prix_unitaire,
      }));

      const { error: lignesError } = await supabase
        .from("ligne_commande")
        .insert(lignesData);

      if (lignesError) throw lignesError;

      // Réserver le stock
      for (const ligne of lignes) {
        await supabase.rpc("reserver_stock", {
          p_produit_id: ligne.produit_id,
          p_quantite: ligne.quantite,
          p_commande_id: commande.id,
          p_reference_origine: commande.numero_commande,
        });
      }

      toast({
        title: "Succès",
        description: "Commande créée avec succès",
      });

      navigate("/client/commandes");
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Créer une Commande</h1>
          <p className="text-muted-foreground mt-1">
            Créez une commande manuellement pour vos besoins spécifiques
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informations Client</CardTitle>
              <CardDescription>Coordonnées du destinataire</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nom_client">Nom *</Label>
                  <Input
                    id="nom_client"
                    value={formData.nom_client}
                    onChange={(e) => setFormData({ ...formData, nom_client: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email_client">Email</Label>
                  <Input
                    id="email_client"
                    type="email"
                    value={formData.email_client}
                    onChange={(e) => setFormData({ ...formData, email_client: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telephone_client">Téléphone</Label>
                  <Input
                    id="telephone_client"
                    value={formData.telephone_client}
                    onChange={(e) => setFormData({ ...formData, telephone_client: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Adresse de Livraison</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="adresse_nom">Nom Adresse *</Label>
                  <Input
                    id="adresse_nom"
                    value={formData.adresse_nom}
                    onChange={(e) => setFormData({ ...formData, adresse_nom: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="adresse_ligne_1">Adresse Ligne 1 *</Label>
                  <Input
                    id="adresse_ligne_1"
                    value={formData.adresse_ligne_1}
                    onChange={(e) => setFormData({ ...formData, adresse_ligne_1: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="adresse_ligne_2">Adresse Ligne 2</Label>
                  <Input
                    id="adresse_ligne_2"
                    value={formData.adresse_ligne_2}
                    onChange={(e) => setFormData({ ...formData, adresse_ligne_2: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code_postal">Code Postal *</Label>
                  <Input
                    id="code_postal"
                    value={formData.code_postal}
                    onChange={(e) => setFormData({ ...formData, code_postal: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ville">Ville *</Label>
                  <Input
                    id="ville"
                    value={formData.ville}
                    onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pays_code">Pays *</Label>
                  <Input
                    id="pays_code"
                    value={formData.pays_code}
                    onChange={(e) => setFormData({ ...formData, pays_code: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transporteur">Transporteur</Label>
                  <Input
                    id="transporteur"
                    value={formData.transporteur}
                    onChange={(e) => setFormData({ ...formData, transporteur: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Produits</CardTitle>
                  <CardDescription>Sélectionnez les produits à expédier</CardDescription>
                </div>
                <Button type="button" onClick={ajouterLigne} variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter un produit
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {lignes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun produit ajouté. Cliquez sur "Ajouter un produit" pour commencer.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead>Quantité</TableHead>
                      <TableHead>Prix Unit.</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lignes.map((ligne, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Select
                            value={ligne.produit_id}
                            onValueChange={(value) => modifierLigne(index, "produit_id", value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {produits.map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.reference} - {p.nom} (Stock: {p.stock_actuel})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            value={ligne.quantite}
                            onChange={(e) => modifierLigne(index, "quantite", parseInt(e.target.value) || 1)}
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>{ligne.prix_unitaire.toFixed(2)} €</TableCell>
                        <TableCell>{(ligne.quantite * ligne.prix_unitaire).toFixed(2)} €</TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => supprimerLigne(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Étiquette de Transport (Optionnel)</CardTitle>
              <CardDescription>
                Si vous avez déjà une étiquette, téléchargez-la ici. La commande ne passera pas par Sendcloud.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="label_file">Fichier Étiquette</Label>
                <Input
                  id="label_file"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setLabelFile(file);
                      handleLabelUpload(file);
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tracking_number">Numéro de Suivi</Label>
                <Input
                  id="tracking_number"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="ex: 1234567890"
                />
              </div>
              {labelUrl && trackingNumber && (
                <div className="text-sm text-green-600 dark:text-green-400">
                  ✓ Étiquette pré-générée détectée - La commande ne passera pas par Sendcloud
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Remarques</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.remarques}
                onChange={(e) => setFormData({ ...formData, remarques: e.target.value })}
                rows={4}
                placeholder="Instructions spéciales, notes internes..."
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate("/client/commandes")}>
              Annuler
            </Button>
            <Button type="submit">Créer la Commande</Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default CreerCommande;
