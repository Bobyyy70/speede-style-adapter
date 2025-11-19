// Feature disabled - billing reports not configured in database
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DashboardLayout } from '@/components/DashboardLayout';

export default function RapportsFacturation() {
  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">Rapports Facturation</h1>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Les rapports de facturation ne sont pas encore configurés.
          </AlertDescription>
        </Alert>
      </div>
    </DashboardLayout>
  );
}
