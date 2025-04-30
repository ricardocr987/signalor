import { Command } from '../';
import { getTokenMetadata } from '../db/index';
import { orderManager } from '../services/order-manager';

const orderCommand: Command = {
  name: 'order',
  description: 'Set buy orders for tokens when price drops below specified amount. Use /order show to view your orders or /order remove to remove all orders.',
  execute: async (userId: number, args?: string[]) => {
    if (!args || args.length === 0) {
      return {
        chat_id: userId,
        text: "Please specify input token, output token, price, and amount. Example: /order SOL USDC 100 1\n\nOr use:\n/order show - to view your orders\n/order remove - to remove all orders"
      };
    }

    // Handle show command
    if (args[0].toLowerCase() === 'show') {
      try {
        const orders = await orderManager.getUserOrders(userId);
        if (orders.length === 0) {
          return {
            chat_id: userId,
            text: "You don't have any active orders."
          };
        }

        const orderList = orders.map(order => 
          `📊 Buy ${order.inputTokenAmount} ${order.inputSymbol} with ${order.outputSymbol} when ${order.outputSymbol} price goes below $${order.outputTokenPrice}`
        ).join('\n\n');

        return {
          chat_id: userId,
          text: `📋 Your Active Orders:\n\n${orderList}\n\nUse /order remove to remove all orders.`
        };
      } catch (error) {
        console.error('Error showing orders:', error);
        return {
          chat_id: userId,
          text: "❌ An error occurred while showing your orders. Please try again later."
        };
      }
    }

    // Handle remove command
    if (args[0].toLowerCase() === 'remove') {
      try {
        await orderManager.removeAllUserOrders(userId);
        return {
          chat_id: userId,
          text: "✅ All your orders have been removed."
        };
      } catch (error) {
        console.error('Error removing orders:', error);
        return {
          chat_id: userId,
          text: "❌ An error occurred while removing your orders. Please try again later."
        };
      }
    }

    // Handle setting new order
    if (args.length < 4) {
      return {
        chat_id: userId,
        text: "Please specify input token, output token, price, and amount. Example: /order SOL USDC 100 1"
      };
    }

    const inputToken = args[0]; // USDC
    const outputToken = args[1]; // SOL
    const outputTokenPrice = parseFloat(args[2]); // 100
    const inputTokenAmount = parseFloat(args[3]); // 1

    if (isNaN(outputTokenPrice) || isNaN(inputTokenAmount)) {
      return {
        chat_id: userId,
        text: "Invalid price or amount. Please provide valid numbers."
      };
    }

    try {
      // Get token metadata for both tokens
      const inputTokenMetadata = await getTokenMetadata(inputToken);
      const outputTokenMetadata = await getTokenMetadata(outputToken);

      if (!inputTokenMetadata || !outputTokenMetadata) {
        return {
          chat_id: userId,
          text: "Invalid token(s) specified. Please check the token symbols and try again."
        };
      }

      // Create the order
      await orderManager.addOrder(
        userId,
        inputTokenMetadata.mintAddress,
        inputTokenMetadata.symbol,
        outputTokenMetadata.mintAddress,
        outputTokenMetadata.symbol,
        outputTokenPrice,
        inputTokenAmount
      );
      
      return {
        chat_id: userId,
        text: `✅ Order set to buy ${outputTokenMetadata.symbol} with ${inputTokenAmount} ${inputTokenMetadata.symbol} when ${outputTokenMetadata.symbol} price goes below $${outputTokenPrice}`
      };
    } catch (error) {
      console.error('Error setting order:', error);
      return {
        chat_id: userId,
        text: "❌ An error occurred while setting the order. Please try again later."
      };
    }
  }
};

export default orderCommand; 