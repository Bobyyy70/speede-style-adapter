// Feature disabled - thermal printer tables not configured in database
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ThermalPrinterSettings() {
  return (
    <div className="p-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          La fonctionnalité d'impression thermique n'est pas encore configurée.
        </AlertDescription>
      </Alert>
    </div>
  );
}
