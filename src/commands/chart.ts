import { Command } from '../';
import { VybeService } from '../services/vybe';
import { getTokenMetadata } from '../db/index';
import { createCanvas } from '@napi-rs/canvas';
import { formatDecimalPrice, formatLongNumber } from '../utils/format';

const chartCommand: Command = {
  name: 'chart',
  description: 'Get a candlestick chart for a token',
  execute: async (userId: number, args?: string[]) => {
    if (!args || args.length === 0) {
      return {
        chat_id: userId,
        text: "Please specify a token symbol and optional timeframe. Example: /chart SOL 1h"
      };
    }

    const token = args[0];
    const timeframe = args[1] || '1h'; // Default to 1 hour if not specified

    // Validate timeframe
    const validTimeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
    if (!validTimeframes.includes(timeframe)) {
      return {
        chat_id: userId,
        text: `Invalid timeframe. Available options: ${validTimeframes.join(', ')}`
      };
    }

    const tokenMetadata = await getTokenMetadata(token);
    if (!tokenMetadata) {
      return {
        chat_id: userId,
        text: `Token ${token} not found`
      };
    }
    
    try {
      // Calculate time range based on timeframe
      const now = Math.floor(Date.now() / 1000);
      let timeStart = now;
      let resolution = '1m';
      
      switch (timeframe) {
        case '1m':
          timeStart = now - 60 * 60; // 1 hour
          resolution = '1m';
          break;
        case '5m':
          timeStart = now - 5 * 60 * 60; // 5 hours
          resolution = '5m';
          break;
        case '15m':
          timeStart = now - 15 * 60 * 60; // 15 hours
          resolution = '15m';
          break;
        case '30m':
          timeStart = now - 30 * 60 * 60; // 30 hours
          resolution = '30m';
          break;
        case '1h':
          timeStart = now - 24 * 60 * 60; // 24 hours
          resolution = '1h';
          break;
        case '4h':
          timeStart = now - 4 * 24 * 60 * 60; // 4 days
          resolution = '4h';
          break;
        case '1d':
          timeStart = now - 30 * 24 * 60 * 60; // 30 days
          resolution = '1d';
          break;
        case '1w':
          timeStart = now - 12 * 7 * 24 * 60 * 60; // 12 weeks
          resolution = '1w';
          break;
      }

      // Get OHLCV data
      const ohlcvData = await VybeService.getTokenOHLCV(tokenMetadata.mintAddress, {
        resolution,
        timeStart,
        timeEnd: now,
        limit: 100 // Get enough data points for a good chart
      });

      if (!ohlcvData.data || ohlcvData.data.length === 0) {
        return {
          chat_id: userId,
          text: `No price data found for ${token}`
        };
      }

      // Get current price and change
      const latestData = ohlcvData.data[ohlcvData.data.length - 1];
      const firstData = ohlcvData.data[0];
      const currentPrice = parseFloat(latestData.close);
      const startPrice = parseFloat(firstData.close);
      const changePercentage = ((currentPrice - startPrice) / startPrice) * 100;

      // Generate chart
      const chartBuffer = await generateCandlestickChart(
        ohlcvData,
        token,
        timeframe,
        {
          symbol: token,
          price: currentPrice,
          changePercentage,
          marketCap: 0 // Default to 0 if not available
        }
      );

      return {
        chat_id: userId,
        photo: chartBuffer,
        caption: `📊 ${token} Chart (${timeframe})\n` +
                `Current Price: $${formatDecimalPrice(currentPrice, 5)}\n` +
                `Change: ${changePercentage >= 0 ? '+' : ''}${changePercentage.toFixed(2)}%`
      };
    } catch (error) {
      console.error('Error generating chart:', error);
      return {
        chat_id: userId,
        text: `Error generating chart for ${token}. Please try again later.`
      };
    }
  }
};

async function generateCandlestickChart(
  ohlcv: { data: any[] },
  title: string,
  timeframe: string,
  tokenInfo: {
    symbol: string
    price: number
    changePercentage: number
    marketCap: number
  }
) {
  const data = ohlcv.data;
  const width = 800;
  const height = 700;
  // Adjust padding for better centering
  const padding = { top: 50, right: 60, bottom: 80, left: 70 };

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Fill background with TradingView-like dark theme
  ctx.fillStyle = '#131722';
  ctx.fillRect(0, 0, width, height);

  // Draw fewer grid lines for cleaner look
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 1;
  // Draw only 4 vertical and 4 horizontal lines
  for (let i = 1; i <= 3; i++) {
    const x = padding.left + (width * i) / 3;
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, height - padding.bottom);
    ctx.stroke();
  }
  for (let i = 1; i <= 3; i++) {
    const y = padding.top + (height * i) / 3;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  // Calculate chart dimensions
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  // Allocate 20% of chart height for volume, with better spacing
  const priceChartHeight = chartHeight * 0.82;
  const volumeChartHeight = chartHeight * 0.13;
  const volumeChartTop = height - padding.bottom - volumeChartHeight;

  // Calculate 200 MA based on timeframe
  let maPeriod = 200;
  switch (timeframe) {
    case '1m':
      maPeriod = 200;
      break;
    case '5m':
      maPeriod = 200;
      break;
    case '15m':
      maPeriod = 200;
      break;
    case '30m':
      maPeriod = 100;
      break;
    case '1h':
      maPeriod = 50;
      break;
    case '4h':
      maPeriod = 25;
      break;
    case '1d':
      maPeriod = 10;
      break;
    case '1w':
      maPeriod = 5;
      break;
  }

  // Calculate MA
  const maData = [];
  for (let i = 0; i < data.length; i++) {
    if (i < maPeriod - 1) {
      maData.push(null);
      continue;
    }
    // Take the last maPeriod candles for the calculation
    const startIdx = Math.max(0, i - maPeriod + 1);
    const slice = data.slice(startIdx, i + 1);
    const sum = slice.reduce((acc, candle) => acc + Number(candle.close), 0);
    maData.push(sum / slice.length);
  }

  // Draw header with TradingView-like styling
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, Trebuchet MS, Roboto, Ubuntu';
  ctx.textAlign = 'left';
  ctx.fillText(`${tokenInfo.symbol}/USDC`, 30, 35);

  ctx.font = '15px -apple-system, BlinkMacSystemFont, Trebuchet MS, Roboto, Ubuntu';
  ctx.fillStyle = '#787b86';
  ctx.fillText(`(${timeframe})`, 30 + (tokenInfo.symbol.length + 4) * 15, 35);

  // Price and change with TradingView styling
  const changeColor = tokenInfo.changePercentage >= 0 ? '#26a69a' : '#ef5350';
  const changeSymbol = tokenInfo.changePercentage >= 0 ? '+' : '';

  ctx.font = '15px -apple-system, BlinkMacSystemFont, Trebuchet MS, Roboto, Ubuntu';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(
    `Price: $${formatDecimalPrice(tokenInfo.price, 5)}`,
    180 + (tokenInfo.symbol.length + 3) * 15,
    35
  );

  ctx.fillStyle = changeColor;
  ctx.fillText(
    `(${changeSymbol}${tokenInfo.changePercentage.toFixed(2)}%)`,
    300 + (tokenInfo.symbol.length + 3.5) * 15,
    35
  );

  // Market cap
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(
    `• MC: $${formatLongNumber(tokenInfo.marketCap || 0)}`,
    380 + (tokenInfo.symbol.length + 3.5) * 15,
    35
  );

  // Calculate min/max for price chart
  const minLow = Math.min(
    ...data.map((candle) => Number(candle.low)),
    ...maData.filter(v => v !== null)
  );
  const maxHigh = Math.max(
    ...data.map((candle) => Number(candle.high)),
    ...maData.filter(v => v !== null)
  );
  const valueRange = maxHigh - minLow;

  // Add 5% padding
  const paddedMinY = minLow - valueRange * 0.05;
  const paddedMaxY = maxHigh + valueRange * 0.05;
  const paddedRange = paddedMaxY - paddedMinY;

  // Draw candles
  const candleWidth = (chartWidth / data.length) * 0.6;
  const spacing = (chartWidth / data.length) * 0.4;

  // Draw volume bars
  if (data[0].volume !== undefined) {
    const maxVolume = Math.max(...data.map((candle) => Number(candle.volume || '0')));
    
    ctx.fillStyle = '#888888';
    ctx.textAlign = 'left';
    ctx.fillText('Volume', padding.left, volumeChartTop - 5);

    // Draw volume grid line
    ctx.strokeStyle = '#222222';
    ctx.beginPath();
    ctx.moveTo(padding.left, volumeChartTop);
    ctx.lineTo(width - padding.right, volumeChartTop);
    ctx.stroke();

    data.forEach((candle, i) => {
      if (candle.volume === undefined) return;

      const x = padding.left + i * (candleWidth + spacing) + spacing / 2;
      const volHeight = (Number(candle.volume) / maxVolume) * volumeChartHeight;

      ctx.fillStyle = Number(candle.open) > Number(candle.close)
        ? 'rgba(255, 68, 68, 0.5)'
        : 'rgba(68, 221, 68, 0.5)';
      ctx.fillRect(x, volumeChartTop + volumeChartHeight - volHeight, candleWidth, volHeight);
    });
  }

  // Draw candles
  data.forEach((candle, i) => {
    const x = padding.left + i * (candleWidth + spacing) + spacing / 2;

    const openY = padding.top + ((paddedMaxY - Number(candle.open)) / paddedRange) * priceChartHeight;
    const closeY = padding.top + ((paddedMaxY - Number(candle.close)) / paddedRange) * priceChartHeight;
    const highY = padding.top + ((paddedMaxY - Number(candle.high)) / paddedRange) * priceChartHeight;
    const lowY = padding.top + ((paddedMaxY - Number(candle.low)) / paddedRange) * priceChartHeight;

    const isRed = Number(candle.open) > Number(candle.close);
    
    // TradingView-like colors
    const candleRed = '#ef5350';
    const candleGreen = '#26a69a';
    
    // Draw the wick
    ctx.strokeStyle = isRed ? candleRed : candleGreen;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + candleWidth / 2, highY);
    ctx.lineTo(x + candleWidth / 2, lowY);
    ctx.stroke();

    // Draw the candle body
    const bodyHeight = Math.max(Math.abs(closeY - openY), 2);
    ctx.fillStyle = isRed ? candleRed : candleGreen;
    ctx.fillRect(x, Math.min(openY, closeY), candleWidth, bodyHeight);

    // Draw outline
    ctx.strokeStyle = isRed ? '#FF6666' : '#66FF66';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, Math.min(openY, closeY), candleWidth, bodyHeight);
  });

  // Draw 200 MA line
  ctx.strokeStyle = '#ff9800';  // More visible orange
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  let firstPoint = true;
  maData.forEach((ma, i) => {
    if (ma === null) return;
    const x = padding.left + i * (candleWidth + spacing) + spacing / 2 + candleWidth / 2;
    const y = padding.top + ((paddedMaxY - ma) / paddedRange) * priceChartHeight;
    if (firstPoint) {
      ctx.moveTo(x, y);
      firstPoint = false;
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  // Add MA legend with TradingView styling
  ctx.fillStyle = '#ff9800';
  ctx.textAlign = 'right';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, Trebuchet MS, Roboto, Ubuntu';
  ctx.fillText(`MA(${maPeriod})`, width - padding.right, padding.top + 20);

  // X-axis time labels with improved formatting
  ctx.fillStyle = '#787b86';  // TradingView-like color
  ctx.textAlign = 'center';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, Trebuchet MS, Roboto, Ubuntu';
  
  // Calculate proper time range based on timeframe
  const startTime = new Date(data[0].time);
  const endTime = new Date(data[data.length - 1].time);
  const timeSpanDays = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60 * 24);
  
  // Show fewer x-axis labels (5-7 labels total)
  const labelCount = Math.min(7, data.length);
  const labelStep = Math.floor(data.length / labelCount);
  
  for (let i = 0; i < data.length; i += labelStep) {
    const candle = data[i];
    const x = padding.left + i * (candleWidth + spacing) + spacing / 2 + candleWidth / 2;
    const timestamp = new Date(candle.time);
    
    // Format date based on timeframe
    let label;
    if (timeframe === '1w') {
      // For weekly, show "MMM DD" (e.g., "Mar 15")
      label = timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (timeframe === '1d') {
      // For daily, show "MM/DD" (e.g., "03/15")
      label = `${(timestamp.getMonth() + 1).toString().padStart(2, '0')}/${timestamp.getDate().toString().padStart(2, '0')}`;
    } else if (timeframe === '4h') {
      // For 4h, show "MM/DD HH:00"
      label = `${(timestamp.getMonth() + 1).toString().padStart(2, '0')}/${timestamp.getDate().toString().padStart(2, '0')} ${timestamp.getHours().toString().padStart(2, '0')}:00`;
    } else {
      // For 1h and shorter, show "MM/DD HH:mm"
      label = `${(timestamp.getMonth() + 1).toString().padStart(2, '0')}/${timestamp.getDate().toString().padStart(2, '0')} ${timestamp.getHours().toString().padStart(2, '0')}:${timestamp.getMinutes().toString().padStart(2, '0')}`;
    }

    // Draw subtle vertical grid line
    ctx.strokeStyle = '#1f2937';
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, height - padding.bottom);
    ctx.stroke();

    // Draw date label
    ctx.fillStyle = '#787b86';
    ctx.fillText(label, x, height - padding.bottom / 2);
  }

  return canvas.toBuffer('image/png');
}

export default chartCommand; 