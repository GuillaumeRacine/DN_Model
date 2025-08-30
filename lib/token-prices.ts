// Shared token price cache with 5-minute TTL, using DeFiLlama Pro fallback logic
import { defiLlamaAPI } from './defillama-api';

type PriceCacheEntry = { price: number; ts: number };
const TTL_MS = 5 * 60 * 1000;

const cache = new Map<string, PriceCacheEntry>(); // key = full id, e.g., "solana:<mint>"

function now() {
  return Date.now();
}

function setCached(id: string, price: number) {
  cache.set(id.toLowerCase(), { price, ts: now() });
}

function getCached(id: string): number | undefined {
  const entry = cache.get(id.toLowerCase());
  if (!entry) return undefined;
  if ((now() - entry.ts) > TTL_MS) {
    cache.delete(id.toLowerCase());
    return undefined;
  }
  return entry.price;
}

export async function getPricesByIds(ids: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const need: string[] = [];

  ids.forEach((id) => {
    const cached = getCached(id);
    if (typeof cached === 'number') {
      out[id.toLowerCase()] = cached;
    } else {
      need.push(id);
    }
  });

  if (need.length > 0) {
    const data = await defiLlamaAPI.getCurrentPrices(need);
    need.forEach((id) => {
      const key = id.toLowerCase();
      const price = data?.coins?.[key]?.price;
      if (typeof price === 'number') {
        setCached(key, price);
        out[key] = price;
      }
    });
  }
  return out;
}

export async function getSolanaMintPrices(mints: string[]): Promise<Record<string, number>> {
  const ids = mints.map((m) => `solana:${m}`);
  const prices = await getPricesByIds(ids);
  const out: Record<string, number> = {};
  mints.forEach((m) => {
    const key = `solana:${m}`.toLowerCase();
    if (typeof prices[key] === 'number') out[m] = prices[key];
  });
  return out;
}

export async function getBaseTokenPrices(addresses: string[]): Promise<Record<string, number>> {
  const ids = addresses.map((a) => `base:${a.toLowerCase()}`);
  const prices = await getPricesByIds(ids);
  const out: Record<string, number> = {};
  addresses.forEach((a) => {
    const key = `base:${a.toLowerCase()}`;
    const p = prices[key];
    if (typeof p === 'number') out[a.toLowerCase()] = p;
  });
  return out;
}

