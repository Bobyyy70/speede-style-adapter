// Feature disabled - returns management tables not configured in database
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function GestionRetours() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Gestion des Retours</h1>
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          La fonctionnalité de gestion des retours n'est pas encore configurée. Les tables de base de données nécessaires doivent être créées.
        </AlertDescription>
      </Alert>
    </div>
  );
}
