import { WebSocketManager } from './ws-manager';
import { VybeService } from './vybe';

export interface PriceUpdate {
  symbol: string;
  price: number;
  timestamp: number;
}

type PriceUpdateCallback = (update: PriceUpdate) => void;

interface CallbackEntry {
  id: number;
  type: 'alert' | 'order';
  callback: PriceUpdateCallback;
}

interface CallbackKey {
  id: number;
  type: 'alert' | 'order';
}

export class PriceFeedService {
  private static instance: PriceFeedService;
  private wsManager: WebSocketManager;
  private callbacks: Map<string, Set<CallbackEntry>> = new Map();
  private priceFeeds: Set<string> = new Set();

  private constructor() {
    this.wsManager = WebSocketManager.getInstance();
  }

  public static getInstance(): PriceFeedService {
    if (!PriceFeedService.instance) {
      PriceFeedService.instance = new PriceFeedService();
    }
    return PriceFeedService.instance;
  }

  public async initialize() {
    try {
      console.log('Initializing price feed service...');
      const priceFeeds = await VybeService.getPythPriceFeeds();
      console.log(`Found ${priceFeeds.length} price feeds`);
      
      priceFeeds.forEach(priceFeed => {
        this.wsManager.subscribeToPriceFeed(
          priceFeed.symbol,
          (update) => this.handlePriceUpdate(priceFeed.symbol, update)
        );
        this.priceFeeds.add(priceFeed.symbol);
      });
    } catch (error) {
      console.error('Failed to initialize price feed service:', error);
      throw error;
    }
  }

  private handlePriceUpdate(symbol: string, update: any) {
    const callbacks = this.callbacks.get(symbol);
    if (!callbacks) return;

    const priceUpdate: PriceUpdate = {
      symbol,
      price: parseFloat(update.price),
      timestamp: update.timestamp || Date.now()
    };
    console.log('symbol', symbol);
    console.log('priceUpdate', priceUpdate);
    console.log('callbacks', callbacks);
    callbacks.forEach(entry => entry.callback(priceUpdate));
  }

  public subscribe(symbol: string, id: number, type: 'alert' | 'order', callback: PriceUpdateCallback) {
    if (!this.callbacks.has(symbol)) {
      this.callbacks.set(symbol, new Set());
    }
    this.callbacks.get(symbol)?.add({ id, type, callback });

    if (!this.priceFeeds.has(symbol)) {
      this.wsManager.subscribeToPriceFeed(
        symbol,
        (update) => this.handlePriceUpdate(symbol, update)
      );
      this.priceFeeds.add(symbol);
    }
  }

  public unsubscribeById(id: number, type: 'alert' | 'order') {
    for (const [symbol, callbacks] of this.callbacks.entries()) {
      for (const entry of callbacks) {
        if (entry.id === id && entry.type === type) {
          callbacks.delete(entry);
          if (callbacks.size === 0) {
            this.callbacks.delete(symbol);
          }
          break;
        }
      }
    }
  }

  public unsubscribe(symbol: string, callback: PriceUpdateCallback) {
    const callbacks = this.callbacks.get(symbol);
    if (callbacks) {
      for (const entry of callbacks) {
        if (entry.callback === callback) {
          callbacks.delete(entry);
          if (callbacks.size === 0) {
            this.callbacks.delete(symbol);
          }
          break;
        }
      }
    }
  }

  public isSymbolAvailable(symbol: string): boolean {
    return this.priceFeeds.has(symbol);
  }
}

export const priceFeedService = PriceFeedService.getInstance();