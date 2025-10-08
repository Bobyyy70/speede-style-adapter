import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface GenererEmplacementsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function GenererEmplacementsDialog({ open, onOpenChange, onSuccess }: GenererEmplacementsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [allees, setAllees] = useState("A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z");
  const [nbRacks, setNbRacks] = useState("50");
  const [positions, setPositions] = useState("a,b,c,d");
  const [capaciteKg, setCapaciteKg] = useState("1500");

  const handleGenerer = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)('generer_emplacements_auto', {
        p_allees: allees,
        p_nb_racks: parseInt(nbRacks),
        p_positions: positions,
        p_capacite_kg: parseFloat(capaciteKg)
      });

      if (error) throw error;

      toast.success(`${data} emplacements générés avec succès`);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erreur génération emplacements:', error);
      toast.error(error.message || "Erreur lors de la génération des emplacements");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Générer les emplacements automatiquement</DialogTitle>
          <DialogDescription>
            Créer tous les emplacements selon la nomenclature définie
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="allees">Allées (séparées par virgules)</Label>
            <Input
              id="allees"
              value={allees}
              onChange={(e) => setAllees(e.target.value)}
              placeholder="A,B,C,D,E..."
            />
            <p className="text-xs text-muted-foreground">
              Exemple: A,B,C créera les allées A, B et C
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="nbRacks">Nombre de racks par allée</Label>
            <Input
              id="nbRacks"
              type="number"
              value={nbRacks}
              onChange={(e) => setNbRacks(e.target.value)}
              min="1"
              max="100"
            />
            <p className="text-xs text-muted-foreground">
              Les racks seront numérotés de 1 à ce nombre
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="positions">Positions verticales (séparées par virgules)</Label>
            <Input
              id="positions"
              value={positions}
              onChange={(e) => setPositions(e.target.value)}
              placeholder="a,b,c,d"
            />
            <p className="text-xs text-muted-foreground">
              a = en bas, b = au-dessus, etc.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="capaciteKg">Capacité max par emplacement (kg)</Label>
            <Input
              id="capaciteKg"
              type="number"
              value={capaciteKg}
              onChange={(e) => setCapaciteKg(e.target.value)}
              min="0"
              step="0.1"
            />
            <p className="text-xs text-muted-foreground">
              1500 kg = norme palette Europe standard
            </p>
          </div>

          <div className="rounded-md bg-muted p-3 text-sm">
            <p className="font-medium mb-1">Aperçu:</p>
            <p className="text-muted-foreground">
              Exemple de codes: A1_a, A1_b, A2_a, B1_a...
            </p>
            <p className="text-muted-foreground mt-1">
              Total estimé: {allees.split(',').length} × {nbRacks} × {positions.split(',').length} = {allees.split(',').length * parseInt(nbRacks || "0") * positions.split(',').length} emplacements
            </p>
            <p className="text-muted-foreground mt-1">
              Capacité: {capaciteKg} kg par emplacement
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annuler
          </Button>
          <Button onClick={handleGenerer} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Générer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
