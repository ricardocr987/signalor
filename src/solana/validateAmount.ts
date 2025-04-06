import { getTokenMetadata } from './fetcher/getTokenMetadata';
import { getTokenBalance } from './fetcher/getTokenBalance';
import BigNumber from 'bignumber.js';

export type ValidateAmount = {
  isValid: boolean;
  message?: string;
};

export async function validateAmount(
  account: string,
  inputToken: string,
  amount: string
): Promise<ValidateAmount> {
  const inputAmount = new BigNumber(amount);

  if (inputAmount.isLessThanOrEqualTo(0)) {
    return {
      isValid: false,
      message: 'Amount must be greater than 0!',
    };
  }

  try {
    const balance = await getTokenBalance(account, inputToken);

    if (!balance) {
      return {
        isValid: false,
        message: 'Token not found in wallet!',
      };
    }

    const userBalance = new BigNumber(balance);

    if (inputAmount.isGreaterThan(userBalance)) {
      const metadata = await getTokenMetadata(inputToken);
      if (!metadata) {
        return {
          isValid: false,
          message: 'Token not found!',
        };
      }

      return {
        isValid: false,
        message: `Insufficient balance! You have ${userBalance.toFixed(4)} ${metadata.symbol}`,
      };
    }

    return { isValid: true };
  } catch (error) {
    console.error('Error validating token amount:', error);
    return {
      isValid: false,
      message: 'Failed to validate token amount',
    };
  }
}
