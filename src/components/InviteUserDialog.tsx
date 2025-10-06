import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserPlus, Info } from "lucide-react";

type AppRole = 'admin' | 'operateur' | 'gestionnaire' | 'client';

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function InviteUserDialog({ open, onOpenChange, onSuccess }: InviteUserDialogProps) {
  const [email, setEmail] = useState("");
  const [nomComplet, setNomComplet] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>('client');
  const [clientId, setClientId] = useState<string>("");
  const [clients, setClients] = useState<Array<{ id: string; nom_entreprise: string }>>([]);
  const [loading, setLoading] = useState(false);

  // Charger les clients quand le dialog s'ouvre
  useEffect(() => {
    if (open) {
      fetchClients();
    }
  }, [open]);

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from("client")
      .select("id, nom_entreprise")
      .eq("actif", true)
      .order("nom_entreprise");

    if (!error && data) {
      setClients(data);
    }
  };

  const handleInvite = async () => {
    if (!email || !nomComplet || !password) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    if (role === "client" && !clientId) {
      toast.error("Veuillez sélectionner un client");
      return;
    }

    setLoading(true);
    try {
      // Créer l'utilisateur via signUp
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nom_complet: nomComplet
          },
          emailRedirectTo: `${window.location.origin}/auth`
        }
      });

      if (authError) {
        // Si l'utilisateur existe déjà, envoyer un email de reset password
        if (authError.message.includes('already registered') || authError.message.includes('User already registered')) {
          toast.info("Utilisateur déjà enregistré. Envoi d'un email de réinitialisation...");
          const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth`
          });
          if (resetError) throw resetError;
          toast.success(`Email de réinitialisation envoyé à ${email}`);
          onOpenChange(false);
          return;
        }
        throw authError;
      }
      if (!authData.user) throw new Error("Erreur lors de la création de l'utilisateur");

      // Attendre que le trigger crée le profil
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Upsert le profil avec le client_id si applicable
      const profileData: any = {
        id: authData.user.id,
        email,
        nom_complet: nomComplet
      };
      if (role === "client" && clientId) {
        profileData.client_id = clientId;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(profileData);

      if (profileError) throw profileError;

      // Assigner le rôle
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: authData.user.id,
          role: role
        }, {
          onConflict: 'user_id,role'
        });

      if (roleError) throw roleError;

      toast.success(`Utilisateur ${email} créé avec succès`);
      setEmail("");
      setNomComplet("");
      setPassword("");
      setRole('client');
      setClientId("");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erreur lors de la création de l\'utilisateur:', error);
      toast.error(error.message || "Erreur lors de la création de l'utilisateur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Inviter un nouvel utilisateur
          </DialogTitle>
          <DialogDescription>
            Créer un nouveau compte utilisateur dans le système
          </DialogDescription>
        </DialogHeader>

        <Alert className="my-4">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>Important :</strong> L'utilisateur devra utiliser ce mot de passe temporaire pour sa première connexion.
            Il pourra ensuite le changer via "Mot de passe oublié" ou vous pourrez lui envoyer un email de réinitialisation via le bouton "Reset MDP".
          </AlertDescription>
        </Alert>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="utilisateur@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nom">Nom complet *</Label>
            <Input
              id="nom"
              type="text"
              placeholder="Jean Dupont"
              value={nomComplet}
              onChange={(e) => setNomComplet(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe temporaire *</Label>
            <Input
              id="password"
              type="password"
              placeholder="Minimum 6 caractères"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              L'utilisateur pourra changer ce mot de passe après sa première connexion
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Rôle *</Label>
            <Select value={role} onValueChange={(value: AppRole) => setRole(value)}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrateur</SelectItem>
                <SelectItem value="gestionnaire">Gestionnaire</SelectItem>
                <SelectItem value="operateur">Opérateur</SelectItem>
                <SelectItem value="client">Client</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {role === "client" && (
            <div className="space-y-2">
              <Label htmlFor="client">Client associé *</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger id="client">
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      Aucun client disponible
                    </div>
                  ) : (
                    clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.nom_entreprise}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annuler
          </Button>
          <Button onClick={handleInvite} disabled={loading}>
            {loading ? "Création..." : "Créer l'utilisateur"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
