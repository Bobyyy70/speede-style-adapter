import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";

interface VoiceInputProps {
  onVoiceInput: (text: string) => void;
  language?: string;
  disabled?: boolean;
}

export function VoiceInput({
  onVoiceInput,
  language = "fr-FR",
  disabled = false
}: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    // Vérifier si l'API est disponible
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      return;
    }

    const recognitionInstance = new SpeechRecognition();
    recognitionInstance.continuous = false;
    recognitionInstance.lang = language;
    recognitionInstance.interimResults = false;
    recognitionInstance.maxAlternatives = 1;

    recognitionInstance.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onVoiceInput(transcript);
      toast.success(`Reconnaissance vocale: "${transcript}"`);
      setIsListening(false);
    };

    recognitionInstance.onerror = (event: any) => {
      console.error("Erreur reconnaissance vocale:", event.error);
      toast.error("Erreur de reconnaissance vocale");
      setIsListening(false);
    };

    recognitionInstance.onend = () => {
      setIsListening(false);
    };

    setRecognition(recognitionInstance);

    return () => {
      if (recognitionInstance) {
        recognitionInstance.stop();
      }
    };
  }, [language, onVoiceInput]);

  const toggleListening = () => {
    if (!recognition) {
      toast.error("La reconnaissance vocale n'est pas supportée par ce navigateur");
      return;
    }

    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      recognition.start();
      setIsListening(true);
      toast.info("Parlez maintenant...");
    }
  };

  // Si l'API n'est pas disponible, ne pas afficher le bouton
  if (!recognition) {
    return null;
  }

  return (
    <Button
      onClick={toggleListening}
      variant={isListening ? "destructive" : "secondary"}
      size="lg"
      disabled={disabled}
      className="w-full"
    >
      {isListening ? (
        <>
          <MicOff className="mr-2 h-5 w-5" />
          Arrêter l'écoute
        </>
      ) : (
        <>
          <Mic className="mr-2 h-5 w-5" />
          Mode vocal
        </>
      )}
    </Button>
  );
}
