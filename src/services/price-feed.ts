import { WebSocketManager } from './ws-manager';
import { VybeService } from './vybe';

export interface PriceUpdate {
  symbol: string;
  price: number;
  timestamp: number;
}

type PriceUpdateCallback = (update: PriceUpdate) => void;

export class PriceFeedService {
  private static instance: PriceFeedService;
  private wsManager: WebSocketManager;
  private callbacks: Map<string, Set<PriceUpdateCallback>> = new Map();
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
    if (!callbacks) {
      console.log(`No callbacks registered for ${symbol}`);
      return;
    }

    const priceUpdate: PriceUpdate = {
      symbol,
      price: parseFloat(update.price),
      timestamp: update.timestamp || Date.now()
    };

    callbacks.forEach(callback => callback(priceUpdate));
  }

  public subscribe(symbol: string, callback: PriceUpdateCallback) {
    if (!this.callbacks.has(symbol)) {
      this.callbacks.set(symbol, new Set());
    }
        
    this.callbacks.get(symbol)?.add(callback);

    if (!this.priceFeeds.has(symbol)) {
      this.wsManager.subscribeToPriceFeed(
        symbol,
        (update) => this.handlePriceUpdate(symbol, update)
      );
      this.priceFeeds.add(symbol);
    }
  }

  public unsubscribe(symbol: string, callback: PriceUpdateCallback) {
    const callbacks = this.callbacks.get(symbol);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.callbacks.delete(symbol);
      }
    }
  }

  public isSymbolAvailable(symbol: string): boolean {
    return this.priceFeeds.has(symbol);
  }
}

export const priceFeedService = PriceFeedService.getInstance();