import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Package, Truck } from "lucide-react";

interface TypeCarton {
  id: string;
  nom: string;
  longueur_cm: number;
  largeur_cm: number;
  hauteur_cm: number;
  poids_carton_kg: number;
  volume_m3: number;
  actif: boolean;
}

interface FacteurDivision {
  id: string;
  transporteur_code: string;
  transporteur_nom: string;
  facteur_division: number;
  description: string;
  actif: boolean;
}

export function CalculateurVolumetrique() {
  const [cartons, setCartons] = useState<TypeCarton[]>([]);
  const [facteurs, setFacteurs] = useState<FacteurDivision[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCarton, setNewCarton] = useState({
    nom: "",
    longueur_cm: "",
    largeur_cm: "",
    hauteur_cm: "",
    poids_carton_kg: ""
  });

  useEffect(() => {
    fetchCartons();
    fetchFacteurs();
  }, []);

  const fetchCartons = async () => {
    try {
      const { data, error } = await supabase
        .from("type_carton")
        .select("*")
        .order("volume_m3", { ascending: true });

      if (error) throw error;
      setCartons(data || []);
    } catch (error: any) {
      toast.error("Erreur lors du chargement des cartons");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFacteurs = async () => {
    try {
      const { data, error } = await supabase
        .from("transporteur_facteur_division")
        .select("*")
        .order("transporteur_nom");

      if (error) throw error;
      setFacteurs(data || []);
    } catch (error: any) {
      toast.error("Erreur lors du chargement des facteurs");
      console.error(error);
    }
  };

  const handleAddCarton = async () => {
    if (!newCarton.nom || !newCarton.longueur_cm || !newCarton.largeur_cm || !newCarton.hauteur_cm) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    try {
      const { error } = await supabase.from("type_carton").insert({
        nom: newCarton.nom,
        longueur_cm: parseFloat(newCarton.longueur_cm),
        largeur_cm: parseFloat(newCarton.largeur_cm),
        hauteur_cm: parseFloat(newCarton.hauteur_cm),
        poids_carton_kg: parseFloat(newCarton.poids_carton_kg) || 0
      });

      if (error) throw error;

      toast.success("Type de carton ajouté");
      setNewCarton({ nom: "", longueur_cm: "", largeur_cm: "", hauteur_cm: "", poids_carton_kg: "" });
      fetchCartons();
    } catch (error: any) {
      toast.error("Erreur lors de l'ajout du carton");
      console.error(error);
    }
  };

  const handleDeleteCarton = async (id: string) => {
    try {
      const { error } = await supabase
        .from("type_carton")
        .update({ actif: false })
        .eq("id", id);

      if (error) throw error;
      toast.success("Carton désactivé");
      fetchCartons();
    } catch (error: any) {
      toast.error("Erreur lors de la suppression");
      console.error(error);
    }
  };

  return (
    <Tabs defaultValue="cartons" className="space-y-4">
      <TabsList>
        <TabsTrigger value="cartons">
          <Package className="h-4 w-4 mr-2" />
          Types de Cartons
        </TabsTrigger>
        <TabsTrigger value="facteurs">
          <Truck className="h-4 w-4 mr-2" />
          Facteurs Transporteurs
        </TabsTrigger>
      </TabsList>

      <TabsContent value="cartons" className="space-y-4">
        <Card>
        <CardHeader>
          <CardTitle>Ajouter un type de carton</CardTitle>
          <CardDescription>
            Définissez les dimensions des cartons utilisés pour calculer automatiquement le poids volumétrique
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label>Nom du carton</Label>
              <Input
                placeholder="Ex: Carton S"
                value={newCarton.nom}
                onChange={(e) => setNewCarton({ ...newCarton, nom: e.target.value })}
              />
            </div>
            <div>
              <Label>Longueur (cm)</Label>
              <Input
                type="number"
                placeholder="40"
                value={newCarton.longueur_cm}
                onChange={(e) => setNewCarton({ ...newCarton, longueur_cm: e.target.value })}
              />
            </div>
            <div>
              <Label>Largeur (cm)</Label>
              <Input
                type="number"
                placeholder="30"
                value={newCarton.largeur_cm}
                onChange={(e) => setNewCarton({ ...newCarton, largeur_cm: e.target.value })}
              />
            </div>
            <div>
              <Label>Hauteur (cm)</Label>
              <Input
                type="number"
                placeholder="20"
                value={newCarton.hauteur_cm}
                onChange={(e) => setNewCarton({ ...newCarton, hauteur_cm: e.target.value })}
              />
            </div>
            <div>
              <Label>Poids carton (kg)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.5"
                value={newCarton.poids_carton_kg}
                onChange={(e) => setNewCarton({ ...newCarton, poids_carton_kg: e.target.value })}
              />
            </div>
          </div>
          <Button onClick={handleAddCarton} className="mt-4">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter le carton
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Types de cartons configurés</CardTitle>
          <CardDescription>
            Liste des cartons disponibles pour le calcul automatique
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Chargement...</div>
          ) : cartons.filter((c) => c.actif).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              Aucun type de carton configuré
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Dimensions (L×l×H)</TableHead>
                  <TableHead>Volume</TableHead>
                  <TableHead>Poids carton</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cartons
                  .filter((c) => c.actif)
                  .map((carton) => (
                    <TableRow key={carton.id}>
                      <TableCell className="font-medium">{carton.nom}</TableCell>
                      <TableCell>
                        {carton.longueur_cm} × {carton.largeur_cm} × {carton.hauteur_cm} cm
                      </TableCell>
                      <TableCell>{(carton.volume_m3 * 1000).toFixed(2)} L</TableCell>
                      <TableCell>{carton.poids_carton_kg} kg</TableCell>
                      <TableCell>
                        <Badge variant="secondary">Actif</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCarton(carton.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </TabsContent>

      <TabsContent value="facteurs">
        <Card>
          <CardHeader>
            <CardTitle>Facteurs de Division par Transporteur</CardTitle>
            <CardDescription>
              Configurez les diviseurs volumétriques utilisés par chaque transporteur pour calculer le poids facturable
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Chargement...</div>
            ) : facteurs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                Aucun facteur configuré
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transporteur</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Facteur de Division</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {facteurs.map((facteur) => (
                    <TableRow key={facteur.id}>
                      <TableCell className="font-medium">{facteur.transporteur_nom}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{facteur.transporteur_code}</Badge>
                      </TableCell>
                      <TableCell className="font-mono">
                        {facteur.facteur_division} cm³/kg
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {facteur.description}
                      </TableCell>
                      <TableCell>
                        {facteur.actif ? (
                          <Badge variant="secondary">Actif</Badge>
                        ) : (
                          <Badge variant="outline">Inactif</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            
            <div className="mt-6 bg-muted/50 rounded-lg p-4 text-sm space-y-2">
              <p className="font-medium">Formule de calcul:</p>
              <code className="block">
                Poids volumétrique (kg) = (Longueur × Largeur × Hauteur en cm) ÷ Facteur de division
              </code>
              <p className="text-muted-foreground mt-2">
                Le transporteur facture sur la base du <strong>poids le plus élevé</strong> entre le poids réel et le poids volumétrique.
              </p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
