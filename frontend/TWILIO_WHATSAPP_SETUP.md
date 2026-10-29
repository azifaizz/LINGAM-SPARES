# Twilio WhatsApp Integration Guide

## Overview
To send automated WhatsApp messages (business-initiated) to customers, you must use **Twilio** connected to the **WhatsApp Business API**.

There are two environments:
1. **Sandbox** (Development/Testing)
2. **Production** (Live Customers)

---

## 1. Sandbox Setup (Testing)
*Use this mode to test the feature immediately.*

1. **Log in** to your [Twilio Console](https://console.twilio.com/).
2. Go to **Messaging** > **Try it out** > **Send a WhatsApp message**.
3. You will see a **Sandbox Number** (e.g., `+1 415 523 8886`) and a **Join Code** (e.g., `join something-word`).
4. **Action Required:** Open WhatsApp on your phone and send the **Join Code** to the **Sandbox Number**.
   - *Note:* Until you do this, Twilio will block any message sending to your number.
5. In `Billing.tsx`, update the variables:
   - `accountSid`: Your Account SID from Twilio Dashboard.
   - `authToken`: Your Auth Token.
   - `fromNumber`: The Sandbox Number (e.g., `whatsapp:+14155238886`).

---

## 2. Production Setup (Live)
*Use this mode to send messages to any customer without them joining first.*

### A. Business Verification
1. Go to **Messaging** > **Senders** > **WhatsApp Senders**.
2. Click **Sign up for WhatsApp**.
3. Follow the wizard to link your **Meta (Facebook) Business Manager** account.
   - You will need to verify your business legal name and phone number.
4. Once verified, your Twilio number will be a "WhatsApp Business sender".

### B. Template Creation (CRITICAL)
WhatsApp **blocks** free-form text messages sent by businesses to users who haven't messaged them in the last 24 hours. To send a bill notification, you **Must** use a template.

1. Go to **Messaging** > **Content Template Builder**.
2. Click **Create new template**.
3. **Category:** Utility.
4. **Name:** `new_bill_notification`
5. **Content Body:**
   ```text
   Hello {{1}},
   Thank you for shopping at Lingam Spares!
   Your bill (ID: {{2}}) for Rs. {{3}} is ready.
   View & Download: {{4}}
   
   Thank you!
   ```
6. Submit for approval (takes 5 mins - 24 hours).
7. Once approved, copy the **Content SID** (starts with `HX...`).

### C. Update Code
Change the `handleSendWhatsApp` function in `Billing.tsx` to use the Template API instead of free text body:

```javascript
// ... inside handleSendWhatsApp
const contentSid = "HX12345..."; // Your approved Content SID
const variables = JSON.stringify({
  "1": customerName,
  "2": billId,
  "3": totalAmount.toString(),
  "4": billUrl
});

formData.append("ContentSid", contentSid);
formData.append("ContentVariables", variables);
// Remove formData.append("Body", ...)
```

---

## Troubleshooting
- **"Twilio Error 63016"**: You are trying to send free-text to a user who hasn't messaged you in 24 hours. Use a Template.
- **"Twilio Error 63015"**: The user is not in the Sandbox (if testing) or has blocked you.
- **Message not received**: Check Twilio **Programmable Messaging Logs** in the console for the specific error reason.
