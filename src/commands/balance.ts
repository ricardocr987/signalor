import { Command } from '../';
import { getUserByTelegramId, getKeypairByUserId } from '../db';
import { VybeService } from '../services/vybe';

const balanceCommand: Command = {
  name: 'balance',
  description: 'Check token balances for your wallet. Use /balance <token_symbol> to check specific token.',
  execute: async (userId: number, args?: string[]) => {
    try {
      // Get user and their keypair
      const user = getUserByTelegramId(userId);
      if (!user) {
        return {
          chat_id: userId,
          text: "You need to generate a keypair first using /keypair command."
        };
      }

      const keypair = getKeypairByUserId(user.id);
      if (!keypair) {
        return {
          chat_id: userId,
          text: "You need to generate a keypair first using /keypair command."
        };
      }

      // Get token balances from Vybe
      const balances = await VybeService.getTokenBalances(keypair.public_key, {
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
                `Mint: \`${token.mintAddress}\`\n` +
                `Status: ${token.verified ? '✅ Verified' : '⚠️ Unverified'}`
        };
      }

      // Format the response for all balances
      const balanceList = balances.data.map(token => 
        `💰 ${token.symbol} (${token.name}):\n` +
        `Amount: ${token.amount.toLocaleString()}\n` +
        `Value: $${token.valueUsd.toLocaleString()} (${Number(token.amount).toFixed(4)} SOL)\n` +
        `Mint: \`${token.mintAddress}\`\n` +
        `Status: ${token.verified ? '✅ Verified' : '⚠️ Unverified'}`
      ).join('\n');

      return {
        chat_id: userId,
        text: `🔍 Your Token Balances:\n\n${balanceList}\n\nTotal Assets: $${balances.data.reduce((sum, token) => sum + token.valueUsd, 0).toLocaleString()}`
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
