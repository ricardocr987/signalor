import ky from 'ky';
import { config } from '../config';

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

export class JupiterService {
  private static readonly BASE_URL = 'https://api.jup.ag/swap/v1';
  private static readonly ULTRA_BASE_URL = 'https://api.jup.ag/ultra/v1';

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
}
