import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Grid3x3, Archive, AlertCircle, Plus, Minus, Warehouse, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GenererEmplacementsDialog } from "@/components/GenererEmplacementsDialog";
import { AjouterStockDialog } from "@/components/AjouterStockDialog";
import { RetirerStockDialog } from "@/components/RetirerStockDialog";
import { useAuth } from "@/hooks/useAuth";

const Emplacements = () => {
  const { userRole } = useAuth();
  const isAdmin = userRole === 'admin';
  
  const [genererOpen, setGenererOpen] = useState(false);
  const [ajouterOpen, setAjouterOpen] = useState(false);
  const [retirerOpen, setRetirerOpen] = useState(false);
  const [selectedEmplacement, setSelectedEmplacement] = useState<any>(null);
  
  const [filterZone, setFilterZone] = useState<string>("all");
  const [filterStatut, setFilterStatut] = useState<string>("all");
  const [searchCode, setSearchCode] = useState("");

  const { data: emplacements, isLoading, refetch } = useQuery({
    queryKey: ['emplacements', filterZone, filterStatut, searchCode],
    queryFn: async () => {
      let query = supabase
        .from('emplacement')
        .select(`
          *,
          produit:produit_actuel_id(id, reference, nom)
        `)
        .order('code_emplacement');

      if (filterZone !== "all") {
        query = query.eq('zone', filterZone);
      }
      if (filterStatut !== "all") {
        query = query.eq('statut_actuel', filterStatut);
      }
      if (searchCode) {
        query = query.ilike('code_emplacement', `%${searchCode}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const zones = Array.from(new Set(emplacements?.map(e => e.zone) || [])).sort();

  const stats = {
    total: emplacements?.length || 0,
    occupes: emplacements?.filter(e => e.statut_actuel === 'occupé').length || 0,
    disponibles: emplacements?.filter(e => e.statut_actuel === 'disponible').length || 0,
    bloques: emplacements?.filter(e => e.statut_actuel === 'bloqué').length || 0,
  };

  const tauxOccupation = stats.total > 0 ? ((stats.occupes / stats.total) * 100).toFixed(1) : "0";

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case 'disponible':
        return <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-200">Disponible</Badge>;
      case 'occupé':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-200">Occupé</Badge>;
      case 'bloqué':
        return <Badge variant="destructive">Bloqué</Badge>;
      default:
        return <Badge variant="outline">{statut}</Badge>;
    }
  };

  const handleAjouterStock = (emplacement: any) => {
    setSelectedEmplacement(emplacement);
    setAjouterOpen(true);
  };

  const handleRetirerStock = (emplacement: any) => {
    setSelectedEmplacement(emplacement);
    setRetirerOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Emplacements</h1>
            <p className="text-muted-foreground mt-1">
              Cartographie et gestion de l'entrepôt
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => setGenererOpen(true)}>
              <Warehouse className="mr-2 h-4 w-4" />
              Générer emplacements
            </Button>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Grid3x3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Emplacements</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Occupés</CardTitle>
              <Archive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.occupes}</div>
              <p className="text-xs text-muted-foreground">{tauxOccupation}% taux occupation</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Disponibles</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.disponibles}</div>
              <p className="text-xs text-muted-foreground">Libres</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bloqués</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.bloques}</div>
              <p className="text-xs text-muted-foreground">Maintenance</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Liste des emplacements</CardTitle>
                <CardDescription>Gérer les stocks par emplacement</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-4 flex-wrap">
                <Input
                  placeholder="Rechercher par code..."
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  className="max-w-xs"
                />
                <Select value={filterZone} onValueChange={setFilterZone}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrer par zone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les zones</SelectItem>
                    {zones.map(zone => (
                      <SelectItem key={zone} value={zone}>{zone}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterStatut} onValueChange={setFilterStatut}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrer par statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="disponible">Disponible</SelectItem>
                    <SelectItem value="occupé">Occupé</SelectItem>
                    <SelectItem value="bloqué">Bloqué</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : emplacements && emplacements.length > 0 ? (
                <div className="space-y-2">
                  {emplacements.map((emplacement) => (
                    <div key={emplacement.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-medium">{emplacement.code_emplacement}</span>
                          {getStatutBadge(emplacement.statut_actuel)}
                          <span className="text-sm text-muted-foreground">Zone {emplacement.zone}</span>
                        </div>
                        {emplacement.produit && (
                          <div className="mt-1 text-sm text-muted-foreground">
                            {emplacement.produit.reference} - {emplacement.produit.nom}
                          </div>
                        )}
                        <div className="mt-1 text-sm">
                          <span className="font-medium">{emplacement.quantite_actuelle || 0}</span>
                          {(emplacement as any).capacite_max_unites && (
                            <span className="text-muted-foreground"> / {(emplacement as any).capacite_max_unites} unités</span>
                          )}
                          {(emplacement as any).capacite_max_kg && (
                            <span className="text-muted-foreground ml-2">({(emplacement as any).capacite_max_kg} kg max)</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAjouterStock(emplacement)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Ajouter
                        </Button>
                        {emplacement.quantite_actuelle > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRetirerStock(emplacement)}
                          >
                            <Minus className="h-4 w-4 mr-1" />
                            Retirer
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {stats.total === 0 ? (
                    <>
                      <p>Aucun emplacement créé.</p>
                      {isAdmin && (
                        <p className="mt-2">Cliquez sur "Générer emplacements" pour commencer.</p>
                      )}
                    </>
                  ) : (
                    <p>Aucun emplacement trouvé avec ces filtres.</p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <GenererEmplacementsDialog
        open={genererOpen}
        onOpenChange={setGenererOpen}
        onSuccess={refetch}
      />

      <AjouterStockDialog
        open={ajouterOpen}
        onOpenChange={setAjouterOpen}
        emplacement={selectedEmplacement}
        onSuccess={refetch}
      />

      <RetirerStockDialog
        open={retirerOpen}
        onOpenChange={setRetirerOpen}
        emplacement={selectedEmplacement}
        produitNom={selectedEmplacement?.produit?.nom}
        onSuccess={refetch}
      />
    </DashboardLayout>
  );
};

export default Emplacements;
