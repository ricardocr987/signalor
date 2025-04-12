import { config } from '../config';
import { db } from '../db/index';
import { tokens } from '../db/schema';
import { eq } from 'drizzle-orm';

interface VybeToken {
  symbol: string;
  name: string;
  mintAddress: string;
  price: number;
  price1d: number;
  price7d: number;
  decimal: number;
  logoUrl: string | null;
  category: string | null;
  subcategory: string | null;
  verified: boolean;
  currentSupply: string;
  marketCap: number;
  tokenAmountVolume24h: number;
  usdValueVolume24h: number;
}

interface TopHolder {
  rank: number;
  ownerName: string;
  ownerAddress: string;
  valueUsd: number;
  balance: number;
  percentageOfSupplyHeld: number;
}

interface TopHoldersResponse {
  data: TopHolder[];
  total: number;
}

interface TokenBalance {
  mintAddress: string;
  symbol: string;
  name: string;
  amount: string;
  valueUsd: number;
  priceUsd: number;
  verified: boolean;
}

interface TokenBalancesResponse {
  data: TokenBalance[];
  total: number;
}

interface TokenTrade {
  authorityAddress: string;
  baseMintAddress: string;
  baseSize: string;
  blockTime: number;
  fee: string;
  feePayer: string;
  iixOrdinal: number;
  interIxOrdinal: number;
  ixOrdinal: number;
  marketId: string;
  price: string;
  programId: string;
  quoteMintAddress: string;
  quoteSize: string;
  signature: string;
  slot: number;
  txIndex: number;
}

interface TokenTradesResponse {
  data: TokenTrade[];
  total: number;
}

export interface PythPriceFeed {
  priceFeedId: string;
  productId: string;
  symbol: string;
}

interface OHLCVData {
  close: string;
  count: number;
  high: string;
  low: string;
  open: string;
  time: string;
  volume: string;
  volumeUsd: string;
}

interface OHLCVResponse {
  data: OHLCVData[];
}

export class VybeService {
  private static readonly BASE_URL = 'https://api.vybenetwork.xyz';

  static async getTokenByMintAddress(mintAddress: string): Promise<typeof tokens.$inferSelect | null> {
    try {
      const result = await db.select().from(tokens).where(eq(tokens.mintAddress, mintAddress)).limit(1);
      return result[0] || null;
    } catch (error) {
      console.error('Error fetching token:', error);
      throw error;
    }
  }

  static async getTokenBySymbol(symbol: string): Promise<typeof tokens.$inferSelect | null> {
    try {
      const result = await db.select().from(tokens).where(eq(tokens.symbol, symbol)).limit(1);
      return result[0] || null;
    } catch (error) {
      console.error('Error fetching token:', error);
      throw error;
    }
  }

  static async getAllTokens(): Promise<typeof tokens.$inferSelect[]> {
    try {
      return await db.select().from(tokens);
    } catch (error) {
      console.error('Error fetching all tokens:', error);
      throw error;
    }
  }

  static async getTopHolders(
    mintAddress: string,
    options: {
      page?: number;
      limit?: number;
      sortByAsc?: string;
      sortByDesc?: string;
    } = {}
  ): Promise<TopHoldersResponse> {
    const queryParams = new URLSearchParams();
    
    if (options.page !== undefined) queryParams.append('page', options.page.toString());
    if (options.limit !== undefined) queryParams.append('limit', options.limit.toString());
    if (options.sortByAsc) queryParams.append('sortByAsc', options.sortByAsc);
    if (options.sortByDesc) queryParams.append('sortByDesc', options.sortByDesc);

    const url = `${this.BASE_URL}/token/${mintAddress}/top-holders?${queryParams.toString()}`;
    
    const response = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'X-API-KEY': config.VYBE_API_KEY || ''
      } as HeadersInit
    });

    if (!response.ok) {
      throw new Error(`Vybe API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  static async getTokenBalances(
    ownerAddress: string,
    options: {
      includeNoPriceBalance?: boolean;
      sortByAsc?: string;
      sortByDesc?: string;
      onlyVerified?: boolean;
      oneDayTradeMinimum?: number;
      oneDayTradeVolumeMinimum?: number;
      holderMinimum?: number;
      minAssetValue?: string;
      maxAssetValue?: string;
      limit?: number;
      page?: number;
    } = {}
  ): Promise<TokenBalancesResponse> {
    const queryParams = new URLSearchParams();
    
    if (options.includeNoPriceBalance !== undefined) queryParams.append('includeNoPriceBalance', options.includeNoPriceBalance.toString());
    if (options.sortByAsc) queryParams.append('sortByAsc', options.sortByAsc);
    if (options.sortByDesc) queryParams.append('sortByDesc', options.sortByDesc);
    if (options.onlyVerified !== undefined) queryParams.append('onlyVerified', options.onlyVerified.toString());
    if (options.oneDayTradeMinimum !== undefined) queryParams.append('oneDayTradeMinimum', options.oneDayTradeMinimum.toString());
    if (options.oneDayTradeVolumeMinimum !== undefined) queryParams.append('oneDayTradeVolumeMinimum', options.oneDayTradeVolumeMinimum.toString());
    if (options.holderMinimum !== undefined) queryParams.append('holderMinimum', options.holderMinimum.toString());
    if (options.minAssetValue) queryParams.append('minAssetValue', options.minAssetValue);
    if (options.maxAssetValue) queryParams.append('maxAssetValue', options.maxAssetValue);
    if (options.limit !== undefined) queryParams.append('limit', options.limit.toString());
    if (options.page !== undefined) queryParams.append('page', options.page.toString());

    const url = `${this.BASE_URL}/account/token-balance/${ownerAddress}?${queryParams.toString()}`;
    
    const response = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'X-API-KEY': config.VYBE_API_KEY || ''
      } as HeadersInit
    });

    if (!response.ok) {
      throw new Error(`Vybe API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  static async getTokenTrades(
    options: {
      programId?: string;
      baseMintAddress?: string;
      quoteMintAddress?: string;
      mintAddress?: string;
      marketId?: string;
      authorityAddress?: string;
      resolution?: string;
      timeStart?: number;
      timeEnd?: number;
      page?: number;
      limit?: number;
      sortByAsc?: string;
      sortByDesc?: string;
      feePayer?: string;
    } = {}
  ): Promise<TokenTradesResponse> {
    const queryParams = new URLSearchParams();
    
    if (options.programId) queryParams.append('programId', options.programId);
    if (options.baseMintAddress) queryParams.append('baseMintAddress', options.baseMintAddress);
    if (options.quoteMintAddress) queryParams.append('quoteMintAddress', options.quoteMintAddress);
    if (options.mintAddress) queryParams.append('mintAddress', options.mintAddress);
    if (options.marketId) queryParams.append('marketId', options.marketId);
    if (options.authorityAddress) queryParams.append('authorityAddress', options.authorityAddress);
    if (options.resolution) queryParams.append('resolution', options.resolution);
    if (options.timeStart !== undefined) queryParams.append('timeStart', options.timeStart.toString());
    if (options.timeEnd !== undefined) queryParams.append('timeEnd', options.timeEnd.toString());
    if (options.page !== undefined) queryParams.append('page', options.page.toString());
    if (options.limit !== undefined) queryParams.append('limit', options.limit.toString());
    if (options.sortByAsc) queryParams.append('sortByAsc', options.sortByAsc);
    if (options.sortByDesc) queryParams.append('sortByDesc', options.sortByDesc);
    if (options.feePayer) queryParams.append('feePayer', options.feePayer);

    const url = `${this.BASE_URL}/token/trades?${queryParams.toString()}`;
    
    const response = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'X-API-KEY': config.VYBE_API_KEY || ''
      } as HeadersInit
    });

    if (!response.ok) {
      throw new Error(`Vybe API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  static async getPythPriceFeeds(): Promise<PythPriceFeed[]> {
    const url = `${this.BASE_URL}/price/pyth-accounts`;
    const response = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'X-API-Key': config.VYBE_API_KEY || ''
      } as HeadersInit
    });

    if (!response.ok) {
      throw new Error(`Vybe API error: ${response.status} ${response.statusText}`);
    }

    const priceFeeds = await response.json();
    const filteredPriceFeeds = priceFeeds.data.filter((priceFeed: PythPriceFeed) => priceFeed.priceFeedId !== '' && priceFeed.productId !== '' && priceFeed.symbol.includes('Crypto'));
    
    return filteredPriceFeeds.map((priceFeed: PythPriceFeed) => {
      return {
        symbol: priceFeed.symbol.split('.')[1].split('/')[0],
        priceFeedId: priceFeed.priceFeedId,
        productId: priceFeed.productId
      };
    });
  }

  static async getTokenOHLCV(
    mintAddress: string,
    options: {
      resolution?: string;
      timeStart?: number;
      timeEnd?: number;
      limit?: number;
      page?: number;
    } = {}
  ): Promise<OHLCVResponse> {
    const queryParams = new URLSearchParams();
    
    if (options.resolution) queryParams.append('resolution', options.resolution);
    if (options.timeStart !== undefined) queryParams.append('timeStart', options.timeStart.toString());
    if (options.timeEnd !== undefined) queryParams.append('timeEnd', options.timeEnd.toString());
    if (options.limit !== undefined) queryParams.append('limit', options.limit.toString());
    if (options.page !== undefined) queryParams.append('page', options.page.toString());

    const url = `${this.BASE_URL}/price/${mintAddress}/token-ohlcv?${queryParams.toString()}`;
    
    const response = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'X-API-KEY': config.VYBE_API_KEY || ''
      } as HeadersInit
    });

    if (!response.ok) {
      throw new Error(`Vybe API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}