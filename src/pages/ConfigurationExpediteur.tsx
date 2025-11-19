import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import ThermalPrinterSettings from "@/components/thermal-printer/ThermalPrinterSettings";

export default function ConfigurationExpediteur() {
  const { user, userRole } = useAuth();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nom: '',
    entreprise: '',
    email: '',
    telephone: '',
    adresse_ligne_1: '',
    adresse_ligne_2: '',
    code_postal: '',
    ville: '',
    pays_code: 'FR',
    eori_number: '',
    vat_number: '',
    est_defaut: false
  });

  // Fetch configurations
  const { data: configurations, isLoading } = useQuery({
    queryKey: ['configuration_expediteur', user?.id],
    queryFn: async () => {
      let query = supabase
        .from('configuration_expediteur')
        .select('*')
        .order('est_defaut', { ascending: false })
        .order('date_creation', { ascending: false });

      if (userRole === 'client') {
        const { data: profile } = await supabase
          .from('profiles')
          .select('client_id')
          .eq('id', user!.id)
          .single();
        
        if (profile?.client_id) {
          query = query.eq('client_id', profile.client_id);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('client_id')
        .eq('id', user!.id)
        .single();

      const { error } = await supabase
        .from('configuration_expediteur')
        .insert({
          ...data,
          client_id: profile!.client_id
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuration_expediteur'] });
      toast.success('Configuration créée');
      resetForm();
    },
    onError: () => toast.error('Erreur lors de la création')
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const { error } = await supabase
        .from('configuration_expediteur')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuration_expediteur'] });
      toast.success('Configuration mise à jour');
      setEditingId(null);
    },
    onError: () => toast.error('Erreur lors de la mise à jour')
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('configuration_expediteur')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuration_expediteur'] });
      toast.success('Configuration supprimée');
    },
    onError: () => toast.error('Erreur lors de la suppression')
  });

  const resetForm = () => {
    setFormData({
      nom: '',
      entreprise: '',
      email: '',
      telephone: '',
      adresse_ligne_1: '',
      adresse_ligne_2: '',
      code_postal: '',
      ville: '',
      pays_code: 'FR',
      eori_number: '',
      vat_number: '',
      est_defaut: false
    });
    setEditingId(null);
  };

  const handleEdit = (config: any) => {
    setEditingId(config.id);
    setFormData({
      nom: config.nom,
      entreprise: config.entreprise,
      email: config.email,
      telephone: config.telephone,
      adresse_ligne_1: config.adresse_ligne_1,
      adresse_ligne_2: config.adresse_ligne_2 || '',
      code_postal: config.code_postal,
      ville: config.ville,
      pays_code: config.pays_code,
      eori_number: config.eori_number || '',
      vat_number: config.vat_number || '',
      est_defaut: config.est_defaut
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configuration Expéditeur</h1>
          <p className="text-muted-foreground">
            Gérez vos adresses d'expédition et informations douanières
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Formulaire */}
          <Card>
            <CardHeader>
              <CardTitle>{editingId ? 'Modifier' : 'Nouvelle'} Configuration</CardTitle>
              <CardDescription>
                {editingId ? 'Modifiez' : 'Créez'} une configuration d'expéditeur
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nom">Nom contact</Label>
                    <Input
                      id="nom"
                      value={formData.nom}
                      onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="entreprise">Entreprise</Label>
                    <Input
                      id="entreprise"
                      value={formData.entreprise}
                      onChange={(e) => setFormData({ ...formData, entreprise: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telephone">Téléphone</Label>
                    <Input
                      id="telephone"
                      value={formData.telephone}
                      onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adresse_ligne_1">Adresse ligne 1</Label>
                  <Input
                    id="adresse_ligne_1"
                    value={formData.adresse_ligne_1}
                    onChange={(e) => setFormData({ ...formData, adresse_ligne_1: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adresse_ligne_2">Adresse ligne 2</Label>
                  <Input
                    id="adresse_ligne_2"
                    value={formData.adresse_ligne_2}
                    onChange={(e) => setFormData({ ...formData, adresse_ligne_2: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code_postal">Code postal</Label>
                    <Input
                      id="code_postal"
                      value={formData.code_postal}
                      onChange={(e) => setFormData({ ...formData, code_postal: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ville">Ville</Label>
                    <Input
                      id="ville"
                      value={formData.ville}
                      onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pays_code">Pays</Label>
                    <Input
                      id="pays_code"
                      value={formData.pays_code}
                      onChange={(e) => setFormData({ ...formData, pays_code: e.target.value })}
                      maxLength={2}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="eori_number">Numéro EORI</Label>
                    <Input
                      id="eori_number"
                      value={formData.eori_number}
                      onChange={(e) => setFormData({ ...formData, eori_number: e.target.value })}
                      placeholder="FR12345678901"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vat_number">Numéro TVA</Label>
                    <Input
                      id="vat_number"
                      value={formData.vat_number}
                      onChange={(e) => setFormData({ ...formData, vat_number: e.target.value })}
                      placeholder="FR12345678901"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="est_defaut"
                    checked={formData.est_defaut}
                    onCheckedChange={(checked) => setFormData({ ...formData, est_defaut: checked })}
                  />
                  <Label htmlFor="est_defaut">Définir comme expéditeur par défaut</Label>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    <Plus className="mr-2 h-4 w-4" />
                    {editingId ? 'Modifier' : 'Créer'}
                  </Button>
                  {editingId && (
                    <Button type="button" variant="outline" onClick={resetForm}>
                      Annuler
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Liste des configurations */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Configurations existantes</h2>
            {isLoading ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground">Chargement...</p>
                </CardContent>
              </Card>
            ) : configurations?.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-muted-foreground">Aucune configuration trouvée</p>
                </CardContent>
              </Card>
            ) : (
              configurations?.map((config) => (
                <Card key={config.id}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{config.entreprise}</h3>
                          {config.est_defaut && (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{config.nom}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(config)}
                        >
                          Modifier
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteMutation.mutate(config.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p>{config.adresse_ligne_1}</p>
                      {config.adresse_ligne_2 && <p>{config.adresse_ligne_2}</p>}
                      <p>{config.code_postal} {config.ville}, {config.pays_code}</p>
                      <p>📧 {config.email} | 📱 {config.telephone}</p>
                      {config.eori_number && <p>EORI: {config.eori_number}</p>}
                      {config.vat_number && <p>TVA: {config.vat_number}</p>}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Section Imprimantes Thermiques */}
        <ThermalPrinterSettings />
      </div>
    </DashboardLayout>
  );
}
