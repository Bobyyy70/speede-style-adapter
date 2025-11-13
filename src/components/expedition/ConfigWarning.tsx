import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

interface ConfigWarningProps {
  errors: string[];
}

export function ConfigWarning({ errors }: ConfigWarningProps) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        <div className="font-semibold mb-2">
          Les transporteurs ne sont pas configurés correctement. Définissez la configuration avant d'utiliser "Préparer expédition".
        </div>
        <ul className="list-disc list-inside space-y-1 text-sm">
          {errors.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
