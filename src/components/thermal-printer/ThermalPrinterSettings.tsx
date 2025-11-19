import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Printer, CheckCircle2, Wifi, Cable, Bluetooth } from "lucide-react";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ImprimanteThermique {
  id: string;
  client_id: string;
  nom_imprimante: string;
  type_imprimante: string;
  type_connexion: string;
  adresse_ip?: string;
  port?: number;
  device_id?: string;
  largeur_papier_mm: number;
  hauteur_papier_mm?: number;
  resolution_dpi: number;
  vitesse_impression: string;
  par_defaut_picking: boolean;
  par_defaut_expedition: boolean;
  par_defaut_etiquettes: boolean;
  is_active: boolean;
  statut_connexion: string;
  derniere_connexion?: string;
  created_at: string;
  updated_at: string;
}

const initialFormData = {
  nom_imprimante: '',
  type_imprimante: 'thermal_80mm',
  type_connexion: 'network',
  adresse_ip: '',
  port: 9100,
  device_id: '',
  largeur_papier_mm: 80,
  hauteur_papier_mm: undefined as number | undefined,
  resolution_dpi: 203,
  vitesse_impression: 'medium',
  par_defaut_picking: false,
  par_defaut_expedition: false,
  par_defaut_etiquettes: false,
  is_active: true,
};

export function ThermalPrinterSettings() {
  const { user, userRole } = useAuth();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState(initialFormData);

  // Fetch imprimantes
  const { data: imprimantes, isLoading } = useQuery({
    queryKey: ['imprimante_thermique', user?.id],
    queryFn: async () => {
      let query = supabase
        .from('imprimante_thermique')
        .select('*')
        .order('par_defaut_picking', { ascending: false })
        .order('created_at', { ascending: false });

      if (userRole === 'client' || userRole === 'gestionnaire') {
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
      return data as ImprimanteThermique[];
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
        .from('imprimante_thermique')
        .insert({
          ...data,
          client_id: profile!.client_id,
          created_by: user!.id,
          statut_connexion: 'unknown'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imprimante_thermique'] });
      toast.success('Imprimante ajoutée avec succès');
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(`Erreur: ${error.message}`);
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const { error } = await supabase
        .from('imprimante_thermique')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imprimante_thermique'] });
      toast.success('Imprimante mise à jour');
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(`Erreur: ${error.message}`);
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('imprimante_thermique')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imprimante_thermique'] });
      toast.success('Imprimante supprimée');
    },
    onError: () => toast.error('Erreur lors de la suppression')
  });

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingId(null);
  };

  const handleEdit = (imprimante: ImprimanteThermique) => {
    setFormData({
      nom_imprimante: imprimante.nom_imprimante,
      type_imprimante: imprimante.type_imprimante,
      type_connexion: imprimante.type_connexion,
      adresse_ip: imprimante.adresse_ip || '',
      port: imprimante.port || 9100,
      device_id: imprimante.device_id || '',
      largeur_papier_mm: imprimante.largeur_papier_mm,
      hauteur_papier_mm: imprimante.hauteur_papier_mm,
      resolution_dpi: imprimante.resolution_dpi,
      vitesse_impression: imprimante.vitesse_impression,
      par_defaut_picking: imprimante.par_defaut_picking,
      par_defaut_expedition: imprimante.par_defaut_expedition,
      par_defaut_etiquettes: imprimante.par_defaut_etiquettes,
      is_active: imprimante.is_active,
    });
    setEditingId(imprimante.id);
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getConnectionIcon = (type: string) => {
    switch (type) {
      case 'wifi':
      case 'network':
        return <Wifi className="h-4 w-4" />;
      case 'usb':
        return <Cable className="h-4 w-4" />;
      case 'bluetooth':
        return <Bluetooth className="h-4 w-4" />;
      default:
        return <Printer className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      online: { variant: "default", label: "En ligne" },
      offline: { variant: "secondary", label: "Hors ligne" },
      error: { variant: "destructive", label: "Erreur" },
      unknown: { variant: "outline", label: "Inconnu" },
    };
    const config = variants[status] || variants.unknown;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (userRole === 'operateur') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Accès refusé</CardTitle>
          <CardDescription>
            Seuls les gestionnaires et administrateurs peuvent configurer les imprimantes.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Imprimantes thermiques
            </CardTitle>
            <CardDescription>
              Configurez vos imprimantes thermiques pour l'impression automatique des bordereaux et étiquettes
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter une imprimante
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingId ? 'Modifier l\'imprimante' : 'Ajouter une imprimante'}
                </DialogTitle>
                <DialogDescription>
                  Configurez les paramètres de connexion et d'impression
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Informations générales */}
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="nom_imprimante">Nom de l'imprimante *</Label>
                    <Input
                      id="nom_imprimante"
                      value={formData.nom_imprimante}
                      onChange={(e) => setFormData({ ...formData, nom_imprimante: e.target.value })}
                      placeholder="Ex: Imprimante Préparation 1"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="type_imprimante">Type d'imprimante</Label>
                      <Select
                        value={formData.type_imprimante}
                        onValueChange={(value) => setFormData({ ...formData, type_imprimante: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="thermal_80mm">Thermique 80mm</SelectItem>
                          <SelectItem value="thermal_58mm">Thermique 58mm</SelectItem>
                          <SelectItem value="label_100x150mm">Étiquettes 100x150mm</SelectItem>
                          <SelectItem value="label_4x6inch">Étiquettes 4x6"</SelectItem>
                          <SelectItem value="zebra_zpl">Zebra ZPL</SelectItem>
                          <SelectItem value="epson_escpos">Epson ESC/POS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="type_connexion">Type de connexion</Label>
                      <Select
                        value={formData.type_connexion}
                        onValueChange={(value) => setFormData({ ...formData, type_connexion: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="network">Réseau (IP)</SelectItem>
                          <SelectItem value="wifi">WiFi</SelectItem>
                          <SelectItem value="usb">USB</SelectItem>
                          <SelectItem value="bluetooth">Bluetooth</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Configuration réseau */}
                  {(formData.type_connexion === 'network' || formData.type_connexion === 'wifi') && (
                    <div className="grid grid-cols-3 gap-4">
                      <div className="grid gap-2 col-span-2">
                        <Label htmlFor="adresse_ip">Adresse IP</Label>
                        <Input
                          id="adresse_ip"
                          value={formData.adresse_ip}
                          onChange={(e) => setFormData({ ...formData, adresse_ip: e.target.value })}
                          placeholder="192.168.1.100"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="port">Port</Label>
                        <Input
                          id="port"
                          type="number"
                          value={formData.port}
                          onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                          placeholder="9100"
                        />
                      </div>
                    </div>
                  )}

                  {/* Configuration USB/Bluetooth */}
                  {(formData.type_connexion === 'usb' || formData.type_connexion === 'bluetooth') && (
                    <div className="grid gap-2">
                      <Label htmlFor="device_id">ID de périphérique</Label>
                      <Input
                        id="device_id"
                        value={formData.device_id}
                        onChange={(e) => setFormData({ ...formData, device_id: e.target.value })}
                        placeholder="Ex: /dev/usb/lp0 ou 00:11:22:33:44:55"
                      />
                    </div>
                  )}

                  {/* Paramètres papier */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="largeur_papier_mm">Largeur (mm)</Label>
                      <Input
                        id="largeur_papier_mm"
                        type="number"
                        value={formData.largeur_papier_mm}
                        onChange={(e) => setFormData({ ...formData, largeur_papier_mm: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="hauteur_papier_mm">Hauteur (mm)</Label>
                      <Input
                        id="hauteur_papier_mm"
                        type="number"
                        value={formData.hauteur_papier_mm || ''}
                        onChange={(e) => setFormData({ ...formData, hauteur_papier_mm: e.target.value ? parseInt(e.target.value) : undefined })}
                        placeholder="Auto"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="resolution_dpi">Résolution (DPI)</Label>
                      <Select
                        value={formData.resolution_dpi.toString()}
                        onValueChange={(value) => setFormData({ ...formData, resolution_dpi: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="203">203 DPI</SelectItem>
                          <SelectItem value="300">300 DPI</SelectItem>
                          <SelectItem value="600">600 DPI</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="vitesse_impression">Vitesse d'impression</Label>
                    <Select
                      value={formData.vitesse_impression}
                      onValueChange={(value) => setFormData({ ...formData, vitesse_impression: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="slow">Lente (meilleure qualité)</SelectItem>
                        <SelectItem value="medium">Moyenne</SelectItem>
                        <SelectItem value="fast">Rapide</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Imprimante par défaut */}
                  <div className="space-y-3">
                    <Label>Utilisation par défaut</Label>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="par_defaut_picking" className="font-normal">
                        Bordereaux de picking
                      </Label>
                      <Switch
                        id="par_defaut_picking"
                        checked={formData.par_defaut_picking}
                        onCheckedChange={(checked) => setFormData({ ...formData, par_defaut_picking: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="par_defaut_expedition" className="font-normal">
                        Étiquettes d'expédition
                      </Label>
                      <Switch
                        id="par_defaut_expedition"
                        checked={formData.par_defaut_expedition}
                        onCheckedChange={(checked) => setFormData({ ...formData, par_defaut_expedition: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="par_defaut_etiquettes" className="font-normal">
                        Étiquettes produits
                      </Label>
                      <Switch
                        id="par_defaut_etiquettes"
                        checked={formData.par_defaut_etiquettes}
                        onCheckedChange={(checked) => setFormData({ ...formData, par_defaut_etiquettes: checked })}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="is_active" className="font-normal">
                      Imprimante active
                    </Label>
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      resetForm();
                      setIsDialogOpen(false);
                    }}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingId ? 'Mettre à jour' : 'Ajouter'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Chargement...</div>
        ) : imprimantes && imprimantes.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Connexion</TableHead>
                <TableHead>Adresse</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Défaut pour</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {imprimantes.map((imprimante) => (
                <TableRow key={imprimante.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {getConnectionIcon(imprimante.type_connexion)}
                      {imprimante.nom_imprimante}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {imprimante.type_imprimante.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {imprimante.type_connexion}
                  </TableCell>
                  <TableCell>
                    {imprimante.adresse_ip || imprimante.device_id || '-'}
                    {imprimante.port && `:${imprimante.port}`}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(imprimante.statut_connexion)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {imprimante.par_defaut_picking && (
                        <Badge variant="secondary" className="text-xs">Picking</Badge>
                      )}
                      {imprimante.par_defaut_expedition && (
                        <Badge variant="secondary" className="text-xs">Expédition</Badge>
                      )}
                      {imprimante.par_defaut_etiquettes && (
                        <Badge variant="secondary" className="text-xs">Étiquettes</Badge>
                      )}
                      {!imprimante.par_defaut_picking && !imprimante.par_defaut_expedition && !imprimante.par_defaut_etiquettes && '-'}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(imprimante)}
                      >
                        Modifier
                      </Button>
                      {userRole === 'admin' && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (confirm('Êtes-vous sûr de vouloir supprimer cette imprimante ?')) {
                              deleteMutation.mutate(imprimante.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8">
            <Printer className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              Aucune imprimante configurée
            </p>
            <p className="text-sm text-muted-foreground">
              Ajoutez votre première imprimante thermique pour automatiser l'impression
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
