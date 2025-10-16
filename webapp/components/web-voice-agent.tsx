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

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const connectToOpenAI = async () => {
    try {
      setError(null);
      
      // Get user media for microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
          channelCount: 1
        } 
      });
      
      audioStreamRef.current = stream;
      
      // Create WebSocket connection to your backend
      const ws = new WebSocket(`ws://${window.location.hostname}:8081/webrtc`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebRTC connection established");
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
        console.log("Received message:", data);

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
        setError("Connection error");
      };

      ws.onclose = () => {
        console.log("WebSocket connection closed");
        setIsConnected(false);
      };

      // Set up audio recording
      setupAudioRecording(stream, ws);

    } catch (err: any) {
      console.error("Error connecting:", err);
      setError(err.message || "Failed to connect");
    }
  };

  const setupAudioRecording = (stream: MediaStream, ws: WebSocket) => {
    // Create audio context for processing
    const audioContext = new AudioContext({ sampleRate: 16000 });
    audioContextRef.current = audioContext;

    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (event) => {
      if (ws.readyState === WebSocket.OPEN) {
        const audioData = event.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(audioData.length);
        
        // Convert float32 to int16
        for (let i = 0; i < audioData.length; i++) {
          pcm16[i] = Math.max(-32768, Math.min(32767, audioData[i] * 32768));
        }
        
        // Send audio data to backend
        ws.send(JSON.stringify({
          type: "input_audio_buffer.append",
          audio: Array.from(pcm16).map(n => n.toString(36)).join('')
        }));
      }
    };

    source.connect(processor);
    processor.connect(audioContext.destination);
  };

  const playAudio = (audioData: string) => {
    if (!audioContextRef.current) return;

    try {
      // Convert base36 back to PCM16
      const pcm16 = new Int16Array(audioData.split('').map(c => parseInt(c, 36)));
      const float32 = new Float32Array(pcm16.length);
      
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768;
      }

      // Create audio buffer and play
      const audioBuffer = audioContextRef.current.createBuffer(1, float32.length, 16000);
      audioBuffer.copyToChannel(float32, 0);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.start();
      
      setIsSpeaking(true);
      source.onended = () => setIsSpeaking(false);
    } catch (error) {
      console.error("Error playing audio:", error);
    }
  };

  const updateTranscript = (item: any) => {
    setTranscript(prev => [...prev, {
      ...item,
      timestamp: new Date().toLocaleTimeString()
    }]);
    
    if (onTranscriptUpdate) {
      onTranscriptUpdate([...transcript, item]);
    }
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
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
            <Button onClick={connectToOpenAI} className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Start Voice Chat
            </Button>
          ) : (
            <Button onClick={disconnect} variant="destructive" className="flex items-center gap-2">
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
                 "Connected - Start talking!"}
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 p-3 bg-blue-50 rounded-md">
          <p className="text-xs text-blue-700">
            <strong>Web Voice Agent:</strong> Talk directly to the AI assistant using your browser's microphone. 
            No phone number required!
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default WebVoiceAgent;
