import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ConditionBuilder, Condition } from "@/components/expedition/ConditionBuilder";
import { Plus, Edit, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";

const AVAILABLE_RELATIONS = [
  {
    value: "Produit",
    label: "Produit",
    fields: [
      { value: "categorie", label: "Catégorie", type: "text" as const },
      { value: "rotation_stock", label: "Rotation", type: "select" as const, options: [
        { value: "haute", label: "Haute" },
        { value: "moyenne", label: "Moyenne" },
        { value: "basse", label: "Basse" }
      ]},
      { value: "poids_unitaire", label: "Poids unitaire (g)", type: "number" as const },
      { value: "volume_unitaire", label: "Volume unitaire", type: "number" as const }
    ]
  }
];

export default function ReglesAttribution() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [formData, setFormData] = useState({
    nom_regle: "",
    description: "",
    zone_cible: "",
    type_emplacement_cible: "picking",
    priorite: 100
  });
  const [conditions, setConditions] = useState<Condition[]>([]);

  const { data: regles, isLoading } = useQuery({
    queryKey: ["regles-attribution-emplacement"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("regle_attribution_emplacement")
        .select("*")
        .order("priorite", { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (regle: any) => {
      const { error } = await supabase
        .from("regle_attribution_emplacement")
        .insert(regle);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regles-attribution-emplacement"] });
      toast.success("Règle créée avec succès");
      resetForm();
    },
    onError: () => toast.error("Erreur lors de la création")
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase
        .from("regle_attribution_emplacement")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regles-attribution-emplacement"] });
      toast.success("Règle mise à jour");
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("regle_attribution_emplacement")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regles-attribution-emplacement"] });
      toast.success("Règle supprimée");
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, actif }: { id: string; actif: boolean }) => {
      const { error } = await supabase
        .from("regle_attribution_emplacement")
        .update({ actif })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regles-attribution-emplacement"] });
    }
  });

  const resetForm = () => {
    setFormData({
      nom_regle: "",
      description: "",
      zone_cible: "",
      type_emplacement_cible: "picking",
      priorite: 100
    });
    setConditions([]);
    setEditingRule(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (regle: any) => {
    setEditingRule(regle);
    setFormData({
      nom_regle: regle.nom_regle,
      description: regle.description || "",
      zone_cible: regle.zone_cible || "",
      type_emplacement_cible: regle.type_emplacement_cible || "picking",
      priorite: regle.priorite
    });
    setConditions(regle.conditions || []);
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.nom_regle || conditions.length === 0) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    const regleData = {
      ...formData,
      conditions
    };

    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, updates: regleData });
    } else {
      createMutation.mutate(regleData);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Règles d'Attribution d'Emplacement</h1>
            <p className="text-muted-foreground mt-2">
              Définissez automatiquement où stocker les produits à la réception
            </p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle Règle
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Règles Actives</CardTitle>
            <CardDescription>
              Les règles sont appliquées par ordre de priorité (1 = plus haute priorité)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Chargement...</div>
            ) : regles && regles.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Zone Cible</TableHead>
                    <TableHead>Type Emplacement</TableHead>
                    <TableHead>Conditions</TableHead>
                    <TableHead>Priorité</TableHead>
                    <TableHead>Actif</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regles.map((regle) => (
                    <TableRow key={regle.id}>
                      <TableCell className="font-medium">{regle.nom_regle}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{regle.zone_cible}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{regle.type_emplacement_cible}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {Array.isArray(regle.conditions) ? regle.conditions.length : 0} condition(s)
                      </TableCell>
                      <TableCell>{regle.priorite}</TableCell>
                      <TableCell>
                        <Switch
                          checked={regle.actif}
                          onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: regle.id, actif: checked })}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(regle)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(regle.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Aucune règle définie. Créez votre première règle pour automatiser l'attribution des emplacements.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Modifier la règle" : "Nouvelle règle d'attribution"}</DialogTitle>
            <DialogDescription>
              Définissez les conditions pour attribuer automatiquement une zone et un type d'emplacement
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nom_regle">Nom de la règle *</Label>
                <Input
                  id="nom_regle"
                  value={formData.nom_regle}
                  onChange={(e) => setFormData({ ...formData, nom_regle: e.target.value })}
                  placeholder="Ex: Textile haute rotation → Zone A"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="zone_cible">Zone cible</Label>
                <Input
                  id="zone_cible"
                  value={formData.zone_cible}
                  onChange={(e) => setFormData({ ...formData, zone_cible: e.target.value })}
                  placeholder="Ex: A, B, C..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type_emplacement_cible">Type d'emplacement</Label>
              <Select
                value={formData.type_emplacement_cible}
                onValueChange={(value) => setFormData({ ...formData, type_emplacement_cible: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="picking">Picking (accès rapide)</SelectItem>
                  <SelectItem value="reserve">Réserve (stockage masse)</SelectItem>
                  <SelectItem value="palette">Palette</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Décrivez l'objectif de cette règle..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priorite">Priorité (1 = plus haute)</Label>
              <Input
                id="priorite"
                type="number"
                value={formData.priorite}
                onChange={(e) => setFormData({ ...formData, priorite: parseInt(e.target.value) })}
              />
            </div>

            <ConditionBuilder
              conditions={conditions}
              onChange={setConditions}
              availableRelations={AVAILABLE_RELATIONS}
              title="Conditions d'attribution"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Annuler</Button>
            <Button onClick={handleSubmit}>
              {editingRule ? "Mettre à jour" : "Créer la règle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
