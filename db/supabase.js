/**
 * Supabase Database Operations
 * Free tier: 500MB PostgreSQL + 1GB storage
 */

const { createClient } = require('@supabase/supabase-js');

let supabase = null;

/**
 * Initialize Supabase client
 */
function initSupabase() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Supabase credentials not found in environment variables');
        console.error('Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env file');
        throw new Error('Supabase credentials missing');
    }
    
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase client initialized');
    return supabase;
}

/**
 * Get Supabase client (initialize if needed)
 */
function getSupabase() {
    if (!supabase) {
        return initSupabase();
    }
    return supabase;
}

// ============================================
// MERCHANT OPERATIONS
// ============================================

/**
 * Get or create merchant
 */
async function getOrCreateMerchant(phoneNumber, businessName = null) {
    try {
        const supabase = getSupabase();
        
        // Try to get existing merchant
        let { data: merchant, error } = await supabase
            .from('merchants')
            .select('*')
            .eq('phone_number', phoneNumber)
            .single();
        
        if (error && error.code !== 'PGRST116') {
            throw error;
        }
        
        // Create new merchant if not exists
        if (!merchant) {
            const { data: newMerchant, error: createError } = await supabase
                .from('merchants')
                .insert([{
                    phone_number: phoneNumber,
                    business_name: businessName || `Shop ${phoneNumber}`,
                    easypaisa_number: phoneNumber,
                    jazzcash_number: phoneNumber,
                    created_at: new Date().toISOString()
                }])
                .select()
                .single();
            
            if (createError) throw createError;
            merchant = newMerchant;
            console.log(`✅ New merchant created: ${phoneNumber}`);
        }
        
        return merchant;
    } catch (error) {
        console.error('Error in getOrCreateMerchant:', error);
        throw error;
    }
}

/**
 * Get merchant by phone number
 */
async function getMerchant(phoneNumber) {
    try {
        const supabase = getSupabase();
        
        const { data: merchant, error } = await supabase
            .from('merchants')
            .select('*')
            .eq('phone_number', phoneNumber)
            .single();
        
        if (error && error.code !== 'PGRST116') {
            throw error;
        }
        
        return merchant;
    } catch (error) {
        console.error('Error in getMerchant:', error);
        throw error;
    }
}

/**
 * Update merchant payment details
 */
async function updateMerchantPayments(phoneNumber, easypaisaNumber, jazzcashNumber) {
    try {
        const supabase = getSupabase();
        
        const { data, error } = await supabase
            .from('merchants')
            .update({
                easypaisa_number: easypaisaNumber,
                jazzcash_number: jazzcashNumber,
                updated_at: new Date().toISOString()
            })
            .eq('phone_number', phoneNumber)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error in updateMerchantPayments:', error);
        throw error;
    }
}

// ============================================
// PRODUCT OPERATIONS
// ============================================

/**
 * Create or update product
 */
async function createOrUpdateProduct(productData) {
    try {
        const supabase = getSupabase();
        
        // Check for existing product with same name and merchant
        const { data: existingProduct, error: searchError } = await supabase
            .from('products')
            .select('*')
            .eq('merchant_phone', productData.merchant_phone)
            .ilike('name', productData.name)
            .single();
        
        if (searchError && searchError.code !== 'PGRST116') {
            throw searchError;
        }
        
        let result;
        
        if (existingProduct) {
            // Update existing product
            const { data, error } = await supabase
                .from('products')
                .update({
                    price: productData.price,
                    sizes: productData.sizes,
                    colors: productData.colors,
                    image_url: productData.image_url || existingProduct.image_url,
                    raw_caption: productData.raw_caption,
                    in_stock: productData.in_stock !== false,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingProduct.id)
                .select()
                .single();
            
            if (error) throw error;
            result = { ...data, isUpdate: true };
            console.log(`✅ Product updated: ${data.name}`);
        } else {
            // Create new product
            const { data, error } = await supabase
                .from('products')
                .insert([{
                    merchant_phone: productData.merchant_phone,
                    name: productData.name,
                    price: productData.price,
                    sizes: productData.sizes || [],
                    colors: productData.colors || [],
                    image_url: productData.image_url,
                    raw_caption: productData.raw_caption,
                    in_stock: productData.in_stock !== false,
                    created_at: new Date().toISOString()
                }])
                .select()
                .single();
            
            if (error) throw error;
            result = { ...data, isUpdate: false };
            console.log(`✅ New product created: ${data.name}`);
        }
        
        return result;
    } catch (error) {
        console.error('Error in createOrUpdateProduct:', error);
        throw error;
    }
}

/**
 * Get products by merchant
 */
async function getProductsByMerchant(merchantPhone, limit = 50) {
    try {
        const supabase = getSupabase();
        
        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .eq('merchant_phone', merchantPhone)
            .eq('in_stock', true)
            .order('created_at', { ascending: false })
            .limit(limit);
        
        if (error) throw error;
        return products || [];
    } catch (error) {
        console.error('Error in getProductsByMerchant:', error);
        throw error;
    }
}

/**
 * Search products by merchant and query
 */
async function searchProducts(merchantPhone, query) {
    try {
        const supabase = getSupabase();
        
        // Search in name, colors, and raw_caption
        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .eq('merchant_phone', merchantPhone)
            .eq('in_stock', true)
            .or(`name.ilike.%${query}%,colors.cs.{${query}},raw_caption.ilike.%${query}%`)
            .limit(10);
        
        if (error) throw error;
        return products || [];
    } catch (error) {
        console.error('Error in searchProducts:', error);
        throw error;
    }
}

/**
 * Get product by ID
 */
async function getProductById(productId) {
    try {
        const supabase = getSupabase();
        
        const { data: product, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', productId)
            .single();
        
        if (error) throw error;
        return product;
    } catch (error) {
        console.error('Error in getProductById:', error);
        throw error;
    }
}

/**
 * Delete product
 */
async function deleteProduct(productId, merchantPhone) {
    try {
        const supabase = getSupabase();
        
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', productId)
            .eq('merchant_phone', merchantPhone);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error in deleteProduct:', error);
        throw error;
    }
}

// ============================================
// ORDER OPERATIONS
// ============================================

/**
 * Create new order
 */
async function createOrder(orderData) {
    try {
        const supabase = getSupabase();
        
        const { data, error } = await supabase
            .from('orders')
            .insert([{
                merchant_phone: orderData.merchant_phone,
                customer_phone: orderData.customer_phone,
                product_id: orderData.product_id,
                quantity: orderData.quantity || 1,
                total_amount: orderData.total_amount,
                status: 'pending',
                customer_name: orderData.customer_name || null,
                customer_address: orderData.customer_address || null,
                notes: orderData.notes || null,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();
        
        if (error) throw error;
        console.log(`✅ New order created: ${data.id}`);
        return data;
    } catch (error) {
        console.error('Error in createOrder:', error);
        throw error;
    }
}

/**
 * Get order by ID
 */
async function getOrderById(orderId) {
    try {
        const supabase = getSupabase();
        
        const { data: order, error } = await supabase
            .from('orders')
            .select(`
                *,
                product:products(*)
            `)
            .eq('id', orderId)
            .single();
        
        if (error) throw error;
        return order;
    } catch (error) {
        console.error('Error in getOrderById:', error);
        throw error;
    }
}

/**
 * Update order status
 */
async function updateOrderStatus(orderId, status, additionalData = {}) {
    try {
        const supabase = getSupabase();
        
        const updateData = {
            status: status,
            updated_at: new Date().toISOString(),
            ...additionalData
        };
        
        const { data, error } = await supabase
            .from('orders')
            .update(updateData)
            .eq('id', orderId)
            .select()
            .single();
        
        if (error) throw error;
        console.log(`✅ Order ${orderId} status updated to: ${status}`);
        return data;
    } catch (error) {
        console.error('Error in updateOrderStatus:', error);
        throw error;
    }
}

/**
 * Get orders by merchant
 */
async function getOrdersByMerchant(merchantPhone, status = null, limit = 50) {
    try {
        const supabase = getSupabase();
        
        let query = supabase
            .from('orders')
            .select(`
                *,
                product:products(name, price, image_url)
            `)
            .eq('merchant_phone', merchantPhone)
            .order('created_at', { ascending: false })
            .limit(limit);
        
        if (status) {
            query = query.eq('status', status);
        }
        
        const { data: orders, error } = await query;
        
        if (error) throw error;
        return orders || [];
    } catch (error) {
        console.error('Error in getOrdersByMerchant:', error);
        throw error;
    }
}

/**
 * Get orders by customer
 */
async function getOrdersByCustomer(customerPhone, merchantPhone = null) {
    try {
        const supabase = getSupabase();
        
        let query = supabase
            .from('orders')
            .select(`
                *,
                product:products(name, price, image_url)
            `)
            .eq('customer_phone', customerPhone)
            .order('created_at', { ascending: false });
        
        if (merchantPhone) {
            query = query.eq('merchant_phone', merchantPhone);
        }
        
        const { data: orders, error } = await query;
        
        if (error) throw error;
        return orders || [];
    } catch (error) {
        console.error('Error in getOrdersByCustomer:', error);
        throw error;
    }
}

// ============================================
// CONVERSATION STATE OPERATIONS
// ============================================

/**
 * Get or create conversation state
 */
async function getOrCreateConversation(customerPhone, merchantPhone) {
    try {
        const supabase = getSupabase();
        
        // Try to get existing conversation
        let { data: conversation, error } = await supabase
            .from('conversations')
            .select('*')
            .eq('customer_phone', customerPhone)
            .eq('merchant_phone', merchantPhone)
            .single();
        
        if (error && error.code !== 'PGRST116') {
            throw error;
        }
        
        // Create new conversation if not exists
        if (!conversation) {
            const { data: newConversation, error: createError } = await supabase
                .from('conversations')
                .insert([{
                    customer_phone: customerPhone,
                    merchant_phone: merchantPhone,
                    state: 'idle',
                    cart: {},
                    last_message_at: new Date().toISOString()
                }])
                .select()
                .single();
            
            if (createError) throw createError;
            conversation = newConversation;
        }
        
        return conversation;
    } catch (error) {
        console.error('Error in getOrCreateConversation:', error);
        throw error;
    }
}

/**
 * Update conversation state
 */
async function updateConversationState(customerPhone, merchantPhone, state, cart = null) {
    try {
        const supabase = getSupabase();
        
        const updateData = {
            state: state,
            last_message_at: new Date().toISOString()
        };
        
        if (cart !== null) {
            updateData.cart = cart;
        }
        
        const { data, error } = await supabase
            .from('conversations')
            .update(updateData)
            .eq('customer_phone', customerPhone)
            .eq('merchant_phone', merchantPhone)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error in updateConversationState:', error);
        throw error;
    }
}

/**
 * Reset conversation state
 */
async function resetConversation(customerPhone, merchantPhone) {
    return updateConversationState(customerPhone, merchantPhone, 'idle', {});
}

/**
 * Delete conversation
 */
async function deleteConversation(customerPhone, merchantPhone) {
    try {
        const supabase = getSupabase();
        
        const { error } = await supabase
            .from('conversations')
            .delete()
            .eq('customer_phone', customerPhone)
            .eq('merchant_phone', merchantPhone);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error in deleteConversation:', error);
        throw error;
    }
}

// ============================================
// STATS OPERATIONS
// ============================================

/**
 * Get merchant stats
 */
async function getMerchantStats(merchantPhone) {
    try {
        const supabase = getSupabase();
        
        // Get product count
        const { count: productCount, error: productError } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('merchant_phone', merchantPhone);
        
        if (productError) throw productError;
        
        // Get order stats
        const { data: orders, error: orderError } = await supabase
            .from('orders')
            .select('status, total_amount')
            .eq('merchant_phone', merchantPhone);
        
        if (orderError) throw orderError;
        
        const totalOrders = orders.length;
        const pendingOrders = orders.filter(o => o.status === 'pending').length;
        const paidOrders = orders.filter(o => o.status === 'paid').length;
        const confirmedOrders = orders.filter(o => o.status === 'confirmed').length;
        const totalRevenue = orders
            .filter(o => o.status === 'confirmed' || o.status === 'paid')
            .reduce((sum, o) => sum + o.total_amount, 0);
        
        return {
            productCount,
            totalOrders,
            pendingOrders,
            paidOrders,
            confirmedOrders,
            totalRevenue
        };
    } catch (error) {
        console.error('Error in getMerchantStats:', error);
        throw error;
    }
}

module.exports = {
    initSupabase,
    getSupabase,
    getOrCreateMerchant,
    getMerchant,
    updateMerchantPayments,
    createOrUpdateProduct,
    getProductsByMerchant,
    searchProducts,
    getProductById,
    deleteProduct,
    createOrder,
    getOrderById,
    updateOrderStatus,
    getOrdersByMerchant,
    getOrdersByCustomer,
    getOrCreateConversation,
    updateConversationState,
    resetConversation,
    deleteConversation,
    getMerchantStats
};
