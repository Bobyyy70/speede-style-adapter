import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Link2, Loader2, Users, Building2 } from "lucide-react";

interface UserWithoutClient {
  id: string;
  email: string;
  nom_complet: string;
  role: string;
  created_at: string;
  client_id: string | null;
}

interface Client {
  id: string;
  nom_entreprise: string;
  email_contact: string;
  actif: boolean;
}

export default function AssignClientToUser() {
  const [usersWithoutClient, setUsersWithoutClient] = useState<UserWithoutClient[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [selectedClients, setSelectedClients] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch users without client_id
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select(`
          id,
          email,
          nom_complet,
          client_id,
          created_at
        `)
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Get roles for each user
      const usersWithRoles = await Promise.all(
        (profilesData || []).map(async (profile) => {
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", profile.id)
            .maybeSingle();

          return {
            ...profile,
            role: roleData?.role || "N/A",
          };
        })
      );

      setUsersWithoutClient(usersWithRoles);

      // Fetch all active clients
      const { data: clientsData, error: clientsError } = await supabase
        .from("client")
        .select("id, nom_entreprise, email_contact, actif")
        .eq("actif", true)
        .order("nom_entreprise", { ascending: true });

      if (clientsError) throw clientsError;

      setClients(clientsData || []);
    } catch (error: any) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const handleAssignClient = async (userId: string, clientId: string) => {
    if (!clientId) {
      toast.error("Veuillez sélectionner un client");
      return;
    }

    setAssigning(userId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ client_id: clientId })
        .eq("id", userId);

      if (error) throw error;

      toast.success("Client assigné avec succès");

      // Refresh data
      await fetchData();
    } catch (error: any) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de l'assignation du client");
    } finally {
      setAssigning(null);
    }
  };

  const handleCreateAndAssignClient = async (userId: string, userEmail: string, nomComplet: string) => {
    setAssigning(userId);
    try {
      // Create a new client based on user info
      const { data: newClient, error: clientError } = await supabase
        .from("client")
        .insert({
          nom_entreprise: nomComplet || userEmail,
          email_contact: userEmail,
          actif: true,
        })
        .select()
        .single();

      if (clientError) throw clientError;

      // Assign the new client to the user
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ client_id: newClient.id })
        .eq("id", userId);

      if (updateError) throw updateError;

      toast.success("Client créé et assigné avec succès");

      // Refresh data
      await fetchData();
    } catch (error: any) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la création du client");
    } finally {
      setAssigning(null);
    }
  };

  const usersWithoutClientId = usersWithoutClient.filter(u => !u.client_id);
  const usersWithClientId = usersWithoutClient.filter(u => u.client_id);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Assignation des Clients</h1>
            <p className="text-muted-foreground">
              Gérez l'assignation des utilisateurs aux clients
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Utilisateurs</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{usersWithoutClient.length}</div>
              <p className="text-xs text-muted-foreground">Dans le système</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sans Client</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{usersWithoutClientId.length}</div>
              <p className="text-xs text-muted-foreground">
                {Math.round((usersWithoutClientId.length / usersWithoutClient.length) * 100)}% du total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clients Actifs</CardTitle>
              <Building2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clients.length}</div>
              <p className="text-xs text-muted-foreground">Disponibles</p>
            </CardContent>
          </Card>
        </div>

        {/* Alert if users without client */}
        {usersWithoutClientId.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>{usersWithoutClientId.length} utilisateur(s)</strong> n'ont pas de client_id assigné.
              Ces utilisateurs ne pourront pas accéder à leurs données (commandes, produits, mouvements, retours).
            </AlertDescription>
          </Alert>
        )}

        {/* Users without client_id */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Utilisateurs Sans Client ({usersWithoutClientId.length})
            </CardTitle>
            <CardDescription>
              Ces utilisateurs doivent être assignés à un client pour accéder aux données
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-muted-foreground mt-2">Chargement...</p>
              </div>
            ) : usersWithoutClientId.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-2" />
                <p className="text-muted-foreground">Tous les utilisateurs ont un client assigné</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Nom Complet</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Créé le</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersWithoutClientId.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>{user.nom_complet || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString("fr-FR")}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Select
                            value={selectedClients[user.id] || ""}
                            onValueChange={(value) =>
                              setSelectedClients({ ...selectedClients, [user.id]: value })
                            }
                            disabled={assigning === user.id}
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder="Sélectionner un client" />
                            </SelectTrigger>
                            <SelectContent>
                              {clients.map((client) => (
                                <SelectItem key={client.id} value={client.id}>
                                  {client.nom_entreprise}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            onClick={() => handleAssignClient(user.id, selectedClients[user.id])}
                            disabled={!selectedClients[user.id] || assigning === user.id}
                          >
                            {assigning === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Link2 className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCreateAndAssignClient(user.id, user.email, user.nom_complet)}
                            disabled={assigning === user.id}
                          >
                            {assigning === user.id ? "..." : "Créer Client"}
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

        {/* Users with client_id */}
        {usersWithClientId.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Utilisateurs Avec Client ({usersWithClientId.length})
              </CardTitle>
              <CardDescription>
                Ces utilisateurs ont déjà un client assigné
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Nom Complet</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Client ID</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersWithClientId.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>{user.nom_complet || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{user.client_id}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Configuré
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
