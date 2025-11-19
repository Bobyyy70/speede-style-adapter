import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Scan, Camera } from "lucide-react";
import { toast } from "sonner";

interface ScannerInputProps {
  onScan: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  label?: string;
}

export function ScannerInput({
  onScan,
  placeholder = "Scanner un code-barres...",
  autoFocus = true,
  disabled = false,
  label
}: ScannerInputProps) {
  const [scanInput, setScanInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleScan = () => {
    if (!scanInput.trim()) {
      toast.error("Veuillez scanner ou saisir un code");
      return;
    }

    setIsScanning(true);
    onScan(scanInput.trim());
    setScanInput("");

    // Refocus après un court délai
    setTimeout(() => {
      setIsScanning(false);
      inputRef.current?.focus();
    }, 300);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleScan();
    }
  };

  const handleCameraScan = async () => {
    // Vérifier si l'API est disponible
    if (!('BarcodeDetector' in window)) {
      toast.error("La détection de code-barres n'est pas supportée par ce navigateur");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });

      toast.info("Scan caméra non implémenté dans cette version. Utilisez un lecteur de code-barres.");
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      toast.error("Impossible d'accéder à la caméra");
    }
  };

  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-medium">{label}</label>}
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={scanInput}
          onChange={(e) => setScanInput(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={disabled || isScanning}
          className="text-lg"
          autoFocus={autoFocus}
        />
        <Button
          onClick={handleScan}
          size="lg"
          disabled={disabled || isScanning || !scanInput.trim()}
        >
          <Scan className="h-5 w-5" />
        </Button>
        <Button
          onClick={handleCameraScan}
          size="lg"
          variant="outline"
          disabled={disabled}
        >
          <Camera className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
