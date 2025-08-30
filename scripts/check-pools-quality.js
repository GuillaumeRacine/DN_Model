#!/usr/bin/env node
/**
 * Check data completeness for the 100 pools shown in the UI:
 * - Confirms 30d daily series availability via DeFiLlama Pro (/yields/chart)
 * - Confirms analytics overlay presence (FVR, vol, risk) in SQLite DB
 * - Writes a quality report to data/pools/top-by-apy/quality-<timestamp>.json
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

async function openAnalyticsDB() {
  const dbPath = path.join(process.cwd(), 'analytics', 'database', 'analytics.db');
  const db = await open({ filename: dbPath, driver: sqlite3.Database });
  return db;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function midnightUTCTimestampDaysAgo(days) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return Math.floor(d.getTime() / 1000);
}

async function fetchTokenHistoryCoverage(tokenIds, days = 30, batchSize = 50) {
  const unique = Array.from(new Set(tokenIds.map((s) => String(s).toLowerCase())));
  if (unique.length === 0) return {};
  const coverage = Object.fromEntries(unique.map((id) => [id, 0]));
  const batches = chunk(unique, batchSize);
  for (let d = days - 1; d >= 0; d--) {
    const ts = midnightUTCTimestampDaysAgo(d);
    for (const group of batches) {
      try {
        const csv = group.join(',');
        const data = await getPro(`/coins/prices/historical/${ts}/${encodeURIComponent(csv)}`);
        if (data && data.coins) {
          for (const id of group) {
            const rec = data.coins[id];
            if (rec && typeof rec.price === 'number') {
              coverage[id] += 1;
            }
          }
        }
      } catch (e) {
        // continue on error to avoid blocking entire check
      }
    }
  }
  return coverage;
}

async function main() {
  const minTVL = Number(process.env.MIN_TVL || 1_000_000);
  const limit = Number(process.env.LIMIT || 100);

  const yieldsData = await getPro('/yields/pools');
  const pools = Array.isArray(yieldsData?.data) ? yieldsData.data : [];
  const top = pools
    .filter((p) => typeof p.apy === 'number' && p.apy > 0 && p.apy < 1000 && typeof p.tvlUsd === 'number' && p.tvlUsd >= minTVL)
    .sort((a, b) => b.apy - a.apy)
    .slice(0, limit);

  const db = await openAnalyticsDB();
  const rows = await db.all('SELECT token_pair, network FROM pool_analytics WHERE fvr IS NOT NULL');
  await db.close();
  const analyticsSet = new Set(rows.map(r => `${normalizePair(r.token_pair)}|${String(r.network || '').toLowerCase()}`));

  // Collect underlying tokens from top pools
  const tokenIds = [];
  for (const p of top) {
    if (Array.isArray(p.underlyingTokens)) {
      for (const t of p.underlyingTokens) tokenIds.push(String(t).toLowerCase());
    }
  }

  // Fetch token price history coverage (30 daily points)
  const tokenCoverage = await fetchTokenHistoryCoverage(tokenIds, 30, 50);

  const report = [];
  let missingSeriesCount = 0;
  let missingAnalyticsCount = 0;
  let poolsWithTokenGaps = 0;

  for (const p of top) {
    const chainKey = String(p.chain || '').toLowerCase();
    const pairKey = normalizePair(p.symbol);
    const aKey = `${pairKey}|${chainKey}`;
    const hasAnalytics = analyticsSet.has(aKey);
    if (!hasAnalytics) missingAnalyticsCount++;

    let seriesPoints = 0;
    let hasSeries = false;
    try {
      const chart = await getPro(`/yields/chart/${encodeURIComponent(p.pool)}`);
      const points = chart?.data?.data || [];
      seriesPoints = Array.isArray(points) ? points.length : 0;
      hasSeries = seriesPoints >= 28;
    } catch (e) {
      hasSeries = false;
    }
    if (!hasSeries) missingSeriesCount++;

    // Token coverage for this pool
    const tokens = Array.isArray(p.underlyingTokens) ? p.underlyingTokens.map((t) => String(t).toLowerCase()) : [];
    const tokenPoints = tokens.map((t) => ({ id: t, days: tokenCoverage[t] || 0 }));
    const tokensOK = tokenPoints.length === 0 ? true : tokenPoints.every((tp) => tp.days >= 28);
    if (!tokensOK) poolsWithTokenGaps++;

    report.push({
      pool: p.pool,
      project: p.project,
      symbol: p.symbol,
      chain: p.chain,
      tvlUsd: p.tvlUsd,
      apy: p.apy,
      pairKey,
      analyticsKey: aKey,
      hasAnalytics,
      hasSeries,
      seriesPoints,
      tokensOK,
      tokenPoints,
    });
  }

  const outDir = path.join(process.cwd(), 'data', 'pools', 'top-by-apy');
  fs.mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = `quality-${ts}.json`;
  const outPath = path.join(outDir, outFile);
  const payload = {
    generatedAt: new Date().toISOString(),
    minTVL,
    limit,
    counts: {
      total: report.length,
      missingSeries: missingSeriesCount,
      missingAnalytics: missingAnalyticsCount,
      poolsWithTokenGaps,
      complete: report.length - (missingSeriesCount + missingAnalyticsCount + poolsWithTokenGaps),
    },
    report,
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));

  const indexPath = path.join(outDir, 'quality-index.json');
  let index = [];
  if (fs.existsSync(indexPath)) {
    try { index = JSON.parse(fs.readFileSync(indexPath, 'utf8')); } catch {}
  }
  index.unshift({ file: outFile, ts: payload.generatedAt, summary: payload.counts });
  fs.writeFileSync(indexPath, JSON.stringify(index.slice(0, 20), null, 2));
  console.log('Saved quality report:', outPath);
}

main().catch((e) => {
  console.error('Data quality check failed:', e);
  process.exit(1);
});
