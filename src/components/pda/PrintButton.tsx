import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { toast } from "sonner";

interface PrintButtonProps {
  label: string;
  data: any;
  templateType: "etiquette" | "document" | "rapport";
  disabled?: boolean;
  variant?: "default" | "outline" | "secondary";
}

export function PrintButton({
  label,
  data,
  templateType,
  disabled = false,
  variant = "outline"
}: PrintButtonProps) {

  const generateLabel = () => {
    // Générer une étiquette simple en format texte
    const printContent = `
      ════════════════════════════
      ${label.toUpperCase()}
      ════════════════════════════
      ${Object.entries(data).map(([key, value]) => `${key}: ${value}`).join('\n      ')}
      ════════════════════════════
      Date: ${new Date().toLocaleString('fr-FR')}
    `;

    return printContent;
  };

  const handlePrint = () => {
    try {
      const printContent = generateLabel();

      // Créer une fenêtre d'impression
      const printWindow = window.open('', '', 'height=600,width=800');

      if (!printWindow) {
        toast.error("Impossible d'ouvrir la fenêtre d'impression");
        return;
      }

      printWindow.document.write(`
        <html>
          <head>
            <title>${label}</title>
            <style>
              body {
                font-family: 'Courier New', monospace;
                padding: 20px;
                white-space: pre-wrap;
              }
              @media print {
                body { margin: 0; }
              }
            </style>
          </head>
          <body>
            ${printContent}
          </body>
        </html>
      `);

      printWindow.document.close();
      printWindow.focus();

      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);

      toast.success("Impression lancée");
    } catch (error) {
      console.error("Erreur d'impression:", error);
      toast.error("Erreur lors de l'impression");
    }
  };

  return (
    <Button
      onClick={handlePrint}
      variant={variant}
      disabled={disabled}
      className="w-full"
    >
      <Printer className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}
