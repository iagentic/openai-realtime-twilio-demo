"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Phone, PhoneCall, Loader2 } from "lucide-react";

interface OutboundCallPanelProps {
  selectedPhoneNumber: string;
}

const OutboundCallPanel: React.FC<OutboundCallPanelProps> = ({
  selectedPhoneNumber,
}) => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isCalling, setIsCalling] = useState(false);
  const [callStatus, setCallStatus] = useState<string | null>(null);

  const handleMakeCall = async () => {
    if (!phoneNumber || !selectedPhoneNumber) {
      alert("Please enter a phone number and ensure your Twilio number is configured");
      return;
    }

    setIsCalling(true);
    setCallStatus("Initiating call...");

    try {
      const response = await fetch("/api/twilio/call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: phoneNumber,
          from: selectedPhoneNumber,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setCallStatus(`Call initiated successfully! Call SID: ${data.callSid}`);
      } else {
        setCallStatus(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Error making call:", error);
      setCallStatus(`Error: ${error}`);
    } finally {
      setIsCalling(false);
    }
  };

  const formatPhoneNumber = (phone: string) => {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, "");
    
    // Format as +1XXXXXXXXXX for US numbers
    if (digits.length === 10) {
      return `+1${digits}`;
    } else if (digits.length === 11 && digits.startsWith("1")) {
      return `+${digits}`;
    } else if (digits.startsWith("+")) {
      return phone;
    }
    
    return phone; // Return as-is if doesn't match patterns
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <PhoneCall className="h-4 w-4" />
          Make Outbound Call
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Call From</label>
          <Input 
            value={selectedPhoneNumber} 
            disabled 
            className="bg-gray-50"
            placeholder="Your Twilio number"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Call To</label>
          <Input
            type="tel"
            placeholder="+1234567890 or 1234567890"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))}
            className="font-mono"
          />
          <p className="text-xs text-gray-500">
            Enter phone number with country code (e.g., +1234567890)
          </p>
        </div>

        <Button
          onClick={handleMakeCall}
          disabled={isCalling || !phoneNumber || !selectedPhoneNumber}
          className="w-full"
        >
          {isCalling ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Making Call...
            </>
          ) : (
            <>
              <Phone className="mr-2 h-4 w-4" />
              Make Call
            </>
          )}
        </Button>

        {callStatus && (
          <div className="mt-4 p-3 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-700">{callStatus}</p>
          </div>
        )}

        <div className="mt-4 p-3 bg-blue-50 rounded-md">
          <p className="text-xs text-blue-700">
            <strong>Note:</strong> The AI assistant will handle the call once connected. 
            Make sure your websocket server is running and accessible.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default OutboundCallPanel;
