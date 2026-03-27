/**
 * Utility Helpers
 * Formatting, validation, and helper functions
 */

/**
 * Format price with PKR currency
 */
function formatPrice(price) {
    if (!price && price !== 0) return 'Price not available';
    return `Rs ${price.toLocaleString('en-PK')}`;
}

/**
 * Format product list for display
 */
function formatProductList(products) {
    if (!products || products.length === 0) {
        return 'Koi products nahi mile. 😔';
    }
    
    let response = '*Products:*\n\n';
    
    products.slice(0, 5).forEach((p, i) => {
        response += `*${i + 1}.* ${p.name}\n`;
        response += `   💰 ${formatPrice(p.price)}\n`;
        
        if (p.sizes?.length) {
            response += `   📏 ${p.sizes.join(', ')}\n`;
        }
        if (p.colors?.length) {
            response += `   🎨 ${p.colors.join(', ')}\n`;
        }
        response += '\n';
    });
    
    if (products.length > 5) {
        response += `...aur ${products.length - 5} products\n\n`;
    }
    
    response += `Order karne ke liye number likhain (e.g., *1* ya *order 1*)`;
    
    return response;
}

/**
 * Format order confirmation message
 */
function formatOrderConfirmation(order, product, merchant) {
    let message = `✅ *Order Confirmed!*\n\n`;
    message += `Order #: *${order.id.slice(-6)}*\n`;
    message += `Product: ${product.name}\n`;
    message += `Amount: *${formatPrice(order.total_amount)}*\n\n`;
    
    message += `*Payment Options:*\n`;
    if (merchant.easypaisa_number) {
        message += `📱 Easypaisa: ${merchant.easypaisa_number}\n`;
    }
    if (merchant.jazzcash_number) {
        message += `📱 JazzCash: ${merchant.jazzcash_number}\n`;
    }
    
    message += `\nPayment karne ke baad *PAID* likhain.`;
    
    return message;
}

/**
 * Check if message is a merchant command
 */
function isMerchantCommand(text) {
    if (!text) return false;
    
    const commands = [
        'start', 'help', 'products', 'orders', 'stats', 
        'payments', 'delete', 'confirm', 'cancel'
    ];
    
    const lowerText = text.toLowerCase().trim();
    return commands.some(cmd => lowerText.startsWith(cmd));
}

/**
 * Validate Pakistani mobile number
 */
function validatePakistaniNumber(number) {
    const regex = /^03\d{9}$/;
    return regex.test(number);
}

/**
 * Format Pakistani number for display
 */
function formatPakistaniNumber(number) {
    if (!number) return '';
    if (number.length === 11 && number.startsWith('03')) {
        return `${number.slice(0, 4)}-${number.slice(4, 7)}-${number.slice(7)}`;
    }
    return number;
}

/**
 * Detect language (Roman Urdu or English)
 */
function detectLanguage(text) {
    if (!text) return 'english';
    
    // Common Roman Urdu words
    const romanUrduWords = [
        'hai', 'kya', 'kaisa', 'kese', 'kitna', 'kahan', 'kab', 'kyun',
        'mein', 'mera', 'aap', 'tum', 'yeh', 'woh', 'acha', 'theek',
        'shukriya', 'meherbani', 'kher', 'mubarak', 'bohat', 'thora',
        'sab', 'kuch', 'koi', 'har', 'aur', 'ya', 'lekin', 'magar',
        'dikhao', 'dekhao', 'batao', 'bhejo', 'do', 'lo', 'jao',
        'pasand', 'acha', 'bura', 'bara', 'chota', 'naya', 'purana'
    ];
    
    const lowerText = text.toLowerCase();
    const words = lowerText.split(/\s+/);
    
    const urduWordCount = words.filter(word => 
        romanUrduWords.some(urduWord => word.includes(urduWord))
    ).length;
    
    return urduWordCount > 0 ? 'roman_urdu' : 'english';
}

/**
 * Extract price from text
 */
function extractPrice(text) {
    if (!text) return null;
    
    // Match various price formats
    const patterns = [
        /rs\.?\s*(\d[\d,]*)/i,
        /rupees?\s*(\d[\d,]*)/i,
        /pkr\.?\s*(\d[\d,]*)/i,
        /price[\s:]*(?:rs\.?)?\s*(\d[\d,]*)/i,
        /(?:rs\.?|price)?\s*(\d{3,5})/i
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const price = parseInt(match[1].replace(/,/g, ''));
            if (price > 0 && price < 1000000) {
                return price;
            }
        }
    }
    
    return null;
}

/**
 * Extract sizes from text
 */
function extractSizes(text) {
    if (!text) return [];
    
    const sizePatterns = [
        /\b(s|m|l|xl|xxl|xxxl)\b/gi,
        /\b(small|medium|large|extra large|double xl|triple xl)\b/gi,
        /size[s]?[\s:]*([\w,\s]+)/i
    ];
    
    const sizes = new Set();
    
    for (const pattern of sizePatterns) {
        const matches = text.match(pattern);
        if (matches) {
            matches.forEach(match => {
                const normalized = match.toLowerCase().trim();
                if (['s', 'small'].includes(normalized)) sizes.add('S');
                else if (['m', 'medium'].includes(normalized)) sizes.add('M');
                else if (['l', 'large'].includes(normalized)) sizes.add('L');
                else if (['xl', 'extra large'].includes(normalized)) sizes.add('XL');
                else if (['xxl', 'double xl'].includes(normalized)) sizes.add('XXL');
                else if (['xxxl', 'triple xl'].includes(normalized)) sizes.add('XXXL');
                else sizes.add(match.toUpperCase());
            });
        }
    }
    
    return Array.from(sizes);
}

/**
 * Extract colors from text
 */
function extractColors(text) {
    if (!text) return [];
    
    const commonColors = [
        'red', 'blue', 'green', 'yellow', 'black', 'white', 'pink', 'purple',
        'orange', 'brown', 'gray', 'grey', 'beige', 'maroon', 'navy', 'teal',
        'gold', 'silver', 'bronze', 'cream', 'ivory', 'peach', 'coral',
        'lal', 'neela', 'hara', 'peela', 'kala', 'safed', 'gulabi'
    ];
    
    const colors = [];
    const lowerText = text.toLowerCase();
    
    commonColors.forEach(color => {
        if (lowerText.includes(color)) {
            colors.push(color.charAt(0).toUpperCase() + color.slice(1));
        }
    });
    
    return colors;
}

/**
 * Sanitize text for database
 */
function sanitizeText(text, maxLength = 500) {
    if (!text) return '';
    
    return text
        .replace(/[<>]/g, '')
        .substring(0, maxLength)
        .trim();
}

/**
 * Generate unique order ID
 */
function generateOrderId() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD${timestamp}${random}`;
}

/**
 * Format date for display
 */
function formatDate(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    
    return date.toLocaleDateString('en-PK', options);
}

/**
 * Truncate text
 */
function truncateText(text, maxLength = 100) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

/**
 * Check if text contains order intent
 */
function hasOrderIntent(text) {
    if (!text) return false;
    
    const orderWords = [
        'order', 'book', 'buy', 'purchase', 'lena', 'leni', 'mangwana',
        'chahta', 'chahti', 'pasand', 'dilchaasp', 'interest'
    ];
    
    const lowerText = text.toLowerCase();
    return orderWords.some(word => lowerText.includes(word));
}

/**
 * Check if text contains inquiry intent
 */
function hasInquiryIntent(text) {
    if (!text) return false;
    
    const inquiryWords = [
        'price', 'kitna', 'rate', 'cost', 'kimat', 'qeemat',
        'available', 'hai', 'maujood', 'stock', 'available',
        'show', 'dikhao', 'dekhao', 'batao', 'kya'
    ];
    
    const lowerText = text.toLowerCase();
    return inquiryWords.some(word => lowerText.includes(word));
}

/**
 * Create delay promise
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
async function retry(fn, maxRetries = 3, delayMs = 1000) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            console.log(`Retry ${i + 1}/${maxRetries} failed:`, error.message);
            
            if (i < maxRetries - 1) {
                await delay(delayMs * Math.pow(2, i));
            }
        }
    }
    
    throw lastError;
}

module.exports = {
    formatPrice,
    formatProductList,
    formatOrderConfirmation,
    isMerchantCommand,
    validatePakistaniNumber,
    formatPakistaniNumber,
    detectLanguage,
    extractPrice,
    extractSizes,
    extractColors,
    sanitizeText,
    generateOrderId,
    formatDate,
    truncateText,
    hasOrderIntent,
    hasInquiryIntent,
    delay,
    retry
};
