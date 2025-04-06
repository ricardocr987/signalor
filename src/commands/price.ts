import { Command } from '../';
import { VybeService } from '../services/vybe';

const priceCommand: Command = {
  name: 'price',
  description: 'Get the current price of a token',
  execute: async (userId: number, args?: string[]) => {
    if (!args || args.length === 0) {
      return {
        chat_id: userId,
        text: "Please specify a token symbol. Example: /price SOL"
      };
    }

    const token = args[0];
    
    try {
      const now = Math.floor(Date.now() / 1000); // Current Unix timestamp in seconds
      const timeStart = now - 2;

      // Get the latest OHLCV data for the token with 1-minute resolution
      const ohlcvData = await VybeService.getTokenOHLCV(token, {
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

      return {
        chat_id: userId,
        text: `💰 Price for ${token}:\n\n` +
              `Current Price: $${formatPrice(price)}\n`
      };
    } catch (error) {
      console.error('Error fetching price:', error);
      return {
        chat_id: userId,
        text: `Error fetching price for ${token}. Please try again later.`
      };
    }
  }
};

export default priceCommand;
