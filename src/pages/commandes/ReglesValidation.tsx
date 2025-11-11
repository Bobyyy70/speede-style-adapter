import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConditionBuilder } from "@/components/expedition/ConditionBuilder";
import { useValidationRules, RegleValidation } from "@/hooks/useValidationRules";
import { Plus, Pencil, Trash2, Shield, AlertTriangle, Info } from "lucide-react";

const AVAILABLE_RELATIONS = [
  {
    value: "Commande",
    label: "Commande",
    fields: [
      { value: "numero_commande", label: "Numéro de commande", type: "text" as const },
      { value: "valeur_totale", label: "Valeur totale (€)", type: "number" as const },
      { value: "poids_total", label: "Poids total (kg)", type: "number" as const },
      { value: "volume_total", label: "Volume total (m³)", type: "number" as const },
      { value: "nombre_colis", label: "Nombre de colis", type: "number" as const },
      { value: "longueur_cm", label: "Longueur (cm)", type: "number" as const },
      { value: "largeur_cm", label: "Largeur (cm)", type: "number" as const },
      { value: "hauteur_cm", label: "Hauteur (cm)", type: "number" as const },
      { value: "pays_code", label: "Pays destination", type: "text" as const },
      { value: "code_postal", label: "Code postal", type: "text" as const },
      { value: "ville", label: "Ville", type: "text" as const },
      { value: "zone_livraison", label: "Zone de livraison", type: "text" as const },
      { value: "transporteur", label: "Transporteur", type: "text" as const },
      { value: "service_livraison", label: "Service de livraison", type: "text" as const },
      { value: "numero_suivi", label: "Numéro de suivi", type: "text" as const },
      { value: "incoterm", label: "Incoterm", type: "text" as const },
      { value: "tags", label: "Tags", type: "text" as const },
      { value: "priorite_expedition", label: "Priorité expédition", type: "text" as const },
      { value: "statut_wms", label: "Statut WMS", type: "text" as const },
      { value: "date_expedition_demandee", label: "Date expédition demandée", type: "date" as const },
      { value: "valeur_douaniere_totale", label: "Valeur douanière (€)", type: "number" as const }
    ]
  },
  {
    value: "Produit",
    label: "Produit",
    fields: [
      { value: "reference", label: "SKU / Référence", type: "text" as const },
      { value: "nom", label: "Nom du produit", type: "text" as const },
      { value: "code_barre_ean", label: "Code-barres EAN", type: "text" as const },
      { value: "poids_unitaire", label: "Poids unitaire (kg)", type: "number" as const },
      { value: "longueur_cm", label: "Longueur (cm)", type: "number" as const },
      { value: "largeur_cm", label: "Largeur (cm)", type: "number" as const },
      { value: "hauteur_cm", label: "Hauteur (cm)", type: "number" as const },
      { value: "volume_m3", label: "Volume (m³)", type: "number" as const },
      { value: "categorie", label: "Catégorie", type: "text" as const },
      { value: "pays_origine", label: "Pays d'origine", type: "text" as const },
      { value: "code_sh", label: "Code SH (douanes)", type: "text" as const },
      { value: "valeur_douaniere", label: "Valeur douanière (€)", type: "number" as const },
      { value: "stock_actuel", label: "Stock actuel", type: "number" as const },
      { value: "stock_minimum", label: "Stock minimum", type: "number" as const },
      { value: "dangereux", label: "Matière dangereuse", type: "text" as const }
    ]
  },
  {
    value: "Client",
    label: "Client",
    fields: [
      { value: "nom_client", label: "Nom client", type: "text" as const },
      { value: "nom_entreprise", label: "Nom entreprise", type: "text" as const },
      { value: "siret", label: "SIRET", type: "text" as const },
      { value: "email", label: "Email", type: "text" as const },
      { value: "telephone", label: "Téléphone", type: "text" as const },
      { value: "pays", label: "Pays", type: "text" as const },
      { value: "statut", label: "Statut client", type: "text" as const },
      { value: "tva_intracommunautaire", label: "TVA intracommunautaire", type: "text" as const }
    ]
  },
  {
    value: "Expediteur",
    label: "Expéditeur",
    fields: [
      { value: "expediteur_entreprise", label: "Entreprise", type: "text" as const },
      { value: "expediteur_pays_code", label: "Pays", type: "text" as const },
      { value: "expediteur_code_postal", label: "Code postal", type: "text" as const },
      { value: "expediteur_ville", label: "Ville", type: "text" as const }
    ]
  }
];

export default function ReglesValidation() {
  const { regles, isLoading, createRegle, updateRegle, deleteRegle, toggleActive } = useValidationRules();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRegle, setEditingRegle] = useState<RegleValidation | null>(null);
  const [formData, setFormData] = useState<{
    nom_regle: string;
    description: string;
    action_a_effectuer: 'bloquer' | 'exiger_validation' | 'alerter';
    niveau_validation: string;
    message_utilisateur: string;
    priorite: number;
    actif: boolean;
    delai_max_jours: number | undefined;
  }>({
    nom_regle: "",
    description: "",
    action_a_effectuer: "exiger_validation",
    niveau_validation: "gestionnaire",
    message_utilisateur: "",
    priorite: 100,
    actif: true,
    delai_max_jours: undefined
  });
  const [conditions, setConditions] = useState<any[]>([]);

  const resetForm = () => {
    setFormData({
      nom_regle: "",
      description: "",
      action_a_effectuer: "exiger_validation",
      niveau_validation: "gestionnaire",
      message_utilisateur: "",
      priorite: 100,
      actif: true,
      delai_max_jours: undefined
    });
    setConditions([]);
    setEditingRegle(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (regle: RegleValidation) => {
    setEditingRegle(regle);
    setFormData({
      nom_regle: regle.nom_regle,
      description: regle.description || "",
      action_a_effectuer: regle.action_a_effectuer,
      niveau_validation: regle.niveau_validation || "gestionnaire",
      message_utilisateur: regle.message_utilisateur || "",
      priorite: regle.priorite,
      actif: regle.actif,
      delai_max_jours: regle.delai_max_jours
    });
    setConditions(regle.conditions || []);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.nom_regle.trim()) {
      return;
    }

    if (conditions.length === 0) {
      return;
    }

    try {
      const regleData = {
        ...formData,
        conditions
      };

      if (editingRegle) {
        await updateRegle({ id: editingRegle.id, ...regleData });
      } else {
        await createRegle(regleData);
      }

      resetForm();
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'bloquer':
        return <AlertTriangle className="h-4 w-4" />;
      case 'exiger_validation':
        return <Shield className="h-4 w-4" />;
      case 'alerter':
        return <Info className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'bloquer':
        return 'Bloquer';
      case 'exiger_validation':
        return 'Validation requise';
      case 'alerter':
        return 'Alerte';
      default:
        return action;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Règles de Validation</h1>
            <p className="text-muted-foreground mt-1">
              Configurez des règles pour valider ou bloquer automatiquement les commandes
            </p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle règle
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Règles actives</CardTitle>
            <CardDescription>
              Les règles sont appliquées par ordre de priorité (1 = plus haute)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Chargement...</div>
            ) : !regles || regles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucune règle configurée
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Priorité</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Niveau</TableHead>
                    <TableHead>Conditions</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regles.map((regle) => (
                    <TableRow key={regle.id}>
                      <TableCell className="font-mono">{regle.priorite}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{regle.nom_regle}</div>
                          {regle.description && (
                            <div className="text-sm text-muted-foreground">{regle.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={regle.action_a_effectuer === 'bloquer' ? 'destructive' : 'default'} className="gap-1">
                          {getActionIcon(regle.action_a_effectuer)}
                          {getActionLabel(regle.action_a_effectuer)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {regle.niveau_validation && (
                          <Badge variant="outline">{regle.niveau_validation}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {regle.conditions?.length || 0} condition(s)
                        </span>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={regle.actif}
                          onCheckedChange={(checked) => toggleActive({ id: regle.id, actif: checked })}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(regle)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteRegle(regle.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingRegle ? 'Modifier la règle' : 'Nouvelle règle de validation'}
              </DialogTitle>
              <DialogDescription>
                Définissez les conditions et l'action à effectuer
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nom_regle">Nom de la règle *</Label>
                  <Input
                    id="nom_regle"
                    value={formData.nom_regle}
                    onChange={(e) => setFormData({ ...formData, nom_regle: e.target.value })}
                    placeholder="ex: Validation commandes >5000€"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priorite">Priorité</Label>
                  <Input
                    id="priorite"
                    type="number"
                    value={formData.priorite}
                    onChange={(e) => setFormData({ ...formData, priorite: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description de la règle..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="action">Action à effectuer *</Label>
                  <Select
                    value={formData.action_a_effectuer}
                    onValueChange={(value: any) => setFormData({ ...formData, action_a_effectuer: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exiger_validation">Exiger validation manuelle</SelectItem>
                      <SelectItem value="bloquer">Bloquer immédiatement</SelectItem>
                      <SelectItem value="alerter">Créer une alerte uniquement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.action_a_effectuer === 'exiger_validation' && (
                  <div className="space-y-2">
                    <Label htmlFor="niveau">Niveau de validation</Label>
                    <Select
                      value={formData.niveau_validation}
                      onValueChange={(value) => setFormData({ ...formData, niveau_validation: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gestionnaire">Gestionnaire</SelectItem>
                        <SelectItem value="admin">Administrateur</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message affiché à l'utilisateur *</Label>
                <Textarea
                  id="message"
                  value={formData.message_utilisateur}
                  onChange={(e) => setFormData({ ...formData, message_utilisateur: e.target.value })}
                  placeholder="Ce message sera affiché à l'opérateur..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Conditions de déclenchement *</Label>
                <ConditionBuilder
                  conditions={conditions}
                  onChange={setConditions}
                  availableRelations={AVAILABLE_RELATIONS}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>
                Annuler
              </Button>
              <Button onClick={handleSubmit}>
                {editingRegle ? 'Mettre à jour' : 'Créer la règle'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}