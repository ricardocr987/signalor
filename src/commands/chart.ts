// https://docs.phanes.bot/phanes/commands#chart-queries

import { Command } from '../types/command';

const chartCommand: Command = {
  name: 'chart',
  description: 'Get a price chart for a token',
  execute: async (userId: number, args?: string[]) => {
    if (!args || args.length === 0) {
      return {
        chat_id: userId,
        text: "Please specify a token symbol. Example: /chart SOL"
      };
    }

    const token = args[0].toUpperCase();
    // TODO: Implement chart generation logic here
    
    return {
      chat_id: userId,
      text: `Price chart for ${token}:\n[Chart will be displayed here]`
    };
  }
};

export default chartCommand;