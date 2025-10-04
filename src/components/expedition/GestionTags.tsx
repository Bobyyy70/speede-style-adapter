import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Tag, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface RegleTag {
  id: string;
  nom_regle: string;
  tag: string;
  couleur_tag: string;
  priorite: number;
  actif: boolean;
  conditions: any;
}

const COULEURS_TAGS = [
  { value: "blue", label: "Bleu", class: "bg-blue-500" },
  { value: "orange", label: "Orange", class: "bg-orange-500" },
  { value: "green", label: "Vert", class: "bg-green-500" },
  { value: "red", label: "Rouge", class: "bg-red-500" },
  { value: "purple", label: "Violet", class: "bg-purple-500" },
  { value: "yellow", label: "Jaune", class: "bg-yellow-500" },
  { value: "gray", label: "Gris", class: "bg-gray-500" }
];

export function GestionTags() {
  const [regles, setRegles] = useState<RegleTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [newRegle, setNewRegle] = useState({
    nom_regle: "",
    tag: "",
    couleur_tag: "blue",
    priorite: "1",
    conditions: "[]"
  });

  useEffect(() => {
    fetchRegles();
  }, []);

  const fetchRegles = async () => {
    try {
      const { data, error } = await supabase
        .from("regle_tag_automatique")
        .select("*")
        .order("priorite", { ascending: true });

      if (error) throw error;
      setRegles(data || []);
    } catch (error: any) {
      toast.error("Erreur lors du chargement des règles");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRegle = async () => {
    if (!newRegle.nom_regle || !newRegle.tag) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    try {
      let parsedConditions = [];
      try {
        parsedConditions = JSON.parse(newRegle.conditions);
      } catch {
        toast.error("Format JSON invalide pour les conditions");
        return;
      }

      const { error } = await supabase.from("regle_tag_automatique").insert({
        nom_regle: newRegle.nom_regle,
        tag: newRegle.tag,
        couleur_tag: newRegle.couleur_tag,
        priorite: parseInt(newRegle.priorite),
        conditions: parsedConditions,
        actif: true
      });

      if (error) throw error;

      toast.success("Règle de tag ajoutée");
      setNewRegle({ nom_regle: "", tag: "", couleur_tag: "blue", priorite: "1", conditions: "[]" });
      setOpen(false);
      fetchRegles();
    } catch (error: any) {
      toast.error("Erreur lors de l'ajout de la règle");
      console.error(error);
    }
  };

  const handleDeleteRegle = async (id: string) => {
    try {
      const { error } = await supabase
        .from("regle_tag_automatique")
        .update({ actif: false })
        .eq("id", id);

      if (error) throw error;
      toast.success("Règle désactivée");
      fetchRegles();
    } catch (error: any) {
      toast.error("Erreur lors de la suppression");
      console.error(error);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Règles de tags automatiques</CardTitle>
              <CardDescription>
                Configurez des règles pour appliquer automatiquement des tags aux commandes (source, priorité, type de livraison, etc.)
              </CardDescription>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle règle
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Créer une règle de tag</DialogTitle>
                  <DialogDescription>
                    Définissez les conditions pour appliquer automatiquement un tag
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Nom de la règle</Label>
                    <Input
                      placeholder="Ex: Tag Amazon automatique"
                      value={newRegle.nom_regle}
                      onChange={(e) => setNewRegle({ ...newRegle, nom_regle: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Nom du tag</Label>
                    <Input
                      placeholder="Ex: Amazon, Urgent, Express"
                      value={newRegle.tag}
                      onChange={(e) => setNewRegle({ ...newRegle, tag: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Couleur du tag</Label>
                    <Select value={newRegle.couleur_tag} onValueChange={(val) => setNewRegle({ ...newRegle, couleur_tag: val })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COULEURS_TAGS.map((couleur) => (
                          <SelectItem key={couleur.value} value={couleur.value}>
                            <div className="flex items-center gap-2">
                              <div className={`w-4 h-4 rounded ${couleur.class}`} />
                              {couleur.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Priorité (1 = la plus haute)</Label>
                    <Input
                      type="number"
                      value={newRegle.priorite}
                      onChange={(e) => setNewRegle({ ...newRegle, priorite: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Conditions (JSON)</Label>
                    <Textarea
                      placeholder={`[
  {"field": "source", "operator": "equals", "value": "Amazon"},
  {"field": "methode_expedition", "operator": "contains", "value": "Express"}
]`}
                      value={newRegle.conditions}
                      onChange={(e) => setNewRegle({ ...newRegle, conditions: e.target.value })}
                      className="font-mono text-sm"
                      rows={6}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Champs disponibles: source, methode_expedition, pays_code, valeur_totale, etc.
                      <br />
                      Opérateurs: equals, notEquals, greaterThan, lessThan, contains, in
                    </p>
                  </div>
                  <Button onClick={handleAddRegle} className="w-full">
                    Créer la règle
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Chargement...</div>
          ) : regles.filter((r) => r.actif).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              Aucune règle configurée
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Tag</TableHead>
                  <TableHead>Priorité</TableHead>
                  <TableHead>Conditions</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regles
                  .filter((r) => r.actif)
                  .map((regle) => {
                    const couleurClass = COULEURS_TAGS.find((c) => c.value === regle.couleur_tag)?.class || "bg-gray-500";
                    return (
                      <TableRow key={regle.id}>
                        <TableCell className="font-medium">{regle.nom_regle}</TableCell>
                        <TableCell>
                          <Badge className={`${couleurClass} text-white`}>
                            {regle.tag}
                          </Badge>
                        </TableCell>
                        <TableCell>{regle.priorite}</TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {Array.isArray(regle.conditions) 
                              ? regle.conditions.length 
                              : (typeof regle.conditions === 'object' && regle.conditions 
                                ? Object.keys(regle.conditions).length 
                                : 0)} condition(s)
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">Actif</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRegle(regle.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
