import { Command } from '../';
import { getUserByTelegramId, createUser, createKeypair, getKeypairByUserId } from '../db/index';
import bs58 from 'bs58';
import { Keypair } from '@solana/web3.js';

const keypairCommand: Command = {
  name: 'keypair',
  description: 'Generate a new Solana keypair or show existing one',
  execute: async (userId: number, args?: string[]) => {
    try {
      // Check if user already has a keypair
      const existingKeypair = await getKeypairByUserId(userId);

      // If "show" argument is provided, display existing keypair
      if (args && args[0] === 'show') {
        if (!existingKeypair) {
          return {
            chat_id: userId,
            text: "❌ You don't have a keypair yet. Use /keypair to generate one."
          };
        }
        console.log(`Keypair command: Showing keypair for user ${userId}`);
        return {
          chat_id: userId,
          text: `🔑 Your Solana Public Key:\n\`${existingKeypair.publicKey}\``
        };
      }

      // If user already has a keypair and no "show" argument, return error
      if (existingKeypair) {
        return {
          chat_id: userId,
          text: "You already have a keypair. Please use /keypair show to view it."
        };
      }

      // Generate new Solana keypair using web3.js Keypair
      const keypair = Keypair.generate();
      const publicKey = keypair.publicKey.toBase58();
      const privateKey = bs58.encode(keypair.secretKey);

      // Store keypair in database
      await createKeypair(userId, publicKey, privateKey);

      return {
        chat_id: userId,
        text: `🔑 Solana Keypair generated successfully!\n\nPublic Key:\n\`${publicKey}\`\n\nPrivate Key:\n\`${privateKey}\`\n\n⚠️ WARNING: Never share your private key! Store it securely.`
      };
    } catch (error) {
      console.error('Error generating keypair:', error);
      return {
        chat_id: userId,
        text: "❌ An error occurred while generating your keypair. Please try again later."
      };
    }
  }
};

export default keypairCommand;
