import { Command } from '../';
import { AlertManager } from '../services/alert-manager';

const alertManager = AlertManager.getInstance();

const alertCommand: Command = {
  name: 'alert',
  description: 'Set price alerts for tokens. Use /alert show to view your alerts or /alert remove to remove all alerts.',
  execute: async (userId: number, args?: string[]) => {
    if (!args || args.length === 0) {
      return {
        chat_id: userId,
        text: "Please specify token, price, and condition. Example: /alert SOL 100 above\n\nOr use:\n/alert show - to view your alerts\n/alert remove - to remove all alerts"
      };
    }

    // Handle show command
    if (args[0].toLowerCase() === 'show') {
      try {
        const alerts = await alertManager.getUserAlerts(userId);
        if (alerts.length === 0) {
          return {
            chat_id: userId,
            text: "You don't have any active alerts."
          };
        }

        const alertList = alerts.map(alert => 
          `🔔 ${alert.symbol}: Alert when price goes ${alert.condition} $${alert.price}`
        ).join('\n\n');

        return {
          chat_id: userId,
          text: `📋 Your Active Alerts:\n\n${alertList}\n\nUse /alert remove to remove all alerts.`
        };
      } catch (error) {
        console.error('Error showing alerts:', error);
        return {
          chat_id: userId,
          text: "❌ An error occurred while showing your alerts. Please try again later."
        };
      }
    }

    // Handle remove command
    if (args[0].toLowerCase() === 'remove') {
      try {
        await alertManager.removeAllUserAlerts(userId);
        return {
          chat_id: userId,
          text: "✅ All your alerts have been removed."
        };
      } catch (error) {
        console.error('Error removing alerts:', error);
        return {
          chat_id: userId,
          text: "❌ An error occurred while removing your alerts. Please try again later."
        };
      }
    }

    // Handle setting new alert
    if (args.length < 3) {
      return {
        chat_id: userId,
        text: "Please specify token, price, and condition. Example: /alert SOL 100 above"
      };
    }

    const token = args[0].toUpperCase();
    const price = parseFloat(args[1]);
    const condition = args[2].toLowerCase();

    if (isNaN(price)) {
      return {
        chat_id: userId,
        text: "Invalid price. Please provide a valid number."
      };
    }

    if (condition !== 'above' && condition !== 'below') {
      return {
        chat_id: userId,
        text: "Invalid condition. Use 'above' or 'below'."
      };
    }

    try {
      // Check if the token is available in Pyth
      const subscribed = alertManager.symbolSubscribed(token);
      if (!subscribed) {
        return {
          chat_id: userId,
          text: `Sorry, price alerts are not available for ${token}.`
        };
      }

      // Add the alert
      await alertManager.addAlert(userId, token, price, condition as 'above' | 'below');
      
      return {
        chat_id: userId,
        text: `✅ Alert set for ${token} when price goes ${condition} $${price}`
      };
    } catch (error) {
      console.error('Error setting alert:', error);
      return {
        chat_id: userId,
        text: "❌ An error occurred while setting the alert. Please try again later."
      };
    }
  }
};

export default alertCommand;
