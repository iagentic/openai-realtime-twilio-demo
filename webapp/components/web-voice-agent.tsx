"use client";

import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Volume2, VolumeX, Phone, PhoneOff } from "lucide-react";

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

  const wsRef = useRef<WebSocket | null>(null);
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

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        }
      }

      if (finalTranscript && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log("Sending text to OpenAI Realtime API:", finalTranscript);
        
        // Send text message to OpenAI Realtime API
        wsRef.current.send(JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [{ type: "text", text: finalTranscript }],
          },
        }));
        
        wsRef.current.send(JSON.stringify({ type: "response.create" }));
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
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const connectToRealtimeAPI = async () => {
    try {
      setError(null);
      
      // Connect to your websocket server's webrtc endpoint
      const ws = new WebSocket(`wss://ws.iagentic.ai/webrtc`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("Connected to OpenAI Realtime API via websocket server");
        setIsConnected(true);
        
        // Send session configuration
        ws.send(JSON.stringify({
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            turn_detection: { type: "server_vad" },
            voice: "ash",
            input_audio_format: "pcm16",
            output_audio_format: "pcm16",
          },
        }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("Received from OpenAI Realtime API:", data);

        // Handle different message types
        switch (data.type) {
          case "response.audio.delta":
            // Play audio response
            playAudio(data.delta);
            break;
          case "conversation.item.created":
            // Update transcript
            updateTranscript(data.item);
            break;
          case "input_audio_buffer.speech_started":
            setIsListening(true);
            break;
          case "input_audio_buffer.speech_stopped":
            setIsListening(false);
            break;
          case "response.audio_transcript.delta":
            // Update transcript with AI response
            updateTranscript({
              type: "message",
              role: "assistant",
              content: [{ type: "text", text: data.delta }]
            });
            break;
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setError("Connection error - check if websocket server is running");
      };

      ws.onclose = () => {
        console.log("WebSocket connection closed");
        setIsConnected(false);
      };

    } catch (err: any) {
      console.error("Error connecting:", err);
      setError(err.message || "Failed to connect");
    }
  };

  const playAudio = (audioData: string) => {
    // For now, we'll use text-to-speech instead of raw audio
    // The websocket server should handle audio conversion
    console.log("Audio received, would play:", audioData);
    setIsSpeaking(true);
    
    // Simulate speaking
    setTimeout(() => {
      setIsSpeaking(false);
    }, 2000);
  };

  const updateTranscript = (item: any) => {
    const transcriptItem = {
      ...item,
      timestamp: new Date().toLocaleTimeString(),
      status: "completed"
    };
    
    setTranscript(prev => [...prev, transcriptItem]);
    
    if (onTranscriptUpdate) {
      onTranscriptUpdate([...transcript, transcriptItem]);
    }
  };

  const startVoiceChat = () => {
    connectToRealtimeAPI();
  };

  const endVoiceChat = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (synthesisRef.current) {
      speechSynthesis.cancel();
    }
    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log("Sending text message:", message.trim());
      
      // Send text message to OpenAI Realtime API
      wsRef.current.send(JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "text", text: message.trim() }],
        },
      }));
      
      wsRef.current.send(JSON.stringify({ type: "response.create" }));
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
              Connect to Realtime API
            </Button>
          ) : (
            <Button onClick={endVoiceChat} variant="destructive" className="flex items-center gap-2">
              <PhoneOff className="h-4 w-4" />
              Disconnect
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
                ) : (
                  <VolumeX className="h-5 w-5 text-gray-400" />
                )}
                <span className="text-sm">Speaking</span>
              </div>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600">
                {isListening ? "Listening for your voice..." : 
                 isSpeaking ? "AI is speaking..." : 
                 "Connected to OpenAI Realtime API - Start talking!"}
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

            {/* Start/Stop voice recognition */}
            <div className="flex justify-center">
              {!isListening ? (
                <Button 
                  onClick={() => recognitionRef.current?.start()} 
                  variant="outline" 
                  size="sm"
                >
                  Start Listening
                </Button>
              ) : (
                <Button 
                  onClick={() => recognitionRef.current?.stop()} 
                  variant="outline" 
                  size="sm"
                >
                  Stop Listening
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 p-3 bg-blue-50 rounded-md">
          <p className="text-xs text-blue-700">
            <strong>Web Voice Agent:</strong> Connects to OpenAI Realtime API via your websocket server. 
            Uses browser speech recognition with real-time AI responses!
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default WebVoiceAgent;
