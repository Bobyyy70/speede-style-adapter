import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Search } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";

const Mouvements = () => {
  const { user, userRole, getViewingClientId } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: mouvements, isLoading } = useQuery({
    queryKey: ["mouvements-detail", user?.id, getViewingClientId(), typeFilter, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("mouvement_stock")
        .select(`
          *,
          produit:produit_id (
            id,
            reference,
            nom
          ),
          emplacement_source:emplacement_source_id (
            code_emplacement
          ),
          emplacement_destination:emplacement_destination_id (
            code_emplacement
          ),
          utilisateur:created_by (
            id,
            nom_complet,
            email
          )
        `)
        .order("date_mouvement", { ascending: false });

      // Filter by client if needed
      const viewingClientId = getViewingClientId();
      if (viewingClientId || userRole === 'client') {
        const clientId = viewingClientId || await (async () => {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("client_id")
            .eq("id", user!.id)
            .single();
          return profileData?.client_id;
        })();

        if (clientId) {
          const { data: produitsClient } = await supabase
            .from("produit")
            .select("id")
            .eq("client_id", clientId);
          
          if (produitsClient) {
            query = query.in("produit_id", produitsClient.map(p => p.id));
          }
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  const filteredMouvements = mouvements?.filter(m => {
    const matchesSearch = searchTerm === "" ||
      m.produit?.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.produit?.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.numero_mouvement.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = typeFilter === "all" || m.type_mouvement === typeFilter;

    return matchesSearch && matchesType;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mouvements de Stock</h1>
          <p className="text-muted-foreground mt-1">
            Historique complet des mouvements avec traçabilité
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Historique des mouvements</CardTitle>
                <CardDescription>Tous les mouvements de stock enregistrés</CardDescription>
              </div>
              <div className="flex gap-4">
                <div className="relative w-[300px]">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Type de mouvement" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    <SelectItem value="entrée">Entrée</SelectItem>
                    <SelectItem value="sortie">Sortie</SelectItem>
                    <SelectItem value="transfert">Transfert</SelectItem>
                    <SelectItem value="réservation">Réservation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredMouvements && filteredMouvements.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>N° Mouvement</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Produit</TableHead>
                      <TableHead>Référence</TableHead>
                      <TableHead className="text-right">Quantité</TableHead>
                      <TableHead>Raison</TableHead>
                      <TableHead>Utilisateur</TableHead>
                      <TableHead>Empl. Source</TableHead>
                      <TableHead>Empl. Destination</TableHead>
                      <TableHead>Remarques</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMouvements.map((mouvement: any) => (
                      <TableRow key={mouvement.id}>
                        <TableCell className="text-sm whitespace-nowrap">
                          {format(new Date(mouvement.date_mouvement), "dd/MM/yyyy HH:mm", { locale: fr })}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{mouvement.numero_mouvement}</TableCell>
                        <TableCell>
                          <Badge variant={
                            mouvement.type_mouvement === "entrée" ? "default" :
                            mouvement.type_mouvement === "sortie" ? "destructive" :
                            "secondary"
                          }>
                            {mouvement.type_mouvement}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{mouvement.produit?.nom || "-"}</TableCell>
                        <TableCell className="font-mono text-sm">{mouvement.produit?.reference || "-"}</TableCell>
                        <TableCell className="text-right font-medium">
                          <span className={mouvement.quantite > 0 ? "text-green-600" : "text-red-600"}>
                            {mouvement.quantite > 0 ? "+" : ""}{mouvement.quantite}
                          </span>
                        </TableCell>
                        <TableCell>
                          {mouvement.raison ? (
                            <Badge variant="outline">{mouvement.raison}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm max-w-[150px] truncate">
                          {mouvement.utilisateur?.nom_complet || mouvement.utilisateur?.email || "-"}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {mouvement.emplacement_source?.code_emplacement || "-"}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {mouvement.emplacement_destination?.code_emplacement || "-"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                          {mouvement.remarques || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Aucun mouvement trouvé
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Mouvements;
