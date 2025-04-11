import { Command, CommandResponse } from '../index';
import { VybeService } from '../services/vybe';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { TimeframeToSeconds, formatNumber } from '../utils';

interface ChartOptions {
  token: string;
  timeframe?: string;
  wide?: boolean;
  showMc?: boolean;
  showMa?: boolean;
}

interface ChartDataset {
  label: string;
  data: (number | null)[];
  borderColor: string;
  tension: number;
  fill: boolean;
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

      const ohlcvData = await VybeService.getTokenOHLCV(options.token, {
        resolution: timeframe,
        timeStart: startTime,
        timeEnd: endTime,
        limit: 100
      });

      // Create chart using Chart.js
      const width = options.wide ? 800 : 600;
      const height = 400;
      const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

      const chartData = {
        labels: ohlcvData.data.map(d => new Date(parseInt(d.time)).toLocaleString()),
        datasets: [{
          label: `${options.token}/USD`,
          data: ohlcvData.data.map(d => parseFloat(d.close)),
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1,
          fill: false
        }] as ChartDataset[]
      };

      if (options.showMa) {
        const prices = ohlcvData.data.map(d => parseFloat(d.close));
        
        const ema21 = calculateEMA(prices, 21);
        chartData.datasets.push({
          label: '21 EMA',
          data: ema21,
          borderColor: 'rgb(255, 99, 132)',
          tension: 0.1,
          fill: false
        });

        const sma50 = calculateSMA(prices, 50);
        chartData.datasets.push({
          label: '50 SMA',
          data: sma50,
          borderColor: 'rgb(54, 162, 235)',
          tension: 0.1,
          fill: false
        });

        const sma200 = calculateSMA(prices, 200);
        chartData.datasets.push({
          label: '200 SMA',
          data: sma200,
          borderColor: 'rgb(255, 206, 86)',
          tension: 0.1,
          fill: false
        });
      }

      const image = await chartJSNodeCanvas.renderToBuffer({
        type: 'line',
        data: chartData,
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: `${options.token}/USD ${timeframe} Chart`
            },
            legend: {
              display: true,
              position: 'top'
            }
          },
          scales: {
            y: {
              type: 'linear',
              display: true,
              position: 'right',
              grid: {
                color: 'rgba(255, 255, 255, 0.1)'
              }
            },
            x: {
              grid: {
                color: 'rgba(255, 255, 255, 0.1)'
              }
            }
          },
          elements: {
            point: {
              radius: 0
            }
          }
        }
      });

      return {
        chat_id: userId,
        photo: image,
        caption: `${options.token}/USD ${timeframe} Chart`
      };
    } catch (error: any) {
      console.error('Error generating chart:', error);
      return {
        chat_id: userId,
        text: `Error generating chart for ${args[0]}: ${error.message}`
      };
    }
  }
};

// Helper functions for moving averages
function calculateSMA(data: number[], period: number): (number | null)[] {
  const sma: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(null);
      continue;
    }
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    sma.push(sum / period);
  }
  return sma;
}

function calculateEMA(data: number[], period: number): (number | null)[] {
  const ema: (number | null)[] = [];
  const multiplier = 2 / (period + 1);
  
  // Start with SMA
  const firstSMA = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  ema.push(firstSMA);
  
  // Calculate EMA
  for (let i = period; i < data.length; i++) {
    const currentEMA: number = (data[i] - (ema[ema.length - 1] as number)) * multiplier + (ema[ema.length - 1] as number);
    ema.push(currentEMA);
  }
  
  // Pad the beginning with nulls
  return Array(period - 1).fill(null).concat(ema);
}

export default chartCommand;