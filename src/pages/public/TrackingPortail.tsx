// Feature disabled - public tracking portal not configured in database
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function TrackingPortail() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Suivi de Commande</h1>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Le portail de suivi public n'est pas encore configuré.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
