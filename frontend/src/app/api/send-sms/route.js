import twilio from "twilio";

export async function POST(req) {
  try {
    const { to, body } = await req.json();

    if (!to || !body) {
      return new Response(
        JSON.stringify({ error: "Missing 'to' or 'body' field" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const client = twilio(
      process.env.TWILIO_SID,
      process.env.TWILIO_AUTH
    );

    const msg = await client.messages.create({
      to,
      from: process.env.TWILIO_PHONE,
      body,
    });

    return new Response(
      JSON.stringify({ success: true, sid: msg.sid }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("SMS API ERROR:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
