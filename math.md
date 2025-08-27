```markdown
# CLMM Math & Theory Reference

This section summarizes the key formulas needed to evaluate concentrated liquidity positions (Uniswap v3–style, also Pancake v3, Raydium CLMM, Orca, Cetus).

---

## 1. Price, Liquidity, and Range Definitions

- \(P\): current price (token1 per token0, e.g. USDC per ETH)  
- \(P_a, P_b\): lower and upper price bounds of the LP’s range  
- \(s = \sqrt{P},\; s_a=\sqrt{P_a},\; s_b=\sqrt{P_b}\)  
- \(L\): liquidity parameter of the position  
- \(\text{amount}_0\): token0 (e.g. ETH) held by LP  
- \(\text{amount}_1\): token1 (e.g. USDC) held by LP  

**Token amounts (piecewise):**

- If \(P \le P_a\):  
  \(\text{amount}_0 = L\!\left(\tfrac{1}{s_a}-\tfrac{1}{s_b}\right),\;\text{amount}_1=0\)

- If \(P_a < P < P_b\):  
  \(\text{amount}_0 = L\!\left(\tfrac{1}{s}-\tfrac{1}{s_b}\right),\;\text{amount}_1 = L(s-s_a)\)

- If \(P \ge P_b\):  
  \(\text{amount}_0=0,\;\text{amount}_1=L(s_b-s_a)\)

**Position value in token1 units:**

- If \(P \le P_a\): \(V(P)=\text{amount}_0 \cdot P\)  
- If \(P_a < P < P_b\): \(V(P)=\text{amount}_0\cdot P+\text{amount}_1 = L\!\left(2s-s_a-\tfrac{s^2}{s_b}\right)\)  
- If \(P \ge P_b\): \(V(P)=\text{amount}_1\)

**Sensitivities:**

- Delta (exposure in token0 units): \(\Delta = \text{amount}_0\)  
- Gamma (curvature, always <0): \(\Gamma = -\tfrac{L}{2s^3}\)  

---

## 2. Fees, Volume, TVL

- \(\text{volume}_t\): traded volume in token1 units at time \(t\)  
- \(\text{feeTier}\): fee % (e.g. 0.3% = 0.003)  
- \(\text{TVL}_t\): total value locked at time \(t\) (in token1 units)  

**Period fees (pool-level):**

\[
\text{Fees} = \sum_t \text{volume}_t \cdot \text{feeTier}
\]

**Average TVL:**

\[
\overline{\text{TVL}}=\frac{1}{N}\sum_t \text{TVL}_t
\]

**Pool Fee APR:**

\[
\text{FeeAPR}_{pool} = \frac{\text{Fees}}{\overline{\text{TVL}}}\cdot \frac{365}{\text{days}}
\]

**Position Fee APR (approx):**

\[
\text{FeeAPR}_{pos} \approx \text{FeeAPR}_{pool} \times \text{TimeInRange} \times \text{LiquidityShare}
\]

- *TimeInRange*: fraction of samples with \(P \in [P_a,P_b]\)  
- *LiquidityShare*: LP’s share of active liquidity in-range  

---

## 3. Volatility and Ratios

- Log return: \(r_t=\ln(P_t/P_{t-1})\)  
- Annualized volatility:  
  \(\sigma_{ann} = \text{stdev}(r_t)\cdot \sqrt{\text{obs per year}}\)

**Fee-to-Vol Ratio (FVR):**

\[
\text{FVR}=\frac{\text{FeeAPR}_{pos}}{\sigma_{ann}}
\]

---

## 4. Impermanent Loss (IL) vs HODL

**50/50 HODL value at price \(P\):**

\[
V_{HODL}(P)=\frac{C_0}{2}\left(1+\frac{P}{P_0}\right)
\]

- \(C_0\): initial capital (token1 units)  
- \(P_0\): initial price  

**IL (general, path-based):**

\[
IL(P) = \frac{V_{LP}(P)}{V_{HODL}(P)}-1
\]

**Closed-form IL (constant-product full range, reference):**

\[
IL(r) = \frac{2\sqrt{r}}{1+r}-1,\;\; r=P/P_0
\]

---

## 5. Breakeven and Net Yield

- **Expected IL rate**: average annualized IL from path simulation or MC  
- **Breakeven FeeAPR**:  
  \(\text{FeeAPR}_{pos} \approx \text{ExpectedIL}_{rate}\)  

- **Excess Yield**:  
  \(\Delta Y = \text{FeeAPR}_{pos} - \text{ExpectedIL}_{rate}\)  

- **Sharpe-like Net Ratio**:  
  \(\text{FVR}_{net}=\frac{\text{FeeAPR}_{pos}-\text{ExpectedIL}_{rate}}{\sigma_{ann}}\)

---

## 6. Hedged LP

- **LP delta (token0 units):** \(\Delta_{LP}=\text{amount}_0\)  
- **Target delta (e.g., 0 for neutral):** \(\Delta^*\)  
- **Perp hedge size (token0 units):**  
  \(H=\Delta_{LP}-\Delta^*\)  
  (Short if \(H>0\), long if \(H<0\))  

- **Hedge costs:**  
  \(\text{HedgeCost} \approx \text{Funding}_{ann} + \text{TradingCost}_{ann}\)  

- **Net Hedged Yield:**  
  \(\text{NetYield}_{hedged} \approx \text{FeeAPR}_{pos} - \text{HedgeCost} - \text{ResidualIL}_{rate}\)

---

## 7. Comparative Signals

- **FVR bands:**  
  - >1.0 = attractive  
  - 0.6–1.0 = fair  
  - <0.6 = overpriced  

- **Richness ratio:**  
  \(\text{Richness} = \tfrac{\text{FeeAPR}_{pos}}{\text{Breakeven FeeAPR}}\)  
  (>1 good, ≈1 fair, <1 poor)

---

## 8. Worked Numeric Example (ETH/USDC, 30-day window)

**Assumptions**
- Pair: ETH/USDC, fee tier \(=0.3\%\) (\(\text{feeTier}=0.003\))  
- Range: \(P_a=3{,}200\), \(P_b=4{,}000\) (USDC per ETH)  
- Current price: \(P=3{,}500\); initial \(P_0=3{,}500\)  
- Pool 7-day volume: \(\$1.2\text{B}\) ; 7-day avg TVL: \(\$1.0\text{B}\)  
- Volatility: daily stdev of log returns over 30d \(\approx 2.2\%\) ⇒ \(\sigma_{ann} \approx 0.022\sqrt{365}\approx 0.42\) (42%)  
- Time-in-Range over 30d: \( \text{TiR}=0.95\) (price mostly stayed between 3,200–4,000)  
- In-range liquidity share for screening: assume \(=1\) (position-agnostic screening)  

**Fee APR (pool-level, annualized)**  
- 7d fees \(=\) \(1.2\text{B} \times 0.003 = \$3.6\text{M}\)  
- \(\text{FeeAPR}_{pool} = \frac{3.6\text{M}}{1.0\text{B}} \times \frac{365}{7} \approx 0.0036 \times 52.142 \approx 0.188 \) ⇒ **18.8%**

**Position Fee APR (screening approximation)**  
- \(\text{FeeAPR}_{pos} \approx 0.188 \times \text{TiR} \times 1 = 0.188 \times 0.95 \approx \mathbf{17.9\%}\)

**Fee-to-Vol Ratio (FVR)**  
- \( \text{FVR} = \frac{0.179}{0.42} \approx \mathbf{0.43} \)  → **borderline/fair** (needs hedge or wider range)

**Expected IL rate (illustrative)**  
- Full-range CPMM IL at \(r=P/P_0=1.00\): \(\approx 0\%\) (trendless end-point)  
- For a **concentrated** range with 42% vol, variance-driven concavity implies an annualized **ExpectedIL\(_{rate}\)** on the order of **~10–15%** (path-based backtest or MC needed; take **12%** here as a realistic mid-case).  

**Breakeven Fee APR**  
- \(\text{BreakevenAPR} \approx \text{ExpectedIL}_{rate} \approx \mathbf{12\%}\)

**Excess Yield (vs 50/50)**  
- \(\Delta Y = 17.9\% - 12\% \approx \mathbf{5.9\%}\)

**Net “Sharpe-like” (optional)**  
- \(\text{FVR}_{net} = \frac{0.179 - 0.12}{0.42} \approx \mathbf{0.14}\)

**Concrete position snapshot (range mechanics)**  
- Suppose you deposited **10 ETH** and **10,000 USDC** at \(P=3{,}500\) in the above range.  
- Resulting liquidity \(L \approx 2{,}278.661\).  
- Current holdings (in-range):  
  - \(\text{amount}_0 \approx 2.4876\ \text{ETH}\)  
  - \(\text{amount}_1 \approx 10{,}000\ \text{USDC}\)  
  - Delta (ETH units): \(\Delta_{LP} = 2.4876\)  
  - Notional delta: \(\approx 2.4876 \times 3{,}500 \approx \$8{,}707\)

**Perp hedge to neutralize delta (example)**  
- Target \(\Delta^\*=0\) ⇒ hedge size \(H=\Delta_{LP}-\Delta^\*=2.4876\) ETH (SHORT 2.4876 ETH).  
- If perp funding \(=5\%\) annual and trading cost \(=0.5\%\) annual (from periodic rebalances), and residual IL after hedging \(=2\%\):  
  - \(\text{NetYield}_{hedged} \approx 17.9\% - 5.0\% - 0.5\% - 2.0\% \approx \mathbf{10.4\%}\)

**Interpretation**  
- Unhedged: fair but not amazing (FVR ~ 0.43; relies on fees staying strong and price staying in-range).  
- Hedged: turns into fee carry; net ~10% depends on funding and rebalance costs.  
- If \(\text{TiR}\) drops or \(\sigma\) rises without a fee pickup, attractiveness deteriorates quickly (breakeven creeps up).

*Note:* Replace illustrative IL (12%) with your **path-based** estimate: replay the actual 30d prices through the piecewise \(V(P)\) to compute realized IL vs 50/50, then annualize.
```
