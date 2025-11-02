import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { z } from 'zod';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Package, RotateCcw, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const retourSchema = z.object({
  commande_origine_id: z.string().uuid().optional().nullable(),
  client_nom: z.string().min(1, "Nom client requis"),
  client_id: z.string().uuid("Client requis"),
  raison_globale: z.string().optional(),
  adresse_retour: z.object({
    ligne_1: z.string().min(1, "Adresse requise"),
    ligne_2: z.string().optional(),
    code_postal: z.string().min(1, "Code postal requis"),
    ville: z.string().min(1, "Ville requise"),
    pays_code: z.string().length(2, "Code pays requis (2 lettres)"),
  }),
  lignes: z.array(z.object({
    produit_id: z.string().uuid(),
    produit_reference: z.string().min(1),
    produit_nom: z.string().min(1),
    quantite_retournee: z.number().int().positive("Quantité doit être positive"),
    raison_retour: z.string().min(1, "Raison requise"),
    action_souhaitee: z.enum(['remboursement', 'echange', 'avoir', 'reintegration_stock']),
    etat_produit: z.enum(['neuf', 'bon_etat', 'endommage', 'inutilisable']),
    categorie_emballage: z.number().int().optional(),
  })).min(1, "Au moins un produit requis"),
  transporteur_retour: z.string().optional(),
  numero_tracking_retour: z.string().optional(),
  instructions_retour: z.string().optional(),
  remarques_internes: z.string().optional(),
  statut_initial: z.enum(['annonce', 'en_transit', 'recu']).default('annonce'),
  date_retour_prevue: z.string().optional(),
});

type RetourFormData = z.infer<typeof retourSchema>;

interface LigneRetour {
  produit_id: string;
  produit_reference: string;
  produit_nom: string;
  quantite_retournee: number;
  raison_retour: string;
  action_souhaitee: 'remboursement' | 'echange' | 'avoir' | 'reintegration_stock';
  etat_produit: 'neuf' | 'bon_etat' | 'endommage' | 'inutilisable';
  categorie_emballage?: number;
}

export default function CreerRetour() {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const commandeIdFromUrl = searchParams.get("commande_id");
  
  const [loading, setLoading] = useState(false);
  const [prefilledFromCommande, setPrefilledFromCommande] = useState(false);
  const [commandeOrigine, setCommandeOrigine] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [produits, setProduits] = useState<any[]>([]);
  
  const [formData, setFormData] = useState<Partial<RetourFormData>>({
    client_nom: '',
    client_id: '',
    raison_globale: '',
    adresse_retour: {
      ligne_1: '',
      ligne_2: '',
      code_postal: '',
      ville: '',
      pays_code: 'FR',
    },
    lignes: [],
    statut_initial: 'annonce',
  });

  // Fetch clients for admin/gestionnaire
  useEffect(() => {
    if (userRole === 'admin' || userRole === 'gestionnaire') {
      fetchClients();
    }
  }, [userRole]);

  // Fetch commande data if URL param exists
  useEffect(() => {
    if (commandeIdFromUrl) {
      fetchCommandeData(commandeIdFromUrl);
    }
  }, [commandeIdFromUrl]);

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from('client')
      .select('*')
      .eq('actif', true)
      .order('nom_entreprise');
    
    if (!error && data) {
      setClients(data);
    }
  };

  const fetchCommandeData = async (commandeId: string) => {
    const { data: commande, error } = await supabase
      .from('commande')
      .select(`
        *,
        lignes:ligne_commande(
          *,
          produit:produit(*)
        )
      `)
      .eq('id', commandeId)
      .single();
    
    if (error || !commande) {
      toast({
        title: "Erreur",
        description: "Commande introuvable",
        variant: "destructive",
      });
      return;
    }
    
    setCommandeOrigine(commande);
    setPrefilledFromCommande(true);
    
    setFormData({
      commande_origine_id: commande.id,
      client_nom: commande.nom_client || '',
      client_id: commande.client_id || '',
      adresse_retour: {
        ligne_1: commande.adresse_ligne_1 || '',
        ligne_2: commande.adresse_ligne_2 || '',
        code_postal: commande.code_postal || '',
        ville: commande.ville || '',
        pays_code: commande.pays_code || 'FR',
      },
      lignes: commande.lignes.map((ligne: any) => ({
        produit_id: ligne.produit_id,
        produit_reference: ligne.produit_reference,
        produit_nom: ligne.produit_nom,
        quantite_retournee: 0,
        raison_retour: '',
        action_souhaitee: 'remboursement' as const,
        etat_produit: 'bon_etat' as const,
        categorie_emballage: ligne.categorie_emballage,
      })),
      statut_initial: 'annonce',
    });
  };

  const fetchProduitsByClient = async (clientId: string) => {
    const { data, error } = await supabase
      .from('produit')
      .select('*')
      .eq('client_id', clientId)
      .eq('statut_actif', true)
      .order('nom_produit');
    
    if (!error && data) {
      setProduits(data);
    }
  };

  const handleClientChange = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setFormData(prev => ({
        ...prev,
        client_id: clientId,
        client_nom: client.nom_client,
      }));
      fetchProduitsByClient(clientId);
    }
  };

  const addLigne = () => {
    const nouvelleLigne: LigneRetour = {
      produit_id: '',
      produit_reference: '',
      produit_nom: '',
      quantite_retournee: 1,
      raison_retour: '',
      action_souhaitee: 'remboursement',
      etat_produit: 'bon_etat',
    };
    
    setFormData(prev => ({
      ...prev,
      lignes: [...(prev.lignes || []), nouvelleLigne],
    }));
  };

  const removeLigne = (index: number) => {
    setFormData(prev => ({
      ...prev,
      lignes: (prev.lignes || []).filter((_, i) => i !== index),
    }));
  };

  const updateLigne = (index: number, field: keyof LigneRetour, value: any) => {
    setFormData(prev => ({
      ...prev,
      lignes: (prev.lignes || []).map((ligne, i) => 
        i === index ? { ...ligne, [field]: value } : ligne
      ),
    }));
  };

  const handleProduitChange = (index: number, produitId: string) => {
    const produit = produits.find(p => p.id === produitId);
    if (produit) {
      updateLigne(index, 'produit_id', produitId);
      updateLigne(index, 'produit_reference', produit.reference_produit);
      updateLigne(index, 'produit_nom', produit.nom_produit);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validation
      const validated = retourSchema.parse(formData);

      // Calculer valeur totale (simplifiée)
      const valeurTotale = validated.lignes.reduce((sum, ligne) => {
        return sum + (ligne.quantite_retournee * 10); // Prix fictif pour l'exemple
      }, 0);

      // Créer le retour
      const clientData = clients.find(c => c.id === validated.client_id);
      const { data: retour, error: retourError } = await supabase
        .from('retour_produit')
        .insert([{
          client_id: validated.client_id,
          client_nom: clientData?.nom_entreprise || validated.client_nom,
          numero_retour: `RET-${Date.now()}`,
          statut_retour: validated.statut_initial,
          raison_retour: validated.raison_globale || 'Non spécifiée',
          valeur_totale: valeurTotale,
          remarques: validated.remarques_internes,
        }])
        .select()
        .single();

      if (retourError) throw retourError;

      // Créer les lignes de retour
      const lignesInsert = validated.lignes.map(ligne => ({
        retour_id: retour.id,
        produit_id: ligne.produit_id,
        produit_reference: ligne.produit_reference,
        produit_nom: ligne.produit_nom,
        quantite_retournee: ligne.quantite_retournee,
        raison_retour: ligne.raison_retour,
        action_souhaitee: ligne.action_souhaitee,
        etat_produit: ligne.etat_produit,
        categorie_emballage: ligne.categorie_emballage,
      }));

      const { error: lignesError } = await supabase
        .from('ligne_retour_produit')
        .insert(lignesInsert);

      if (lignesError) throw lignesError;

      toast({
        title: "Retour créé",
        description: `Retour ${retour.numero_retour} créé avec succès`,
      });

      // Redirection selon le rôle
      if (userRole === 'client') {
        navigate('/client/mes-retours');
      } else {
        navigate('/retours');
      }
    } catch (error: any) {
      console.error('Erreur création retour:', error);
      if (error instanceof z.ZodError) {
        toast({
          title: "Erreur de validation",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erreur",
          description: error.message || "Impossible de créer le retour",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <RotateCcw className="h-8 w-8" />
                Créer un Retour
              </h1>
            </div>
            <p className="text-muted-foreground">
              Créer un nouveau retour de produits
            </p>
          </div>
        </div>

        {prefilledFromCommande && commandeOrigine && (
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg">
                🔗 Retour lié à la commande {commandeOrigine.numero_commande}
              </CardTitle>
              <CardDescription>
                Les informations ont été pré-remplies depuis la commande d'origine
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section Client */}
          {!prefilledFromCommande && (userRole === 'admin' || userRole === 'gestionnaire') && (
            <Card>
              <CardHeader>
                <CardTitle>Informations Client</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="client">Client *</Label>
                  <Select
                    value={formData.client_id}
                    onValueChange={handleClientChange}
                  >
                    <SelectTrigger id="client">
                      <SelectValue placeholder="Sélectionner un client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.nom_client}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Section Produits à Retourner */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Produits à Retourner *</CardTitle>
                {!prefilledFromCommande && (
                  <Button type="button" onClick={addLigne} size="sm">
                    <Package className="h-4 w-4 mr-2" />
                    Ajouter un produit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {(formData.lignes || []).length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  Aucun produit ajouté
                </p>
              ) : (
                <div className="space-y-4">
                  {(formData.lignes || []).map((ligne, index) => (
                    <Card key={index} className="p-4">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <p className="font-medium">{ligne.produit_nom}</p>
                            <p className="text-sm text-muted-foreground">Réf: {ligne.produit_reference}</p>
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

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {!prefilledFromCommande && (
                            <div className="space-y-2">
                              <Label>Produit *</Label>
                              <Select
                                value={ligne.produit_id}
                                onValueChange={(value) => handleProduitChange(index, value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Sélectionner" />
                                </SelectTrigger>
                                <SelectContent>
                                  {produits.map(produit => (
                                    <SelectItem key={produit.id} value={produit.id}>
                                      {produit.nom_produit} ({produit.reference_produit})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          <div className="space-y-2">
                            <Label>Quantité retournée *</Label>
                            <Input
                              type="number"
                              min="1"
                              value={ligne.quantite_retournee}
                              onChange={(e) => updateLigne(index, 'quantite_retournee', parseInt(e.target.value) || 1)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Raison du retour *</Label>
                            <Select
                              value={ligne.raison_retour}
                              onValueChange={(value) => updateLigne(index, 'raison_retour', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Sélectionner" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Défectueux">Défectueux</SelectItem>
                                <SelectItem value="Erreur envoi">Erreur d'envoi</SelectItem>
                                <SelectItem value="Client insatisfait">Client insatisfait</SelectItem>
                                <SelectItem value="Périmé">Périmé</SelectItem>
                                <SelectItem value="Endommagé transport">Endommagé transport</SelectItem>
                                <SelectItem value="Autre">Autre</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>État du produit *</Label>
                            <Select
                              value={ligne.etat_produit}
                              onValueChange={(value: any) => updateLigne(index, 'etat_produit', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="neuf">Neuf</SelectItem>
                                <SelectItem value="bon_etat">Bon état</SelectItem>
                                <SelectItem value="endommage">Endommagé</SelectItem>
                                <SelectItem value="inutilisable">Inutilisable</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Action souhaitée *</Label>
                            <Select
                              value={ligne.action_souhaitee}
                              onValueChange={(value: any) => updateLigne(index, 'action_souhaitee', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="remboursement">Remboursement</SelectItem>
                                <SelectItem value="echange">Échange</SelectItem>
                                <SelectItem value="avoir">Avoir</SelectItem>
                                <SelectItem value="reintegration_stock">Réintégration stock</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section Adresse de Retour */}
          <Card>
            <CardHeader>
              <CardTitle>Adresse de Retour</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="adresse_ligne_1">Adresse ligne 1 *</Label>
                  <Input
                    id="adresse_ligne_1"
                    value={formData.adresse_retour?.ligne_1 || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      adresse_retour: { ...prev.adresse_retour!, ligne_1: e.target.value }
                    }))}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="adresse_ligne_2">Adresse ligne 2</Label>
                  <Input
                    id="adresse_ligne_2"
                    value={formData.adresse_retour?.ligne_2 || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      adresse_retour: { ...prev.adresse_retour!, ligne_2: e.target.value }
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code_postal">Code postal *</Label>
                  <Input
                    id="code_postal"
                    value={formData.adresse_retour?.code_postal || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      adresse_retour: { ...prev.adresse_retour!, code_postal: e.target.value }
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ville">Ville *</Label>
                  <Input
                    id="ville"
                    value={formData.adresse_retour?.ville || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      adresse_retour: { ...prev.adresse_retour!, ville: e.target.value }
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pays_code">Code pays (2 lettres) *</Label>
                  <Input
                    id="pays_code"
                    maxLength={2}
                    value={formData.adresse_retour?.pays_code || 'FR'}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      adresse_retour: { ...prev.adresse_retour!, pays_code: e.target.value.toUpperCase() }
                    }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section Logistique */}
          <Card>
            <CardHeader>
              <CardTitle>Informations Logistiques</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="statut_initial">Statut initial</Label>
                  <Select
                    value={formData.statut_initial}
                    onValueChange={(value: any) => setFormData(prev => ({ ...prev, statut_initial: value }))}
                  >
                    <SelectTrigger id="statut_initial">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="annonce">Annoncé</SelectItem>
                      <SelectItem value="en_transit">En transit</SelectItem>
                      <SelectItem value="recu">Reçu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date_retour_prevue">Date retour prévue</Label>
                  <Input
                    id="date_retour_prevue"
                    type="date"
                    value={formData.date_retour_prevue || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, date_retour_prevue: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transporteur">Transporteur</Label>
                  <Input
                    id="transporteur"
                    placeholder="DHL, Colissimo, etc."
                    value={formData.transporteur_retour || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, transporteur_retour: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tracking">Numéro de tracking</Label>
                  <Input
                    id="tracking"
                    value={formData.numero_tracking_retour || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, numero_tracking_retour: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="instructions">Instructions de retour</Label>
                <Textarea
                  id="instructions"
                  placeholder="Instructions pour le client..."
                  value={formData.instructions_retour || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, instructions_retour: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="remarques">Remarques internes</Label>
                <Textarea
                  id="remarques"
                  placeholder="Remarques visibles uniquement par l'équipe..."
                  value={formData.remarques_internes || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, remarques_internes: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading || (formData.lignes?.length || 0) === 0}>
              {loading ? "Création..." : "Créer le retour"}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}