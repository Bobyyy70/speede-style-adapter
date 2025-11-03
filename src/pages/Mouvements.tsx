import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
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
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [produitFilter, setProduitFilter] = useState<string>("all");
  const [dateDebut, setDateDebut] = useState<string>("");
  const [dateFin, setDateFin] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Charger la liste des clients actifs
  const { data: clients } = useQuery({
    queryKey: ["clients-actifs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client")
        .select("id, nom_entreprise")
        .eq("actif", true)
        .order("nom_entreprise");
      if (error) throw error;
      return data;
    },
    enabled: !!user && (userRole === 'admin' || userRole === 'gestionnaire')
  });

  // Charger la liste des produits (filtrés par client si sélectionné)
  const { data: produits } = useQuery({
    queryKey: ["produits-pour-filtre", clientFilter, getViewingClientId()],
    queryFn: async () => {
      let query = supabase
        .from("produit")
        .select("id, nom, reference, client_id")
        .eq("statut_actif", true)
        .order("nom");
      
      const viewingClientId = getViewingClientId();
      if (viewingClientId || userRole === 'client') {
        const clientId = viewingClientId || clientFilter !== "all" ? clientFilter : await (async () => {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("client_id")
            .eq("id", user!.id)
            .single();
          return profileData?.client_id;
        })();
        
        if (clientId && clientId !== "all") {
          query = query.eq("client_id", clientId);
        }
      } else if (clientFilter !== "all") {
        query = query.eq("client_id", clientFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  const { data: mouvements, isLoading } = useQuery({
    queryKey: ["mouvements-detail", user?.id, getViewingClientId(), typeFilter, clientFilter, produitFilter, searchTerm, dateDebut, dateFin],
    queryFn: async () => {
      let query = supabase
        .from("mouvement_stock")
        .select(`
          *,
          produit:produit_id (
            id,
            reference,
            nom,
            client:client_id (
              id,
              nom_entreprise
            )
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
        .order("date_mouvement", { ascending: false })
        .limit(1000);

      // Filtres de date
      if (dateDebut) {
        query = query.gte("date_mouvement", new Date(dateDebut).toISOString());
      }
      if (dateFin) {
        const endDate = new Date(dateFin);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte("date_mouvement", endDate.toISOString());
      }

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
      } else if (clientFilter !== "all") {
        // Admin/Gestionnaire filter by specific client
        const { data: produitsClient } = await supabase
          .from("produit")
          .select("id")
          .eq("client_id", clientFilter);
        
        if (produitsClient) {
          query = query.in("produit_id", produitsClient.map(p => p.id));
        }
      }

      // Filter by product if selected
      if (produitFilter !== "all") {
        query = query.eq("produit_id", produitFilter);
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

  // Pagination
  const totalPages = Math.ceil((filteredMouvements?.length || 0) / itemsPerPage);
  const paginatedMouvements = filteredMouvements?.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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
              <div className="flex flex-wrap gap-3">
                <div className="relative w-[250px]">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                {(userRole === 'admin' || userRole === 'gestionnaire') && (
                  <Select value={clientFilter} onValueChange={(val) => {
                    setClientFilter(val);
                    setProduitFilter("all"); // Reset product filter when client changes
                  }}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Tous les clients" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">🏢 Tous les clients</SelectItem>
                      {clients?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nom_entreprise}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Select value={produitFilter} onValueChange={setProduitFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Tous les produits" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">📦 Tous les produits</SelectItem>
                    {produits?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nom} ({p.reference})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">🔄 Tous les types</SelectItem>
                    <SelectItem value="entrée">📥 Entrée</SelectItem>
                    <SelectItem value="sortie">📤 Sortie</SelectItem>
                    <SelectItem value="réservation">🔒 Réservation</SelectItem>
                    <SelectItem value="ajout">➕ Ajout manuel</SelectItem>
                    <SelectItem value="retrait">➖ Retrait manuel</SelectItem>
                    <SelectItem value="transfert">↔️ Transfert</SelectItem>
                    <SelectItem value="ajustement_inventaire_positif">🔼 Ajustement +</SelectItem>
                    <SelectItem value="ajustement_inventaire_negatif">🔽 Ajustement -</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  type="date"
                  placeholder="Date début"
                  className="w-[150px]"
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                />
                <Input
                  type="date"
                  placeholder="Date fin"
                  className="w-[150px]"
                  value={dateFin}
                  onChange={(e) => setDateFin(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[130px]">📅 Date</TableHead>
                        <TableHead className="w-[150px]">👤 Opérateur</TableHead>
                        <TableHead className="w-[150px]">🏢 Client</TableHead>
                        <TableHead className="w-[200px]">📦 Produit</TableHead>
                        <TableHead className="w-[120px]">🔖 Référence</TableHead>
                        <TableHead className="w-[120px]">🔄 Type</TableHead>
                        <TableHead className="text-right w-[100px]">➕➖ Quantité</TableHead>
                        <TableHead className="text-right w-[100px]">📊 Stock Après</TableHead>
                        <TableHead className="w-[250px]">📝 Raison / Détails</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedMouvements && paginatedMouvements.length > 0 ? (
                        paginatedMouvements.map((mouvement: any) => {
                        return (
                          <TableRow key={mouvement.id}>
                            <TableCell className="text-sm whitespace-nowrap">
                              {format(new Date(mouvement.date_mouvement), "dd/MM/yy HH:mm", { locale: fr })}
                            </TableCell>
                            <TableCell className="text-xs max-w-[150px] truncate">
                              {mouvement.utilisateur?.nom_complet || mouvement.utilisateur?.email || "Système"}
                            </TableCell>
                            <TableCell className="text-sm font-medium max-w-[150px] truncate">
                              {mouvement.produit?.client?.nom_entreprise || "-"}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-sm">
                              {mouvement.produit?.nom || "-"}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {mouvement.produit?.reference || "-"}
                            </TableCell>
                            <TableCell>
                              {mouvement.type_mouvement === "entrée" && (
                                <Badge className="bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-100">
                                  📥 Entrée
                                </Badge>
                              )}
                              {mouvement.type_mouvement === "sortie" && (
                                <Badge className="bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-100">
                                  📤 Sortie
                                </Badge>
                              )}
                              {mouvement.type_mouvement === "réservation" && (
                                <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-100">
                                  🔒 Réservation
                                </Badge>
                              )}
                              {mouvement.type_mouvement === "ajout" && (
                                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-100">
                                  ➕ Ajout
                                </Badge>
                              )}
                              {mouvement.type_mouvement === "retrait" && (
                                <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-100">
                                  ➖ Retrait
                                </Badge>
                              )}
                              {mouvement.type_mouvement === "transfert" && (
                                <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900 dark:text-indigo-100">
                                  ↔️ Transfert
                                </Badge>
                              )}
                              {mouvement.type_mouvement === "ajustement_inventaire_positif" && (
                                <Badge className="bg-teal-100 text-teal-700 hover:bg-teal-200 dark:bg-teal-900 dark:text-teal-100">
                                  🔼 Ajust +
                                </Badge>
                              )}
                              {mouvement.type_mouvement === "ajustement_inventaire_negatif" && (
                                <Badge className="bg-pink-100 text-pink-700 hover:bg-pink-200 dark:bg-pink-900 dark:text-pink-100">
                                  🔽 Ajust -
                                </Badge>
                              )}
                              {!["entrée", "sortie", "réservation", "ajout", "retrait", "transfert", "ajustement_inventaire_positif", "ajustement_inventaire_negatif"].includes(mouvement.type_mouvement) && (
                                <Badge variant="outline">{mouvement.type_mouvement}</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-bold text-lg">
                              {mouvement.quantite > 0 ? (
                                <span className="text-green-600 font-semibold">
                                  +{mouvement.quantite}
                                </span>
                              ) : (
                                <span className="text-red-600 font-semibold">
                                  {mouvement.quantite}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-primary">
                              {mouvement.stock_apres_mouvement !== null ? mouvement.stock_apres_mouvement : "-"}
                            </TableCell>
                            <TableCell className="text-sm max-w-[250px]">
                              <div className="space-y-1">
                                {mouvement.raison && (
                                  <div className="font-medium">{mouvement.raison}</div>
                                )}
                                {mouvement.remarques && (
                                  <div className="text-xs text-muted-foreground truncate">{mouvement.remarques}</div>
                                )}
                                {mouvement.commande_id && (
                                  <div className="text-xs text-muted-foreground">
                                    Commande: {mouvement.commande_id.substring(0, 8)}...
                                  </div>
                                )}
                                {(mouvement.emplacement_source?.code_emplacement || mouvement.emplacement_destination?.code_emplacement) && (
                                  <div className="text-xs text-muted-foreground font-mono">
                                    {mouvement.emplacement_source?.code_emplacement && `De: ${mouvement.emplacement_source.code_emplacement}`}
                                    {mouvement.emplacement_source?.code_emplacement && mouvement.emplacement_destination?.code_emplacement && " → "}
                                    {mouvement.emplacement_destination?.code_emplacement && `Vers: ${mouvement.emplacement_destination.code_emplacement}`}
                                  </div>
                                )}
                                {!mouvement.raison && !mouvement.remarques && !mouvement.commande_id && (
                                  <span className="text-muted-foreground text-xs">Non spécifié</span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={9} className="h-32 text-center">
                            <div className="flex flex-col items-center justify-center text-muted-foreground">
                              <p className="text-lg font-medium">Aucun mouvement de stock trouvé</p>
                              <p className="text-sm mt-1">Les mouvements apparaîtront ici dès qu'ils seront enregistrés</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {paginatedMouvements && paginatedMouvements.length > 0 && totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Page {currentPage} sur {totalPages} ({filteredMouvements?.length || 0} mouvements)
                    </div>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          
                          return (
                            <PaginationItem key={pageNum}>
                              <PaginationLink
                                onClick={() => setCurrentPage(pageNum)}
                                isActive={currentPage === pageNum}
                                className="cursor-pointer"
                              >
                                {pageNum}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        })}
                        <PaginationItem>
                          <PaginationNext 
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Mouvements;
