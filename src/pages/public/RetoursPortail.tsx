// Feature disabled - returns portal functions not configured
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function RetoursPortail() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Portail Retours</h1>
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Le portail de gestion des retours n'est pas encore configuré.
        </AlertDescription>
      </Alert>
    </div>
  );
}
