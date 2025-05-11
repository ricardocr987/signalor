import ky from 'ky';
import { config } from '../config';
import { db } from '../db/index';
import { tokens } from '../db/schema';

interface RoutePlanStep {
  swapInfo: {
    ammKey: string;
    label?: string;
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    feeAmount: string;
    feeMint: string;
    percent: number;
  };
}

interface PlatformFee {
  amount?: string;
  feeBps?: number;
}

interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: 'ExactIn' | 'ExactOut';
  slippageBps: number;
  platformFee?: PlatformFee;
  priceImpactPct: string;
  routePlan: RoutePlanStep[];
  contextSlot?: number;
  timeTaken?: number;
}

interface JupiterPriceResponse {
  data: {
    id: string;
    mintSymbol: string;
    vsToken: string;
    vsTokenSymbol: string;
    price: number;
  }[];
  timeTaken: number;
}

interface JupiterSwapData {
  tokenLedgerInstruction: any;
  computeBudgetInstructions: any[];
  setupInstructions: any[];
  swapInstruction: any;
  cleanupInstruction?: any;
  addressLookupTableAddresses: string[];
}

interface JupiterSwapInstructions {
  swapInstructions: any[];
  lookupTableAddresses: string[];
  quoteResponse: JupiterQuoteResponse;
}

interface UltraOrderResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: object[];
  contextSlot?: number;
  feeBps: number;
  prioritizationType: 'None' | 'ComputeBudget' | 'Jito';
  prioritizationFeeLamports: number;
  swapType: 'aggregator' | 'rfq';
  transaction: string | null;
  gasless: boolean;
  requestId: string;
  totalTime: number;
  taker: string | null;
  quoteId: string;
  maker: string;
  expireAt: string;
  lastValidBlockHeight: number;
  platformFee?: object;
  dynamicSlippageReport?: object;
}

interface UltraExecuteResponse {
  status: 'Success' | 'Failed';
  signature?: string;
  slot?: string;
  error?: string;
  code: number;
  inputAmountResult?: string;
  outputAmountResult?: string;
  swapEvents?: object[];
}

interface JupiterToken {
  address: string;
  created_at: string;
  daily_volume: number | null;
  decimals: number;
  extensions: any;
  freeze_authority: string | null;
  logoURI: string | null;
  mint_authority: string | null;
  minted_at: string | null;
  name: string;
  permanent_delegate: string | null;
  symbol: string;
  tags: (string | null)[];
}

export class JupiterService {
  private static readonly BASE_URL = 'https://api.jup.ag/swap/v1';
  private static readonly ULTRA_BASE_URL = 'https://api.jup.ag/ultra/v1';
  private static readonly TOKEN_BASE_URL = 'https://lite-api.jup.ag/tokens/v1';

  static async getQuote(
    inputMint: string,
    outputMint: string,
    amount: string,
    slippageBps: number = 50
  ): Promise<JupiterQuoteResponse> {
    const headers = {
        'x-api-key': config.JUPITER_API_KEY,
      };

    try {
        const params = new URLSearchParams({
            inputMint: inputMint,
            outputMint: outputMint,
            amount: amount.toString(),
            slippageBps: slippageBps.toString(),
            onlyDirectRoutes: 'false',
        });
        
        return await ky
            .get(`${this.BASE_URL}/quote?${params}`, { headers })
            .json<JupiterQuoteResponse>();
    } catch (error) {
      console.error('Error fetching Jupiter quote:', error);
      throw error;
    }
  }

  static async getSwapInstructions(
    quoteResponse: JupiterQuoteResponse,
    userPublicKey: string
  ): Promise<JupiterSwapInstructions> {
    try {
        const swapData = await ky
        .post(`${this.BASE_URL}/swap-instructions`, {
          json: {
            quoteResponse,
            userPublicKey,
            wrapAndUnwrapSol: true,
          },
          headers: {
            'x-api-key': config.JUPITER_API_KEY,
          },
        })
        .json<JupiterSwapData>();
    
      const {
        tokenLedgerInstruction,
        computeBudgetInstructions,
        setupInstructions,
        swapInstruction,
        cleanupInstruction,
        addressLookupTableAddresses,
      } = swapData;

      const instructions = [
        ...setupInstructions,
        swapInstruction,
        cleanupInstruction,
      ].filter(Boolean);

      return {
        swapInstructions: instructions,
        lookupTableAddresses: addressLookupTableAddresses || [],
        quoteResponse,
      };
    } catch (error) {
      console.error('Error getting swap instructions:', error);
      throw error;
    }
  }

  static async swap(
    inputMint: string,
    outputMint: string,
    amount: string,
    userPublicKey: string,
    slippageBps: number = 50
  ): Promise<JupiterSwapInstructions> {
    try {
      const quoteResponse = await this.getQuote(
        inputMint,
        outputMint,
        amount,
        slippageBps
      );

      return await this.getSwapInstructions(quoteResponse, userPublicKey);
    } catch (error) {
      console.error('Error in swap process:', error);
      throw error;
    }
  }

  static async getUltraOrder(
    inputMint: string,
    outputMint: string,
    amount: string,
    taker?: string
  ): Promise<UltraOrderResponse> {
    try {
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount: amount.toString(),
      });

      if (taker) {
        params.append('taker', taker);
      }

      return await ky
        .get(`${this.ULTRA_BASE_URL}/order?${params}`, {
          headers: {
            'x-api-key': config.JUPITER_API_KEY,
          },
        })
        .json<UltraOrderResponse>();
    } catch (error) {
      console.error('Error fetching Ultra order:', error);
      throw error;
    }
  }

  static async executeUltraOrder(
    signedTransaction: string,
    requestId: string
  ): Promise<UltraExecuteResponse> {
    try {
      return await ky
        .post(`${this.ULTRA_BASE_URL}/execute`, {
          json: {
            signedTransaction,
            requestId,
          },
          headers: {
            'x-api-key': config.JUPITER_API_KEY,
          },
        })
        .json<UltraExecuteResponse>();
    } catch (error) {
      console.error('Error executing Ultra order:', error);
      throw error;
    }
  }

  static async fetchAndStoreTokens(): Promise<void> {
    try {
      console.log('Fetching tokens from Jupiter...');
      
      const response = await fetch(`${this.TOKEN_BASE_URL}/all`, {
        headers: {
          'accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Jupiter API error: ${response.status} ${response.statusText}`);
      }

      const jupTokens = await response.json() as JupiterToken[];
      console.log(`Found ${jupTokens.length} tokens`);

      // Sort tokens by daily_volume in descending order and take top 1000
      const sortedTokens = jupTokens
        .sort((a, b) => (b.daily_volume || 0) - (a.daily_volume || 0))
        .slice(0, 1000);

      console.log(`Storing top 1000 tokens by daily volume`);

      // Clear existing tokens
      await db.delete(tokens);

      // Insert new tokens in batches
      const batchSize = 100;
      const totalBatches = Math.ceil(sortedTokens.length / batchSize);
      
      for (let i = 0; i < sortedTokens.length; i += batchSize) {
        const currentBatch = Math.floor(i / batchSize) + 1;
        console.log(`Processing batch ${currentBatch}/${totalBatches} (${Math.round((currentBatch/totalBatches)*100)}%)`);
        
        const batch = sortedTokens.slice(i, i + batchSize).map(token => ({
          mintAddress: token.address,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          logoUrl: token.logoURI,
          dailyVolume: token.daily_volume,
          extensions: token.extensions,
          freezeAuthority: token.freeze_authority,
          mintAuthority: token.mint_authority,
          mintedAt: token.minted_at ? new Date(token.minted_at) : null,
          permanentDelegate: token.permanent_delegate,
          tags: token.tags,
          updateTime: Date.now()
        }));

        await db.insert(tokens).values(batch);
      }

      console.log('Token data successfully stored in database');
    } catch (error) {
      console.error('Error fetching and storing tokens:', error);
      throw error;
    }
  }

  static async getTokenMetadata(mintAddress: string): Promise<JupiterToken | null> {
    try {
      const response = await fetch(`${this.TOKEN_BASE_URL}/all`, {
        headers: {
          'accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Jupiter API error: ${response.status} ${response.statusText}`);
      }

      const tokens = await response.json() as JupiterToken[];
      return tokens.find(token => token.address === mintAddress) || null;
    } catch (error) {
      console.error('Error fetching token metadata:', error);
      throw error;
    }
  }

  static async jupiterSwapInstructions(
    inputToken: string,
    outputToken: string,
    amount: number,
    slippageBps: string,
    userPublicKey: string
  ): Promise<JupiterSwapInstructions> {
    const headers = {
      'x-api-key': config.JUPITER_API_KEY,
    };

    try {
      const params = new URLSearchParams({
        inputMint: inputToken,
        outputMint: outputToken,
        amount: amount.toString(),
        slippageBps: slippageBps,
        onlyDirectRoutes: 'true',
      });
      const quoteResponse = await ky
        .get(`https://api.jup.ag/swap/v1/quote?${params}`, { headers })
        .json<JupiterQuoteResponse>();

      return await this.getSwapInstructions(quoteResponse, userPublicKey);
    } catch (error: any) {
      if (
        error.message?.includes('Request failed with status code 400 Bad Request')
      ) {
        // Try again with all routes
        const params = new URLSearchParams({
          inputMint: inputToken,
          outputMint: outputToken,
          amount: amount.toString(),
          slippageBps: slippageBps,
          onlyDirectRoutes: 'false',
        });

        const quoteResponse = await ky
          .get(`https://api.jup.ag/swap/v1/quote?${params}`, { headers })
          .json<JupiterQuoteResponse>();

        return await this.getSwapInstructions(quoteResponse, userPublicKey);
      }
      throw Error('Error finding routes');
    }
  }
}
