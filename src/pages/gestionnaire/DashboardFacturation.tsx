// Feature disabled - billing dashboard not configured in database
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DashboardLayout } from '@/components/DashboardLayout';

export default function DashboardFacturation() {
  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">Dashboard Facturation</h1>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Le dashboard de facturation n'est pas encore configuré.
          </AlertDescription>
        </Alert>
      </div>
    </DashboardLayout>
  );
}
