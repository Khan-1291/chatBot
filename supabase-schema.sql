-- ============================================
-- Pakistani WhatsApp Bot - Supabase Schema
-- Free Tier: 500MB PostgreSQL + 1GB Storage
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- MERCHANTS TABLE
-- Stores merchant information
-- ============================================
CREATE TABLE IF NOT EXISTS merchants (
    phone_number TEXT PRIMARY KEY,
    business_name TEXT NOT NULL DEFAULT 'My Shop',
    easypaisa_number TEXT,
    jazzcash_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment
COMMENT ON TABLE merchants IS 'Stores merchant information and payment details';

-- ============================================
-- PRODUCTS TABLE
-- Stores product catalog for each merchant
-- ============================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_phone TEXT NOT NULL REFERENCES merchants(phone_number) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price INTEGER NOT NULL CHECK (price >= 0),
    sizes TEXT[] DEFAULT '{}',
    colors TEXT[] DEFAULT '{}',
    image_url TEXT,
    raw_caption TEXT,
    in_stock BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_products_merchant ON products(merchant_phone);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_in_stock ON products(in_stock);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_products_search ON products USING gin(to_tsvector('english', name || ' ' || COALESCE(raw_caption, '')));

COMMENT ON TABLE products IS 'Stores product catalog for merchants';

-- ============================================
-- ORDERS TABLE
-- Stores customer orders
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_phone TEXT NOT NULL REFERENCES merchants(phone_number) ON DELETE CASCADE,
    customer_phone TEXT NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'confirmed', 'cancelled', 'delivered')),
    customer_name TEXT,
    customer_address TEXT,
    notes TEXT,
    paid_at TIMESTAMP WITH TIME ZONE,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_orders_merchant ON orders(merchant_phone);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

COMMENT ON TABLE orders IS 'Stores customer orders';

-- ============================================
-- CONVERSATIONS TABLE
-- Stores conversation state for customers
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_phone TEXT NOT NULL,
    merchant_phone TEXT NOT NULL REFERENCES merchants(phone_number) ON DELETE CASCADE,
    state TEXT NOT NULL DEFAULT 'idle' CHECK (state IN ('idle', 'selecting', 'confirming', 'awaiting_payment', 'awaiting_address')),
    cart JSONB DEFAULT '{}',
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(customer_phone, merchant_phone)
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_conversations_customer ON conversations(customer_phone);
CREATE INDEX IF NOT EXISTS idx_conversations_merchant ON conversations(merchant_phone);
CREATE INDEX IF NOT EXISTS idx_conversations_state ON conversations(state);

COMMENT ON TABLE conversations IS 'Stores conversation state for customer interactions';

-- ============================================
-- AI USAGE LOG TABLE (Optional)
-- Tracks AI API usage for rate limiting
-- ============================================
CREATE TABLE IF NOT EXISTS ai_usage_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_phone TEXT REFERENCES merchants(phone_number) ON DELETE SET NULL,
    request_type TEXT NOT NULL,
    model TEXT,
    tokens_used INTEGER,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_merchant ON ai_usage_log(merchant_phone);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage_log(created_at);

COMMENT ON TABLE ai_usage_log IS 'Tracks AI API usage for monitoring and rate limiting';

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Enable RLS for security
-- ============================================

-- Enable RLS on all tables
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for MVP - tighten in production)
CREATE POLICY "Allow all" ON merchants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON conversations FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_merchants_updated_at BEFORE UPDATE ON merchants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS
-- ============================================

-- Merchant dashboard view
CREATE OR REPLACE VIEW merchant_dashboard AS
SELECT 
    m.phone_number,
    m.business_name,
    COUNT(DISTINCT p.id) as total_products,
    COUNT(DISTINCT o.id) as total_orders,
    COUNT(DISTINCT CASE WHEN o.status = 'pending' THEN o.id END) as pending_orders,
    COUNT(DISTINCT CASE WHEN o.status = 'paid' THEN o.id END) as paid_orders,
    COUNT(DISTINCT CASE WHEN o.status = 'confirmed' THEN o.id END) as confirmed_orders,
    COALESCE(SUM(CASE WHEN o.status IN ('paid', 'confirmed') THEN o.total_amount END), 0) as total_revenue
FROM merchants m
LEFT JOIN products p ON m.phone_number = p.merchant_phone
LEFT JOIN orders o ON m.phone_number = o.merchant_phone
GROUP BY m.phone_number, m.business_name;

-- Recent orders view
CREATE OR REPLACE VIEW recent_orders AS
SELECT 
    o.id,
    o.merchant_phone,
    o.customer_phone,
    p.name as product_name,
    o.quantity,
    o.total_amount,
    o.status,
    o.created_at
FROM orders o
JOIN products p ON o.product_id = p.id
ORDER BY o.created_at DESC
LIMIT 100;

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================

-- Insert sample merchant (uncomment if needed)
-- INSERT INTO merchants (phone_number, business_name, easypaisa_number, jazzcash_number)
-- VALUES ('03001234567', 'Test Shop', '03001234567', '03001234567')
-- ON CONFLICT (phone_number) DO NOTHING;

-- Insert sample products (uncomment if needed)
-- INSERT INTO products (merchant_phone, name, price, sizes, colors, in_stock)
-- VALUES 
--     ('03001234567', 'Red Kurta', 2500, ARRAY['S', 'M', 'L', 'XL'], ARRAY['Red', 'Maroon'], true),
--     ('03001234567', 'Blue Shalwar Kameez', 3500, ARRAY['M', 'L', 'XL'], ARRAY['Blue', 'Navy'], true),
--     ('03001234567', 'Embroidered Dupatta', 1500, ARRAY['One Size'], ARRAY['Gold', 'Silver'], true)
-- ON CONFLICT DO NOTHING;

-- ============================================
-- GRANTS
-- ============================================

-- Grant access to anon and authenticated roles
GRANT ALL ON merchants TO anon, authenticated;
GRANT ALL ON products TO anon, authenticated;
GRANT ALL ON orders TO anon, authenticated;
GRANT ALL ON conversations TO anon, authenticated;
GRANT ALL ON ai_usage_log TO anon, authenticated;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
