# 🧪 Testing Guide

Complete testing scenarios for the Pakistani WhatsApp Bot.

## 📋 Test Checklist

### 1. Bot Startup

- [ ] Bot starts without errors
- [ ] QR code displays in terminal
- [ ] QR code scans successfully
- [ ] Connection status shows "connected"

```bash
# Start bot
npm start

# Expected output:
# ✅ Supabase client initialized
# Starting WhatsApp Bot...
# Using Baileys v6.x.x
# QR Code generated! Scan with WhatsApp:
# [QR CODE]
# ✅ WhatsApp connection established successfully!
```

### 2. Merchant Onboarding

#### Test 2.1: First START Command

**Merchant sends:** `START`

**Expected response:**
```
Assalam-o-Alaikum! 👋

I'm your ShopBot assistant. Here's how to use me:

Add Products:
Send product photo with caption like:
"Red Kurta Medium Large Rs 2500"

Commands:
• products - View all your products
• orders - View pending orders
• stats - View shop statistics
• payments - Update payment numbers
• help - Show this message
```

#### Test 2.2: Add Product with Image

**Merchant sends:** Photo with caption `Red Kurta Medium Large XL Rs 2500`

**Expected response:**
```
✅ Product added successfully!

Red Kurta
Price: Rs 2500
Sizes: M, L, XL

Customers can now order this product! 🎉
```

#### Test 2.3: View Products

**Merchant sends:** `PRODUCTS`

**Expected response:**
```
Your Products (1):

1. Red Kurta - Rs 2500
   Sizes: M, L, XL
   Status: ✅ In Stock
```

### 3. Customer Interactions

#### Test 3.1: Customer Greeting

**Customer sends:** `Assalam o alaikum`

**Expected response:**
```
Assalam-o-Alaikum! 👋

Welcome to My Shop!

Kya dekhna pasand karengay?
• products - Sab products dekhein
• price [product name] - Price check karein
• order [number] - Order karein

Kuch bhi poochne mein hesitate na karein! 😊
```

#### Test 3.2: Browse Products

**Customer sends:** `products`

**Expected response:**
```
My Shop - Products:

1. Red Kurta
   💰 Rs 2,500
   📏 Sizes: M, L, XL

Order karne ke liye product number likhain (e.g., 1 ya order 1)
```

#### Test 3.3: Price Inquiry (Roman Urdu)

**Customer sends:** `Kurta kitne ka hai?`

**Expected response:**
```
Red Kurta Rs 2,500 mein available hai!
Sizes: M, L, XL

Order karna hai to "order 1" likhain.
```

### 4. Order Flow

#### Test 4.1: Select Product

**Customer sends:** `1` or `order 1`

**Expected response:**
```
Aapne select kiya:

Red Kurta
💰 Price: Rs 2,500
📏 Available Sizes: M, L, XL

Order confirm karne ke liye CONFIRM likhain.
```

#### Test 4.2: Confirm Order

**Customer sends:** `CONFIRM`

**Expected response (to customer):**
```
✅ Order Created!

Order #: *A1B2C3*
Product: Red Kurta
Amount: *Rs 2,500*

Payment Options:
1️⃣ Easypaisa: 03001234567
2️⃣ JazzCash: 03001234567

Payment karne ke baad PAID likhain.
```

**Expected notification (to merchant):**
```
🛒 New Order!

Order #: A1B2C3
Customer: 03008765432
Product: Red Kurta
Amount: Rs 2,500

Status: ⏳ Pending Payment
```

#### Test 4.3: Payment Confirmation

**Customer sends:** `PAID`

**Expected response (to customer):**
```
🎉 Shukriya!

Aapka payment receive ho gaya hai.
Order #: *A1B2C3*

Dukan malik jald confirm karengay. Aapko update diya jayega.
```

**Expected notification (to merchant):**
```
💰 Payment Received!

Order #: A1B2C3
Customer: 03008765432
Product: Red Kurta
Amount: Rs 2,500

Status: 💰 Paid - Awaiting Confirmation

Confirm karne ke liye: confirm #A1B2C3
```

#### Test 4.4: Merchant Confirms Order

**Merchant sends:** `confirm #A1B2C3`

**Expected response (to merchant):**
```
✅ Order A1B2C3 confirmed!

Customer ko inform kar diya jayega.
```

**Expected notification (to customer):**
```
🎉 Good news!

Aapka order *A1B2C3* confirm ho gaya hai!

Product: Red Kurta
Amount: Rs 2,500

Jald delivery ki details share ki jayengi. Shukriya! 🙏
```

### 5. Error Handling

#### Test 5.1: Invalid Product Number

**Customer sends:** `99` (when only 3 products exist)

**Expected response:**
```
❌ Galat number. Please sahi product number select karein.
```

#### Test 5.2: Product Not Found

**Customer sends:** `iPhone 15 ka price kya hai?` (not in catalog)

**Expected response:**
```
Iska data nahi mila. 😔

Dukan malik se rabta karein: 03001234567

Ya *products* likhain sab products dekhein.
```

#### Test 5.3: AI Rate Limit

**Trigger:** Send 50+ AI requests in one day

**Expected response:**
```
⚠️ AI daily limit reached. Please try tomorrow or contact owner directly.
```

### 6. Merchant Commands

#### Test 6.1: View Statistics

**Merchant sends:** `STATS`

**Expected response:**
```
📊 Shop Statistics:

Products: 5
Total Orders: 12
Pending: 3
Paid: 2
Confirmed: 7
Total Revenue: Rs 45,000

Keep up the good work! 💪
```

#### Test 6.2: Update Payment Numbers

**Merchant sends:** `payments 03001234567 03009876543`

**Expected response:**
```
✅ Payment numbers updated!

Easypaisa: 03001234567
JazzCash: 03009876543
```

#### Test 6.3: View Orders

**Merchant sends:** `ORDERS`

**Expected response:**
```
Your Orders:

⏳ Pending (3):
• #A1B2C3 - Red Kurta - Rs 2,500
  Customer: 03008765432

💰 Paid - Awaiting Confirmation (1):
• #D4E5F6 - Blue Shalwar - Rs 3,500
```

## 🔍 API Testing

### Health Check

```bash
curl https://your-bot.onrender.com/
```

**Expected response:**
```json
{
  "status": "ok",
  "bot": {
    "state": "connected",
    "qrCode": null,
    "user": {
      "id": "1234567890@s.whatsapp.net",
      "name": "Shop Bot"
    },
    "aiCallsToday": 15,
    "aiCallsLimit": 50
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Send Message (Admin)

```bash
curl -X POST https://your-bot.onrender.com/send \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "03001234567",
    "message": "Test message from API"
  }'
```

## 🐛 Common Issues & Fixes

### Issue: QR Code Not Scanning

**Fix:**
1. Make sure you're using "Link a Device" not "Link to Android"
2. Try zooming out terminal to see full QR code
3. Clear auth folder and restart:
   ```bash
   rm -rf auth/
   npm start
   ```

### Issue: Database Connection Failed

**Fix:**
1. Check SUPABASE_URL and SUPABASE_ANON_KEY in .env
2. Verify tables are created:
   ```sql
   SELECT * FROM merchants;
   SELECT * FROM products;
   ```
3. Check RLS policies allow access

### Issue: AI Not Responding

**Fix:**
1. Verify OPENROUTER_API_KEY or GEMINI_API_KEY
2. Check rate limit status:
   ```bash
   curl https://your-bot.onrender.com/status
   ```
3. Check logs for API errors

### Issue: Messages Not Sending

**Fix:**
1. Check connection status:
   ```bash
   curl https://your-bot.onrender.com/status
   ```
2. Verify phone number format (should include country code)
3. Check if recipient has blocked the bot

## 📊 Load Testing

### Simulate Multiple Customers

```bash
# Using curl to simulate requests
for i in {1..10}; do
  curl -X POST https://your-bot.onrender.com/send \
    -H "Content-Type: application/json" \
    -d "{\"phone\": \"0300000000$i\", \"message\": \"products\"}"
done
```

### Monitor Response Times

```bash
# Check response time
curl -w "@curl-format.txt" -o /dev/null -s https://your-bot.onrender.com/
```

Create `curl-format.txt`:
```
time_namelookup:  %{time_namelookup}\n
time_connect:     %{time_connect}\n
time_appconnect:  %{time_appconnect}\n
time_pretransfer: %{time_pretransfer}\n
time_redirect:    %{time_redirect}\n
time_starttransfer: %{time_starttransfer}\n\n
time_total:       %{time_total}\n
```

## ✅ Pre-Deployment Checklist

- [ ] All environment variables set in Render dashboard
- [ ] Supabase tables created
- [ ] AI API key working
- [ ] QR code scanned successfully
- [ ] Tested merchant commands
- [ ] Tested customer flow
- [ ] Tested order completion
- [ ] Error handling verified
- [ ] Health check endpoint responding
- [ ] UptimeRobot configured (optional)

## 🎯 Success Criteria

The bot is working correctly when:

1. ✅ QR code scans and connects
2. ✅ Merchants can add products with images
3. ✅ AI extracts product info accurately
4. ✅ Customers can browse products
5. ✅ Orders are created and tracked
6. ✅ Payment notifications work
7. ✅ Merchant confirmations work
8. ✅ Roman Urdu is understood
9. ✅ Rate limiting prevents overuse
10. ✅ Bot recovers from errors gracefully

---

**Happy Testing! 🚀**
