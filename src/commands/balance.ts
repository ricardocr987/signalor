import { Command } from '../';
import { getUserByTelegramId, getKeypairByUserId } from '../db/index';
import { VybeService } from '../services/vybe';

const balanceCommand: Command = {
  name: 'balance',
  description: 'Check token balances for your wallet. Use /balance <token_symbol> to check specific token.',
  execute: async (userId: number, args?: string[]) => {
    try {
      const keypair = await getKeypairByUserId(userId);
      if (!keypair) {
        return {
          chat_id: userId,
          text: "You need to generate a keypair first using /keypair command."
        };
      }

      // Get token balances from Vybe
      const balances = await VybeService.getTokenBalances(keypair.publicKey, {
        onlyVerified: true,
        minAssetValue: "1", // Only show balances worth at least $1
        sortByDesc: "valueUsd" // Sort by USD value descending
      });

      if (balances.data.length === 0) {
        return {
          chat_id: userId,
          text: "No token balances found for your wallet."
        };
      }

      // If a specific token is requested
      if (args && args.length > 0) {
        const requestedToken = args[0].toUpperCase();
        const token = balances.data.find(t => t.symbol.toUpperCase() === requestedToken);
        
        if (!token) {
          return {
            chat_id: userId,
            text: `No balance found for token ${requestedToken}.`
          };
        }

        return {
          chat_id: userId,
          text: `🔍 ${token.symbol} Balance:\n\n` +
                `Name: ${token.name}\n` +
                `Amount: ${token.amount.toLocaleString()}\n` +
                `Value: $${token.valueUsd.toLocaleString()} (${Number(token.amount).toFixed(4)} SOL)\n` +
                `Mint: \`${token.mintAddress}\`\n`
        };
      }

      // Format the response for all balances
      const balanceList = balances.data.map(token => 
        `💰 ${token.symbol} (${token.name}):\n` +
        `Amount: ${token.amount.toLocaleString()}\n` +
        `Value: $${token.valueUsd.toLocaleString()} (${Number(token.amount).toFixed(4)} SOL)\n` +
        `Mint: \`${token.mintAddress}\`\n`
      ).join('\n');

      const totalValue = balances.data.reduce((sum, token) => sum + Number(token.valueUsd), 0);
      return {
        chat_id: userId,
        text: `🔍 Your Token Balances:\n\n${balanceList}\n\nTotal Assets: $${totalValue.toFixed(2)}`
      };
    } catch (error) {
      console.error('Error checking balances:', error);
      return {
        chat_id: userId,
        text: "❌ An error occurred while checking your balances. Please try again later."
      };
    }
  }
};

export default balanceCommand;
