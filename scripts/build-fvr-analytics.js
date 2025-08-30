#!/usr/bin/env node
/**
 * Build FVR analytics snapshot for the current top 100 pools by APY (TVL ≥ 1M).
 * - Uses DeFiLlama Pro API: DEFILLAMA_API_KEY required
 * - Overlays historical analytics from analytics/database/analytics.db when available
 * - Computes proxy 30d volatility & FVR for pools missing DB metrics via /yields/chart
 * - Saves to data/pools/top-by-apy/analytics-<timestamp>.json and updates index.json
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

function normalizePair(input) {
  if (!input) return '';
  const parts = String(input)
    .replace(/\d+\.\d+%/g, '')
    .split(/[\/:\-]/)
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .sort();
  return parts.join('-');
}

async function getPro(pathPart) {
  const key = process.env.DEFILLAMA_API_KEY;
  if (!key) throw new Error('DEFILLAMA_API_KEY not set');
  const url = `https://pro-api.llama.fi/${key}${pathPart}`;
  const res = await axios.get(url, { timeout: 30000 });
  return res.data;
}

async function getYields() {
  return await getPro('/yields/pools');
}

async function getPoolChart(poolId) {
  const safe = encodeURIComponent(poolId);
  return await getPro(`/yields/chart/${safe}`);
}

async function openAnalyticsDB() {
  const dbPath = path.join(process.cwd(), 'analytics', 'database', 'analytics.db');
  const db = await open({ filename: dbPath, driver: sqlite3.Database });
  return db;
}

function computeVolatilityFromSeries(points) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const recent = points.slice(-30);
  const apys = recent
    .map((p) => (typeof p.apy === 'number' ? p.apy : (typeof p.value === 'number' ? p.value : null)))
    .filter((v) => typeof v === 'number');
  if (apys.length < 2) return null;
  const changes = [];
  for (let i = 1; i < apys.length; i++) {
    const prev = apys[i - 1];
    const curr = apys[i];
    if (prev && curr) {
      const ch = (curr - prev) / Math.max(1e-9, prev);
      if (isFinite(ch)) changes.push(ch);
    }
  }
  if (changes.length < 2) return null;
  const mean = changes.reduce((a, b) => a + b, 0) / changes.length;
  const variance = changes.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (changes.length - 1);
  const vol = Math.sqrt(Math.max(0, variance));
  return vol; // unitless proxy
}

async function main() {
  const minTVL = Number(process.env.MIN_TVL || 1_000_000);
  const limit = Number(process.env.LIMIT || 100);

  const yieldsData = await getYields();
  const pools = Array.isArray(yieldsData?.data) ? yieldsData.data : [];
  const top = pools
    .filter((p) => typeof p.apy === 'number' && p.apy > 0 && p.apy < 1000 && typeof p.tvlUsd === 'number' && p.tvlUsd >= minTVL)
    .sort((a, b) => b.apy - a.apy)
    .slice(0, limit);

  // Build analytics map from DB
  const db = await openAnalyticsDB();
  const rows = await db.all('SELECT token_pair, network, fvr, volatility_30d, il_risk_score, recommendation, data_points_count FROM pool_analytics WHERE fvr IS NOT NULL');
  await db.close();
  const analyticsMap = new Map();
  for (const r of rows) {
    const key = `${normalizePair(r.token_pair)}|${String(r.network || '').toLowerCase()}`;
    analyticsMap.set(key, {
      fvr: r.fvr,
      volatility30d: r.volatility_30d,
      ilRiskScore: r.il_risk_score,
      recommendation: r.recommendation,
      dataPoints: r.data_points_count,
    });
  }

  const out = [];
  for (const p of top) {
    const chainKey = String(p.chain || '').toLowerCase();
    const pairKey = normalizePair(p.symbol);
    const aKey = `${pairKey}|${chainKey}`;
    let fvr = null, vol30 = null, risk = null, rec = null, source = 'computed';
    const overlay = analyticsMap.get(aKey);
    if (overlay) {
      fvr = overlay.fvr;
      vol30 = overlay.volatility30d;
      risk = overlay.ilRiskScore;
      rec = overlay.recommendation;
      source = 'analytics-db';
    } else {
      try {
        const chart = await getPoolChart(p.pool);
        const vol = computeVolatilityFromSeries(chart?.data?.data);
        if (typeof vol === 'number') {
          vol30 = vol;
          if (p.apy > 0 && isFinite(vol) && vol > 0) {
            fvr = p.apy / (vol * 100);
          }
        }
      } catch (e) {
        // skip compute on error
      }
    }

    out.push({
      pool: p.pool,
      chain: p.chain,
      project: p.project,
      symbol: p.symbol,
      tvlUsd: p.tvlUsd,
      apy: p.apy,
      fvr,
      volatility30d: vol30,
      ilRiskScore: risk,
      recommendation: rec,
      source,
    });
  }

  const dir = path.join(process.cwd(), 'data', 'pools', 'top-by-apy');
  fs.mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = `analytics-${ts}.json`;
  const fpath = path.join(dir, file);
  fs.writeFileSync(fpath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    minTVL,
    limit,
    count: out.length,
    pools: out,
  }, null, 2));

  const indexPath = path.join(dir, 'analytics-index.json');
  let index = [];
  if (fs.existsSync(indexPath)) {
    try { index = JSON.parse(fs.readFileSync(indexPath, 'utf8')); } catch {}
  }
  index.unshift({ file, count: out.length, ts: new Date().toISOString() });
  fs.writeFileSync(indexPath, JSON.stringify(index.slice(0, 20), null, 2));
  console.log('Saved analytics:', fpath);
}

main().catch((e) => {
  console.error('Failed to build FVR analytics:', e);
  process.exit(1);
});

