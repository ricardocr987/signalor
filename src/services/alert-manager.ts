import { Alert, createAlert, getUserAlerts, deactivateAlert, getAllActiveAlerts } from '../db/index';
import { priceFeedService } from './price-feed';
import { config } from '../config';

export class AlertManager {
  private static instance: AlertManager;
  private activeAlerts: Map<string, Alert[]> = new Map();

  private constructor() {}

  static getInstance(): AlertManager {
    if (!AlertManager.instance) {
      AlertManager.instance = new AlertManager();
    }
    return AlertManager.instance;
  }

  public async initialize() {
    try {
      // Load all active alerts from the database
      const alerts = await getAllActiveAlerts();
      console.log(`Loaded ${alerts.length} active alerts`);
      
      // Group alerts by symbol
      alerts.forEach(alert => {
        if (!this.activeAlerts.has(alert.symbol)) {
          this.activeAlerts.set(alert.symbol, []);
        }
        this.activeAlerts.get(alert.symbol)?.push(alert);
        
        // Subscribe to price updates for this symbol
        this.subscribeToSymbol(alert.symbol);
      });
    } catch (error) {
      console.error('Failed to initialize alert manager:', error);
      throw error;
    }
  }

  private subscribeToSymbol(symbol: string) {
    priceFeedService.subscribe(symbol, (update) => this.handlePriceUpdate(symbol, update.price));
  }

  private handlePriceUpdate(symbol: string, currentPrice: number) {
    const alerts = this.activeAlerts.get(symbol);
    if (!alerts) return;

    alerts.forEach(alert => {
      if (this.shouldTriggerAlert(alert, currentPrice)) {
        // Deactivate the alert after triggering
        deactivateAlert(alert.id);
        
        // Remove from active alerts
        const symbolAlerts = this.activeAlerts.get(alert.symbol);
        if (symbolAlerts) {
          const index = symbolAlerts.findIndex(a => a.id === alert.id);
          if (index !== -1) {
            symbolAlerts.splice(index, 1);
          }
        }
        this.triggerAlert(alert, currentPrice);
      }
    });
  }

  private shouldTriggerAlert(alert: Alert, currentPrice: number): boolean {
    if (alert.condition === 'above') {
      return currentPrice >= alert.price;
    } else if (alert.condition === 'below') {
      return currentPrice <= alert.price;
    }
    return false;
  }

  private async triggerAlert(alert: Alert, currentPrice: number) {
    try {
      // Send alert to user via Telegram
      const message = `🔔 Alert Triggered!\n\n${alert.symbol} is now $${currentPrice.toFixed(2)}\n\nYour alert was set for when price goes ${alert.condition} $${alert.price}`;
      
      await fetch(`https://api.telegram.org/bot${config.BOT_TELEGRAM_KEY}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: alert.userId,
          text: message
        })
      });
    } catch (error) {
      console.error('Error sending alert notification:', error);
    }
  }

  symbolSubscribed(symbol: string): boolean {
    return priceFeedService.isSymbolAvailable(symbol);
  }

  async addAlert(userId: number, symbol: string, price: number, condition: 'above' | 'below'): Promise<Alert> {
    // Create alert in database
    const alert = await createAlert(userId, symbol, price, condition);
    
    // Add to active alerts
    if (!this.activeAlerts.has(symbol)) {
      this.activeAlerts.set(symbol, []);
    }
    this.activeAlerts.get(symbol)?.push(alert);
    
    // Subscribe to price updates for this symbol
    this.subscribeToSymbol(symbol);
        
    return alert;
  }

  async removeAlert(alertId: number): Promise<void> {
    // Find the alert in active alerts
    for (const [symbol, alerts] of this.activeAlerts.entries()) {
      const alert = alerts.find(a => a.id === alertId);
      if (alert) {
        // Deactivate in database
        deactivateAlert(alertId);
        
        // Remove from active alerts
        const index = alerts.indexOf(alert);
        this.activeAlerts.get(symbol)?.splice(index, 1);

        break;
      }
    }
  }

  async getUserAlerts(userId: number): Promise<Alert[]> {
    return getUserAlerts(userId);
  }

  async removeAllUserAlerts(userId: number): Promise<void> {
    const alerts = await this.getUserAlerts(userId);
    for (const alert of alerts) {
      await this.removeAlert(alert.id);
    }
  }
}

export const alertManager = AlertManager.getInstance();