/**
 * Pakistani WhatsApp Business Bot
 * Free MVP for Small Merchants
 * 
 * Stack: Node.js + Baileys + Supabase + OpenRouter/Gemini
 * Hosting: Render.com Free Tier
 */

require('dotenv').config();
const { Boom } = require('@hapi/boom');
const makeWASocket = require('@whiskeysockets/baileys').default;
const {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    jidNormalizedUser,
    getContentType
} = require('@whiskeysockets/baileys');
const P = require('pino');
const qrcode = require('qrcode-terminal');
const fs = require('fs-extra');
const path = require('path');
const express = require('express');

// Import handlers
const messageHandler = require('./handlers/messageHandler');
const { initSupabase } = require('./db/supabase');

// Logger setup
const logger = P({
    timestamp: () => `,"time":"${new Date().toJSON()}"`,
    level: process.env.LOG_LEVEL || 'info'
});

// Global state
let sock = null;
let qrCode = null;
let connectionState = 'connecting';
let messageRetryCounter = 0;

// Rate limiting for AI calls
global.aiCallCount = 0;
global.lastAiCallReset = Date.now();

// Reset AI call counter daily
setInterval(() => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    if (now - global.lastAiCallReset > oneDay) {
        global.aiCallCount = 0;
        global.lastAiCallReset = now;
        logger.info('AI call counter reset for new day');
    }
}, 60 * 60 * 1000); // Check every hour

/**
 * Initialize Baileys WhatsApp connection
 */
async function connectToWhatsApp() {
    try {
        logger.info('Starting WhatsApp Bot...');
        
        // Initialize Supabase
        await initSupabase();
        
        // Fetch latest Baileys version
        const { version, isLatest } = await fetchLatestBaileysVersion();
        logger.info(`Using Baileys v${version.join('.')}, isLatest: ${isLatest}`);

        // Auth state setup
        const authDir = path.join(__dirname, 'auth', 'baileys');
        await fs.ensureDir(authDir);
        
        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        
        // Create WhatsApp socket
        sock = makeWASocket({
            version,
            logger: logger.child({ level: 'silent' }),
            printQRInTerminal: true,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger.child({ level: 'silent' }))
            },
            browser: ['Ubuntu', 'Chrome', '20.0.04'],
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
            markOnlineOnConnect: true,
            keepAliveIntervalMs: 30000,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            retryRequestDelayMs: 250
        });

        // Connection event handlers
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                qrCode = qr;
                connectionState = 'qr_ready';
                logger.info('QR Code generated! Scan with WhatsApp:');
                qrcode.generate(qr, { small: true });
            }
            
            if (connection === 'close') {
                connectionState = 'disconnected';
                const shouldReconnect = (lastDisconnect?.error instanceof Boom) && 
                    lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;
                
                logger.error(
                    'Connection closed due to:',
                    lastDisconnect?.error?.message || 'unknown',
                    ', reconnecting:',
                    shouldReconnect
                );
                
                if (shouldReconnect) {
                    logger.info('Reconnecting in 5 seconds...');
                    setTimeout(connectToWhatsApp, 5000);
                } else {
                    logger.error('Connection closed. Please scan QR code again.');
                    // Clear auth state if logged out
                    if (lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut) {
                        await fs.remove(authDir);
                        logger.info('Auth state cleared. Restart to scan new QR code.');
                    }
                }
            } else if (connection === 'open') {
                connectionState = 'connected';
                qrCode = null;
                logger.info('✅ WhatsApp connection established successfully!');
                logger.info(`Bot JID: ${sock.user.id}`);
                logger.info(`Bot Name: ${sock.user.name}`);
                
                // Send startup notification to admin if configured
                const adminNumber = process.env.ADMIN_NUMBER;
                if (adminNumber) {
                    await sendMessage(adminNumber, '✅ *ShopBot is now online!*\n\nReady to help customers and manage orders.');
                }
            } else if (connection === 'connecting') {
                connectionState = 'connecting';
                logger.info('Connecting to WhatsApp...');
            }
        });

        // Credentials update handler
        sock.ev.on('creds.update', saveCreds);

        // Message handler
        sock.ev.on('messages.upsert', async (m) => {
            try {
                if (m.type !== 'notify') return;
                
                for (const msg of m.messages) {
                    // Skip own messages
                    if (msg.key.fromMe) continue;
                    
                    // Skip status updates
                    if (msg.key.remoteJid === 'status@broadcast') continue;
                    
                    // Process message
                    await messageHandler(sock, msg, logger);
                }
            } catch (error) {
                logger.error('Error processing message:', error);
            }
        });

        // Group participants update
        sock.ev.on('group-participants.update', async (update) => {
            logger.info('Group participants update:', update);
        });

        // Presence update handler
        sock.ev.on('presence.update', (update) => {
            // logger.debug('Presence update:', update);
        });

    } catch (error) {
        logger.error('Fatal error in connectToWhatsApp:', error);
        logger.info('Retrying in 10 seconds...');
        setTimeout(connectToWhatsApp, 10000);
    }
}

/**
 * Send text message helper
 */
async function sendMessage(jid, text, options = {}) {
    try {
        if (!sock) {
            throw new Error('WhatsApp socket not initialized');
        }
        
        const normalizedJid = jidNormalizedUser(jid);
        
        const message = await sock.sendMessage(normalizedJid, {
            text: text,
            ...options
        });
        
        logger.info(`Message sent to ${normalizedJid}`);
        return message;
    } catch (error) {
        logger.error('Error sending message:', error);
        throw error;
    }
}

/**
 * Send image message helper
 */
async function sendImageMessage(jid, imageUrl, caption = '', options = {}) {
    try {
        if (!sock) {
            throw new Error('WhatsApp socket not initialized');
        }
        
        const normalizedJid = jidNormalizedUser(jid);
        
        // Download image if URL
        let imageBuffer;
        if (imageUrl.startsWith('http')) {
            const axios = require('axios');
            const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            imageBuffer = Buffer.from(response.data);
        } else {
            imageBuffer = await fs.readFile(imageUrl);
        }
        
        const message = await sock.sendMessage(normalizedJid, {
            image: imageBuffer,
            caption: caption,
            ...options
        });
        
        logger.info(`Image message sent to ${normalizedJid}`);
        return message;
    } catch (error) {
        logger.error('Error sending image message:', error);
        throw error;
    }
}

/**
 * Get connection status
 */
function getStatus() {
    return {
        state: connectionState,
        qrCode: qrCode,
        user: sock?.user || null,
        aiCallsToday: global.aiCallCount,
        aiCallsLimit: parseInt(process.env.MAX_AI_CALLS_PER_DAY) || 50
    };
}

/**
 * Express server for health checks and status
 */
function startExpressServer() {
    const app = express();
    const port = process.env.PORT || 3000;
    
    app.use(express.json());
    
    // Health check endpoint
    app.get('/', (req, res) => {
        const status = getStatus();
        res.json({
            status: 'ok',
            bot: status,
            timestamp: new Date().toISOString()
        });
    });
    
    // Status endpoint
    app.get('/status', (req, res) => {
        res.json(getStatus());
    });
    
    // QR code endpoint (for web display)
    app.get('/qr', (req, res) => {
        const status = getStatus();
        if (status.qrCode) {
            res.json({
                hasQR: true,
                qrCode: status.qrCode,
                message: 'Scan this QR code with WhatsApp'
            });
        } else if (status.state === 'connected') {
            res.json({
                hasQR: false,
                state: status.state,
                user: status.user,
                message: 'Bot is already connected'
            });
        } else {
            res.json({
                hasQR: false,
                state: status.state,
                message: 'QR code not available yet'
            });
        }
    });
    
    // Send message endpoint (for admin notifications)
    app.post('/send', async (req, res) => {
        try {
            const { phone, message } = req.body;
            if (!phone || !message) {
                return res.status(400).json({ error: 'Phone and message required' });
            }
            
            const result = await sendMessage(phone, message);
            res.json({ success: true, messageId: result.key.id });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    
    app.listen(port, () => {
        logger.info(`Express server running on port ${port}`);
    });
}

// Export functions for use in other modules
module.exports = {
    sendMessage,
    sendImageMessage,
    getStatus,
    getSocket: () => sock
};

// Start the bot
if (require.main === module) {
    // Start Express server for Render.com
    startExpressServer();
    
    // Connect to WhatsApp
    connectToWhatsApp();
}
