import twilioClient from "@/lib/twilio";

export async function POST(req: Request) {
  if (!twilioClient) {
    return Response.json(
      { error: "Twilio client not initialized" },
      { status: 500 }
    );
  }

  try {
    const { to, from } = await req.json();

    if (!to || !from) {
      return Response.json(
        { error: "Missing 'to' or 'from' phone number" },
        { status: 400 }
      );
    }

    // Get the webhook URL for the call
    const webhookUrl = process.env.NEXT_PUBLIC_WEBHOOK_URL || `http://${process.env.NEXT_PUBLIC_SERVER_URL || 'localhost:8081'}/twiml`;

    // Create the outbound call
    const call = await twilioClient.calls.create({
      to: to,
      from: from,
      url: webhookUrl,
      method: 'POST'
    });

    return Response.json({
      success: true,
      callSid: call.sid,
      status: call.status,
      to: call.to,
      from: call.from
    });

  } catch (error: any) {
    console.error("Error creating outbound call:", error);
    return Response.json(
      { error: error.message || "Failed to create call" },
      { status: 500 }
    );
  }
}
