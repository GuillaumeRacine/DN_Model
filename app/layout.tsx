import './globals.css';

export const metadata = {
  title: 'DN_Model',
  description: 'Advanced DeFi analytics and liquidity pool tracking across Ethereum, L2s, Solana, and Sui',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}