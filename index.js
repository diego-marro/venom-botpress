// Load environment variables from .env file
require('dotenv').config();
const express = require('express');
const venom = require('venom-bot');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Initialize Express app
const app = express();
app.use(express.json());

// Botpress configuration
const BOTPRESS_WEBHOOK_URL = process.env.BOTPRESS_WEBHOOK_URL || 'https://webhook.botpress.cloud/fdab131d-0b23-4f3b-a11c-bbae29647cc3';
const BOTPRESS_ACCESS_TOKEN = process.env.BOTPRESS_ACCESS_TOKEN || 'bp_pat_c9zbOwjtv0bF7qB8sqvo2P25SDTscDq5BenQ';

// Validate Botpress configuration
if (!BOTPRESS_ACCESS_TOKEN) {
    console.error('Error: BOTPRESS_ACCESS_TOKEN is not set. Please add it to your .env file.');
    process.exit(1);
}
if (!BOTPRESS_WEBHOOK_URL) {
    console.error('Error: BOTPRESS_WEBHOOK_URL is not set. Please add it to your .env file.');
    process.exit(1);
}

// Initialize Venom-bot for WhatsApp
venom
    .create(
        'whatsapp-bot-session', // Session name
        (base64Qr, asciiQR) => {
            console.log('Scan this QR Code with your WhatsApp app:');
            console.log(asciiQR); // Displays QR code in terminal
        },
        (statusSession) => {
            console.log('Session status:', statusSession);
        },
        {
            headless: true, // Headless mode for servers
            useChrome: true // Use Chrome for stability
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
        const sender = message.from; // WhatsApp sender ID (e.g., 1234567890@s.whatsapp.net)
        const messageContent = message.body; // The text of the message
        const messageId = uuidv4(); // Generate a unique message ID
        const conversationId = sender; // Use sender ID as conversation ID

        try {
            console.log(`Received message from ${sender}: ${messageContent}`);
            // Send message to Botpress via Webhook URL
            const response = await axios.post(
                BOTPRESS_WEBHOOK_URL,
                {
                    userid: sender, // Identifies the WhatsApp user
                    messageId: messageId, // Unique ID for this message
                    conversationId: conversationId, // Unique conversation identifier
                    type: 'text', // Message type as per Botpress docs
                    text: messageContent, // The actual message content
                    payload: {} // Optional additional data
                },
                {
                    headers: {
                        'Authorization': `bearer ${BOTPRESS_ACCESS_TOKEN}`, // Bearer token for authentication
                        'Content-Type': 'application/json' // Required content type
                    },
                    timeout: 10000 // 10-second timeout to avoid hanging
                }
            );
            console.log('Message sent to Botpress:', response.data);
        } catch (error) {
            console.error('Error sending message to Botpress:', error.message);
            if (error.response) {
                console.error('Botpress response:', error.response.data);
            }
        }
    });

    // Optional: Handle responses from Botpress
    app.post('/botpress-response', async (req, res) => {
        try {
            const { conversationId, type, payload } = req.body;
            if (type === 'text' && payload.text) {
                await client.sendText(conversationId, payload.text);
                console.log(`Sent Botpress reply to ${conversationId}: ${payload.text}`);
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
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});