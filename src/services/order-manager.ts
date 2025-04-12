import { getAllActiveOrders, deactivateOrder, createOrder, getUserOrders, getAllUserOrders, getUserByTelegramId, Order, getKeypairByUserId, getTokenMetadata } from '../db/index';
import { JupiterService } from './jup';
import { signTransaction, getBase64EncodedWireTransaction } from '@solana/kit';
import { createKeyPairFromBytes } from '@solana/keys';
import bs58 from 'bs58';
import { Keypair } from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import { base64Encoder, transactionDecoder } from '../solana/constants';
import { priceFeedService } from './price-feed';
import { PriceUpdate } from './price-feed';
import { config } from '../config';

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
      console.log('Initializing order manager...');
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
        this.subscribeToSymbol(order.inputSymbol);
      });

      console.log('Order manager initialized successfully');
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
        order => order.inputSymbol === symbol
      );
      orders.forEach(async (order) => {
        await this.handlePriceUpdate(order.inputMint, update.price);
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
    await Promise.all(orders.map(async (order) => {
      if (this.shouldTriggerOrder(order, currentPrice)) {
        await deactivateOrder(order.id);
        console.log(`OrderManager: Deactivating order ${order.id}`, order);
        const symbolOrders = this.activeOrders.get(order.inputMint);
        if (symbolOrders) {
          const index = symbolOrders.findIndex(o => o.id === order.id);
          if (index !== -1) {
            symbolOrders.splice(index, 1);
          }
        }

        console.log(`OrderManager: Triggering order ${order.id} for ${inputMint} at price ${currentPrice}`);
        const signature = await this.executeOrder(order);
        if (signature) {
          await this.triggerAlert(order, currentPrice, signature);
        }
      }
    }));
  }

  private shouldTriggerOrder(order: Order, currentPrice: number): boolean {
    console.log(`OrderManager: Checking if order ${order.id} should trigger at price ${currentPrice}`);
    if (!order.isActive) return false
    return currentPrice <= order.price;
  }

  private async executeOrder(order: Order): Promise<string | undefined> {
    try {
      console.log(`Processing order ${order.id} for user ${order.userId}`);
          
    // Get internal user ID from Telegram user ID
      const user = await getUserByTelegramId(order.userId);
      if (!user) {
        throw new Error(`No user found for Telegram ID ${order.userId}`);
      }
      // Get user's keypair
      const keypair = await getKeypairByUserId(user.id);
      if (!keypair) {
        console.error(`No keypair found for user ${order.userId}`);
        return;
      }

      // Get token metadata for output token
      const outputTokenMetadata = await getTokenMetadata(order.outputMint);
      if (!outputTokenMetadata) {
        console.error(`No metadata found for token ${order.outputMint}`);
        return;
      }

      // Calculate total input amount
      const parsedAmount = new BigNumber(order.amount).multipliedBy(
        10 ** outputTokenMetadata.decimals
      );

      // Get Ultra order
      const orderResponse = await JupiterService.getUltraOrder(
        order.inputMint,
        order.outputMint,
        parsedAmount.toString(),
        keypair.publicKey
      );

      if (!orderResponse.transaction) {
        console.error('Failed to create swap transaction');
        return;
      }

      // Convert base64 transaction to bytes
      const transactionBytes = base64Encoder.encode(orderResponse.transaction);
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
        const message = `🔔 Order Triggered!\n\n${order.inputSymbol} is now $${currentPrice.toFixed(2)}\n\n $${order.price}\n\nSignature: ${signature}\n\nhttps://solscan.io/tx/${signature}`;
        
        await fetch(`https://api.telegram.org/bot${config.BOT_TELEGRAM_KEY}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: order.userId,
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
    const order = await createOrder(
      userId,
      inputMint, 
      inputTokenMetadata.symbol,
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
      if (order) {
        console.log(`OrderManager: Removing order ${order.id} from active orders`);
        // Deactivate in database
        await deactivateOrder(orderId);
        
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