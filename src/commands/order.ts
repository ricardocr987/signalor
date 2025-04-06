import { Command } from '../';
import { orderManager } from '../services/order-manager';
import { getTokenMetadata } from '../solana/fetcher/getTokenMetadata';

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
          `📊 Buy ${order.amount} ${order.output_mint} with ${order.input_mint} when price goes below $${order.price}`
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

    const inputToken = args[0];
    const outputToken = args[1];
    const price = parseFloat(args[2]);
    const amount = parseFloat(args[3]);

    if (isNaN(price) || isNaN(amount)) {
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
        inputTokenMetadata.address,
        outputTokenMetadata.address,
        price,
        amount
      );
      
      return {
        chat_id: userId,
        text: `✅ Order set to buy ${amount} ${outputToken} with ${inputToken} when price goes below $${price}`
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