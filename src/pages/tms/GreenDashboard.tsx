// Feature disabled - TMS green dashboard tables not configured
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function GreenDashboard() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Dashboard Écologique</h1>
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          La fonctionnalité de dashboard écologique n'est pas encore configurée.
        </AlertDescription>
      </Alert>
    </div>
  );
}
