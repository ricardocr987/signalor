import { Elysia } from "elysia";
import { config } from "./config";
import * as fs from 'fs';
import * as path from 'path';
import { priceFeedService } from './services/price-feed';
import { JupiterService } from './services/jup';

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
      
      // Fetch and store token data from Vybe
      await JupiterService.fetchAndStoreTokens();
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
        .map(cmd => `/${cmd.name} - ${cmd.description}`)
        .join('\n');
      
      return {
        chat_id: userId,
        text: `Welcome to Signalor Bot! 🚀\n\nHere are the available commands:\n\n${commandList}`
      };
    }
  };

  commands['help'] = {
    name: 'help',
    description: 'Show help information',
    execute: async (userId: number) => {
      const commandList = Object.values(commands)
        .map(cmd => `/${cmd.name} - ${cmd.description}`)
        .join('\n');
      
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
