import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Users, Trash2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";

interface ClientUser {
  id: string;
  email: string;
  nom_complet: string;
  created_at: string;
}

interface UserStats {
  current_users: number;
  max_users: number;
  remaining_slots: number;
}

export const ClientUserManagement = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [users, setUsers] = useState<ClientUser[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // Form state
  const [email, setEmail] = useState("");
  const [nomComplet, setNomComplet] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    fetchUsersAndStats();
  }, []);

  const fetchUsersAndStats = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Get client_id from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("client_id")
        .eq("id", user.id)
        .single();

      if (!profile?.client_id) {
        toast({
          title: "Erreur",
          description: "Profil client non trouvé",
          variant: "destructive",
        });
        return;
      }

      // Get users stats
      const { data: statsData } = await supabase
        .from("client_user_stats")
        .select("*")
        .eq("client_id", profile.client_id)
        .single();

      if (statsData) {
        setStats({
          current_users: statsData.current_users,
          max_users: statsData.max_users,
          remaining_slots: statsData.remaining_slots,
        });
      }

      // Get all users for this client
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, email, nom_complet, created_at")
        .eq("client_id", profile.client_id)
        .order("created_at", { ascending: false });

      if (profilesData) {
        setUsers(profilesData);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les utilisateurs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!email || !nomComplet || !password) {
      toast({
        title: "Erreur",
        description: "Tous les champs sont obligatoires",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: "Erreur",
        description: "Le mot de passe doit contenir au moins 8 caractères",
        variant: "destructive",
      });
      return;
    }

    // Check if can create more users
    if (stats && stats.remaining_slots <= 0) {
      toast({
        title: "Limite atteinte",
        description: `Vous avez atteint la limite de ${stats.max_users} utilisateurs`,
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      // Get client_id from current user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("client_id")
        .eq("id", user?.id)
        .single();

      if (!profile?.client_id) {
        throw new Error("Client ID non trouvé");
      }

      // Check limit via function
      const { data: canCreate } = await supabase.rpc("can_client_create_user", {
        _client_id: profile.client_id,
      });

      if (!canCreate) {
        toast({
          title: "Limite atteinte",
          description: "Impossible de créer plus d'utilisateurs",
          variant: "destructive",
        });
        setCreating(false);
        return;
      }

      // Create user via auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nom_complet: nomComplet,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        // Update profile with client_id
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ 
            client_id: profile.client_id,
            nom_complet: nomComplet,
          })
          .eq("id", authData.user.id);

        if (profileError) throw profileError;

        // Assign client role
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({
            user_id: authData.user.id,
            role: "client",
          });

        if (roleError) throw roleError;

        toast({
          title: "Utilisateur créé",
          description: `${email} a été ajouté avec succès`,
        });

        // Reset form and close dialog
        setEmail("");
        setNomComplet("");
        setPassword("");
        setShowCreateDialog(false);
        
        // Refresh list
        fetchUsersAndStats();
      }
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer l'utilisateur",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const canCreateUser = stats ? stats.remaining_slots > 0 : false;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Gestion des utilisateurs
              </CardTitle>
              <CardDescription>
                Gérez les comptes utilisateurs de votre entreprise
              </CardDescription>
            </div>
            {stats && (
              <div className="text-right">
                <div className="text-2xl font-bold">
                  {stats.current_users} / {stats.max_users}
                </div>
                <p className="text-sm text-muted-foreground">
                  {stats.remaining_slots} place{stats.remaining_slots > 1 ? 's' : ''} restante{stats.remaining_slots > 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canCreateUser && stats && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Limite de {stats.max_users} utilisateurs atteinte. Contactez l'administrateur pour augmenter votre quota.
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={() => setShowCreateDialog(true)}
            disabled={!canCreateUser || loading}
            className="w-full"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Créer un nouvel utilisateur
          </Button>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Chargement...
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun utilisateur
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom complet</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Créé le</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.nom_complet || "-"}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      {new Date(u.created_at).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">Client</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un nouvel utilisateur</DialogTitle>
            <DialogDescription>
              Ajoutez un nouveau membre à votre équipe. Il recevra un email de confirmation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nom_complet">Nom complet *</Label>
              <Input
                id="nom_complet"
                placeholder="Jean Dupont"
                value={nomComplet}
                onChange={(e) => setNomComplet(e.target.value)}
                disabled={creating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="jean.dupont@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={creating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe temporaire *</Label>
              <Input
                id="password"
                type="password"
                placeholder="Min. 8 caractères"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={creating}
              />
              <p className="text-xs text-muted-foreground">
                L'utilisateur pourra changer son mot de passe après sa première connexion
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={creating}
            >
              Annuler
            </Button>
            <Button onClick={handleCreateUser} disabled={creating}>
              {creating ? "Création..." : "Créer l'utilisateur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
