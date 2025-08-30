#!/usr/bin/env node
/**
 * Save Top DeFi Pools by APY as deterministic IDs (contract addresses).
 *
 * Usage:
 *   node scripts/save-top-pools.js --minTVL 1000000 --limit 500
 *
 * Requires:
 *   DEFILLAMA_API_KEY env var (Pro key)
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { minTVL: 1_000_000, limit: 500 };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--minTVL' && args[i + 1]) out.minTVL = Number(args[++i]);
    else if (a === '--limit' && args[i + 1]) out.limit = Number(args[++i]);
  }
  return out;
}

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

function extractAddress(poolStr, chain) {
  if (typeof poolStr !== 'string') return { address: null, type: 'unknown' };
  // EVM address
  const evm = poolStr.match(/0x[a-fA-F0-9]{40}/);
  if (evm) return { address: evm[0].toLowerCase(), type: 'evm' };
  // Solana base58 (32-44 chars)
  const sol = poolStr.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
  if (sol && chain?.toLowerCase() === 'solana') return { address: sol[0], type: 'solana' };
  // Sui/other hex-like
  const sui = poolStr.match(/0x[a-fA-F0-9]{64}/);
  if (sui && chain?.toLowerCase() === 'sui') return { address: sui[0].toLowerCase(), type: 'sui' };
  return { address: null, type: 'unknown' };
}

async function main() {
  const { minTVL, limit } = parseArgs();
  const key = process.env.DEFILLAMA_API_KEY;
  if (!key) {
    console.error('DEFILLAMA_API_KEY not set');
    process.exit(1);
  }
  const url = `https://pro-api.llama.fi/${key}/yields/pools`;
  console.log('Fetching:', url.replace(key, '***'));
  const json = await get(url);
  const pools = Array.isArray(json?.data) ? json.data : [];
  console.log(`Received ${pools.length} pools`);

  const filtered = pools
    .filter((p) => typeof p.apy === 'number' && p.apy > 0 && p.apy < 1000 && typeof p.tvlUsd === 'number' && p.tvlUsd >= minTVL)
    .sort((a, b) => b.apy - a.apy)
    .slice(0, limit)
    .map((p) => {
      const { address, type } = extractAddress(p.pool, p.chain);
      const feeTier = (p.poolMeta || '').match(/(0\.01%|0\.05%|0\.3%|1%)/)?.[1] || null;
      return {
        uid: address || p.pool,
        address: address,
        addressType: type,
        originalPoolId: p.pool,
        chain: p.chain,
        project: p.project,
        symbol: p.symbol,
        feeTier,
        tvlUsd: p.tvlUsd,
        apy: p.apy,
        apyBase: p.apyBase ?? null,
        apyReward: p.apyReward ?? null,
        volumeUsd1d: p.volumeUsd1d ?? null,
        volumeUsd7d: p.volumeUsd7d ?? null,
      };
    });

  const outBase = path.join(process.cwd(), 'data', 'pools', 'top-by-apy');
  fs.mkdirSync(outBase, { recursive: true });

  // Save unified file
  const unifiedName = `top${filtered.length}_minTVL${minTVL}.json`;
  const unifiedPath = path.join(outBase, unifiedName);
  const payload = {
    generatedAt: new Date().toISOString(),
    minTVL,
    limit,
    count: filtered.length,
    pools: filtered,
  };
  fs.writeFileSync(unifiedPath, JSON.stringify(payload, null, 2));

  // Update unified index
  const unifiedIndexPath = path.join(outBase, 'index.json');
  let uindex = [];
  if (fs.existsSync(unifiedIndexPath)) {
    try { uindex = JSON.parse(fs.readFileSync(unifiedIndexPath, 'utf8')); } catch {}
  }
  uindex.unshift({ file: unifiedName, minTVL, count: filtered.length, ts: payload.generatedAt });
  fs.writeFileSync(unifiedIndexPath, JSON.stringify(uindex.slice(0, 20), null, 2));
  console.log('Saved unified:', unifiedPath);

  // Save per-chain files (ethereum, arbitrum, base, optimism, polygon, solana, sui, etc.)
  const byChain = filtered.reduce((acc, p) => {
    const key = String(p.chain || 'unknown').toLowerCase();
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  Object.entries(byChain).forEach(([chain, list]) => {
    const chainDir = path.join(outBase, chain);
    fs.mkdirSync(chainDir, { recursive: true });
    const fname = `top${list.length}_minTVL${minTVL}.json`;
    const fpath = path.join(chainDir, fname);
    const body = {
      generatedAt: payload.generatedAt,
      minTVL,
      limit,
      count: list.length,
      chain,
      pools: list,
    };
    fs.writeFileSync(fpath, JSON.stringify(body, null, 2));

    const cindexPath = path.join(chainDir, 'index.json');
    let cindex = [];
    if (fs.existsSync(cindexPath)) {
      try { cindex = JSON.parse(fs.readFileSync(cindexPath, 'utf8')); } catch {}
    }
    cindex.unshift({ file: fname, minTVL, count: list.length, ts: payload.generatedAt });
    fs.writeFileSync(cindexPath, JSON.stringify(cindex.slice(0, 20), null, 2));
    console.log(`Saved ${chain}:`, fpath);
  });
}

main().catch((e) => {
  console.error('Failed:', e);
  process.exit(1);
});
