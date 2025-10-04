import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield } from "lucide-react";

type AppRole = 'admin' | 'operateur' | 'gestionnaire' | 'client';

interface EditUserRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userEmail: string;
  currentRole: AppRole | null;
  currentUserId: string;
  onSuccess: () => void;
}

export function EditUserRoleDialog({
  open,
  onOpenChange,
  userId,
  userEmail,
  currentRole,
  currentUserId,
  onSuccess
}: EditUserRoleDialogProps) {
  const [selectedRole, setSelectedRole] = useState<AppRole>(currentRole || 'client');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    // Empêcher un admin de retirer son propre rôle admin
    if (userId === currentUserId && currentRole === 'admin' && selectedRole !== 'admin') {
      toast.error("Impossible de retirer votre propre rôle administrateur");
      return;
    }

    setLoading(true);
    try {
      if (currentRole) {
        // Mettre à jour le rôle existant
        const { error: updateError } = await supabase
          .from('user_roles')
          .update({ role: selectedRole })
          .eq('user_id', userId);

        if (updateError) throw updateError;
        toast.success(`Rôle mis à jour pour ${userEmail}`);
      } else {
        // Insérer un nouveau rôle
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: selectedRole });

        if (insertError) throw insertError;
        toast.success(`Rôle assigné à ${userEmail}`);
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erreur lors de la modification du rôle:', error);
      toast.error(error.message || "Erreur lors de la modification du rôle");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {currentRole ? "Modifier le rôle" : "Assigner un rôle"}
          </DialogTitle>
          <DialogDescription>
            Modifier le rôle de <strong>{userEmail}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="role">Rôle</Label>
            <Select value={selectedRole} onValueChange={(value: AppRole) => setSelectedRole(value)}>
              <SelectTrigger id="role">
                <SelectValue placeholder="Sélectionner un rôle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrateur</SelectItem>
                <SelectItem value="gestionnaire">Gestionnaire</SelectItem>
                <SelectItem value="operateur">Opérateur</SelectItem>
                <SelectItem value="client">Client</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            <p className="font-medium mb-1">Description des rôles :</p>
            <ul className="space-y-1 text-xs">
              <li><strong>Admin :</strong> Accès complet au système</li>
              <li><strong>Gestionnaire :</strong> Gestion commandes, retours, facturation</li>
              <li><strong>Opérateur :</strong> Réception, préparation, expédition</li>
              <li><strong>Client :</strong> Consultation stocks et commandes</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
