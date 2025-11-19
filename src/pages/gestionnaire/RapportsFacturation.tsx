// Feature disabled - billing reports functions not configured in database
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function RapportsFacturation() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Rapports d'Activité pour Facturation</h1>
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          La fonctionnalité de rapports de facturation n'est pas encore configurée. Les fonctions de base de données nécessaires doivent être créées.
        </AlertDescription>
      </Alert>
    </div>
  );
}
