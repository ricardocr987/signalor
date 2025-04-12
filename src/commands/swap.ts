import { Command } from '../';
import { getUserByTelegramId, getKeypairByUserId, getTokenMetadata } from '../db/index';
import { JupiterService } from '../services/jup';
import { validateAmount } from '../solana/validateAmount';
import { signTransaction, getBase64EncodedWireTransaction } from '@solana/kit';
import { createKeyPairFromBytes } from '@solana/keys';
import bs58 from 'bs58';
import { Keypair } from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import { base64Encoder, transactionDecoder } from '../solana/constants';

const swapCommand: Command = {
  name: 'swap',
  description: 'Swap tokens using Jupiter',
  execute: async (userId: number, args?: string[]) => {
    try {
      if (!args || args.length < 3) {
        return {
          chat_id: userId,
          text: "Please specify amount, from token, and to token. Example: /swap 100 SOL USDC"
        };
      }

      // Get user and their keypair
      const user = await getUserByTelegramId(userId);
      if (!user) {
        return {
          chat_id: userId,
          text: "You need to generate a keypair first using /keypair command."
        };
      }

      const keypair = await getKeypairByUserId(user.id);
      if (!keypair) {
        return {
          chat_id: userId,
          text: "You need to generate a keypair first using /keypair command."
        };
      }

      const amount = args[0];
      const fromToken = args[1];
      const toToken = args[2];

      // Get token metadata
      const fromTokenMetadata = await getTokenMetadata(fromToken);
      const toTokenMetadata = await getTokenMetadata(toToken);

      if (!fromTokenMetadata || !toTokenMetadata) {
        return {
          chat_id: userId,
          text: "Invalid token(s) specified. Please check the token symbols and try again."
        };
      }

      const parsedAmount = new BigNumber(amount).multipliedBy(
        10 ** fromTokenMetadata.decimals
      );

      // Validate amount
      const amountValidation = await validateAmount(keypair.publicKey, fromTokenMetadata.mintAddress, parsedAmount.toString());
      if (!amountValidation.isValid) {
        return {
          chat_id: userId,
          text: amountValidation.message || "Invalid amount specified."
        };
      }

      // Get Ultra order
      const orderResponse = await JupiterService.getUltraOrder(
        fromTokenMetadata.mintAddress,
        toTokenMetadata.mintAddress,
        parsedAmount.toString(),
        keypair.publicKey
      );

      if (!orderResponse.transaction) {
        return {
          chat_id: userId,
          text: "❌ Failed to create swap transaction. Please try again later."
        };
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

      if (executeResponse.status !== 'Success') {
        return {
          chat_id: userId,
          text: `❌ Swap failed: ${executeResponse.error || 'Unknown error'}`
        };
      }

      return {
        chat_id: userId,
        text: `✅ Swap executed successfully!\n\nFrom: ${amount} ${fromToken}\nTo: ${orderResponse.outAmount} ${toToken}\n\nTransaction: https://solscan.io/tx/${executeResponse.signature}`
      };
    } catch (error) {
      console.error('Error executing swap:', error);
      return {
        chat_id: userId,
        text: "❌ An error occurred while executing the swap. Please try again later."
      };
    }
  }
};

export default swapCommand;
