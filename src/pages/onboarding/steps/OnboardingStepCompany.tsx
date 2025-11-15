import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Building2 } from 'lucide-react';

interface StepProps {
  onComplete: (data: any) => void;
  wizardData: Record<string, any>;
}

export default function OnboardingStepCompany({ onComplete, wizardData }: StepProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nom_entreprise: wizardData.nom_entreprise || '',
    siret: wizardData.siret || '',
    email_contact: wizardData.email_contact || '',
    telephone: wizardData.telephone || '',
    adresse: wizardData.adresse || '',
    remarques: wizardData.remarques || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Créer ou mettre à jour l'entreprise
      const { data: client, error } = await supabase
        .from('client')
        .upsert({
          nom_entreprise: formData.nom_entreprise,
          siret: formData.siret,
          email_contact: formData.email_contact,
          telephone: formData.telephone,
          adresse: formData.adresse,
          remarques: formData.remarques,
          actif: true,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Entreprise enregistrée');
      onComplete({ client_id: client.id, ...formData });
    } catch (error: any) {
      console.error('Erreur création entreprise:', error);
      toast.error(error.message || 'Erreur lors de la création de l\'entreprise');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          <CardTitle>Informations de l'Entreprise</CardTitle>
        </div>
        <CardDescription>
          Enregistrez les informations de votre entreprise cliente
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nom_entreprise">Nom de l'entreprise *</Label>
              <Input
                id="nom_entreprise"
                required
                value={formData.nom_entreprise}
                onChange={(e) => setFormData({ ...formData, nom_entreprise: e.target.value })}
                placeholder="SpeedE Logistics"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="siret">SIRET</Label>
              <Input
                id="siret"
                value={formData.siret}
                onChange={(e) => setFormData({ ...formData, siret: e.target.value })}
                placeholder="123 456 789 00012"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email_contact">Email de contact *</Label>
              <Input
                id="email_contact"
                type="email"
                required
                value={formData.email_contact}
                onChange={(e) => setFormData({ ...formData, email_contact: e.target.value })}
                placeholder="contact@speedelogistics.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telephone">Téléphone</Label>
              <Input
                id="telephone"
                value={formData.telephone}
                onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                placeholder="+33 1 23 45 67 89"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adresse">Adresse complète</Label>
            <Textarea
              id="adresse"
              value={formData.adresse}
              onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
              placeholder="123 Rue de la Logistique&#10;75001 Paris, France"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="remarques">Remarques</Label>
            <Textarea
              id="remarques"
              value={formData.remarques}
              onChange={(e) => setFormData({ ...formData, remarques: e.target.value })}
              placeholder="Informations complémentaires..."
              rows={2}
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continuer
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
