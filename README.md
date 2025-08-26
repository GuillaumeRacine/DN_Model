# DN_Model

Advanced DeFi analytics and liquidity pool tracking dashboard across Ethereum, L2s, Solana, and Sui using the DeFiLlama API.

## Features

- 🔍 **Multi-chain Support**: Ethereum L1, Arbitrum, Optimism, Base, Polygon, Solana, and Sui
- 📊 **Comprehensive Metrics**: TVL, APY, volumes, and protocol analytics
- ⚡ **Real-time Data**: Powered by DeFiLlama's free API endpoints
- 🎛️ **Interactive Dashboard**: Filter chains, sort by metrics, and explore protocols
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🚀 **High Performance**: Built with Next.js 14 and optimized caching

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **State Management**: Zustand
- **Data Fetching**: Axios with built-in caching
- **Charts**: Recharts (ready for implementation)
- **API**: DeFiLlama free endpoints

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd defi-pool-tracker
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## API Endpoints Used

### Free DeFiLlama Endpoints:

- `/protocols` - All protocols with TVL
- `/v2/chains` - TVL across all chains
- `/v2/historicalChainTvl/{chain}` - Historical chain TVL
- `/overview/dexs` - DEX volumes overview
- `/overview/dexs/{chain}` - Chain-specific DEX volumes
- `/pools` - Liquidity pools data
- `/protocol/{protocol}` - Protocol details

## Features Overview

### 🏠 Overview Dashboard
- Total TVL across selected chains
- Chain-by-chain breakdown
- Top protocols by TVL
- Quick metrics summary

### ⛓️ Chain Analysis
- Detailed per-chain metrics
- Historical TVL trends
- Top protocols and pools per chain
- Volume and liquidity data

### 💰 Yield Farming
- Top yielding pools
- APY and base APY breakdown
- Impermanent loss risk indicators
- Volume and TVL filtering

### 🏛️ Protocol Explorer
- Protocol rankings by TVL
- Multi-chain protocol support
- 24h/7d performance tracking
- Category-based filtering

## Configuration

### Target Chains

The app tracks these chains by default:
- **Ethereum**: L1 mainnet
- **Arbitrum**: Ethereum L2
- **Optimism**: Ethereum L2
- **Base**: Coinbase L2
- **Polygon**: Ethereum sidechain
- **Solana**: High-performance blockchain
- **Sui**: Move-based blockchain

### Caching Strategy

- **Real-time data**: 5-minute cache TTL
- **Historical data**: 1-hour cache TTL
- **Protocol details**: 1-hour cache TTL
- **Chain metrics**: 15-minute cache TTL

## Data Refresh

The app automatically refreshes data based on cache TTLs. You can also manually refresh using the "Refresh" button in the header.

## Customization

### Adding New Chains

1. Update `TARGET_CHAINS` in `lib/defillama-api.ts`
2. Add display name to `CHAIN_DISPLAY_NAMES`
3. Restart the development server

### Modifying Cache Duration

Update TTL values in `lib/data-service.ts`:
- `DEFAULT_TTL`: Short-term cache (5 minutes)
- `LONG_TTL`: Long-term cache (1 hour)

## Performance Optimization

- **Parallel API Calls**: Multiple endpoints fetched simultaneously
- **Client-side Caching**: Reduces API calls and improves UX
- **Lazy Loading**: Components load data as needed
- **Optimized Filtering**: Client-side filtering for instant results

## Future Enhancements

### With Pro API Access:
- Real-time yield tracking with `/yields/pools`
- Historical APY charts with `/yields/chart/{pool}`
- Advanced pool analytics
- More detailed yield farming metrics

### Potential Features:
- Portfolio tracking
- Price alerts
- Historical performance charts
- Export functionality
- Dark mode toggle

## Troubleshooting

### Common Issues:

1. **API Rate Limits**: The free API has usage limits. Consider upgrading to Pro for higher limits.

2. **CORS Issues**: Use the app through a proper domain or development server.

3. **Slow Loading**: Large datasets may take time to load. Caching helps with subsequent requests.

## API Documentation

For detailed API documentation, visit: https://defillama.com/docs/api

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [DeFiLlama](https://defillama.com/) for providing comprehensive DeFi data
- Next.js and Vercel for the amazing development experience
- Tailwind CSS for the utility-first styling approach