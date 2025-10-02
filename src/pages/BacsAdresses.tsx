import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Box, MapPin, Package, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function BacsAdresses() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statutFilter, setStatutFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: bacs, isLoading } = useQuery({
    queryKey: ["bacs-adresses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bac_adresse")
        .select(`
          *,
          produit:produit_actuel_id(reference, nom)
        `)
        .order("zone", { ascending: true })
        .order("code_bac", { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  const filteredBacs = bacs?.filter(bac => {
    const matchesSearch = bac.code_bac.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         bac.zone.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatut = statutFilter === "all" || bac.statut === statutFilter;
    const matchesType = typeFilter === "all" || bac.type_bac === typeFilter;
    return matchesSearch && matchesStatut && matchesType;
  });

  const getStatutBadge = (statut: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; label: string }> = {
      disponible: { variant: "default", label: "Disponible" },
      occupe: { variant: "secondary", label: "Occupé" },
      reserve: { variant: "outline", label: "Réservé" },
      maintenance: { variant: "destructive", label: "Maintenance" },
    };
    return variants[statut] || { variant: "outline", label: statut };
  };

  const getTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      petit: "Petit",
      moyen: "Moyen",
      grand: "Grand",
    };
    return labels[type] || type;
  };

  const stats = {
    total: bacs?.length || 0,
    disponibles: bacs?.filter(b => b.statut === "disponible").length || 0,
    occupes: bacs?.filter(b => b.statut === "occupe").length || 0,
    tauxOccupation: bacs?.length ? ((bacs.filter(b => b.statut === "occupe").length / bacs.length) * 100).toFixed(1) : "0",
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Bacs & Adresses</h1>
          <p className="text-muted-foreground">Système d'adressage pour le stockage en bacs</p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Bacs</CardTitle>
              <Box className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Disponibles</CardTitle>
              <Package className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.disponibles}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Occupés</CardTitle>
              <MapPin className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.occupes}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taux d'Occupation</CardTitle>
              <Box className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.tauxOccupation}%</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Liste des Bacs</CardTitle>
                <CardDescription>Gestion des emplacements de stockage en bacs</CardDescription>
              </div>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nouveau Bac
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Rechercher un bac..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={statutFilter} onValueChange={setStatutFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  <SelectItem value="disponible">Disponible</SelectItem>
                  <SelectItem value="occupe">Occupé</SelectItem>
                  <SelectItem value="reserve">Réservé</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous types</SelectItem>
                  <SelectItem value="petit">Petit</SelectItem>
                  <SelectItem value="moyen">Moyen</SelectItem>
                  <SelectItem value="grand">Grand</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Chargement...</div>
              ) : filteredBacs?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Aucun bac trouvé</div>
              ) : (
                filteredBacs?.map((bac) => {
                  const statutBadge = getStatutBadge(bac.statut);
                  return (
                    <div
                      key={bac.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium font-mono">{bac.code_bac}</h3>
                          <Badge variant={statutBadge.variant}>{statutBadge.label}</Badge>
                          <Badge variant="outline">{getTypeBadge(bac.type_bac)}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Zone: {bac.zone}</span>
                          {bac.allee && <><span>•</span><span>Allée: {bac.allee}</span></>}
                          {bac.niveau && <><span>•</span><span>Niveau: {bac.niveau}</span></>}
                          {bac.position && <><span>•</span><span>Position: {bac.position}</span></>}
                        </div>
                        {bac.produit && (
                          <div className="text-sm text-muted-foreground">
                            Contient: {bac.produit.reference} - {bac.produit.nom} (x{bac.quantite_actuelle})
                          </div>
                        )}
                      </div>
                      <div className="text-right ml-4 text-sm">
                        <div className="font-medium">{bac.capacite_max_kg} kg</div>
                        <div className="text-muted-foreground">{bac.capacite_max_volume} m³</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
