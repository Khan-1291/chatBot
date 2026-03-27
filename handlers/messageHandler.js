/**
 * Main Message Handler
 * Routes messages to appropriate handlers based on type and context
 */

const {
    getOrCreateMerchant,
    getMerchant,
    getOrCreateConversation,
    getProductsByMerchant,
    searchProducts,
    getProductById,
    createOrder,
    updateOrderStatus,
    getOrdersByCustomer,
    getOrdersByMerchant,
    updateMerchantPayments,
    updateConversationState,
    resetConversation,
    createOrUpdateProduct,
    getMerchantStats
} = require('../db/supabase');

const { extractProductInfo, generateCustomerResponse, generateConversationalReply, canMakeAiCall } = require('../ai/extractor');
const { getContentType } = require('@whiskeysockets/baileys');
const { formatPrice, formatProductList, formatOrderConfirmation, isMerchantCommand } = require('../utils/helpers');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

/**
 * Main message handler
 */
async function messageHandler(sock, msg, logger) {
    try {
        const remoteJid = msg.key.remoteJid;
        const sender = remoteJid.replace('@s.whatsapp.net', '');
        const isGroup = remoteJid.endsWith('@g.us');

        // Skip group messages for now (can be enabled later)
        if (isGroup) {
            logger.info('Skipping group message');
            return;
        }

        // Get message content
        const messageContent = getMessageContent(msg);
        const messageType = getContentType(msg.message);

        logger.info(`Message from ${sender}: ${messageType}`);
        logger.info(`Content: ${messageContent?.substring(0, 100)}...`);

        // Check if sender is a merchant
        const merchant = await getMerchant(sender);

        if (merchant) {
            // Handle merchant messages
            await handleMerchantMessage(sock, msg, merchant, messageContent, messageType, logger);
        } else {
            // Handle customer messages
            await handleCustomerMessage(sock, msg, sender, messageContent, messageType, logger);
        }

    } catch (error) {
        logger.error('Error in messageHandler:', error);
        console.error("Error in messageHandler:", error);
    }
}

/**
 * Handle merchant messages (product training, order management)
 */
async function handleMerchantMessage(sock, msg, merchant, text, messageType, logger) {
    const sender = msg.key.remoteJid;

    // Handle image messages (product training)
    if (messageType === 'imageMessage') {
        await handleMerchantImageMessage(sock, msg, merchant, logger);
        return;
    }

    if (!text) return;

    const lowerText = text.toLowerCase().trim();

    // Command: START - Welcome message
    if (lowerText === 'start' || lowerText === 'help') {
        const welcomeMsg = `*Assalam-o-Alaikum!* 👋\n\n` +
            `I'm your *ShopBot* assistant. Here's how to use me:\n\n` +
            `*Add Products:*\n` +
            `Send product photo with caption like:\n` +
            `"Red Kurta Medium Large Rs 2500"\n\n` +
            `*Commands:*\n` +
            `• *products* - View all your products\n` +
            `• *orders* - View pending orders\n` +
            `• *stats* - View shop statistics\n` +
            `• *payments* - Update payment numbers\n` +
            `• *help* - Show this message\n\n` +
            `Your customers can message this number to browse and order products!`;

        await sock.sendMessage(sender, { text: welcomeMsg });
        return;
    }

    // Command: PRODUCTS - List all products
    if (lowerText === 'products' || lowerText === 'my products') {
        const products = await getProductsByMerchant(merchant.phone_number);

        if (products.length === 0) {
            await sock.sendMessage(sender, {
                text: 'Aapke pass abhi koi products nahi hain.\n\nProduct add karne ke liye photo bhejain with caption like:\n"Red Kurta Medium Large Rs 2500"'
            });
            return;
        }

        let productList = `*Your Products (${products.length}):*\n\n`;
        products.forEach((p, i) => {
            productList += `${i + 1}. *${p.name}* - Rs ${p.price}\n`;
            if (p.sizes?.length) productList += `   Sizes: ${p.sizes.join(', ')}\n`;
            if (p.colors?.length) productList += `   Colors: ${p.colors.join(', ')}\n`;
            productList += `   Status: ${p.in_stock ? '✅ In Stock' : '❌ Out of Stock'}\n\n`;
        });

        await sock.sendMessage(sender, { text: productList });
        return;
    }

    // Command: ORDERS - List pending orders
    if (lowerText === 'orders' || lowerText === 'my orders') {
        const orders = await getOrdersByMerchant(merchant.phone_number);

        if (orders.length === 0) {
            await sock.sendMessage(sender, {
                text: 'Aapke pass abhi koi orders nahi hain.'
            });
            return;
        }

        const pendingOrders = orders.filter(o => o.status === 'pending');
        const paidOrders = orders.filter(o => o.status === 'paid');

        let orderList = `*Your Orders:*\n\n`;

        if (pendingOrders.length > 0) {
            orderList += `*⏳ Pending (${pendingOrders.length}):*\n`;
            pendingOrders.slice(0, 5).forEach(o => {
                orderList += `• #${o.id.slice(-6)} - ${o.product?.name || 'Product'} - Rs ${o.total_amount}\n`;
                orderList += `  Customer: ${o.customer_phone}\n\n`;
            });
        }

        if (paidOrders.length > 0) {
            orderList += `*💰 Paid - Awaiting Confirmation (${paidOrders.length}):*\n`;
            paidOrders.slice(0, 3).forEach(o => {
                orderList += `• #${o.id.slice(-6)} - ${o.product?.name || 'Product'} - Rs ${o.total_amount}\n`;
            });
        }

        if (pendingOrders.length === 0 && paidOrders.length === 0) {
            orderList += 'Koi pending orders nahi hain.\n';
        }

        await sock.sendMessage(sender, { text: orderList });
        return;
    }

    // Command: STATS - Shop statistics
    if (lowerText === 'stats' || lowerText === 'statistics') {
        const stats = await getMerchantStats(merchant.phone_number);

        const statsMsg = `*📊 Shop Statistics:*\n\n` +
            `*Products:* ${stats.productCount}\n` +
            `*Total Orders:* ${stats.totalOrders}\n` +
            `*Pending:* ${stats.pendingOrders}\n` +
            `*Paid:* ${stats.paidOrders}\n` +
            `*Confirmed:* ${stats.confirmedOrders}\n` +
            `*Total Revenue:* Rs ${stats.totalRevenue}\n\n` +
            `Keep up the good work! 💪`;

        await sock.sendMessage(sender, { text: statsMsg });
        return;
    }

    // Command: PAYMENTS - Update payment numbers
    if (lowerText.startsWith('payments') || lowerText.startsWith('payment')) {
        const parts = text.split(' ');
        if (parts.length >= 3) {
            const easypaisa = parts[1];
            const jazzcash = parts[2];

            // Validate Pakistani mobile numbers
            const phoneRegex = /^03\d{9}$/;
            if (!phoneRegex.test(easypaisa) || !phoneRegex.test(jazzcash)) {
                await sock.sendMessage(sender, {
                    text: '❌ Invalid number format. Use format: 03XXXXXXXXX\n\nExample: payments 03123456789 03123456789'
                });
                return;
            }

            await updateMerchantPayments(merchant.phone_number, easypaisa, jazzcash);
            await sock.sendMessage(sender, {
                text: `✅ Payment numbers updated!\n\nEasypaisa: ${easypaisa}\nJazzCash: ${jazzcash}`
            });
        } else {
            await sock.sendMessage(sender, {
                text: `*Current Payment Numbers:*\n\n` +
                    `Easypaisa: ${merchant.easypaisa_number || 'Not set'}\n` +
                    `JazzCash: ${merchant.jazzcash_number || 'Not set'}\n\n` +
                    `To update, send:\n` +
                    `payments 03XXXXXXXXX 03XXXXXXXXX`
            });
        }
        return;
    }

    // Command: DELETE - Delete a product
    if (lowerText.startsWith('delete')) {
        const parts = text.split(' ');
        if (parts.length >= 2) {
            const productIndex = parseInt(parts[1]) - 1;
            const products = await getProductsByMerchant(merchant.phone_number);

            if (productIndex >= 0 && productIndex < products.length) {
                const product = products[productIndex];
                const { deleteProduct } = require('../db/supabase');
                await deleteProduct(product.id, merchant.phone_number);
                await sock.sendMessage(sender, {
                    text: `✅ Product "${product.name}" deleted successfully!`
                });
            } else {
                await sock.sendMessage(sender, {
                    text: '❌ Invalid product number. Send "products" to see the list.'
                });
            }
        }
        return;
    }

    // Command: CONFIRM ORDER - Confirm a paid order
    if (lowerText.startsWith('confirm order') || lowerText.startsWith('confirm #')) {
        const orderId = lowerText.replace('confirm order', '').replace('confirm #', '').trim();
        if (orderId) {
            // Find order by partial ID
            const orders = await getOrdersByMerchant(merchant.phone_number);
            const order = orders.find(o => o.id.includes(orderId) && o.status === 'paid');

            if (order) {
                await updateOrderStatus(order.id, 'confirmed', { confirmed_at: new Date().toISOString() });
                await sock.sendMessage(sender, {
                    text: `✅ Order #${orderId} confirmed!\n\nCustomer ko inform kar diya jayega.`
                });

                // Notify customer
                await sock.sendMessage(order.customer_phone + '@s.whatsapp.net', {
                    text: `🎉 *Good news!*\n\nAapka order *#${orderId}* confirm ho gaya hai!\n\nProduct: ${order.product?.name}\nAmount: Rs ${order.total_amount}\n\nJald delivery ki details share ki jayengi. Shukriya! 🙏`
                });
            } else {
                await sock.sendMessage(sender, {
                    text: '❌ Order not found or not in paid status.'
                });
            }
        }
        return;
    }

    // Default: Unknown command
    await sock.sendMessage(sender, {
        text: `Samajh nahi aaya. 🤔\n\nAvailable commands:\n` +
            `• *products* - View your products\n` +
            `• *orders* - View orders\n` +
            `• *stats* - View statistics\n` +
            `• *payments* - Update payment numbers\n` +
            `• *help* - Show help\n\n` +
            `Product add karne ke liye photo bhejain with caption.`
    });
}

/**
 * Handle merchant image messages (product training)
 */
async function handleMerchantImageMessage(sock, msg, merchant, logger) {
    const sender = msg.key.remoteJid;

    try {
        // Download image
        const buffer = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            {
                logger,
                reuploadRequest: sock.updateMediaMessage
            }
        );

        // Get caption
        const caption = msg.message.imageMessage.caption || '';

        if (!caption.trim()) {
            await sock.sendMessage(sender, {
                text: '❌ Photo ke saath caption bhi bhejain.\n\nExample: "Red Kurta Medium Large Rs 2500"'
            });
            return;
        }

        // Check AI rate limit
        if (!canMakeAiCall()) {
            await sock.sendMessage(sender, {
                text: '⚠️ AI daily limit reached. Please try tomorrow or add product manually.'
            });
            return;
        }

        // Send processing message
        await sock.sendMessage(sender, { text: '⏳ Product information extract ho rahi hai...' });

        // Extract product info using AI
        const extraction = await extractProductInfo(caption);

        if (!extraction.success) {
            await sock.sendMessage(sender, {
                text: `❌ ${extraction.message}\n\nPlease try again with format:\n"Red Kurta Medium Large Rs 2500"`
            });
            return;
        }

        // Save image to file (in production, upload to Supabase storage)
        const imageFileName = `product_${Date.now()}.jpg`;
        const imagePath = path.join(__dirname, '..', 'uploads', imageFileName);
        await fs.ensureDir(path.dirname(imagePath));
        await fs.writeFile(imagePath, buffer);

        // Create or update product
        const productData = {
            merchant_phone: merchant.phone_number,
            name: extraction.data.name,
            price: extraction.data.price,
            sizes: extraction.data.sizes,
            colors: extraction.data.colors,
            image_url: imagePath,
            raw_caption: caption,
            in_stock: extraction.data.in_stock
        };

        const product = await createOrUpdateProduct(productData);

        // Send confirmation
        const action = product.isUpdate ? 'updated' : 'added';
        const confirmationMsg = `✅ Product ${action} successfully!\n\n` +
            `*${product.name}*\n` +
            `Price: Rs ${product.price}\n`;

        if (product.sizes?.length) {
            confirmationMsg += `Sizes: ${product.sizes.join(', ')}\n`;
        }
        if (product.colors?.length) {
            confirmationMsg += `Colors: ${product.colors.join(', ')}\n`;
        }

        confirmationMsg += `\nCustomers can now order this product! 🎉`;

        await sock.sendMessage(sender, { text: confirmationMsg });

        // Send the image back as confirmation
        await sock.sendMessage(sender, {
            image: { url: imagePath },
            caption: `${product.name} - Rs ${product.price}`
        });

    } catch (error) {
        logger.error('Error handling merchant image:', error);
        await sock.sendMessage(sender, {
            text: '❌ Error processing image. Please try again.'
        });
    }
}

/**
 * Handle customer messages — AI-powered natural conversation
 */
async function handleCustomerMessage(sock, msg, customerPhone, text, messageType, logger) {
    const sender = msg.key.remoteJid;
    
    const { getSupabase } = require('../db/supabase');
    const supabase = getSupabase();
    
    // Get the merchant for this bot
    const { data: merchants, error } = await supabase
        .from('merchants')
        .select('*')
        .limit(1);
    
    if (error || !merchants || merchants.length === 0) {
        await sock.sendMessage(sender, { text: 'Bot abhi setup nahi hua. Please try again later.' });
        return;
    }
    
    const merchant = merchants[0];
    let conversation = await getOrCreateConversation(customerPhone, merchant.phone_number);
    
    // Handle non-text messages (images, audio etc.)
    if (!text) {
        await sock.sendMessage(sender, { 
            text: `Assalam-o-Alaikum! 👋 *${merchant.business_name}* mein khush amdeed!\n\n` +
                `Kuch bhi type karein — products poochein, price check karein, ya order karein. Main help karunga! 😊`
        });
        return;
    }
    
    const lowerText = text.toLowerCase().trim();
    
    // ─── HARD TRANSACTIONAL COMMANDS (always keyword-based for reliability) ───
    
    // Product selection by number while in 'selecting' state
    const orderMatch = lowerText.match(/^(?:order\s+|book\s+|buy\s+|#)?(\d+)$/);
    if (orderMatch && conversation.state === 'selecting' && conversation.cart?.products) {
        const productIndex = parseInt(orderMatch[1]) - 1;
        const products = conversation.cart.products;
        
        if (productIndex >= 0 && productIndex < products.length) {
            const selectedProduct = products[productIndex];
            await updateConversationState(customerPhone, merchant.phone_number, 'confirming', { selectedProduct });
            
            let confirmMsg = `Aapne select kiya: ✅\n\n*${selectedProduct.name}*\n💰 Price: Rs ${selectedProduct.price}\n`;
            if (selectedProduct.sizes?.length) confirmMsg += `📏 Sizes: ${selectedProduct.sizes.join(', ')}\n`;
            if (selectedProduct.colors?.length) confirmMsg += `🎨 Colors: ${selectedProduct.colors.join(', ')}\n`;
            confirmMsg += `\nConfirm karna chahte hain? *CONFIRM* likhain ya *CANCEL* karein.`;
            
            await sock.sendMessage(sender, { text: confirmMsg });
        } else {
            await sock.sendMessage(sender, { text: `❌ Galat number. 1 se ${products.length} ke darmiyan likhain.` });
        }
        return;
    }
    
    // CONFIRM order
    if (['confirm', 'haan', 'yes', 'ji', 'ha', 'okay', 'ok'].includes(lowerText) &&
        conversation.state === 'confirming' && conversation.cart?.selectedProduct) {
        const product = conversation.cart.selectedProduct;
        const order = await createOrder({
            merchant_phone: merchant.phone_number,
            customer_phone: customerPhone,
            product_id: product.id,
            quantity: 1,
            total_amount: product.price
        });
        
        await updateConversationState(customerPhone, merchant.phone_number, 'awaiting_payment', { 
            orderId: order.id, product 
        });
        
        await sock.sendMessage(sender, {
            text: `✅ *Order Ban Gaya!*\n\n` +
                `Order #: *${order.id.slice(-6)}*\n` +
                `Product: ${product.name}\n` +
                `Amount: *Rs ${order.total_amount}*\n\n` +
                `*Payment Options:*\n` +
                `1️⃣ Easypaisa: ${merchant.easypaisa_number || 'N/A'}\n` +
                `2️⃣ JazzCash: ${merchant.jazzcash_number || 'N/A'}\n\n` +
                `Payment ke baad *PAID* likhain. Shukriya! 🙏`
        });
        
        // Notify merchant
        await sock.sendMessage(merchant.phone_number + '@s.whatsapp.net', {
            text: `🛒 *Naya Order!*\n\nOrder #: ${order.id.slice(-6)}\nCustomer: ${customerPhone}\nProduct: ${product.name}\nAmount: Rs ${order.total_amount}\nStatus: ⏳ Pending Payment`
        });
        return;
    }
    
    // PAID confirmation
    if ((lowerText === 'paid' || lowerText === 'payment done' || lowerText === 'pay ho gaya' || lowerText === 'payment kar diya') &&
        conversation.state === 'awaiting_payment' && conversation.cart?.orderId) {
        const orderId = conversation.cart.orderId;
        const product = conversation.cart.product;
        
        await updateOrderStatus(orderId, 'paid', { paid_at: new Date().toISOString() });
        await sock.sendMessage(sender, {
            text: `🎉 *Bohat shukriya!*\n\nPayment mil gayi.\nOrder #: *${orderId.slice(-6)}*\n\nDukan malik jald confirm karengay aur delivery ki details bhejengay. 📦`
        });
        
        await sock.sendMessage(merchant.phone_number + '@s.whatsapp.net', {
            text: `💰 *Payment Aa Gayi!*\n\nOrder #: ${orderId.slice(-6)}\nCustomer: ${customerPhone}\nProduct: ${product?.name || 'N/A'}\nAmount: Rs ${product?.price || 'N/A'}\n\nConfirm: *confirm #${orderId.slice(-6)}*`
        });
        
        await resetConversation(customerPhone, merchant.phone_number);
        return;
    }
    
    // CANCEL
    if (['cancel', 'stop', 'nahi', 'na', 'nope', 'band karo'].includes(lowerText)) {
        await resetConversation(customerPhone, merchant.phone_number);
        await sock.sendMessage(sender, { 
            text: `Theek hai! Order cancel ho gaya. 😊\n\nKabhi bhi wapas aaein — hum yahan hain!`
        });
        return;
    }
    
    // ─── LOCAL SMART HANDLERS (no AI needed — always fast & reliable) ───

    // Greetings
    const greetings = ['hi', 'hello', 'hey', 'assalam', 'aslam', 'salam', 'assalamualaikum', 'asslam', 'walaikum'];
    if (greetings.some(g => lowerText.includes(g))) {
        await sock.sendMessage(sender, {
            text: `Wa Alaikum Assalam! 😊 *${merchant.business_name}* mein khush amdeed!\n\n` +
                `Main aapka shopping assistant hoon. Kya dekhna chahenge?\n\n` +
                `• *products* — Saare products dekhein\n` +
                `• Product ka naam type karein — mujhe batain\n\n` +
                `Kuch bhi poochein, main haazir hoon! 🙏`
        });
        await resetConversation(customerPhone, merchant.phone_number);
        return;
    }

    // Small talk — how are you etc.
    const smallTalk = ['how are you', 'kese ho', 'kaisa ho', 'kaise ho', 'theek', 'kaisy', 'kya haal', 'sup', 'what\'s up', 'wassup', 'hows it going', 'acha', 'sahi', 'fine', 'good', 'ok', 'okay'];
    if (smallTalk.some(s => lowerText === s || lowerText.startsWith(s))) {
        const responses = [
            `Bilkul theek hoon, shukriya poochne ka! 😄 Aur aap?\n\nKya aaj kuch dekhna chahenge? Hamare paas bahut acha collection hai! 🛍️`,
            `Main theek hoon, aap bhi theek rahein! 😊\n\nAaj koi product dekhna hai? *products* likh kar poora catalog dekh saktay hain.`,
            `Acha hoon! Aapka khayal rakhne ke liye yahan hoon. 😄\n\nKuch chahiye toh batain — products, price, ya kuch aur!`
        ];
        await sock.sendMessage(sender, { text: responses[Math.floor(Math.random() * responses.length)] });
        return;
    }

    // Show products command
    const showProducts = ['products', 'product', 'catalog', 'list', 'sab dikhao', 'kya hai', 'kya kya hai', 'show products', 'all products', 'dikhao'];
    if (showProducts.some(s => lowerText === s || lowerText.includes(s))) {
        const products = await getProductsByMerchant(merchant.phone_number, 20);
        if (products.length === 0) {
            await sock.sendMessage(sender, { text: `Abhi koi products available nahi hain. 😔\nJald add ho rahe hain — thodi der baad check karein!` });
            return;
        }
        let response = `*${merchant.business_name} — Products:* 🛍️\n\n`;
        products.slice(0, 10).forEach((p, i) => {
            response += `*${i + 1}.* ${p.name} — Rs ${p.price}\n`;
            if (p.sizes?.length) response += `   📏 ${p.sizes.join(', ')}\n`;
            if (p.colors?.length) response += `   🎨 ${p.colors.join(', ')}\n`;
            response += '\n';
        });
        if (products.length > 10) response += `...aur ${products.length - 10} products\n\n`;
        response += `Order ke liye product number likhain (e.g. *1*)`;
        await sock.sendMessage(sender, { text: response });
        await updateConversationState(customerPhone, merchant.phone_number, 'selecting', { products: products.slice(0, 10) });
        return;
    }

    // Help command
    if (lowerText === 'help' || lowerText === 'madad') {
        await sock.sendMessage(sender, {
            text: `Main kaise help kar sakta hoon? 😊\n\n` +
                `• *products* — Saara catalog dekhein\n` +
                `• *[product name]* — Kisi cheez ki details poochein\n` +
                `• *cancel* — Koi bhi order cancel karein\n\n` +
                `Kuch bhi type karein — main samajhunga! 🙏`
        });
        return;
    }

    // ─── AI-POWERED NATURAL CONVERSATION (for everything else) ───

    const allProducts = await getProductsByMerchant(merchant.phone_number, 20);

    console.log(`[AI] Calling Gemini for: "${text}" | Products: ${allProducts.length}`);
    const aiResult = await generateConversationalReply(
        text, allProducts, merchant, conversation.state
    );
    console.log(`[AI] Result:`, JSON.stringify(aiResult));

    if (aiResult.success && aiResult.reply) {
        await sock.sendMessage(sender, { text: aiResult.reply });
        if (['show_products', 'product_inquiry'].includes(aiResult.intent) && allProducts.length > 0) {
            await updateConversationState(customerPhone, merchant.phone_number, 'selecting', {
                products: allProducts.slice(0, 10)
            });
        }
        return;
    }

    // Final fallback — friendly even when AI is down
    const noProductsFallback = `Assalam-o-Alaikum! 😊 *${merchant.business_name}* mein khush amdeed!\n\nAbhi products add ho rahe hain. Thodi der baad *products* likh kar check karein.\n\nKoi sawal ho toh zaroor poochein! 🙏`;
    const hasProductsFallback = `Madad ke liye haazir hoon! 😊\n\nHamary paas *${allProducts.length} products* hain.\n*products* likhain catalog dekhne ke liye, ya mujhe batain kya chahiye!`;

    await sock.sendMessage(sender, { text: allProducts.length > 0 ? hasProductsFallback : noProductsFallback });
}

/**
 * Extract text content from message
 */
function getMessageContent(msg) {
    try {
        const message = msg.message;
        if (!message) return null;

        const type = getContentType(message);
        if (!type) return null;

        switch (type) {
            case 'conversation':
                return message.conversation;
            case 'extendedTextMessage':
                return message.extendedTextMessage.text;
            case 'imageMessage':
                return message.imageMessage.caption;
            case 'videoMessage':
                return message.videoMessage.caption;
            case 'documentMessage':
                return message.documentMessage.caption;
            default:
                return null;
        }
    } catch (error) {
        return null;
    }
}

module.exports = messageHandler;
