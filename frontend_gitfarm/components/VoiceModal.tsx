import type React from "react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { useSpeechRecognition } from "react-speech-recognition";

interface VoiceInputModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const VoiceInputModal: React.FC<VoiceInputModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  // const recognitionRef = useRef<SpeechRecognition | null>(null) // Removed as we are using useSpeechRecognition hook

  const {
    transcript: speechTranscript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  useEffect(() => {
    if (!browserSupportsSpeechRecognition) {
      console.error("Browser does not support speech recognition.");
      return;
    }
    // No need for manual SpeechRecognition setup anymore.
  }, [browserSupportsSpeechRecognition]);

  useEffect(() => {
    setTranscript(speechTranscript);
  }, [speechTranscript]);

  const toggleListening = () => {
    if (listening) {
      resetTranscript();
    } else {
      // Start listening automatically when the button is clicked.
    }
    setIsListening(!listening);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-gray-800 text-white">
        <DialogHeader>
          <DialogTitle>Voice Input</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex items-center justify-center">
            <Button
              onClick={toggleListening}
              className={`p-8 rounded-full ${
                listening
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-blue-500 hover:bg-blue-600"
              }`}
            >
              {listening ? (
                <MicOff className="h-8 w-8" />
              ) : (
                <Mic className="h-8 w-8" />
              )}
            </Button>
          </div>
          <div className="text-center">
            {listening ? "Listening..." : "Click to start listening"}
          </div>
          <div className="bg-gray-700 p-4 rounded-md min-h-[100px] max-h-[200px] overflow-y-auto">
            {transcript}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VoiceInputModal;
