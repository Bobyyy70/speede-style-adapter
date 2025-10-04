import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, UserPlus, Mail, Shield, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { EditUserRoleDialog } from "@/components/EditUserRoleDialog";
import { InviteUserDialog } from "@/components/InviteUserDialog";
import { AssignClientDialog } from "@/components/AssignClientDialog";

type AppRole = 'admin' | 'operateur' | 'gestionnaire' | 'client';

interface UserData {
  id: string;
  email: string;
  nom_complet: string | null;
  role: AppRole | null;
  client_id: string | null;
  client_nom: string | null;
}

const Utilisateurs = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editRoleDialog, setEditRoleDialog] = useState<{
    open: boolean;
    userId: string;
    userEmail: string;
    currentRole: AppRole | null;
  }>({ open: false, userId: "", userEmail: "", currentRole: null });
  const [inviteDialog, setInviteDialog] = useState(false);
  const [assignClientDialog, setAssignClientDialog] = useState<{
    open: boolean;
    userId: string;
    userEmail: string;
    currentClientId: string | null;
  }>({ open: false, userId: "", userEmail: "", currentClientId: null });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Récupérer tous les profils avec leurs rôles et clients
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          nom_complet,
          client_id
        `)
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Récupérer les rôles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Récupérer les noms des clients
      const { data: clients, error: clientsError } = await supabase
        .from('client' as any)
        .select('id, nom_entreprise');

      if (clientsError) throw clientsError;

      // Combiner les données
      const usersData: UserData[] = (profiles || []).map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.id);
        const client = (clients as any)?.find((c: any) => c.id === profile.client_id);
        
        return {
          id: profile.id,
          email: profile.email || "",
          nom_complet: profile.nom_complet,
          role: userRole?.role as AppRole || null,
          client_id: profile.client_id,
          client_nom: client?.nom_entreprise || null
        };
      });

      setUsers(usersData);
    } catch (error: any) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
      toast.error("Erreur lors du chargement des utilisateurs");
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (role: AppRole | null) => {
    if (!role) {
      return <Badge variant="outline">Aucun rôle</Badge>;
    }

    const variants: Record<AppRole, any> = {
      admin: "destructive",
      gestionnaire: "default",
      operateur: "secondary",
      client: "outline",
    };

    const labels: Record<AppRole, string> = {
      admin: "Administrateur",
      gestionnaire: "Gestionnaire",
      operateur: "Opérateur",
      client: "Client",
    };

    return <Badge variant={variants[role]}>{labels[role]}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Utilisateurs</h1>
            <p className="text-muted-foreground">
              Gérez les utilisateurs et leurs permissions
            </p>
          </div>
          <Button onClick={() => setInviteDialog(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Nouvel utilisateur
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total utilisateurs</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Administrateurs</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter(u => u.role === 'admin').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Opérateurs</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter(u => u.role === 'operateur').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sans rôle</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {users.filter(u => !u.role).length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Liste des utilisateurs</CardTitle>
            <CardDescription>
              Gérez les comptes utilisateurs, leurs rôles et leurs entreprises
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Chargement...</div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucun utilisateur trouvé
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Nom complet</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Entreprise</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {user.email}
                        </div>
                      </TableCell>
                      <TableCell>{user.nom_complet || "-"}</TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>
                        {user.client_nom ? (
                          <div className="flex items-center gap-2 text-sm">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {user.client_nom}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditRoleDialog({
                              open: true,
                              userId: user.id,
                              userEmail: user.email,
                              currentRole: user.role
                            })}
                          >
                            <Shield className="h-4 w-4 mr-1" />
                            Rôle
                          </Button>
                          {user.role === 'client' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setAssignClientDialog({
                                open: true,
                                userId: user.id,
                                userEmail: user.email,
                                currentClientId: user.client_id
                              })}
                            >
                              <Building2 className="h-4 w-4 mr-1" />
                              Client
                            </Button>
                          )}
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

      <EditUserRoleDialog
        open={editRoleDialog.open}
        onOpenChange={(open) => setEditRoleDialog({ ...editRoleDialog, open })}
        userId={editRoleDialog.userId}
        userEmail={editRoleDialog.userEmail}
        currentRole={editRoleDialog.currentRole}
        currentUserId={currentUser?.id || ""}
        onSuccess={fetchUsers}
      />

      <InviteUserDialog
        open={inviteDialog}
        onOpenChange={setInviteDialog}
        onSuccess={fetchUsers}
      />

      <AssignClientDialog
        open={assignClientDialog.open}
        onOpenChange={(open) => setAssignClientDialog({ ...assignClientDialog, open })}
        userId={assignClientDialog.userId}
        userEmail={assignClientDialog.userEmail}
        currentClientId={assignClientDialog.currentClientId}
        onSuccess={fetchUsers}
      />
    </DashboardLayout>
  );
};

export default Utilisateurs;
