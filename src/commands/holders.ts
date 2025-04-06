import { Command } from '../';
import { VybeService } from '../services/vybe';

const holdersCommand: Command = {
  name: 'holders',
  description: 'Get the top holders for a token',
  execute: async (userId: number, args?: string[]) => {
    if (!args || args.length === 0) {
      return {
        chat_id: userId,
        text: "Please specify a token mint address. Example: /holders <mint_address>"
      };
    }

    const mintAddress = args[0];
    const limit = args[1] ? parseInt(args[1]) : 10; // Default to top 10 holders
    
    try {
      const response = await VybeService.getTopHolders(mintAddress, { limit });
      const holdersList = response.data
        .slice(0, limit)
        .map(holder => 
          `#${holder.rank} ${holder.ownerName || holder.ownerAddress}\n` +
          `Balance: ${holder.balance.toLocaleString()}\n` +
          `Value: $${holder.valueUsd.toLocaleString()}\n` +
          `Supply: ${holder.percentageOfSupplyHeld.toFixed(2)}%\n`
        )
        .join('\n');

      return {
        chat_id: userId,
        text: `Top ${limit} holders for token ${mintAddress}:\n\n${holdersList}`
      };
    } catch (error) {
      console.error('Error fetching holders:', error);
      return {
        chat_id: userId,
        text: "Sorry, I couldn't fetch the holders information. Please check the token address and try again."
      };
    }
  }
};

export default holdersCommand;

