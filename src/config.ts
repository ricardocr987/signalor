export const config = {
  BOT_TELEGRAM_KEY: process.env.BOT_TELEGRAM_KEY || '',
  VYBE_API_KEY: process.env.VYBE_API_KEY || '',
  TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET || '',
  JUPITER_API_KEY: process.env.JUPITER_API_KEY || '',
  RPC_ENDPOINT: process.env.RPC_ENDPOINT || '',
  HELIUS_API_KEY: process.env.HELIUS_API_KEY || '',
};

const requiredEnvVariables = [
  'RPC_ENDPOINT',
  'HELIUS_API_KEY',
  'BOT_TELEGRAM_KEY',
  'VYBE_API_KEY',
  'TELEGRAM_WEBHOOK_SECRET',
  'JUPITER_API_KEY',
];

requiredEnvVariables.forEach((variable) => {
  if (!process.env[variable]) {
    throw new Error(`Missing required environment variable: ${variable}`);
  }
});
