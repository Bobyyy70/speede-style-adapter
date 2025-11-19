// Feature disabled - TMS tracking tables not configured
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Tracking() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Tracking TMS</h1>
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          La fonctionnalité de tracking TMS n'est pas encore configurée.
        </AlertDescription>
      </Alert>
    </div>
  );
}
