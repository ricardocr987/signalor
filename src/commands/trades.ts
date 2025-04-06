import { VybeService } from '../services/vybe';
import { Command } from '../index';
import { getUserByTelegramId } from '../db';
import { getKeypairByUserId } from '../db';

const command: Command = {
  name: 'trades',
  description: 'Get token trades information',
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
      // Default to last 14 days of trades
      const timeEnd = Math.floor(Date.now() / 1000);
      const timeStart = timeEnd - (14 * 24 * 60 * 60); // 14 days ago

      const response = await VybeService.getTokenTrades({
        timeStart,
        timeEnd,
        limit: 5, // Get last 5 trades by default
        sortByDesc: 'blockTime', // Sort by most recent first
        feePayer: args?.[0] || keypair.public_key // If address provided, filter by feePayer
      });

      if (response.data.length === 0) {
        return {
          chat_id: userId,
          text: 'No trades found for the specified criteria.'
        };
      }

      const tradesText = response.data.map(trade => {
        const date = new Date(trade.blockTime * 1000).toLocaleString();
        return `📊 Trade Details\n` +
               `⏰ Time: ${date}\n` +
               `📜 Signature: ${trade.signature}\n` +
               `\n` +
               `🔵 Base Token\n` +
               `   Address: ${trade.baseMintAddress}\n` +
               `   Size: ${Number(trade.baseSize).toFixed(4)}\n` +
               `\n` +
               `🟡 Quote Token\n` +
               `   Address: ${trade.quoteMintAddress}\n` +
               `   Size: ${Number(trade.quoteSize).toFixed(4)}\n` +
               `\n` +
               `💰 Price: ${Number(trade.price).toFixed(4)}\n` +
               `\n` +
               `   Signer: ${trade.feePayer}\n` +
               `\n` +
               `----------------------------------------`;
      }).join('\n');

      return {
        chat_id: userId,
        text: `🔍 Recent Trades (Last 5)\n\n${tradesText}\n\n` +
              `💡 Use /trades <address> to filter by a specific fee payer address.`
      };
    } catch (error) {
      console.error('Error fetching trades:', error);
      return {
        chat_id: userId,
        text: '❌ Error fetching trades. Please try again later.'
      };
    }
  }
};

export default command; 