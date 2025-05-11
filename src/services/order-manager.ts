import { getAllActiveOrders, deactivateOrder, createOrder, getUserOrders, getAllUserOrders, getUserByTelegramId, Order, getKeypairByUserId, getTokenMetadata, getUserTelegramId } from '../db/index';
import { JupiterService } from './jup';
import { signTransaction, getBase64EncodedWireTransaction, Address } from '@solana/kit';
import { createKeyPairFromBytes } from '@solana/keys';
import bs58 from 'bs58';
import { Keypair } from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import { base64Encoder, transactionDecoder } from '../solana/constants';
import { priceFeedService } from './price-feed';
import { PriceUpdate } from './price-feed';
import { config } from '../config';
import { rpc } from '../solana/rpc';
import { confirmTransaction } from '../solana/confirm';
import { prepareTransaction } from '../solana/prepare';
import { getLookupTables } from '../solana/fetcher/getLookupTables';

class OrderManager {
  private static instance: OrderManager;
  private activeOrders: Map<string, Order[]> = new Map();

  private constructor() {
    // Initialize asynchronously
    this.initialize().catch(error => {
      console.error('Failed to initialize order manager:', error);
    });
  }

  public static getInstance(): OrderManager {
    if (!OrderManager.instance) {
      OrderManager.instance = new OrderManager();
    }
    return OrderManager.instance;
  }

  private async initialize() {
    try {
      const orders = await getAllActiveOrders();
      
      if (!Array.isArray(orders)) {
        console.error('Expected array of orders but got:', typeof orders);
        return;
      }

      console.log(`Loaded ${orders.length} active orders`);
      
      // Group orders by input token
      orders.forEach(order => {
        if (!this.activeOrders.has(order.inputMint)) {
          this.activeOrders.set(order.inputMint, []);
        }
        this.activeOrders.get(order.inputMint)?.push(order);
        
        // Subscribe to price updates for this symbol
        this.subscribeToSymbol(order.inputSymbol, order.id);
      });

      console.log('Order manager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize order manager:', error);
      throw error;
    }
  }

  private subscribeToSymbol(symbol: string, orderId: number) {
    console.log(`OrderManager: Subscribing to ${symbol}`);
    const callback = (update: PriceUpdate) => {
      console.log(`OrderManager: Received price update for ${symbol}: ${update.price}`);
      // Find all orders with this symbol
      const orders = Array.from(this.activeOrders.values()).flat().filter(
        order => order.outputSymbol === symbol
      );
      orders.forEach(async (order) => {
        await this.handlePriceUpdate(order.outputMint, update.price);
      });
    };
    priceFeedService.subscribe(symbol, orderId, 'order', callback);
  }

  private async handlePriceUpdate(outputMint: string, currentPrice: number) {
    console.log(`OrderManager: Handling price update for ${outputMint}: ${currentPrice}`);
    const orders = this.activeOrders.get(outputMint);
    if (!orders) {
      console.log(`OrderManager: No orders found for ${outputMint}`);
      return;
    }

    console.log(`OrderManager: Found ${orders.length} orders for ${outputMint}`);
    for (const order of orders) {
      if (this.shouldTriggerOrder(order, currentPrice)) {
        // Unsubscribe using the order ID and type
        priceFeedService.unsubscribeById(order.id, 'order');
        console.log(`OrderManager: Deactivating order ${order.id}`, order);
        
        const symbolOrders = this.activeOrders.get(order.outputMint);
        if (symbolOrders) {
          const index = symbolOrders.findIndex(o => o.id === order.id);
          if (index !== -1) {
            symbolOrders.splice(index, 1);
          }
        }

        console.log(`OrderManager: Triggering order ${order.id} for ${outputMint} at price ${currentPrice}`);
        const signature = await this.executeOrder(order);
        if (signature) {
          await this.triggerAlert(order, currentPrice, signature);
          await deactivateOrder(order.id);
        }
      }
    }
  }

  private shouldTriggerOrder(order: Order, currentPrice: number): boolean {
    if (!order.isActive) return false
    return currentPrice <= order.outputTokenPrice;
  }

  private async executeOrder(order: Order): Promise<string | undefined> {
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Get user's keypair
        const telegramId = await getUserTelegramId(order.userId);
        const keypair = await getKeypairByUserId(telegramId);
        if (!keypair) {
          console.error(`No keypair found for user ${order.userId}`);
          return;
        }

        // Get token metadata for input token
        const inputTokenMetadata = await getTokenMetadata(order.inputMint);
        if (!inputTokenMetadata) {
          console.error(`No metadata found for token ${order.inputMint}`);
          return;
        }

        // Calculate total input amount
        const parsedAmount = new BigNumber(order.inputTokenAmount).multipliedBy(
          10 ** inputTokenMetadata.decimals
        );

        // Get Ultra order
        const orderResponse = await JupiterService.jupiterSwapInstructions(
          order.inputMint,
          order.outputMint,
          parsedAmount.toNumber(),
          '100',
          keypair.publicKey
        );

        if (!orderResponse.swapInstructions) {
          console.error('Failed to create swap transaction');
          return;
        }

        // Convert base64 transaction to bytes
        const lookupTableAccounts = await getLookupTables(
          orderResponse.lookupTableAddresses
        );
        const transaction = await prepareTransaction(
          orderResponse.swapInstructions,
          keypair.publicKey,
          lookupTableAccounts
        );
        const transactionBytes = base64Encoder.encode(transaction);
        const decodedTx = transactionDecoder.decode(transactionBytes);

        // Sign the transaction
        const userKeypair = Keypair.fromSecretKey(bs58.decode(keypair.privateKey));
        const solanaKeypair = await createKeyPairFromBytes(userKeypair.secretKey);
        const signedTransaction = await signTransaction(
          [solanaKeypair],
          decodedTx
        );

        // Get the base64 encoded wire transaction
        const wireTransaction = getBase64EncodedWireTransaction(signedTransaction);
        
        try {
          const signature = await confirmTransaction(wireTransaction);
          if (signature) {
            console.log(`Successfully executed order ${order.id} on attempt ${attempt}`);
            return signature;
          }
        } catch (error) {
          console.error(`Error confirming transaction on attempt ${attempt}:`, error);
          if (attempt < maxRetries) {
            console.log(`Retrying in ${retryDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
          throw error;
        }
      } catch (error) {
        console.error(`Error executing order ${order.id} on attempt ${attempt}:`, error);
        if (attempt < maxRetries) {
          console.log(`Retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        throw error;
      }
    }
  }

  private async triggerAlert(order: Order, currentPrice: number, signature: string) {
    try {
        // Send alert to user via Telegram
        const message = `�� Order Triggered!\n\n${order.outputSymbol} is now $${currentPrice.toFixed(2)}\n\nSignature: ${signature}\n\nhttps://solscan.io/tx/${signature}`;
        const telegramId = await getUserTelegramId(order.userId);

        await fetch(`https://api.telegram.org/bot${config.BOT_TELEGRAM_KEY}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: telegramId,
            text: message
          })
        });
      } catch (error) {
        console.error('Error sending alert notification:', error);
      }
  }

  public async addOrder(
    userId: number, 
    inputMint: string,
    inputSymbol: string,
    outputMint: string,
    outputSymbol: string,
    outputTokenPrice: number, 
    inputTokenAmount: number
  ): Promise<Order> {
    // Create order in database with both mint and symbol
    const order = await createOrder(
      userId,
      inputMint,
      inputSymbol,
      outputMint,
      outputSymbol,
      outputTokenPrice,
      inputTokenAmount
    );
    
    // Add to active orders
    if (!this.activeOrders.has(outputMint)) {
      this.activeOrders.set(outputMint, []);
    }
    this.activeOrders.get(outputMint)?.push(order);
    
    // Subscribe to price updates for this symbol and store the callback ID
    this.subscribeToSymbol(outputSymbol, order.id);
        
    return order;
  }

  public async removeOrder(orderId: number): Promise<void> {
    // Find the order in active orders
    for (const [symbol, orders] of this.activeOrders.entries()) {
      const order = orders.find(o => o.id === orderId);
      if (order) {
        console.log(`OrderManager: Removing order ${order.id} from active orders`);
        // Deactivate in database
        await deactivateOrder(orderId);
        
        // Unsubscribe using the order ID and type
        priceFeedService.unsubscribeById(orderId, 'order');
        
        // Remove from active orders
        const index = orders.indexOf(order);
        this.activeOrders.get(symbol)?.splice(index, 1);
        break;
      }
    }
  }

  public async getUserOrders(userId: number): Promise<Order[]> {
    return getUserOrders(userId);
  }

  public async removeAllUserOrders(userId: number): Promise<void> {
    const orders = await getAllUserOrders(userId);
    console.log(`OrderManager: Removing ${orders.length} orders for user ${userId}`);
    for (const order of orders) {
      await this.removeOrder(order.id);
    }
  }
}

export const orderManager = OrderManager.getInstance(); 