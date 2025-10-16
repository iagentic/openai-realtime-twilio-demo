"use client";

import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Volume2, VolumeX, Phone, PhoneOff, MessageSquare } from "lucide-react";

interface WebVoiceAgentProps {
  onTranscriptUpdate?: (items: any[]) => void;
}

const WebVoiceAgent: React.FC<WebVoiceAgentProps> = ({ onTranscriptUpdate }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    // Check for browser support
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError("Speech recognition not supported in this browser");
      return;
    }

    if (!('speechSynthesis' in window)) {
      setError("Speech synthesis not supported in this browser");
      return;
    }

    // Initialize speech recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onstart = () => {
      setIsListening(true);
      console.log("Speech recognition started");
    };

    recognitionRef.current.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        console.log("Final transcript:", finalTranscript);
        handleUserMessage(finalTranscript);
      }
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
      console.log("Speech recognition ended");
    };

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startVoiceChat = () => {
    if (recognitionRef.current && !isListening) {
      setError(null);
      setIsConnected(true);
      recognitionRef.current.start();
    }
  };

  const endVoiceChat = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (synthesisRef.current) {
      speechSynthesis.cancel();
    }
    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
  };

  const handleUserMessage = async (userMessage: string) => {
    // Add user message to transcript
    const userItem = {
      id: Date.now().toString(),
      type: "message",
      role: "user",
      content: [{ type: "text", text: userMessage }],
      timestamp: new Date().toLocaleTimeString(),
      status: "completed"
    };
    
    setTranscript(prev => [...prev, userItem]);
    if (onTranscriptUpdate) {
      onTranscriptUpdate([...transcript, userItem]);
    }

    // Send to OpenAI API via your backend
    try {
      setIsTyping(true);
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          conversation_history: transcript
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      const aiResponse = data.response;

      // Add AI response to transcript
      const aiItem = {
        id: (Date.now() + 1).toString(),
        type: "message",
        role: "assistant",
        content: [{ type: "text", text: aiResponse }],
        timestamp: new Date().toLocaleTimeString(),
        status: "completed"
      };

      setTranscript(prev => [...prev, aiItem]);
      if (onTranscriptUpdate) {
        onTranscriptUpdate([...transcript, userItem, aiItem]);
      }

      // Speak the AI response
      speakText(aiResponse);

    } catch (error) {
      console.error("Error getting AI response:", error);
      setError("Failed to get AI response");
    } finally {
      setIsTyping(false);
    }
  };

  const speakText = (text: string) => {
    if (synthesisRef.current) {
      speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = (event) => {
      console.error("Speech synthesis error:", event.error);
      setIsSpeaking(false);
    };

    synthesisRef.current = utterance;
    speechSynthesis.speak(utterance);
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      handleUserMessage(message.trim());
      setMessage("");
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          Web Voice Agent
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-center space-x-4">
          {!isConnected ? (
            <Button onClick={startVoiceChat} className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Start Voice Chat
            </Button>
          ) : (
            <Button onClick={endVoiceChat} variant="destructive" className="flex items-center gap-2">
              <PhoneOff className="h-4 w-4" />
              End Chat
            </Button>
          )}
        </div>

        {isConnected && (
          <div className="space-y-3">
            <div className="flex items-center justify-center space-x-6">
              <div className="flex items-center gap-2">
                {isListening ? (
                  <Mic className="h-5 w-5 text-red-500 animate-pulse" />
                ) : (
                  <MicOff className="h-5 w-5 text-gray-400" />
                )}
                <span className="text-sm">Listening</span>
              </div>
              
              <div className="flex items-center gap-2">
                {isSpeaking ? (
                  <Volume2 className="h-5 w-5 text-blue-500 animate-pulse" />
                ) : isTyping ? (
                  <MessageSquare className="h-5 w-5 text-green-500 animate-pulse" />
                ) : (
                  <VolumeX className="h-5 w-5 text-gray-400" />
                )}
                <span className="text-sm">
                  {isSpeaking ? "Speaking" : isTyping ? "Thinking" : "Ready"}
                </span>
              </div>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600">
                {isListening ? "Listening for your voice..." : 
                 isSpeaking ? "AI is speaking..." : 
                 isTyping ? "AI is thinking..." :
                 "Connected - Start talking!"}
              </p>
            </div>

            {/* Text input as fallback */}
            <form onSubmit={handleTextSubmit} className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Or type a message..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <Button type="submit" size="sm" disabled={!message.trim()}>
                Send
              </Button>
            </form>
          </div>
        )}

        <div className="mt-4 p-3 bg-blue-50 rounded-md">
          <p className="text-xs text-blue-700">
            <strong>Web Voice Agent:</strong> Uses browser speech recognition and synthesis. 
            No external dependencies required!
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default WebVoiceAgent;
