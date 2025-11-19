// Feature disabled - TMS dashboard not configured in database
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DashboardLayout } from '@/components/DashboardLayout';

export default function DashboardTMS() {
  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">Dashboard TMS</h1>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Le dashboard TMS n'est pas encore configuré.
          </AlertDescription>
        </Alert>
      </div>
    </DashboardLayout>
  );
}
