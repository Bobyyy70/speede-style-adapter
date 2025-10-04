import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";

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
  const [loading, setLoading] = useState(false);

  const handleInvite = async () => {
    if (!email || !nomComplet || !password) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    setLoading(true);
    try {
      // Créer l'utilisateur via l'API Supabase auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nom_complet: nomComplet
          },
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Erreur lors de la création de l'utilisateur");

      // Le trigger PostgreSQL va créer automatiquement le profil et assigner le rôle par défaut
      // Mais on veut assigner le rôle choisi, donc on attend un peu puis on update
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mettre à jour le rôle si différent du défaut
      if (role !== 'client') {
        const { error: roleError } = await supabase
          .from('user_roles')
          .update({ role: role })
          .eq('user_id', authData.user.id);

        if (roleError) {
          console.error('Erreur lors de l\'assignation du rôle:', roleError);
          // On continue quand même car l'utilisateur est créé
        }
      }

      toast.success(`Utilisateur ${email} créé avec succès`);
      setEmail("");
      setNomComplet("");
      setPassword("");
      setRole('client');
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
