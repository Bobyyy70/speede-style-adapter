import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { KeyRound } from "lucide-react";

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  userEmail,
}: ResetPasswordDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo: `${window.location.origin}/auth?mode=reset`,
      });

      if (error) throw error;

      toast({
        title: "Email envoyé",
        description: `Un email de réinitialisation a été envoyé à ${userEmail}`,
      });
      
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erreur lors de la réinitialisation:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'envoyer l'email de réinitialisation",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Réinitialiser le mot de passe
          </DialogTitle>
          <DialogDescription>
            Un email de réinitialisation sera envoyé à <strong>{userEmail}</strong>.
            L'utilisateur pourra définir un nouveau mot de passe en cliquant sur le lien dans l'email.
          </DialogDescription>
        </DialogHeader>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button onClick={handleResetPassword} disabled={loading}>
            {loading ? "Envoi..." : "Envoyer l'email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
