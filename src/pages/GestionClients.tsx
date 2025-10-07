import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, Plus, Pencil, Users, Search, Loader2, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Client {
  id: string;
  nom_entreprise: string;
  email_contact: string | null;
  telephone: string | null;
  adresse: string | null;
  siret: string | null;
  date_creation: string;
  actif: boolean;
  remarques: string | null;
}

const GestionClients = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    nom_entreprise: "",
    email_contact: "",
    telephone: "",
    adresse: "",
    siret: "",
    remarques: "",
    actif: true
  });

  // États pour la recherche d'entreprise
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('client')
        .select('*')
        .order('date_creation', { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (error: any) {
      console.error('Erreur lors du chargement des clients:', error);
      toast.error("Erreur lors du chargement des clients");
    } finally {
      setLoading(false);
    }
  };

  // Recherche d'entreprise avec debounce
  const searchEntreprises = async (query: string) => {
    if (!query || query.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('recherche-entreprise', {
        body: { action: 'search', query },
      });

      if (error) throw error;
      setSearchResults(data.results || []);
    } catch (error: any) {
      console.error("Erreur recherche entreprise:", error);
      toast.error("Erreur lors de la recherche");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Récupérer les détails d'une entreprise
  const fetchEntrepriseDetails = async (siret: string) => {
    try {
      toast.loading("Récupération des informations...");
      const { data, error } = await supabase.functions.invoke('recherche-entreprise', {
        body: { action: 'details', siret },
      });

      if (error) throw error;

      const details = data.details;
      setFormData({
        ...formData,
        nom_entreprise: details.nom_entreprise || "",
        siret: details.siret || "",
        adresse: details.adresse || "",
        telephone: details.telephone || "",
        email_contact: details.email || "",
      });

      setSearchOpen(false);
      toast.dismiss();
      toast.success("Informations récupérées avec succès");
    } catch (error: any) {
      console.error("Erreur détails entreprise:", error);
      toast.dismiss();
      toast.error("Erreur lors de la récupération des détails");
    }
  };

  // Gestion du debounce pour la recherche
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      searchEntreprises(value);
    }, 300);

    setSearchTimeout(timeout);
  };

  const handleOpenDialog = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        nom_entreprise: client.nom_entreprise,
        email_contact: client.email_contact || "",
        telephone: client.telephone || "",
        adresse: client.adresse || "",
        siret: client.siret || "",
        remarques: client.remarques || "",
        actif: client.actif
      });
    } else {
      setEditingClient(null);
      setFormData({
        nom_entreprise: "",
        email_contact: "",
        telephone: "",
        adresse: "",
        siret: "",
        remarques: "",
        actif: true
      });
      setSearchQuery("");
      setSearchResults([]);
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nom_entreprise.trim()) {
      toast.error("Le nom de l'entreprise est obligatoire");
      return;
    }

    try {
      if (editingClient) {
        const { error } = await supabase
          .from('client')
          .update(formData)
          .eq('id', editingClient.id);

        if (error) throw error;
        toast.success("Client modifié avec succès");
      } else {
        const { error } = await supabase
          .from('client')
          .insert([formData]);

        if (error) {
          // Message plus explicite pour les erreurs RLS
          if (error.message.includes('row-level security') || error.message.includes('block_public_insert_client')) {
            toast.error("Vous devez avoir le rôle Administrateur pour créer des clients. Veuillez contacter votre administrateur système.");
          } else {
            toast.error(error.message);
          }
          throw error;
        }
        toast.success("Client créé avec succès");
      }

      setDialogOpen(false);
      setSearchQuery("");
      setSearchResults([]);
      fetchClients();
    } catch (error: any) {
      console.error('Erreur lors de l\'enregistrement:', error);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gestion des Clients</h1>
            <p className="text-muted-foreground">
              Gérez les entreprises clientes et leurs informations
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau client
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total clients</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clients.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clients actifs</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {clients.filter(c => c.actif).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clients inactifs</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {clients.filter(c => !c.actif).length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Liste des clients</CardTitle>
            <CardDescription>
              Gérez les informations des entreprises clientes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Chargement...</div>
            ) : clients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucun client trouvé
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entreprise</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>SIRET</TableHead>
                    <TableHead>Date création</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {client.nom_entreprise}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {client.email_contact && <div>{client.email_contact}</div>}
                          {client.telephone && <div className="text-muted-foreground">{client.telephone}</div>}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {client.siret || "-"}
                      </TableCell>
                      <TableCell>
                        {format(new Date(client.date_creation), "dd MMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={client.actif ? "default" : "secondary"}>
                          {client.actif ? "Actif" : "Inactif"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              localStorage.setItem("viewingAsClient", client.id);
                              navigate(`/client/dashboard?asClient=${client.id}`);
                              toast.success(`Mode Vue Client activé pour ${client.nom_entreprise}`);
                            }}
                            title="Voir comme client"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(client)}
                          >
                            <Pencil className="h-4 w-4" />
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
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingClient ? "Modifier le client" : "Nouveau client"}
            </DialogTitle>
            <DialogDescription>
              {editingClient ? "Modifier les informations du client" : "Créer une nouvelle entreprise cliente"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nom">Nom de l'entreprise *</Label>
                <div className="flex gap-2">
                  <Input
                    id="nom"
                    value={formData.nom_entreprise}
                    onChange={(e) => setFormData({ ...formData, nom_entreprise: e.target.value })}
                    placeholder="Nom de l'entreprise"
                    className="flex-1"
                  />
                  <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="icon" type="button">
                        <Search className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Rechercher une entreprise..."
                          value={searchQuery}
                          onValueChange={handleSearchChange}
                        />
                        <CommandList>
                          {isSearching && (
                            <div className="flex items-center justify-center py-6">
                              <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                          )}
                          {!isSearching && searchResults.length === 0 && searchQuery.length >= 3 && (
                            <CommandEmpty>Aucune entreprise trouvée.</CommandEmpty>
                          )}
                          {!isSearching && searchResults.length === 0 && searchQuery.length < 3 && (
                            <CommandEmpty>Tapez au moins 3 caractères...</CommandEmpty>
                          )}
                          {!isSearching && searchResults.length > 0 && (
                            <CommandGroup>
                              {searchResults.map((result, index) => (
                                <CommandItem
                                  key={index}
                                  value={result.siret}
                                  onSelect={() => fetchEntrepriseDetails(result.siret)}
                                >
                                  <div className="flex flex-col">
                                    <span className="font-medium">{result.nom}</span>
                                    <span className="text-sm text-muted-foreground">
                                      SIRET: {result.siret} • {result.adresse_simple}
                                    </span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cliquez sur l'icône de recherche pour trouver une entreprise française
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="siret">SIRET</Label>
                <Input
                  id="siret"
                  value={formData.siret}
                  onChange={(e) => setFormData({ ...formData, siret: e.target.value })}
                  placeholder="12345678901234"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email de contact</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email_contact}
                  onChange={(e) => setFormData({ ...formData, email_contact: e.target.value })}
                  placeholder="contact@entreprise.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tel">Téléphone</Label>
                <Input
                  id="tel"
                  value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                  placeholder="01 23 45 67 89"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adresse">Adresse</Label>
              <Textarea
                id="adresse"
                value={formData.adresse}
                onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                placeholder="Adresse complète de l'entreprise"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="remarques">Remarques</Label>
              <Textarea
                id="remarques"
                value={formData.remarques}
                onChange={(e) => setFormData({ ...formData, remarques: e.target.value })}
                placeholder="Notes ou informations complémentaires"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave}>
              {editingClient ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default GestionClients;
