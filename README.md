# Signalor - Telegram Bot for Solana Token Alerts and Trading 🚀

Signalor is a Telegram bot built for the [Vybe Telegram Bot Challenge](https://earn.superteam.fun/listing/vybe-telegram-bot-challenge-dollar5k/) that provides real-time price alerts and monitoring for Solana tokens. The bot leverages the Vybe API to deliver accurate and timely information about token prices, trades, and market movements.

Demo: https://www.youtube.com/watch?v=tMxPAgMypLQ

## 🌟 Features

- **Price Alerts**: Set custom price alerts for any Solana token
- **Real-time Monitoring**: Get instant notifications when your set conditions are met
- **Token Information**: Access detailed token data including price, volume, and market stats
- **Secure Webhook Integration**: Protected communication between Telegram and your server
- **Automated Trading**: Swap instantly with the generated keypair that the server manages for each individual user
- **Limit Orders**: Set orders to purchase any Solana token when they reach a specific price
- **User-friendly Commands**: Simple and intuitive command interface

## 📝 Available Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/alert [TOKEN] [PRICE] [above/below]` | Set price alerts | `/alert SOL 100 above` |
| `/alert show` | View your active alerts | `/alert show` |
| `/alert remove` | Remove all your alerts | `/alert remove` |
| `/price [TOKEN]` | Get current token price | `/price SOL` |
| `/balance [WALLET]` | Check wallet balance | `/balance 8x...` |
| `/holders [TOKEN]` | View top token holders | `/holders SOL` |
| `/trades [TOKEN]` | View recent trades | `/trades SOL` |
| `/chart [TOKEN]` | Get token price chart | `/chart SOL` |
| `/swap [TOKEN1] [TOKEN2] [AMOUNT]` | Perform a swap | `/swap SOL USDC 1` |
| `/order [TOKEN] [SIDE] [PRICE] [AMOUNT]` | Place limit order | `/order SOL buy 100 1` |

## 🏗️ Technical Architecture

The project is built using:
- **Elysia** with **Bun** runtime for high-performance server
- **TypeScript** for type safety and better development experience
- **Vybe API** for real-time token data and market information
- **Telegram Bot API** for bot functionality
- **Railway** for deployment and hosting
- **PostgreSQL** for cloud-based database storage
- **Drizzle ORM** for type-safe database operations

### Database Setup on Railway

1. Create a new PostgreSQL database on Railway
2. Get your database connection string from Railway's dashboard
3. Add the following to your `.env.local` file:
```env
DATABASE_URL=your_railway_postgres_connection_string
```

4. Run the database migrations:
```bash
bun run db:migrate
```

### Key Components

- `src/commands/` - Contains all bot commands implementation
- `src/config.ts` - Manages environment variables and configuration
- `src/services/vybe.ts` - Vybe API integration for token data
- `src/services/alert-manager.ts` - Manages user alerts and notifications
- `src/db/` - Database schema and operations using Drizzle ORM

## 🛠️ Setup Guide

### 1. Create a Telegram Bot

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot` command
3. Follow the instructions to create your bot
4. Save the bot token provided by BotFather

### 2. Environment Setup

Create a `.env.local` file with the following variables:
```env
BOT_TELEGRAM_KEY=your_bot_token
VYBE_API_KEY=your_vybe_api_key
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret
RPC_ENDPOINT=your_solana_rpc_endpoint
HELIUS_API_KEY=your_helius_api_key
JUPITER_API_KEY=your_jupiter_api_key
```

### 3. Start the Server

#### Option 1: Local Development with ngrok

1. Install ngrok:
```bash
npm install -g ngrok
```

2. Start your server:
```bash
bun run dev
```

3. In a new terminal, start ngrok:
```bash
ngrok http 3000
```

4. Copy the HTTPS URL provided by ngrok (e.g., `https://abc123.ngrok.io`)

#### Option 2: Deploy to Railway

1. Install Railway CLI:
```bash
npm i -g @railway/cli
```

2. Login to Railway:
```bash
railway login
```

3. Initialize and deploy:
```bash
railway init
railway up
```

### 4. Set Up Webhook

Run the following curl command to set up your webhook (replace placeholders with your values):
```bash
curl --location 'https://api.telegram.org/bot{BOTID}/setWebhook?secret_token={SECRET}' \
--header 'Content-Type: application/json' \
--data '{"url": "{YOUR_SERVER_URL}"}'
```

Replace:
- `{BOTID}` with your bot token
- `{SECRET}` with your webhook secret
- `{YOUR_SERVER_URL}` with either:
  - Your ngrok URL (if testing locally)
  - Your Railway deployment URL (if deployed)

## 🔒 Security Features

- **Webhook Secret Token**: Added layer of security to verify incoming requests
- **API Key Validation**: All required API keys are validated on startup
- **Error Handling**: Comprehensive error handling and logging
- **Environment Variables**: Secure storage of sensitive data
- **User-specific Keypairs**: Individual keypair management for each user

> ⚠️ **Security Note**: This bot stores user private keys in the database for automated trading functionality. While we implement security measures, please be aware that:
> - Private keys are stored in the database and could potentially be accessed if the database is compromised
> - Use the bot at your own risk and only with amounts you're comfortable with

## 🧪 Testing the Bot

You can test the bot by searching for [@SignalorBot](https://t.me/SignalorBot) on Telegram. Try out the commands and explore the features!

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [Vybe Network](https://vybenetwork.xyz/) for organizing the hackathon
- [Superteam](https://superteam.fun/) for hosting the challenge
- [Telegram Bot API](https://core.telegram.org/bots/api) for the bot platform
