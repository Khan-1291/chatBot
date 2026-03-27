/**
 * AI Extractor Module
 * Uses OpenRouter (free tier) or Google Gemini (free tier) for product extraction
 * 
 * OpenRouter: 50 requests/day free
 * Gemini: 60 requests/min free
 */

const axios = require('axios');

// Rate limiting
const MAX_AI_CALLS_PER_DAY = parseInt(process.env.MAX_AI_CALLS_PER_DAY) || 50;

/**
 * Check if we can make an AI call
 */
function canMakeAiCall() {
    return global.aiCallCount < MAX_AI_CALLS_PER_DAY;
}

/**
 * Increment AI call counter
 */
function incrementAiCall() {
    global.aiCallCount++;
    console.log(`AI calls today: ${global.aiCallCount}/${MAX_AI_CALLS_PER_DAY}`);
}

/**
 * Extract product information from caption using AI
 */
async function extractProductInfo(caption) {
    try {
        // Check rate limit
        if (!canMakeAiCall()) {
            console.log('AI rate limit reached');
            return {
                success: false,
                error: 'RATE_LIMIT',
                message: 'AI daily limit reached. Please try tomorrow or contact owner directly.'
            };
        }
        
        const aiProvider = process.env.AI_PROVIDER || 'openrouter';
        
        let result;
        if (aiProvider === 'gemini') {
            result = await extractWithGemini(caption);
        } else {
            result = await extractWithOpenRouter(caption);
        }
        
        incrementAiCall();
        return result;
        
    } catch (error) {
        console.error('Error in extractProductInfo:', error);
        return {
            success: false,
            error: 'EXTRACTION_FAILED',
            message: 'Samajh nahi aaya. Please send like: "Red Kurta Medium Large Rs 2500"'
        };
    }
}

/**
 * Extract product info using OpenRouter (Free tier: 50 requests/day)
 */
async function extractWithOpenRouter(caption) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    
    if (!apiKey) {
        throw new Error('OpenRouter API key not configured');
    }
    
    const model = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct';
    
    const prompt = `Extract product information from this Pakistani shop caption in Roman Urdu or English.

Caption: "${caption}"

Extract and return ONLY a JSON object with these fields:
- product_name: The product name (in English or Roman Urdu)
- price: Price in PKR (just the number, no currency symbol)
- sizes: Array of available sizes (e.g., ["S", "M", "L", "XL"] or ["Small", "Medium", "Large"])
- colors: Array of available colors (e.g., ["Red", "Blue", "Black"])
- in_stock: Boolean (true unless caption mentions "out of stock", "sold out", "khatam", etc.)

Return ONLY valid JSON like this example:
{
  "product_name": "Red Kurta",
  "price": 2500,
  "sizes": ["M", "L", "XL"],
  "colors": ["Red", "Maroon"],
  "in_stock": true
}

If price is not found, set price to null.
If sizes not mentioned, return empty array [].
If colors not mentioned, return empty array [].`;

    try {
        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful assistant that extracts product information from Pakistani shop captions. Always return valid JSON only.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 500
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://whatsapp-bot.render.com',
                    'X-Title': 'Pakistani WhatsApp Bot'
                },
                timeout: 30000
            }
        );
        
        const content = response.data.choices[0]?.message?.content;
        
        if (!content) {
            throw new Error('Empty response from OpenRouter');
        }
        
        // Parse JSON from response
        const parsedData = parseJsonFromResponse(content);
        
        return {
            success: true,
            data: {
                name: parsedData.product_name || parsedData.name || 'Unknown Product',
                price: parseFloat(parsedData.price) || 0,
                sizes: Array.isArray(parsedData.sizes) ? parsedData.sizes : [],
                colors: Array.isArray(parsedData.colors) ? parsedData.colors : [],
                in_stock: parsedData.in_stock !== false,
                raw_caption: caption
            }
        };
        
    } catch (error) {
        console.error('OpenRouter API error:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Extract product info using Google Gemini (Free tier: 60 requests/min)
 */
async function extractWithGemini(caption) {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
        throw new Error('Gemini API key not configured');
    }
    
    const prompt = `Extract product information from this Pakistani shop caption in Roman Urdu or English.

Caption: "${caption}"

Extract and return ONLY a JSON object with these fields:
- product_name: The product name (in English or Roman Urdu)
- price: Price in PKR (just the number, no currency symbol)
- sizes: Array of available sizes (e.g., ["S", "M", "L", "XL"] or ["Small", "Medium", "Large"])
- colors: Array of available colors (e.g., ["Red", "Blue", "Black"])
- in_stock: Boolean (true unless caption mentions "out of stock", "sold out", "khatam", etc.)

Return ONLY valid JSON like this example:
{
  "product_name": "Red Kurta",
  "price": 2500,
  "sizes": ["M", "L", "XL"],
  "colors": ["Red", "Maroon"],
  "in_stock": true
}

If price is not found, set price to null.
If sizes not mentioned, return empty array [].
If colors not mentioned, return empty array [].`;

    try {
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
                contents: [
                    {
                        parts: [
                            {
                                text: prompt
                            }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 500
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );
        
        const content = response.data.candidates[0]?.content?.parts[0]?.text;
        
        if (!content) {
            throw new Error('Empty response from Gemini');
        }
        
        // Parse JSON from response
        const parsedData = parseJsonFromResponse(content);
        
        return {
            success: true,
            data: {
                name: parsedData.product_name || parsedData.name || 'Unknown Product',
                price: parseFloat(parsedData.price) || 0,
                sizes: Array.isArray(parsedData.sizes) ? parsedData.sizes : [],
                colors: Array.isArray(parsedData.colors) ? parsedData.colors : [],
                in_stock: parsedData.in_stock !== false,
                raw_caption: caption
            }
        };
        
    } catch (error) {
        console.error('Gemini API error:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Parse JSON from AI response (handles various formats)
 */
function parseJsonFromResponse(content) {
    try {
        // Try direct JSON parse first
        try {
            return JSON.parse(content.trim());
        } catch (e) {
            // Continue to other methods
        }
        
        // Try to extract JSON from markdown code blocks
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[1].trim());
        }
        
        // Try to find JSON between curly braces
        const braceMatch = content.match(/\{[\s\S]*\}/);
        if (braceMatch) {
            return JSON.parse(braceMatch[0]);
        }
        
        throw new Error('Could not parse JSON from response');
        
    } catch (error) {
        console.error('JSON parse error. Content:', content);
        throw new Error('Failed to parse AI response as JSON');
    }
}

/**
 * Generate response to customer inquiry
 */
async function generateCustomerResponse(query, products, context = {}) {
    try {
        // Check rate limit
        if (!canMakeAiCall()) {
            return {
                success: false,
                error: 'RATE_LIMIT',
                message: 'Bot busy, try tomorrow or contact owner directly.'
            };
        }
        
        const aiProvider = process.env.AI_PROVIDER || 'openrouter';
        
        let result;
        if (aiProvider === 'gemini') {
            result = await generateWithGemini(query, products, context);
        } else {
            result = await generateWithOpenRouter(query, products, context);
        }
        
        incrementAiCall();
        return result;
        
    } catch (error) {
        console.error('Error in generateCustomerResponse:', error);
        return {
            success: false,
            error: 'GENERATION_FAILED',
            message: null
        };
    }
}

/**
 * Generate response using OpenRouter
 */
async function generateWithOpenRouter(query, products, context) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct';
    
    const productsText = products.map((p, i) => 
        `${i + 1}. ${p.name} - Rs ${p.price}${p.sizes?.length ? ` (Sizes: ${p.sizes.join(', ')})` : ''}${p.colors?.length ? ` (Colors: ${p.colors.join(', ')})` : ''}`
    ).join('\n');
    
    const prompt = `You are a helpful Pakistani shop assistant. A customer asked: "${query}"

Available products:
${productsText || 'No products found'}

Customer context: ${JSON.stringify(context)}

Respond in Roman Urdu or English (mix is fine). Be friendly and helpful.
If products are found, mention the top 3 options with prices.
If no products found, politely say we don't have that item.
Keep response short (2-3 sentences max).

Response:`;

    const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
            model: model,
            messages: [
                {
                    role: 'system',
                    content: 'You are a friendly Pakistani shop assistant. Respond in Roman Urdu/English mix. Be concise and helpful.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 300
        },
        {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://whatsapp-bot.render.com',
                'X-Title': 'Pakistani WhatsApp Bot'
            },
            timeout: 30000
        }
    );
    
    const content = response.data.choices[0]?.message?.content;
    
    return {
        success: true,
        message: content?.trim() || null
    };
}

/**
 * Generate response using Gemini
 */
async function generateWithGemini(query, products, context) {
    const apiKey = process.env.GEMINI_API_KEY;
    
    const productsText = products.map((p, i) => 
        `${i + 1}. ${p.name} - Rs ${p.price}${p.sizes?.length ? ` (Sizes: ${p.sizes.join(', ')})` : ''}${p.colors?.length ? ` (Colors: ${p.colors.join(', ')})` : ''}`
    ).join('\n');
    
    const prompt = `You are a helpful Pakistani shop assistant. A customer asked: "${query}"

Available products:
${productsText || 'No products found'}

Customer context: ${JSON.stringify(context)}

Respond in Roman Urdu or English (mix is fine). Be friendly and helpful.
If products are found, mention the top 3 options with prices.
If no products found, politely say we don't have that item.
Keep response short (2-3 sentences max).

Response:`;

    const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
            contents: [
                {
                    parts: [
                        {
                            text: prompt
                        }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 300
            }
        },
        {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000
        }
    );
    
    const content = response.data.candidates[0]?.content?.parts[0]?.text;
    
    return {
        success: true,
        message: content?.trim() || null
    };
}

/**
 * Get AI status
 */
function getAiStatus() {
    return {
        callsToday: global.aiCallCount,
        callsLimit: MAX_AI_CALLS_PER_DAY,
        remaining: Math.max(0, MAX_AI_CALLS_PER_DAY - global.aiCallCount),
        provider: process.env.AI_PROVIDER || 'openrouter'
    };
}

/**
 * Generate a conversational, intelligent reply using Gemini
 * Handles small talk, product queries, greetings — all naturally
 */
async function generateConversationalReply(userMessage, products, merchant, conversationState) {
    try {
        if (!canMakeAiCall()) {
            return {
                success: false,
                intent: 'rate_limit',
                reply: 'Bohat busy hoon abhi. Thodi der baad try karein ya seedha dukan par aajain. 😊'
            };
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return { success: false, intent: 'unknown', reply: null };
        }

        const productsText = products && products.length > 0
            ? products.map((p, i) =>
                `${i + 1}. ${p.name} - Rs ${p.price}` +
                (p.sizes?.length ? ` | Sizes: ${p.sizes.join(', ')}` : '') +
                (p.colors?.length ? ` | Colors: ${p.colors.join(', ')}` : '')
            ).join('\n')
            : 'Abhi koi products available nahi hain.';

        const systemPrompt = `You are "Jessica", a friendly and smart WhatsApp shop assistant for "${merchant.business_name}", a Pakistani online clothing store.

KEY RULES:
- Respond NATURALLY like a real helpful shop employee would on WhatsApp
- Use a mix of Roman Urdu and English (like Pakistanis actually talk)
- Be warm, friendly, and conversational — NOT robotic
- Keep replies SHORT (2-4 lines max) unless listing products
- Use emojis sparingly but naturally
- If customer greets you, greet back warmly and ask how you can help
- If customer asks "how are you" or small talk — respond naturally and briefly redirect to shopping
- If customer asks about products — help them find what they want
- If customer shows buying intent — guide them to select and confirm
- NEVER say "Samajh nahi aaya" — always try to understand and respond helpfully

AVAILABLE PRODUCTS:
${productsText}

CURRENT CONVERSATION STATE: ${conversationState || 'idle'}

Respond with a JSON object:
{
  "intent": "greeting" | "smalltalk" | "product_inquiry" | "show_products" | "order_intent" | "confirm" | "cancel" | "general",
  "reply": "Your natural WhatsApp reply here"
}

Only return valid JSON. The reply should be plain text (no extra JSON inside reply).`;

        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
                contents: [{ parts: [{ text: `Customer message: "${userMessage}"\n\n${systemPrompt}` }] }],
                generationConfig: { temperature: 0.8, maxOutputTokens: 400 }
            },
            { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
        );

        const content = response.data.candidates[0]?.content?.parts[0]?.text;
        if (!content) throw new Error('Empty Gemini response');

        // Parse the JSON response
        let parsed;
        try {
            parsed = parseJsonFromResponse(content);
        } catch (e) {
            // If JSON parse fails, treat whole response as the reply
            return { success: true, intent: 'general', reply: content.trim() };
        }

        incrementAiCall();
        return {
            success: true,
            intent: parsed.intent || 'general',
            reply: parsed.reply || null
        };

    } catch (error) {
        console.error('Error in generateConversationalReply:', error.response?.data || error.message);
        return { success: false, intent: 'unknown', reply: null };
    }
}

module.exports = {
    extractProductInfo,
    generateCustomerResponse,
    generateConversationalReply,
    getAiStatus,
    canMakeAiCall
};
