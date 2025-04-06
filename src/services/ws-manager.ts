import { config } from '../config';
import WebSocket from 'ws';
import { PythPriceFeed, VybeService } from './vybe';

interface PriceUpdate {
  symbol: string;
  price: string;
  timestamp: number;
}

interface PriceFeedSubscription {
  symbol: string;
  callback: (update: PriceUpdate) => void;
}

export class WebSocketManager {
  private static instance: WebSocketManager;
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, PriceFeedSubscription> = new Map();
  private priceFeeds: PythPriceFeed[] = []
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000; // 5 seconds
  private readonly enableReconnect = true;

  private constructor() {
    this.connect();
  }

  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  private getTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  }

  private connect() {
    if (this.ws) {
      this.ws.close();
    }

    this.ws = new WebSocket('wss://api.vybenetwork.xyz/live', {
      headers: {
        'X-API-Key': config.VYBE_API_KEY || ''
      }
    });

    this.ws.on('open', () => {
      this.reconnectAttempts = 0;
      this.subscribeToPriceFeeds();
    });

    this.ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (this.priceFeeds.length === 0 || !data.priceFeedAccount || !data.price) {
          return;
        }
        const symbol = this.priceFeeds.find(priceFeed => priceFeed.priceFeedId === data.priceFeedAccount)?.symbol;
        if (data.price && symbol) {
            const subscription = this.subscriptions.get(symbol);
            if (subscription) {
              subscription.callback({
                symbol: symbol,
                price: data.price,
                timestamp: data.timestamp || this.getTimestamp()
              });
            }
        }
      } catch (error) {
        console.error(`Failed to parse message: ${error}`);
      }
    });

    this.ws.on('close', () => {
      console.log('Connection closed');
      if (this.enableReconnect) {
        this.handleReconnect();
      }
    });

    this.ws.on('error', (error) => {
      console.error(`WebSocket error: ${error}`);
      if (this.enableReconnect) {
        this.handleReconnect();
      }
    });
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      setTimeout(() => this.connect(), this.reconnectDelay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  private async subscribeToPriceFeeds() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const priceFeeds = await VybeService.getPythPriceFeeds();
    this.priceFeeds = priceFeeds;
    const subscriptionMessage = {
      type: 'configure',
      filters: {
        oraclePrices: priceFeeds.map(priceFeed => ({
          priceFeedAccount: priceFeed.priceFeedId,
          productAccount: priceFeed.productId
        }))
      }
    };
    this.ws.send(JSON.stringify(subscriptionMessage));
  }

  subscribeToPriceFeed(symbol: string, callback: (update: PriceUpdate) => void) {
    this.subscriptions.set(symbol, {
      symbol,
      callback
    });
  }

  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscriptions.clear();
  }
} 