// Feature disabled - API tokens not configured in database
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DashboardLayout } from '@/components/DashboardLayout';

export default function MesTokensAPI() {
  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">Mes Tokens API</h1>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            La fonctionnalité de gestion des tokens API n'est pas encore configurée.
          </AlertDescription>
        </Alert>
      </div>
    </DashboardLayout>
  );
}
