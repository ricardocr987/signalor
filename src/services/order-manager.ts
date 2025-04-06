import { getAllActiveOrders, deactivateOrder, createOrder, getUserOrders, getAllUserOrders, getUserByTelegramId } from '../db';
import { JupiterService } from './jup';
import { getTokenMetadata } from '../solana/fetcher/getTokenMetadata';
import { validateAmount } from '../solana/validateAmount';
import { signTransaction, getBase64EncodedWireTransaction } from '@solana/kit';
import { createKeyPairFromBytes } from '@solana/keys';
import bs58 from 'bs58';
import { Keypair } from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import { base64Encoder, transactionDecoder } from '../solana/constants';
import { getKeypairByUserId } from '../db';
import { priceFeedService } from './price-feed';
import { PriceUpdate } from './price-feed';
import { config } from '../config';

interface Order {
  id: number;
  user_id: number;
  input_mint: string;
  input_symbol: string;
  output_mint: string;
  price: number;
  amount: number;
  is_active: boolean;
  created_at: string;
}

class OrderManager {
  private static instance: OrderManager;
  private activeOrders: Map<string, Order[]> = new Map();

  private constructor() {
    this.initialize();
  }

  public static getInstance(): OrderManager {
    if (!OrderManager.instance) {
      OrderManager.instance = new OrderManager();
    }
    return OrderManager.instance;
  }

  public initialize() {
    try {
      console.log('Initializing order manager...');
      const orders = getAllActiveOrders();
      console.log(`Loaded ${orders.length} active orders`);
      
      // Group orders by input token
      orders.forEach(order => {
        if (!this.activeOrders.has(order.input_mint)) {
          this.activeOrders.set(order.input_mint, []);
        }
        this.activeOrders.get(order.input_mint)?.push(order);
        
        // Subscribe to price updates for this symbol
        this.subscribeToSymbol(order.input_symbol);
      });
    } catch (error) {
      console.error('Failed to initialize order manager:', error);
      throw error;
    }
  }

  private subscribeToSymbol(symbol: string) {
    console.log(`OrderManager: Subscribing to ${symbol}`);
    const callback = (update: PriceUpdate) => {
      console.log(`OrderManager: Received price update for ${symbol}: ${update.price}`);
      // Find all orders with this symbol
      const orders = Array.from(this.activeOrders.values()).flat().filter(
        order => order.input_symbol === symbol
      );
      orders.forEach(async (order) => {
        await this.handlePriceUpdate(order.input_mint, update.price);
      });
    };
    priceFeedService.subscribe(symbol, callback);
  }

  private async handlePriceUpdate(inputMint: string, currentPrice: number) {
    console.log(`OrderManager: Handling price update for ${inputMint}: ${currentPrice}`);
    const orders = this.activeOrders.get(inputMint);
    if (!orders) {
      console.log(`OrderManager: No orders found for ${inputMint}`);
      return;
    }

    console.log(`OrderManager: Found ${orders.length} orders for ${inputMint}`);
    Promise.all(orders.map(async (order) => {
      // Skip if order was already processed

      if (this.shouldTriggerOrder(order, currentPrice)) {
        deactivateOrder(order.id);
        console.log(`OrderManager: Deactivating order ${order}`, order);
        const symbolOrders = this.activeOrders.get(order.input_mint);
        if (symbolOrders) {
          const index = symbolOrders.findIndex(o => o.id === order.id);
          if (index !== -1) {
            symbolOrders.splice(index, 1);
          }
        }

        console.log(`OrderManager: Triggering order ${order.id} for ${inputMint} at price ${currentPrice}`);
        const signature = await this.executeOrder(order);
        if (signature) {
            this.triggerAlert(order, currentPrice, signature);
        }
      }
    }));
  }

  private shouldTriggerOrder(order: Order, currentPrice: number): boolean {
    console.log(`OrderManager: Checking if order ${order.id} should trigger at price ${currentPrice}`);
    return order.is_active && currentPrice <= order.price;
  }

  private async executeOrder(order: Order): Promise<string | undefined> {
    try {
      console.log(`Processing order ${order.id} for user ${order.user_id}`);
          
    // Get internal user ID from Telegram user ID
      const user = getUserByTelegramId(order.user_id);
      if (!user) {
        throw new Error(`No user found for Telegram ID ${order.user_id}`);
      }
      // Get user's keypair
      const keypair = getKeypairByUserId(user.id);
      if (!keypair) {
        console.error(`No keypair found for user ${order.user_id}`);
        return;
      }

      // Get token metadata for output token
      const outputTokenMetadata = await getTokenMetadata(order.output_mint);
      if (!outputTokenMetadata) {
        console.error(`No metadata found for token ${order.output_mint}`);
        return;
      }

      // Calculate total input amount
      const parsedAmount = new BigNumber(order.amount).multipliedBy(
        10 ** outputTokenMetadata.decimals
      );

      // Get Ultra order
      const orderResponse = await JupiterService.getUltraOrder(
        order.input_mint,
        order.output_mint,
        parsedAmount.toString(),
        keypair.public_key
      );

      if (!orderResponse.transaction) {
        console.error('Failed to create swap transaction');
        return;
      }

      // Convert base64 transaction to bytes
      const transactionBytes = base64Encoder.encode(orderResponse.transaction);
      const decodedTx = transactionDecoder.decode(transactionBytes);

      // Sign the transaction
      const userKeypair = Keypair.fromSecretKey(bs58.decode(keypair.private_key));
      const solanaKeypair = await createKeyPairFromBytes(userKeypair.secretKey);
      const signedTransaction = await signTransaction(
        [solanaKeypair],
        decodedTx
      );

      // Get the base64 encoded wire transaction
      const wireTransaction = getBase64EncodedWireTransaction(signedTransaction);

      // Execute the swap
      const executeResponse = await JupiterService.executeUltraOrder(
        wireTransaction,
        orderResponse.requestId
      );

      return executeResponse.signature;
    } catch (error) {
      console.error(`Error executing order ${order.id}:`, error);
    }
  }

  private async triggerAlert(order: Order, currentPrice: number, signature: string) {
    try {
        // Send alert to user via Telegram
        const message = `🔔 Order Triggered!\n\n${order.input_symbol} is now $${currentPrice.toFixed(2)}\n\n $${order.price}\n\nSignature: ${signature}\n\nhttps://solscan.io/tx/${signature}`;
        
        await fetch(`https://api.telegram.org/bot${config.BOT_TELEGRAM_KEY}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: order.user_id,
            text: message
          })
        });
      } catch (error) {
        console.error('Error sending alert notification:', error);
      }
  }

  public async addOrder(userId: number, inputMint: string, outputMint: string, price: number, amount: number): Promise<Order> {
    // Get token metadata for input token
    const inputTokenMetadata = await getTokenMetadata(inputMint);
    if (!inputTokenMetadata) {
      console.error(`No metadata found for token ${inputMint}`);
      throw new Error(`No metadata found for token ${inputMint}`);
    }
    
    // Create order in database with both mint and symbol
    const order = createOrder(
      userId, // Use internal user ID instead of Telegram user ID
      inputMint, 
      inputTokenMetadata.symbol, // Store the symbol
      outputMint, 
      price, 
      amount
    );
    
    // Add to active orders
    if (!this.activeOrders.has(inputMint)) {
      this.activeOrders.set(inputMint, []);
    }
    this.activeOrders.get(inputMint)?.push(order);
    
    // Subscribe to price updates for this symbol
    this.subscribeToSymbol(inputTokenMetadata.symbol);
        
    return order;
  }

  public async removeOrder(orderId: number): Promise<void> {
    // Find the order in active orders
    for (const [symbol, orders] of this.activeOrders.entries()) {
      const order = orders.find(o => o.id === orderId);
      console.log(`OrderManager: Removing order ${orderId} from active orders`, order);
      if (order) {
        console.log(`OrderManager: Removing order ${order.id} from active orders`);
        // Deactivate in database
        deactivateOrder(orderId);
        
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
    const orders = getAllUserOrders(userId);
    console.log(`OrderManager: Removing ${orders.length} orders for user ${userId}`);
    for (const order of orders) {
      this.removeOrder(order.id);
    }
  }
}

export const orderManager = OrderManager.getInstance(); 