require('dotenv').config();
const express = require('express');
const venom = require('venom-bot');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

// Botpress configuration with your provided values
const BOTPRESS_BOT_ID = '166dfc8e-224d-446e-b304-f08265f9a2ff';
const BOTPRESS_CLIENT_ID = process.env.BOTPRESS_CLIENT_ID; // Loaded from .env or Render
const BOTPRESS_WEBHOOK_URL = 'https://webhook.botpress.cloud/fdab131d-0b23-4f3b-a11c-bbae29647cc3';

// Validate environment variables
if (!BOTPRESS_CLIENT_ID) {
  console.error('Error: BOTPRESS_CLIENT_ID environment variable is not set');
  process.exit(1);
}

// Initialize Venom-bot for WhatsApp
venom
  .create(
    'whatsapp-bot-session', // Session name
    (base64Qr, asciiQR) => {
      console.log('Scan this QR Code with your WhatsApp app:');
      console.log(asciiQR); // Displays QR code for local authentication
    },
    (statusSession) => {
      console.log('Session status:', statusSession);
    },
    {
      headless: true, // Required for Render’s environment
      useChrome: true
    }
  )
  .then((client) => start(client))
  .catch((error) => {
    console.error('Error initializing Venom client:', error);
    process.exit(1);
  });

// Main logic for WhatsApp and Botpress integration
function start(client) {
  // Handle incoming WhatsApp messages
  client.onMessage(async (message) => {
    const sender = message.from; // WhatsApp sender ID
    const messageContent = message.body; // Message text
    const messageId = uuidv4(); // Unique message ID
    const conversationId = sender; // Use sender as conversation ID

    try {
      // Forward message to Botpress
      const response = await axios.post(
        BOTPRESS_WEBHOOK_URL,
        {
          type: 'text',
          text: messageContent,
          userId: sender,
          conversationId: conversationId,
          messageId: messageId
        },
        {
          headers: {
            'Authorization': `Bearer ${BOTPRESS_CLIENT_ID}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10-second timeout
        }
      );
      console.log('Message sent to Botpress:', response.data);
    } catch (error) {
      console.error('Error sending message to Botpress:', error.message);
    }
  });

  // Endpoint to receive responses from Botpress
  app.post('/botpress-response', async (req, res) => {
    try {
      const { conversationId, type, payload } = req.body;
      if (type === 'text' && payload.text) {
        await client.sendText(conversationId, payload.text);
        console.log(`Sent bot reply to ${conversationId}: ${payload.text}`);
        res.status(200).send('OK');
      } else {
        res.status(400).send('Invalid payload');
      }
    } catch (error) {
      console.error('Error in /botpress-response:', error.message);
      res.status(500).send('Internal Server Error');
    }
  });
}

// Start the Express server
const PORT = process.env.PORT || 3000; // Render assigns PORT dynamically
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});