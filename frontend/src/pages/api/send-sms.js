import twilio from "twilio";

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { to, body: messageBody } = req.body || {};
    if (!to || !messageBody) return res.status(400).json({ error: "Missing 'to' or 'body' field" });

    const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);
    const msg = await client.messages.create({ to, from: process.env.TWILIO_PHONE, body: messageBody });

    return res.status(200).json({ success: true, sid: msg.sid });
  } catch (err) {
    console.error("SMS API ERROR:", err);
    return res.status(500).json({ error: err?.message || "Unexpected server error" });
  }
}
