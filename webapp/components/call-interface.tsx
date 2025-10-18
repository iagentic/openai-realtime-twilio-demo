"use client";

import React, { useState, useEffect } from "react";
import TopBar from "@/components/top-bar";
import ChecklistAndConfig from "@/components/checklist-and-config";
import SessionConfigurationPanel from "@/components/session-configuration-panel";
import Transcript from "@/components/transcript";
import FunctionCallsPanel from "@/components/function-calls-panel";
import { Item } from "@/components/types";
import handleRealtimeEvent from "@/lib/handle-realtime-event";
import PhoneNumberChecklist from "@/components/phone-number-checklist";
import OutboundCallPanel from "@/components/outbound-call-panel";
import WebVoiceAgent from "@/components/web-voice-agent";

const CallInterface = () => {
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState("");
  const [allConfigsReady, setAllConfigsReady] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [webVoiceItems, setWebVoiceItems] = useState<Item[]>([]);
  const [callStatus, setCallStatus] = useState("disconnected");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [sessionConfig, setSessionConfig] = useState<any>(null);
  const [activeTranscript, setActiveTranscript] = useState<"phone" | "web">("phone");

  // Auto-switch to web voice transcript when first web voice message arrives
  useEffect(() => {
    if (webVoiceItems.length === 1 && items.length === 0) {
      setActiveTranscript("web");
    }
  }, [webVoiceItems.length, items.length]);


  // Load saved configuration from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sessionConfig');
      if (saved) {
        try {
          const config = JSON.parse(saved);
          setSessionConfig(config);
          console.log("Loaded saved session configuration from localStorage:", config);
        } catch (error) {
          console.error("Error parsing saved session config:", error);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (allConfigsReady && !ws) {
      const newWs = new WebSocket(`wss://ws.iagentic.ai/logs`);

      newWs.onopen = () => {
        console.log("Connected to logs websocket");
        setCallStatus("connected");
        
        // Automatically send saved configuration when WebSocket connects
        if (sessionConfig) {
          const updateEvent = {
            type: "session.update",
            session: sessionConfig,
          };
          console.log("Auto-sending session configuration on connect:", updateEvent);
          newWs.send(JSON.stringify(updateEvent));
        }
      };

      newWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("Received logs event:", data);
        handleRealtimeEvent(data, setItems);
      };

      newWs.onclose = () => {
        console.log("Logs websocket disconnected");
        setWs(null);
        setCallStatus("disconnected");
      };

      setWs(newWs);
    }
  }, [allConfigsReady, ws, sessionConfig]);

  return (
    <div className="h-screen bg-white flex flex-col">
      <ChecklistAndConfig
        ready={allConfigsReady}
        setReady={setAllConfigsReady}
        selectedPhoneNumber={selectedPhoneNumber}
        setSelectedPhoneNumber={setSelectedPhoneNumber}
      />
      <TopBar />
      <div className="flex-grow p-4 h-full overflow-hidden flex flex-col">
        <div className="grid grid-cols-12 gap-4 h-full">
          {/* Left Column */}
          <div className="col-span-3 flex flex-col h-full overflow-hidden">
            <SessionConfigurationPanel
              callStatus={callStatus}
              onSave={(config) => {
                // Save configuration to state
                setSessionConfig(config);
                
                // Also save to localStorage for persistence
                if (typeof window !== 'undefined') {
                  localStorage.setItem('sessionConfig', JSON.stringify(config));
                }
                
                // If WebSocket is already connected, send immediately
                if (ws && ws.readyState === WebSocket.OPEN) {
                  const updateEvent = {
                    type: "session.update",
                    session: config,
                  };
                  console.log("Sending update event:", updateEvent);
                  ws.send(JSON.stringify(updateEvent));
                }
              }}
            />
          </div>

          {/* Middle Column: Transcript */}
          <div className="col-span-6 flex flex-col gap-4 h-full overflow-hidden">
            <PhoneNumberChecklist
              selectedPhoneNumber={selectedPhoneNumber}
              allConfigsReady={allConfigsReady}
              setAllConfigsReady={setAllConfigsReady}
            />
            <OutboundCallPanel selectedPhoneNumber={selectedPhoneNumber} />
            <WebVoiceAgent 
              onTranscriptUpdate={setWebVoiceItems}
              onConnectionChange={(connected) => {
                if (connected) {
                  // Only switch to web transcript if user actively starts web voice
                  // Don't switch if they're viewing phone transcripts
                  setWebVoiceItems([]); // Clear web voice transcript when starting new session
                  // Switch to web view when web voice gets its first message
                }
              }}
            />
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex flex-col h-full">
                {/* Show toggle buttons only if both transcripts have content */}
                {items.length > 0 && webVoiceItems.length > 0 && (
                  <div className="flex items-center justify-between mb-2 px-2">
                    <span className="text-sm font-medium">
                      {activeTranscript === "phone" ? (
                        <span className="text-green-600">Phone Call Transcript</span>
                      ) : (
                        <span className="text-blue-600">Web Voice Transcript</span>
                      )}
                    </span>
                    <button
                      onClick={() => setActiveTranscript(activeTranscript === "phone" ? "web" : "phone")}
                      className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                    >
                      Switch to {activeTranscript === "phone" ? "Web Voice" : "Phone Calls"}
                    </button>
                  </div>
                )}
                
                {/* Show single header if only one type has content */}
                {items.length > 0 && webVoiceItems.length === 0 && (
                  <div className="mb-2 px-2">
                    <span className="text-sm font-medium text-green-600">Phone Call Transcript</span>
                  </div>
                )}
                
                {webVoiceItems.length > 0 && items.length === 0 && (
                  <div className="mb-2 px-2">
                    <span className="text-sm font-medium text-blue-600">Web Voice Transcript</span>
                  </div>
                )}
                
                {/* Display the active transcript */}
                {activeTranscript === "phone" ? (
                  <Transcript items={items} />
                ) : (
                  <Transcript items={webVoiceItems} />
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Function Calls */}
          <div className="col-span-3 flex flex-col h-full overflow-hidden">
            <FunctionCallsPanel items={items} ws={ws} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallInterface;
