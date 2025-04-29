import { Command, CommandResponse } from '../index';
import { VybeService } from '../services/vybe';
import { TimeframeToSeconds, formatNumber } from '../utils';
import { getTokenMetadata } from '../db/index';
import { createCanvas } from 'canvas';

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

function generateChartImage(prices: number[], width: number = 800, height: number = 400): Buffer {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Set background
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, width, height);

  // Calculate chart dimensions
  const padding = 40;
  const chartWidth = width - (padding * 2);
  const chartHeight = height - (padding * 2);

  // Find min and max values
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min;

  // Draw grid lines
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 1;

  // Vertical grid lines
  for (let i = 0; i <= 5; i++) {
    const x = padding + (i * chartWidth / 5);
    ctx.beginPath();
    ctx.moveTo(x, padding);
    ctx.lineTo(x, height - padding);
    ctx.stroke();
  }

  // Horizontal grid lines
  for (let i = 0; i <= 5; i++) {
    const y = padding + (i * chartHeight / 5);
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  // Draw price line
  ctx.strokeStyle = '#4CAF50';
  ctx.lineWidth = 2;
  ctx.beginPath();

  prices.forEach((price, i) => {
    const x = padding + (i * chartWidth / (prices.length - 1));
    const y = height - padding - ((price - min) / range * chartHeight);
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();

  // Draw price labels
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px Arial';
  ctx.textAlign = 'right';

  // Y-axis labels
  for (let i = 0; i <= 5; i++) {
    const value = min + (i * range / 5);
    const y = padding + (i * chartHeight / 5);
    ctx.fillText(formatNumber(value), padding - 5, y + 4);
  }

  // X-axis labels (time)
  ctx.textAlign = 'center';
  const timeLabels = ['Start', '', '', '', 'End'];
  for (let i = 0; i <= 4; i++) {
    const x = padding + (i * chartWidth / 4);
    ctx.fillText(timeLabels[i], x, height - padding + 15);
  }

  return canvas.toBuffer('image/png');
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
      
      const imageBuffer = generateChartImage(prices, chartWidth, chartHeight);
      
      return {
        chat_id: userId,
        photo: imageBuffer,
        caption: `📊 ${options.token}/USD ${timeframe} Chart\n` +
                `High: $${formatNumber(Math.max(...prices))}\n` +
                `Low: $${formatNumber(Math.min(...prices))}\n` +
                `Current: $${formatNumber(prices[prices.length - 1])}`
      };
    } catch (error: unknown) {
      console.error('Error generating chart:', error);
      return {
        chat_id: userId,
        text: `Error generating chart for ${args?.[0] || 'token'}: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
};

export default chartCommand;