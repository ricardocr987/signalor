import { Elysia } from "elysia";
import { config } from "./config";
import * as fs from 'fs';
import * as path from 'path';
import { priceFeedService } from './services/price-feed';

export interface CommandResponse {
  chat_id: number;
  text?: string;
  photo?: Buffer;
  caption?: string;
}

export interface Command {
  name: string;
  description: string;
  execute: (userId: number, args?: string[]) => Promise<CommandResponse>;
} 

const app = new Elysia()
  .onStart(async () => {    
    try {
      // Initialize price feed service
      await priceFeedService.initialize();
    } catch (error) {
      console.error('Failed to initialize services:', error);
    }
  })
  .get("/", () => "Hello Elysia")
  .post("/", async (context) => {
    // Verify Telegram webhook
    const telegramToken = context.headers['x-telegram-bot-api-secret-token'];
    if (!telegramToken || telegramToken !== config.TELEGRAM_WEBHOOK_SECRET) {
      console.log('Unauthorized webhook attempt');
      return new Response('Unauthorized', { status: 401 });
    }

    try {
      const payload: any = context.body;
      const messageText = payload.message.text;  
      const userId = payload.message.from.id;

      let replyPayload;

      // Check if the message starts with a command
      if (messageText.startsWith('/')) {
        const [commandName, ...args] = messageText.split(' ');
        const command = commandName.replace('/', '');
        console.log(commandName, 'called with args', args);
        
        if (commands && commands[command]) {
          replyPayload = await commands[command].execute(userId, args);
        } else {
          replyPayload = {
            chat_id: userId,
            text: "Sorry, I don't recognize that command. Use /help to see available commands."
          };
        }
      } else {
        // Handle regular messages by showing help
        const commandList = commands ? Object.values(commands)
          .map(cmd => `/${cmd.name} - ${cmd.description}`)
          .join('\n') : 'Loading commands...';
        
        replyPayload = {
          chat_id: userId,
          text: `I see you sent a message. To interact with me, please use one of these commands:\n\n${commandList}`
        };
      }

      await fetch(`https://api.telegram.org/bot${config.BOT_TELEGRAM_KEY}/sendMessage`, {
        method: 'post',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(replyPayload)
      });

      // const responseData = await replyStatus.json();
      // console.log(responseData);
    } catch (error) {
      console.error(error);
    }
  });

// Load commands dynamically
const loadCommands = async (): Promise<Record<string, Command>> => {
  const commands: Record<string, Command> = {};
  const commandsDir = path.join(__dirname, 'commands');
  
  // Basic commands
  commands['start'] = {
    name: 'start',
    description: 'Show welcome message',
    execute: async (userId: number) => {
      const commandList = Object.values(commands)
        .map(cmd => {
          let helpText = `/${cmd.name} - ${cmd.description}`;
          // Add argument descriptions based on command
          switch (cmd.name) {
            case 'price':
              helpText += '\n  Usage: /price <token_symbol>';
              break;
            case 'alert':
              helpText += '\n  Usage: /alert <token> <price> <above|below>\n  Or: /alert show\n  Or: /alert remove';
              break;
            case 'chart':
              helpText += '\n  Usage: /chart <token> [timeframe] [options]\n  Timeframes: 1m, 5m, 15m, 30m, 1h, 4h, 12h, 1d, 1w\n  Options: wide, mc, ma';
              break;
            case 'balance':
              helpText += '\n  Usage: /balance <token_symbol>';
              break;
            case 'trades':
              helpText += '\n  Usage: /trades <token_symbol>';
              break;
            case 'holders':
              helpText += '\n  Usage: /holders <token_symbol>';
              break;
            case 'value':
              helpText += '\n  Usage: /value <token_symbol>';
              break;
            case 'swap':
              helpText += '\n  Usage: /swap <from_token> <to_token> <amount>';
              break;
            case 'order':
              helpText += '\n  Usage: /order <token> <side> <price> <amount>';
              break;
            case 'keypair':
              helpText += '\n  Usage: /keypair [show]\n  Generate a new Solana keypair or show existing one';
              break;
          }
          return helpText;
        })
        .join('\n\n');
      
      return {
        chat_id: userId,
        text: `🚀 Welcome to Signalor Bot!\n\n` +
              `To get started, you need to generate a Solana keypair first. This is required for trading and other wallet-related operations.\n\n` +
              `1. Generate your keypair:\n` +
              `   Use /keypair to generate a new Solana keypair\n` +
              `   Use /keypair show to view your existing keypair\n\n` +
              `⚠️ IMPORTANT: Store your private key securely and never share it with anyone!\n\n` +
              `Here are all available commands:\n\n${commandList}\n\n` +
              `Need help? Use /help for detailed command information.`
      };
    }
  };

  commands['help'] = {
    name: 'help',
    description: 'Show help information',
    execute: async (userId: number) => {
      const commandList = Object.values(commands)
        .map(cmd => {
          let helpText = `/${cmd.name} - ${cmd.description}`;
          // Add argument descriptions based on command
          switch (cmd.name) {
            case 'price':
              helpText += '\n  Usage: /price <token_symbol>';
              break;
            case 'alert':
              helpText += '\n  Usage: /alert <token> <price> <above|below>\n  Or: /alert show\n  Or: /alert remove';
              break;
            case 'chart':
              helpText += '\n  Usage: /chart <token> [timeframe] [options]\n  Timeframes: 1m, 5m, 15m, 30m, 1h, 4h, 12h, 1d, 1w\n  Options: wide, mc, ma';
              break;
            case 'balance':
              helpText += '\n  Usage: /balance <token_symbol>';
              break;
            case 'trades':
              helpText += '\n  Usage: /trades <token_symbol>';
              break;
            case 'holders':
              helpText += '\n  Usage: /holders <token_symbol>';
              break;
            case 'value':
              helpText += '\n  Usage: /value <token_symbol>';
              break;
            case 'swap':
              helpText += '\n  Usage: /swap <from_token> <to_token> <amount>';
              break;
            case 'order':
              helpText += '\n  Usage: /order <token> <side> <price> <amount>';
              break;
          }
          return helpText;
        })
        .join('\n\n');
      
      return {
        chat_id: userId,
        text: `Available commands:\n\n${commandList}`
      };
    }
  };

  commands['status'] = {
    name: 'status',
    description: 'Check bot status',
    execute: async (userId: number) => ({
      chat_id: userId,
      text: "Bot is up and running! ✅"
    })
  };

  // Load commands from files
  const files = fs.readdirSync(commandsDir);
  for (const file of files) {
    if (file.endsWith('.ts')) {
      try {
        const commandModule = await import(`./commands/${file.replace('.ts', '')}`);
        if (commandModule.default) {
          const command = commandModule.default as Command;
          commands[command.name] = command;
        }
      } catch (error) {
        console.error(`Error loading command from ${file}:`, error);
      }
    }
  }

  return commands;
};

// Initialize commands
let commands: Record<string, Command>;
loadCommands().then(loadedCommands => {
  commands = loadedCommands;
  console.log('Commands loaded:', Object.keys(commands));
});

app.listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
