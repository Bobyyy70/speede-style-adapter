import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

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
  const { user, userRole, getViewingClientId } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [produits, setProduits] = useState<Produit[]>([]);
  const [lignes, setLignes] = useState<LigneCommande[]>([]);
  const [labelFile, setLabelFile] = useState<File | null>(null);
  const [labelUrl, setLabelUrl] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [useExistingContact, setUseExistingContact] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [saveAsContact, setSaveAsContact] = useState(false);
  const [labelContact, setLabelContact] = useState("");
  
  // Pour admin/gestionnaire: liste des clients et client sélectionné
  const [clients, setClients] = useState<Array<{ id: string; nom_entreprise: string }>>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  
  const [formData, setFormData] = useState({
    // Expéditeur
    expediteur_nom: "",
    expediteur_entreprise: "",
    expediteur_email: "",
    expediteur_telephone: "",
    expediteur_adresse_ligne_1: "",
    expediteur_adresse_ligne_2: "",
    expediteur_code_postal: "",
    expediteur_ville: "",
    expediteur_pays_code: "FR",
    // Destinataire
    nom_client: "",
    prenom_client: "",
    entreprise_client: "",
    email_client: "",
    telephone_client: "",
    telephone_mobile_client: "",
    adresse_nom: "",
    adresse_ligne_1: "",
    adresse_ligne_2: "",
    adresse_ligne_3: "",
    code_postal: "",
    ville: "",
    pays_code: "FR",
    // Instructions de livraison
    digicode: "",
    interphone: "",
    instructions_acces: "",
    instructions_livraison: "",
    transporteur: "",
    remarques: "",
  });

  // Récupérer les contacts du client
  const { data: contacts } = useQuery({
    queryKey: ["contacts", user?.id, selectedClientId],
    queryFn: async () => {
      if (!user) return [];
      
      const asClient = searchParams.get("asClient");
      let clientId = asClient || selectedClientId;

      if (!clientId) {
        clientId = getViewingClientId();
      }

      if (!clientId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("client_id")
          .eq("id", user.id)
          .maybeSingle();
        clientId = profile?.client_id || null;
      }

      if (!clientId) return [];

      const { data, error } = await supabase
        .from("contact_destinataire")
        .select("*")
        .eq("client_id", clientId)
        .eq("est_archive", false)
        .order("est_favori", { ascending: false })
        .order("utilisation_count", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (user) {
      const asClient = searchParams.get("asClient");
      if (!asClient && (userRole === 'admin' || userRole === 'gestionnaire')) {
        fetchClientsList();
      } else {
        fetchProduits();
      }
    }
  }, [user, userRole, searchParams]);

  useEffect(() => {
    if (selectedClientId) {
      fetchProduits();
    }
  }, [selectedClientId]);

  // Charger les données du contact sélectionné
  useEffect(() => {
    if (useExistingContact && selectedContactId && contacts) {
      const contact = contacts.find((c) => c.id === selectedContactId);
      if (contact) {
        setFormData((prev) => ({
          ...prev,
          nom_client: contact.nom,
          prenom_client: contact.prenom || "",
          entreprise_client: contact.entreprise || "",
          email_client: contact.email || "",
          telephone_client: contact.telephone || "",
          telephone_mobile_client: contact.telephone_mobile || "",
          adresse_nom: contact.nom,
          adresse_ligne_1: contact.adresse_ligne_1,
          adresse_ligne_2: contact.adresse_ligne_2 || "",
          adresse_ligne_3: contact.adresse_ligne_3 || "",
          code_postal: contact.code_postal,
          ville: contact.ville,
          pays_code: contact.pays_code,
          digicode: contact.digicode || "",
          interphone: contact.interphone || "",
          instructions_acces: contact.instructions_acces || "",
          instructions_livraison: contact.instructions_livraison || "",
        }));
      }
    }
  }, [useExistingContact, selectedContactId, contacts]);

  const fetchClientsList = async () => {
    try {
      const { data, error } = await supabase
        .from('client')
        .select('id, nom_entreprise')
        .eq('actif', true)
        .order('nom_entreprise');

      if (error) throw error;
      setClients(data || []);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchProduits = async () => {
    try {
      const asClient = searchParams.get("asClient");
      let clientId = asClient || selectedClientId;

      if (!clientId) {
        clientId = getViewingClientId();
      }

      if (!clientId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("client_id")
          .eq("id", user?.id)
          .maybeSingle();
        clientId = profile?.client_id || null;
      }

      if (!clientId) {
        setProduits([]);
        return;
      }

      const { data, error } = await supabase
        .from("produit")
        .select("id, reference, nom, prix_unitaire, stock_actuel, poids_unitaire")
        .eq("client_id", clientId)
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
      const asClient = searchParams.get("asClient");
      let clientId = asClient || selectedClientId;

      if (!clientId) {
        clientId = getViewingClientId();
      }

      if (!clientId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("client_id")
          .eq("id", user?.id)
          .maybeSingle();
        clientId = profile?.client_id || null;
      }

      if (!clientId) {
        toast({
          title: "Erreur",
          description: "Veuillez sélectionner un client",
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
          client_id: clientId,
          numero_commande: `CMD-${Date.now()}`,
          source: "manuel",
          statut_wms: "En attente de réappro",
          valeur_totale: valeurTotale,
          poids_total: poidsTotal,
          label_pregenere: !!labelUrl && !!trackingNumber,
          label_source: labelUrl && trackingNumber ? "manuel" : null,
          label_url: labelUrl || null,
          tracking_number: trackingNumber || null,
          // Expéditeur
          expediteur_nom: formData.expediteur_nom || null,
          expediteur_entreprise: formData.expediteur_entreprise || null,
          expediteur_email: formData.expediteur_email || null,
          expediteur_telephone: formData.expediteur_telephone || null,
          expediteur_adresse_ligne_1: formData.expediteur_adresse_ligne_1 || null,
          expediteur_adresse_ligne_2: formData.expediteur_adresse_ligne_2 || null,
          expediteur_code_postal: formData.expediteur_code_postal || null,
          expediteur_ville: formData.expediteur_ville || null,
          expediteur_pays_code: formData.expediteur_pays_code || null,
          // Destinataire
          nom_client: formData.nom_client,
          email_client: formData.email_client || null,
          telephone_client: formData.telephone_client || null,
          adresse_nom: formData.adresse_nom,
          adresse_ligne_1: formData.adresse_ligne_1,
          adresse_ligne_2: formData.adresse_ligne_2 || null,
          code_postal: formData.code_postal,
          ville: formData.ville,
          pays_code: formData.pays_code,
          transporteur: formData.transporteur || null,
          remarques: formData.remarques || null,
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

      // Sauvegarder le contact si demandé
      if (saveAsContact && !useExistingContact && formData.nom_client && formData.adresse_ligne_1) {
        await supabase.from("contact_destinataire").insert({
          client_id: clientId,
          nom: formData.nom_client,
          prenom: formData.prenom_client || null,
          entreprise: formData.entreprise_client || null,
          email: formData.email_client || null,
          telephone: formData.telephone_client || null,
          telephone_mobile: formData.telephone_mobile_client || null,
          adresse_ligne_1: formData.adresse_ligne_1,
          adresse_ligne_2: formData.adresse_ligne_2 || null,
          adresse_ligne_3: formData.adresse_ligne_3 || null,
          code_postal: formData.code_postal,
          ville: formData.ville,
          pays_code: formData.pays_code,
          digicode: formData.digicode || null,
          interphone: formData.interphone || null,
          instructions_acces: formData.instructions_acces || null,
          instructions_livraison: formData.instructions_livraison || null,
          label_contact: labelContact || null,
          utilisation_count: 1,
          derniere_utilisation: new Date().toISOString(),
        });
      }

      // Mettre à jour le compteur d'utilisation du contact si utilisé
      if (useExistingContact && selectedContactId) {
        const contact = contacts?.find(c => c.id === selectedContactId);
        if (contact) {
          await supabase
            .from("contact_destinataire")
            .update({
              utilisation_count: (contact.utilisation_count || 0) + 1,
              derniere_utilisation: new Date().toISOString(),
            })
            .eq("id", selectedContactId);
        }
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

  const asClient = searchParams.get("asClient");
  const needsClientSelection = !asClient && (userRole === 'admin' || userRole === 'gestionnaire');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Créer une Commande</h1>
          <p className="text-muted-foreground mt-1">
            Créez une commande manuellement avec informations expéditeur et destinataire
          </p>
        </div>

        {needsClientSelection && (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle>Sélection du Client *</CardTitle>
              <CardDescription>
                Choisissez le client pour lequel créer cette commande
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nom_entreprise}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informations Expéditeur */}
          <Card>
            <CardHeader>
              <CardTitle>📤 Informations Expéditeur</CardTitle>
              <CardDescription>Coordonnées de l'expéditeur (entrepôt ou autre)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expediteur_nom">Nom *</Label>
                  <Input
                    id="expediteur_nom"
                    value={formData.expediteur_nom}
                    onChange={(e) => setFormData({ ...formData, expediteur_nom: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expediteur_entreprise">Entreprise</Label>
                  <Input
                    id="expediteur_entreprise"
                    value={formData.expediteur_entreprise}
                    onChange={(e) => setFormData({ ...formData, expediteur_entreprise: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expediteur_email">Email</Label>
                  <Input
                    id="expediteur_email"
                    type="email"
                    value={formData.expediteur_email}
                    onChange={(e) => setFormData({ ...formData, expediteur_email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expediteur_telephone">Téléphone</Label>
                  <Input
                    id="expediteur_telephone"
                    value={formData.expediteur_telephone}
                    onChange={(e) => setFormData({ ...formData, expediteur_telephone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expediteur_adresse_ligne_1">Adresse ligne 1 *</Label>
                <Input
                  id="expediteur_adresse_ligne_1"
                  value={formData.expediteur_adresse_ligne_1}
                  onChange={(e) => setFormData({ ...formData, expediteur_adresse_ligne_1: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expediteur_adresse_ligne_2">Adresse ligne 2</Label>
                <Input
                  id="expediteur_adresse_ligne_2"
                  value={formData.expediteur_adresse_ligne_2}
                  onChange={(e) => setFormData({ ...formData, expediteur_adresse_ligne_2: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expediteur_code_postal">Code postal *</Label>
                  <Input
                    id="expediteur_code_postal"
                    value={formData.expediteur_code_postal}
                    onChange={(e) => setFormData({ ...formData, expediteur_code_postal: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expediteur_ville">Ville *</Label>
                  <Input
                    id="expediteur_ville"
                    value={formData.expediteur_ville}
                    onChange={(e) => setFormData({ ...formData, expediteur_ville: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expediteur_pays_code">Pays *</Label>
                  <Input
                    id="expediteur_pays_code"
                    value={formData.expediteur_pays_code}
                    onChange={(e) => setFormData({ ...formData, expediteur_pays_code: e.target.value.toUpperCase() })}
                    placeholder="FR"
                    maxLength={2}
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Informations Destinataire */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>📦 Informations Destinataire</CardTitle>
                  <CardDescription>Coordonnées du destinataire final</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="use-existing-contact"
                    checked={useExistingContact}
                    onCheckedChange={setUseExistingContact}
                  />
                  <Label htmlFor="use-existing-contact" className="text-sm font-normal cursor-pointer">
                    📇 Utiliser un contact
                  </Label>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {useExistingContact && contacts && contacts.length > 0 ? (
                <div className="space-y-2">
                  <Label htmlFor="contact-select">Sélectionner un contact</Label>
                  <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                    <SelectTrigger>
                      <SelectValue placeholder="-- Choisir un contact --" />
                    </SelectTrigger>
                    <SelectContent>
                      {contacts.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contact.est_favori ? "⭐ " : ""}
                          {contact.nom} {contact.prenom || ""} 
                          {contact.entreprise ? ` - ${contact.entreprise}` : ""} 
                          {contact.label_contact ? ` (${contact.label_contact})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : useExistingContact ? (
                <p className="text-sm text-muted-foreground">Aucun contact enregistré. Basculez en saisie manuelle.</p>
              ) : null}

              {!useExistingContact || !selectedContactId ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nom_client">Nom *</Label>
                      <Input
                        id="nom_client"
                        value={formData.nom_client}
                        onChange={(e) => setFormData({ ...formData, nom_client: e.target.value })}
                        required
                        disabled={useExistingContact && !!selectedContactId}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prenom_client">Prénom</Label>
                      <Input
                        id="prenom_client"
                        value={formData.prenom_client}
                        onChange={(e) => setFormData({ ...formData, prenom_client: e.target.value })}
                        disabled={useExistingContact && !!selectedContactId}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="entreprise_client">Entreprise</Label>
                      <Input
                        id="entreprise_client"
                        value={formData.entreprise_client}
                        onChange={(e) => setFormData({ ...formData, entreprise_client: e.target.value })}
                        disabled={useExistingContact && !!selectedContactId}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email_client">Email</Label>
                      <Input
                        id="email_client"
                        type="email"
                        value={formData.email_client}
                        onChange={(e) => setFormData({ ...formData, email_client: e.target.value })}
                        disabled={useExistingContact && !!selectedContactId}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="telephone_client">Téléphone</Label>
                      <Input
                        id="telephone_client"
                        value={formData.telephone_client}
                        onChange={(e) => setFormData({ ...formData, telephone_client: e.target.value })}
                        disabled={useExistingContact && !!selectedContactId}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="telephone_mobile_client">Téléphone mobile</Label>
                      <Input
                        id="telephone_mobile_client"
                        value={formData.telephone_mobile_client}
                        onChange={(e) => setFormData({ ...formData, telephone_mobile_client: e.target.value })}
                        disabled={useExistingContact && !!selectedContactId}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adresse_nom">Nom du destinataire *</Label>
                    <Input
                      id="adresse_nom"
                      value={formData.adresse_nom}
                      onChange={(e) => setFormData({ ...formData, adresse_nom: e.target.value })}
                      required
                      disabled={useExistingContact && !!selectedContactId}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adresse_ligne_1">Adresse ligne 1 *</Label>
                    <Input
                      id="adresse_ligne_1"
                      value={formData.adresse_ligne_1}
                      onChange={(e) => setFormData({ ...formData, adresse_ligne_1: e.target.value })}
                      required
                      disabled={useExistingContact && !!selectedContactId}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adresse_ligne_2">Adresse ligne 2</Label>
                    <Input
                      id="adresse_ligne_2"
                      value={formData.adresse_ligne_2}
                      onChange={(e) => setFormData({ ...formData, adresse_ligne_2: e.target.value })}
                      disabled={useExistingContact && !!selectedContactId}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adresse_ligne_3">Adresse ligne 3 (Bâtiment, étage...)</Label>
                    <Input
                      id="adresse_ligne_3"
                      value={formData.adresse_ligne_3}
                      onChange={(e) => setFormData({ ...formData, adresse_ligne_3: e.target.value })}
                      disabled={useExistingContact && !!selectedContactId}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="code_postal">Code postal *</Label>
                      <Input
                        id="code_postal"
                        value={formData.code_postal}
                        onChange={(e) => setFormData({ ...formData, code_postal: e.target.value })}
                        required
                        disabled={useExistingContact && !!selectedContactId}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ville">Ville *</Label>
                      <Input
                        id="ville"
                        value={formData.ville}
                        onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                        required
                        disabled={useExistingContact && !!selectedContactId}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pays_code">Pays *</Label>
                      <Input
                        id="pays_code"
                        value={formData.pays_code}
                        onChange={(e) => setFormData({ ...formData, pays_code: e.target.value.toUpperCase() })}
                        placeholder="FR"
                        maxLength={2}
                        required
                        disabled={useExistingContact && !!selectedContactId}
                      />
                    </div>
                  </div>

                  {/* Instructions de livraison */}
                  <div className="mt-6 p-4 border rounded-md bg-muted/50">
                    <h4 className="font-semibold mb-3">📋 Instructions de livraison</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="digicode">Digicode</Label>
                        <Input
                          id="digicode"
                          value={formData.digicode}
                          onChange={(e) => setFormData({ ...formData, digicode: e.target.value })}
                          placeholder="Ex: A1234"
                          disabled={useExistingContact && !!selectedContactId}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="interphone">Interphone</Label>
                        <Input
                          id="interphone"
                          value={formData.interphone}
                          onChange={(e) => setFormData({ ...formData, interphone: e.target.value })}
                          placeholder="Ex: Dupont"
                          disabled={useExistingContact && !!selectedContactId}
                        />
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label htmlFor="instructions_acces">Instructions d'accès</Label>
                      <Textarea
                        id="instructions_acces"
                        value={formData.instructions_acces}
                        onChange={(e) => setFormData({ ...formData, instructions_acces: e.target.value })}
                        placeholder="Ex: Sonner chez le gardien, laisser au concierge..."
                        rows={2}
                        disabled={useExistingContact && !!selectedContactId}
                      />
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label htmlFor="instructions_livraison">Instructions de livraison</Label>
                      <Textarea
                        id="instructions_livraison"
                        value={formData.instructions_livraison}
                        onChange={(e) => setFormData({ ...formData, instructions_livraison: e.target.value })}
                        placeholder="Ex: Ne pas laisser sans signature, appeler avant..."
                        rows={2}
                        disabled={useExistingContact && !!selectedContactId}
                      />
                    </div>
                  </div>

                  {/* Option de sauvegarde */}
                  {!useExistingContact && (
                    <div className="mt-4 p-4 border rounded-md bg-primary/5">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="save-as-contact"
                          checked={saveAsContact}
                          onCheckedChange={setSaveAsContact}
                        />
                        <Label htmlFor="save-as-contact" className="cursor-pointer">
                          💾 Sauvegarder ce destinataire dans mes contacts
                        </Label>
                      </div>
                      {saveAsContact && (
                        <div className="mt-3 space-y-2">
                          <Label htmlFor="labelContact">Label du contact (optionnel)</Label>
                          <Input
                            id="labelContact"
                            value={labelContact}
                            onChange={(e) => setLabelContact(e.target.value)}
                            placeholder="Ex: Bureau Paris, Entrepôt Lyon..."
                          />
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : null}
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
              <CardTitle>Transporteur & Remarques</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="transporteur">Transporteur</Label>
                <Input
                  id="transporteur"
                  value={formData.transporteur}
                  onChange={(e) => setFormData({ ...formData, transporteur: e.target.value })}
                  placeholder="Ex: DHL, Chronopost, Colissimo..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="remarques">Remarques</Label>
                <Textarea
                  id="remarques"
                  value={formData.remarques}
                  onChange={(e) => setFormData({ ...formData, remarques: e.target.value })}
                  rows={4}
                  placeholder="Instructions spéciales, notes internes..."
                />
              </div>
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
