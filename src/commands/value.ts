import { Command } from '../';
import { getTokenMetadata } from '../db/index';
import { VybeService } from '../services/vybe';

const valueCommand: Command = {
  name: 'value',
  description: 'Calculate the value of tokens in USD',
  execute: async (userId: number, args?: string[]) => {
    if (!args || args.length < 2) {
      return {
        chat_id: userId,
        text: "Please specify amount and token symbol. Example: /value 100 SOL"
      };
    }

    const amount = parseFloat(args[0]);
    const token = args[1];

    const tokenMetadata = await getTokenMetadata(token);
    if (!tokenMetadata) {
      return {
        chat_id: userId,
        text: `Token ${token} not found`
      };
    }

    if (isNaN(amount) || amount <= 0) {
      return {
        chat_id: userId,
        text: "Please provide a valid amount greater than 0"
      };
    }
    
    try {
      const now = Math.floor(Date.now() / 1000);
      const timeStart = now - 2;

      // Get the latest price data
      const ohlcvData = await VybeService.getTokenOHLCV(tokenMetadata.mintAddress, {
        resolution: '1m',
        timeStart,
        timeEnd: now,
        limit: 1
      });

      if (!ohlcvData.data || ohlcvData.data.length === 0) {
        return {
          chat_id: userId,
          text: `No price data found for ${token}`
        };
      }

      // Get the last position of the data vector
      const latestData = ohlcvData.data[ohlcvData.data.length - 1];
      const price = parseFloat(latestData.close);

      // Format price with 6 decimals if it's very small
      const formatPrice = (value: number) => {
        return value < 0.01 ? value.toFixed(6) : value.toFixed(2);
      };

      const totalValue = amount * price;

      return {
        chat_id: userId,
        text: `💰 Value Calculation:\n\n` +
              `${amount} ${token} = $${formatPrice(totalValue)}\n` +
              `(Price: $${formatPrice(price)} per ${token})`
      };
    } catch (error) {
      console.error('Error calculating value:', error);
      return {
        chat_id: userId,
        text: `Error calculating value for ${amount} ${token}. Please try again later.`
      };
    }
  }
};

export default valueCommand;