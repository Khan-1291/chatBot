# 🇵🇰 Pakistani WhatsApp Business Bot

A **completely FREE** WhatsApp business bot for Pakistani small merchants. Built with Baileys (no official API fees), Supabase free tier, and OpenRouter/Gemini free AI.

## ✨ Features

- 📱 **WhatsApp Integration** - Uses Baileys (free, no Meta fees)
- 🤖 **AI-Powered** - Extracts product info from photos + captions
- 🛒 **Order Management** - Customers can browse, select, and order
- 💰 **Payment Links** - Manual JazzCash/Easypaisa integration
- 🔔 **Notifications** - Merchant alerts for new orders
- 🌐 **Roman Urdu Support** - Understands mixed Urdu/English
- 📊 **Statistics** - Track sales and inventory

## 🆓 Free Resources Used

| Service | Free Tier | Limit |
|---------|-----------|-------|
| **WhatsApp** | Baileys Library | Unlimited |
| **Hosting** | Render.com | 0.5GB RAM, sleeps after 15min |
| **Database** | Supabase | 500MB + 1GB storage |
| **AI** | OpenRouter | 50 requests/day |
| **AI Alt** | Google Gemini | 60 requests/min |

## 📋 Prerequisites

1. **Node.js** 18+ installed
2. **WhatsApp** account (for bot)
3. **Supabase** account (free)
4. **OpenRouter** or **Gemini** API key (free)
5. **Render.com** account (free, for deployment)

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd pakistani-whatsapp-bot
npm install
```

### 2. Setup Environment Variables

```bash
cp .env.example .env
```

Edit `.env` file:

```env
# Supabase (from https://supabase.com)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# AI Provider - Choose ONE
# Option 1: OpenRouter (50 requests/day free)
OPENROUTER_API_KEY=sk-or-v1-your-key
AI_PROVIDER=openrouter

# Option 2: Gemini (60 requests/min free)
# GEMINI_API_KEY=your-gemini-key
# AI_PROVIDER=gemini

# Bot Settings
MAX_AI_CALLS_PER_DAY=50
PORT=3000
```

### 3. Setup Supabase Database

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Open the SQL Editor
3. Copy contents of `supabase-schema.sql`
4. Run the SQL to create tables

### 4. Get AI API Key

**Option A: OpenRouter (Recommended)**
1. Go to [openrouter.ai](https://openrouter.ai)
2. Sign up (no credit card required)
3. Go to API Keys → Create Key
4. Copy the key to your `.env`

**Option B: Google Gemini**
1. Go to [makersuite.google.com](https://makersuite.google.com/app/apikey)
2. Sign in with Google
3. Create API key
4. Copy the key to your `.env`

### 5. Run the Bot

```bash
# Development mode
npm run dev

# Production mode
npm start
```

### 6. Scan QR Code

When you start the bot, a QR code will appear in the terminal:

```
Scan this QR code with WhatsApp:
█████████████████████████████████
██ ▄▄▄▄▄ █▀▄▀▄▀▄▀▄█ ▄▄▄▄▄ ██
... (QR code) ...
█████████████████████████████████
```

1. Open WhatsApp on your phone
2. Go to Settings → Linked Devices
3. Tap "Link a Device"
4. Scan the QR code

✅ **Bot is now connected!**

## 📱 Usage Guide

### For Merchants

#### 1. First Time Setup

Send `START` to your bot number:

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

#### 2. Add Products

Send a photo with caption:

```
Red Kurta Medium Large XL Rs 2500
Available in Red, Maroon, Black
```

The AI will automatically extract:
- ✅ Product name
- ✅ Price (Rs 2500)
- ✅ Sizes (M, L, XL)
- ✅ Colors (Red, Maroon, Black)

#### 3. Manage Orders

Send `ORDERS` to see:

```
Your Orders:

⏳ Pending (3):
• #A1B2C3 - Red Kurta - Rs 2500
  Customer: 03001234567

💰 Paid - Awaiting Confirmation (1):
• #D4E5F6 - Blue Shalwar - Rs 3500
```

#### 4. Confirm Payment

When customer pays, send:

```
confirm #A1B2C3
```

### For Customers

#### 1. Browse Products

Customer sends:

```
products
```

Bot replies:

```
My Shop - Products:

1. Red Kurta
   💰 Rs 2,500
   📏 Sizes: M, L, XL
   🎨 Colors: Red, Maroon

2. Blue Shalwar Kameez
   💰 Rs 3,500
   📏 Sizes: M, L, XL
   🎨 Colors: Blue, Navy

Order karne ke liye product number likhain (e.g., 1 ya order 1)
```

#### 2. Ask Questions

Customer sends:

```
Kurta kitne ka hai?
```

Bot replies:

```
Red Kurta Rs 2,500 mein available hai! 
Sizes: M, L, XL

Order karna hai to "order 1" likhain.
```

#### 3. Place Order

Customer sends:

```
order 1
```

Bot replies:

```
Aapne select kiya:

Red Kurta
💰 Price: Rs 2,500
📏 Available Sizes: M, L, XL
🎨 Available Colors: Red, Maroon

Order confirm karne ke liye CONFIRM likhain.
```

Customer sends:

```
CONFIRM
```

Bot replies:

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

#### 4. Confirm Payment

Customer sends:

```
PAID
```

Bot replies:

```
🎉 Shukriya!

Aapka payment receive ho gaya hai.
Order #: *A1B2C3*

Dukan malik jald confirm karengay. Aapko update diya jayega.
```

## 📊 Database Schema

### Merchants Table
```sql
phone_number (PK) | business_name | easypaisa_number | jazzcash_number
```

### Products Table
```sql
id | merchant_phone | name | price | sizes[] | colors[] | image_url | in_stock
```

### Orders Table
```sql
id | merchant_phone | customer_phone | product_id | quantity | total_amount | status
```

### Conversations Table
```sql
id | customer_phone | merchant_phone | state | cart (JSONB) | last_message_at
```

## 🌐 Deployment on Render.com

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo>
git push -u origin main
```

### 2. Create Render Web Service

1. Go to [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repo
4. Configure:
   - **Name**: `pakistani-whatsapp-bot`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

### 3. Add Environment Variables

In Render dashboard, add these:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
OPENROUTER_API_KEY=sk-or-v1-your-key
AI_PROVIDER=openrouter
MAX_AI_CALLS_PER_DAY=50
```

### 4. Deploy

Click "Create Web Service"

### 5. Scan QR Code

1. Go to service logs in Render dashboard
2. Find the QR code
3. Scan with WhatsApp
4. Bot is now live!

### ⚠️ Free Tier Limitations

- **Sleeps after 15 minutes** of inactivity
- **Wakes up on next request** (30-60 seconds delay)
- **Use UptimeRobot** (free) to ping every 14 minutes and keep alive

#### Keep Bot Alive with UptimeRobot

1. Go to [uptimerobot.com](https://uptimerobot.com)
2. Create free account
3. Add New Monitor:
   - Type: HTTP(s)
   - URL: `https://your-bot.onrender.com`
   - Interval: 14 minutes
4. Save

## 🔧 Troubleshooting

### QR Code Not Showing

```bash
# Check logs
npm start

# Clear auth and restart
rm -rf auth/
npm start
```

### Database Connection Error

1. Verify Supabase URL and key in `.env`
2. Check if tables are created (run `supabase-schema.sql`)
3. Ensure Row Level Security policies allow access

### AI Not Responding

1. Check AI API key in `.env`
2. Verify rate limit: 50/day for OpenRouter
3. Check logs for API errors

### Bot Stops Responding

```bash
# Restart the bot
Ctrl+C
npm start

# If on Render: Manual Deploy → Clear Build Cache → Deploy
```

## 📁 Project Structure

```
pakistani-whatsapp-bot/
├── index.js                 # Main entry point
├── package.json             # Dependencies
├── .env.example             # Environment template
├── .gitignore               # Git ignore rules
├── README.md                # This file
├── render.yaml              # Render deployment config
├── supabase-schema.sql      # Database schema
├── handlers/
│   └── messageHandler.js    # Message routing
├── ai/
│   └── extractor.js         # AI extraction (OpenRouter/Gemini)
├── db/
│   └── supabase.js          # Database operations
├── utils/
│   └── helpers.js           # Utility functions
└── auth/                    # Baileys auth state (auto-created)
    └── baileys/
```

## 🛡️ Security Notes

1. **Never commit `.env` file**
2. **Use strong Supabase RLS policies** in production
3. **Rotate API keys** regularly
4. **Monitor AI usage** to stay within free limits
5. **Backup auth folder** to avoid re-scanning QR

## 🔄 Upgrading from MVP

When you're ready to scale:

| Feature | MVP | Upgrade To |
|---------|-----|------------|
| WhatsApp | Baileys (free) | Official API ($0.005/msg) |
| Hosting | Render Free | Render Pro ($7/month) |
| Database | Supabase Free | Supabase Pro ($25/month) |
| AI | OpenRouter Free | OpenRouter Paid or OpenAI |
| Payments | Manual | PayFast API |
| Multi-tenant | Single merchant | Add merchant_id to all tables |

## 📝 License

MIT License - Free to use and modify!

## 🤝 Support

For issues and questions:
1. Check Troubleshooting section
2. Review logs in Render dashboard
3. Open GitHub issue

---

**Built with ❤️ for Pakistani small businesses**

*No paid services required. Ever.*
