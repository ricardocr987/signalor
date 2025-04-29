import { Command, CommandResponse } from '../';
import { getTokenMetadata } from '../db/index';
import { VybeService } from '../services/vybe';
import { TimeframeToSeconds } from '../utils';
import sharp from 'sharp';

interface ChartOptions {
  token: string;
  timeframe?: string;
  wide?: boolean;
  showMc?: boolean;
  showMa?: boolean;
}

const parseChartCommand = (args: string[]): ChartOptions => {
  const options: ChartOptions = {
    token: args[0]
  };

  // Parse additional options
  args.slice(1).forEach(arg => {
    if (['1m', '5m', '15m', '30m', '1h', '4h', '12h', '1d', '1w'].includes(arg)) {
      options.timeframe = arg;
    } else if (arg.toLowerCase() === 'wide' || arg.toLowerCase() === 'w') {
      options.wide = true;
    } else if (arg.toLowerCase() === 'mc') {
      options.showMc = true;
    } else if (arg.toLowerCase() === 'ma') {
      options.showMa = true;
    }
  });

  return options;
};

const formatNumber = (num: number): string => {
  if (num >= 1000) {
    return num.toLocaleString();
  }
  return num.toFixed(2);
};

async function generateChartImage(prices: number[], width: number = 800, height: number = 400): Promise<Buffer> {
  // Create a new image with sharp
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .background { fill: #1a1a1a; }
        .grid { stroke: #333333; stroke-width: 1; }
        .price-line { stroke: #4CAF50; stroke-width: 2; fill: none; }
        .text { fill: #ffffff; font-family: Arial; font-size: 12px; }
      </style>
      
      <!-- Background -->
      <rect class="background" width="100%" height="100%" />
      
      <!-- Grid lines -->
      ${Array.from({ length: 6 }, (_, i) => {
        const x = (width * i) / 5;
        const y = (height * i) / 5;
        return `
          <line class="grid" x1="${x}" y1="0" x2="${x}" y2="${height}" />
          <line class="grid" x1="0" y1="${y}" x2="${width}" y2="${y}" />
        `;
      }).join('')}
      
      <!-- Price line -->
      <path class="price-line" d="M${prices.map((price, i) => {
        const x = (width * i) / (prices.length - 1);
        const y = height - ((price - Math.min(...prices)) / (Math.max(...prices) - Math.min(...prices))) * height;
        return `${i === 0 ? 'M' : 'L'}${x},${y}`;
      }).join(' ')}" />
      
      <!-- Price labels -->
      ${Array.from({ length: 6 }, (_, i) => {
        const value = Math.min(...prices) + (i * (Math.max(...prices) - Math.min(...prices)) / 5);
        const y = (height * i) / 5;
        return `<text class="text" x="10" y="${y + 15}">$${formatNumber(value)}</text>`;
      }).join('')}
    </svg>
  `;

  // Convert SVG to PNG
  return await sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}

const chartCommand: Command = {
  name: 'chart',
  description: 'Get a price chart for a token',
  execute: async (userId: number, args?: string[]): Promise<CommandResponse> => {
    if (!args || args.length === 0) {
      return {
        chat_id: userId,
        text: "Please specify a token symbol. Example: /chart SOL 1h"
      };
    }

    try {
      const options = parseChartCommand(args);
      const timeframe = options.timeframe || '4h';
      
      // Get OHLCV data from Vybe
      const endTime = Math.floor(Date.now() / 1000);
      const startTime = endTime - TimeframeToSeconds[timeframe] * 100; // Get 100 candles

      const tokenMetadata = await getTokenMetadata(options.token);
      if (!tokenMetadata) {
        return {
          chat_id: userId,
          text: `Token ${options.token} not found`
        };
      }

      const ohlcvData = await VybeService.getTokenOHLCV(tokenMetadata.mintAddress, {
        resolution: timeframe,
        timeStart: startTime,
        timeEnd: endTime,
        limit: 100
      });

      if (!ohlcvData.data || ohlcvData.data.length === 0) {
        return {
          chat_id: userId,
          text: `No price data found for ${options.token}`
        };
      }

      const prices = ohlcvData.data.map(d => parseFloat(d.close));
      const chartWidth = options.wide ? 1200 : 800;
      const chartHeight = 400;
      
      const imageBuffer = await generateChartImage(prices, chartWidth, chartHeight);
      
      return {
        chat_id: userId,
        photo: imageBuffer,
        caption: `📊 ${options.token}/USD ${timeframe} Chart\n` +
                `High: $${formatNumber(Math.max(...prices))}\n` +
                `Low: $${formatNumber(Math.min(...prices))}\n` +
                `Current: $${formatNumber(prices[prices.length - 1])}`
      };
    } catch (error) {
      console.error('Error generating chart:', error);
      return {
        chat_id: userId,
        text: `Error generating chart for ${args?.[0] || 'token'}: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
};

export default chartCommand;