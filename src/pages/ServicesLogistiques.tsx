import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Euro, Filter, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ServicesLogistiques() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categorieFilter, setCategorieFilter] = useState<string>("all");

  const { data: services, isLoading } = useQuery({
    queryKey: ["services-logistiques"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_logistique")
        .select("*")
        .order("categorie", { ascending: true })
        .order("nom_service", { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  const filteredServices = services?.filter(service => {
    const matchesSearch = service.nom_service.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         service.code_service.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategorie = categorieFilter === "all" || service.categorie === categorieFilter;
    return matchesSearch && matchesCategorie;
  });

  const getCategoryLabel = (categorie: string) => {
    const labels: Record<string, string> = {
      base: "Services de Base",
      pcb_volumineux: "PCB/Volumineux",
      mise_en_stock: "Mise en Stock",
      retours: "Retours",
      optionnel: "Services Optionnels",
    };
    return labels[categorie] || categorie;
  };

  const getCategoryVariant = (categorie: string): "default" | "secondary" | "outline" => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      base: "default",
      pcb_volumineux: "secondary",
      mise_en_stock: "outline",
      retours: "outline",
      optionnel: "secondary",
    };
    return variants[categorie] || "default";
  };

  const getTypeFacturationLabel = (type: string) => {
    const labels: Record<string, string> = {
      par_commande: "Par commande",
      par_produit: "Par produit",
      par_kg: "Par kg",
      par_bac: "Par bac",
      forfait: "Forfait",
    };
    return labels[type] || type;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Services Logistiques</h1>
          <p className="text-muted-foreground">Gestion des services et tarifs de facturation automatique</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Services Actifs</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{services?.filter(s => s.actif).length || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Catégories</CardTitle>
              <Filter className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">5</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tarif Moyen</CardTitle>
              <Euro className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {services?.length ? (services.reduce((acc, s) => acc + Number(s.prix_unitaire), 0) / services.length).toFixed(2) : "0.00"}€
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Catalogue des Services</CardTitle>
                <CardDescription>Liste complète des services de facturation automatique</CardDescription>
              </div>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nouveau Service
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Rechercher un service..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={categorieFilter} onValueChange={setCategorieFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes catégories</SelectItem>
                  <SelectItem value="base">Services de Base</SelectItem>
                  <SelectItem value="pcb_volumineux">PCB/Volumineux</SelectItem>
                  <SelectItem value="mise_en_stock">Mise en Stock</SelectItem>
                  <SelectItem value="retours">Retours</SelectItem>
                  <SelectItem value="optionnel">Services Optionnels</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Chargement...</div>
              ) : filteredServices?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Aucun service trouvé</div>
              ) : (
                filteredServices?.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{service.nom_service}</h3>
                        <Badge variant={getCategoryVariant(service.categorie)}>
                          {getCategoryLabel(service.categorie)}
                        </Badge>
                        {!service.actif && <Badge variant="outline">Inactif</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{service.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Code: {service.code_service}</span>
                        <span>•</span>
                        <span>Type: {getTypeFacturationLabel(service.type_facturation)}</span>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-2xl font-bold">{Number(service.prix_unitaire).toFixed(2)}€</div>
                      <div className="text-xs text-muted-foreground">{getTypeFacturationLabel(service.type_facturation)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
