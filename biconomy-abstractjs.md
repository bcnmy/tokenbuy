# Biconomy AbstractJS SDK

## Overview

AbstractJS is Biconomy's TypeScript SDK for building gas-abstracted, cross-chain applications. It provides a viem-inspired API for managing smart accounts and orchestrating transactions across multiple chains. Users sign once, and the MEE (Modular Execution Environment) network handles execution, gas, bridging, and sequencing.

```bash
npm install @biconomy/abstractjs viem
```

## Core Concepts

### Multichain Nexus Account

A smart account that exists across multiple chains with the same address. Supports gas abstraction, batching, and cross-chain orchestration. Accounts are lazily deployed — only addresses are calculated upfront, and the actual account is deployed on first transaction per chain.

```typescript
import {
  toMultichainNexusAccount,
  getMEEVersion,
  MEEVersion
} from "@biconomy/abstractjs";
import { http } from "viem";
import { base, optimism, arbitrum } from "viem/chains";

const account = await toMultichainNexusAccount({
  signer: wallet,
  chainConfigurations: [
    { chain: optimism, transport: http(), version: getMEEVersion(MEEVersion.V2_1_0) },
    { chain: base, transport: http(), version: getMEEVersion(MEEVersion.V2_1_0) },
    { chain: arbitrum, transport: http(), version: getMEEVersion(MEEVersion.V2_1_0) }
  ]
});

const baseAddress = account.addressOn(base.id);
const strictAddress = account.addressOn(base.id, true); // throws if chain not configured
```

### MEE Client

Connects to the Modular Execution Environment — the network that executes transactions gaslessly across chains.

```typescript
import { createMeeClient } from "@biconomy/abstractjs";

const meeClient = await createMeeClient({ account });
```

| Parameter | Description             | Required |
| --------- | ----------------------- | -------- |
| `account` | The multichain account  | Yes      |
| `apiKey`  | API key for sponsorship | No       |

### Instructions

Building blocks for transactions. Built via `account.buildComposable()` with different types:

```typescript
const instruction = await account.buildComposable({
  type: "default",
  data: { chainId, to, abi, functionName, args }
});
```

## EIP-7702 Mode

For embedded wallets (Privy, Dynamic, Turnkey), set `accountAddress` to the EOA to enable smart account features on the EOA itself via delegation:

```typescript
const account = await toMultichainNexusAccount({
  signer,
  chainConfigurations: [
    {
      chain: base,
      transport: http(),
      version: getMEEVersion(MEEVersion.V2_1_0),
      accountAddress: signer.address
    }
  ]
});
```

---

## Gas Payment

### Pay Gas in ERC-20 Tokens

Users can pay gas in USDC, USDT, or any ERC-20 with liquidity — no native tokens needed. Pass `feeToken` when getting a quote:

```typescript
const quote = await meeClient.getQuote({
  instructions: [/* your calls */],
  feeToken: {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
    chainId: 8453
  }
});

const { hash } = await meeClient.executeQuote({ quote });
```

Cross-chain gas payment is supported — execute on Arbitrum while paying gas from Base USDC:

```typescript
const quote = await meeClient.getQuote({
  instructions: [{ chainId: 42161, calls: [/* Arbitrum calls */] }],
  feeToken: { address: USDC_BASE, chainId: 8453 }
});
```

#### Gas Payment by Wallet Type

| Wallet Type     | Behavior                                     |
| --------------- | -------------------------------------------- |
| Smart Account   | Any token from any chain                     |
| EIP-7702        | Same flexibility, requires `delegate: true`  |
| Fusion (EOA)    | Fee token must match trigger token, same chain only |

### Sponsor Gas (Gasless)

Cover gas costs entirely so users never see or pay fees. Set `sponsorship: true`:

```typescript
const quote = await meeClient.getQuote({
  sponsorship: true,
  instructions: [/* your calls */]
});
```

Requires an API key with sponsorship enabled from [dashboard.biconomy.io](https://dashboard.biconomy.io).

#### Hosting Options

**Biconomy-Hosted** — simplest setup, uses managed gas tanks:

```typescript
const meeClient = await createMeeClient({
  account,
  apiKey: "your_project_api_key"
});

const quote = await meeClient.getQuote({ sponsorship: true, instructions: [...] });
```

**Self-Hosted** — full control with your own backend and gas tank:

```typescript
const quote = await meeClient.getQuote({
  sponsorship: true,
  sponsorshipOptions: {
    url: "https://your-backend.com/sponsor",
    gasTank: {
      address: "0xYourGasTank",
      token: "0xTokenAddress",
      chainId: 84532
    }
  },
  instructions: [...]
});
```

---

## Composable Batch Calls

Batch multiple contract calls into a single atomic transaction. Operations either all succeed or all fail.

```typescript
const approve = await account.buildComposable({
  type: "approve",
  data: { spender: UNISWAP_ROUTER, tokenAddress: USDC, chainId: base.id, amount: parseUnits("100", 6) }
});

const swap = await account.buildComposable({
  type: "default",
  data: {
    chainId: base.id,
    to: UNISWAP_ROUTER,
    abi: UniswapAbi,
    functionName: "exactInputSingle",
    args: [{ tokenIn: USDC, tokenOut: WETH, amountIn: parseUnits("100", 6) }]
  }
});

const quote = await meeClient.getQuote({
  instructions: [approve, swap],
  feeToken: { address: USDC, chainId: base.id }
});

const { hash } = await meeClient.executeQuote({ quote });
```

### Fusion Mode (External Wallets)

For MetaMask/Rabby users, use a `trigger` to fund the operation:

```typescript
const trigger = {
  chainId: base.id,
  tokenAddress: USDC,
  amount: parseUnits("100", 6)
};

const quote = await meeClient.getFusionQuote({
  trigger,
  instructions: [approve, swap, deposit],
  feeToken: { address: USDC, chainId: base.id }
});

const { hash } = await meeClient.executeFusionQuote({ fusionQuote: quote });
```

---

## Runtime Injection (Composable Batching)

Use dynamic values that resolve at execution time — critical when the next step depends on the output of the previous one (e.g., swap output, bridge arrival).

### Available Runtime Functions

| Function                          | Description                        |
| --------------------------------- | ---------------------------------- |
| `runtimeERC20BalanceOf`           | ERC-20 token balance               |
| `runtimeNativeBalanceOf`          | Native token balance (ETH, MATIC)  |
| `runtimeERC20AllowanceOf`         | Token allowance between addresses  |
| `runtimeParamViaCustomStaticCall` | Any contract read (up to 32 bytes) |

### Example: Use Actual Balance After Swap

```typescript
import { runtimeERC20BalanceOf } from "@biconomy/abstractjs";

const deposit = await account.buildComposable({
  type: "default",
  data: {
    chainId: base.id,
    to: MORPHO_POOL,
    abi: MorphoAbi,
    functionName: "deposit",
    args: [
      runtimeERC20BalanceOf({
        tokenAddress: WETH,
        targetAddress: account.addressOn(base.id, true),
        constraints: [balanceNotZeroConstraint]
      }),
      account.addressOn(base.id, true)
    ]
  }
});
```

### Constraints

Constraints control **when** instructions execute. MEE retries until constraints are satisfied.

```typescript
import { greaterThanOrEqualTo } from "@biconomy/abstractjs";

runtimeERC20BalanceOf({
  tokenAddress: USDC,
  targetAddress: orchestrator,
  constraints: [greaterThanOrEqualTo(parseUnits("90", 6))]
})
```

This naturally handles transaction ordering — a post-bridge swap waits until bridge tokens arrive and the balance meets the minimum threshold.

---

## Cross-Chain Orchestration

Execute multi-chain flows with a single signature. User signs once; MEE handles timing, confirmations, and execution across chains.

**Flow:** User signs → MEE executes source chain ops → waits for bridge → executes destination chain ops → user receives tokens.

```typescript
const account = await toMultichainNexusAccount({
  signer,
  chainConfigurations: [
    { chain: arbitrum, transport: http(), version: getMEEVersion(MEEVersion.V2_1_0) },
    { chain: base, transport: http(), version: getMEEVersion(MEEVersion.V2_1_0) }
  ]
});

const quote = await meeClient.getQuote({
  instructions: [approveAcross, bridge, swapOnBase, depositOnBase],
  feeToken: { address: USDC_ARBITRUM, chainId: arbitrum.id }
});

const { hash } = await meeClient.executeQuote({ quote });
```

| Traditional               | With MEE                          |
| ------------------------- | --------------------------------- |
| 4+ signatures             | 1 signature                       |
| Manual bridge waiting     | Automatic                         |
| ETH needed on both chains | Pay in one token                  |
| Risk of stuck states      | Cleanup transactions recover funds |

**Important:** Cross-chain transactions are **not atomic** — only single-chain batches are fully atomic. Use cleanup transactions to handle failures after bridging.

---

## Conditional Execution

Attach runtime conditions so transactions wait until criteria are met — enabling limit orders, price triggers, and safety checks.

```typescript
import { createCondition, ConditionType } from '@biconomy/abstractjs';

const minBalance = createCondition({
  targetContract: USDC,
  functionAbi: erc20Abi,
  functionName: 'balanceOf',
  args: [userAddress],
  value: parseUnits('100', 6),
  type: ConditionType.GTE
});

const instruction = await account.buildComposable({
  type: 'transfer',
  data: {
    tokenAddress: USDC,
    recipient: recipientAddress,
    amount: transferAmount,
    chainId: base.id,
    conditions: [minBalance]
  }
});
```

### Condition Types

| Type  | Meaning | Use Case                         |
| ----- | ------- | -------------------------------- |
| `GTE` | ≥ value | Minimum balance, price floor     |
| `LTE` | ≤ value | Maximum price, cap               |
| `EQ`  | = value | Exact state (e.g., not paused)   |

Multiple conditions act as AND — all must pass. Set `upperBoundTimestamp` to limit how long MEE waits:

```typescript
const quote = await meeClient.getFusionQuote({
  trigger,
  instructions: [instruction],
  feeToken: { chainId: base.id, address: USDC },
  upperBoundTimestamp: Math.floor(Date.now() / 1000) + 300 // 5 min timeout
});
```

---

## Cleanup Transactions

Cleanup transactions return leftover tokens to the user if something fails mid-execution. Essential for cross-chain flows where a bridge may succeed but the destination swap fails.

### Fusion Mode (no `dependsOn` needed)

```typescript
const quote = await meeClient.getFusionQuote({
  trigger,
  instructions: [bridge, swap, deposit],
  cleanUps: [
    { chainId: base.id, tokenAddress: USDC, recipientAddress: userEOA }
  ],
  feeToken: { chainId: base.id, address: USDC }
});
```

### Smart Account / EIP-7702 Mode (use `dependsOn`)

```typescript
const quote = await meeClient.getQuote({
  instructions: [bridge, swap, deposit],
  cleanUps: [
    {
      chainId: base.id,
      tokenAddress: USDC,
      recipientAddress: userEOA,
      dependsOn: [userOp(2)]
    }
  ],
  feeToken: { chainId: base.id, address: USDC }
});
```

Cleanups always run last. If balance is zero, the cleanup harmlessly reverts.

| Scenario                     | Use Cleanup? |
| ---------------------------- | ------------ |
| Cross-chain bridge + swap    | Yes          |
| Multi-step DeFi flow         | Yes          |
| Simple single-chain transfer | No           |
| Atomic single-chain batch    | No           |

---

## Simulation and Gas Estimation

Simulate supertransactions against a forked blockchain before committing on-chain — validates execution, catches failures early, and provides precise gas estimates.

```typescript
const fusionQuote = await meeClient.getFusionQuote({
  trigger: { tokenAddress: USDC, amount: 1n, chainId: base.id },
  simulation: { simulate: true },
  instructions: [...],
  feeToken: { address: USDC, chainId: base.id }
});
```

### Token Overrides (for multi-chain simulation)

Simulate expected balances on destination chains that would arrive after bridging:

```typescript
simulation: {
  simulate: true,
  overrides: {
    tokenOverrides: [{
      tokenAddress: USDC,
      chainId: base.id,
      balance: parseUnits("1000", 6),
      accountAddress: account.addressOn(base.id, true)
    }]
  }
}
```

### Simulation vs Manual Gas Limits

| Priority                  | Approach          | Trade-off                            |
| ------------------------- | ----------------- | ------------------------------------ |
| Cost optimization         | Simulation        | +~250ms latency, tightest gas limits |
| Execution speed           | Manual gas limits | No overhead, requires tuning         |
| Development / testing     | Simulation        | Catches issues early                 |
| Mature production app     | Manual gas limits | Known patterns, prioritize speed     |

Enabling simulation overrides any manually configured gas limits.

### Manual Gas Limits

AbstractJS assigns generous default gas limits for prototyping. In production, set explicit limits to keep quoted prices realistic (unused gas is always refunded on-chain):

```typescript
const instruction = await account.buildComposable({
  type: "default",
  data: {
    abi: erc20Abi,
    to: USDC,
    chainId: optimism.id,
    functionName: "transfer",
    args: [recipient, parseUnits("10", 6)],
    gasLimit: 35_000n
  }
});
```

Recommended workflow: start with generous limits → observe actual gas usage → set limits ~20% above observed.

---

## Working with Testnets

Connect to the staging MEE node for testnet development:

```typescript
import {
  getDefaultMEENetworkUrl,
  getDefaultMEENetworkApiKey
} from "@biconomy/abstractjs";
import { sepolia, baseSepolia } from "viem/chains";

const account = await toMultichainNexusAccount({
  signer,
  chainConfigurations: [
    { chain: sepolia, transport: http(), version: getMEEVersion(MEEVersion.V2_1_0) },
    { chain: baseSepolia, transport: http(), version: getMEEVersion(MEEVersion.V2_1_0) }
  ]
});

const meeClient = await createMeeClient({
  account,
  url: getDefaultMEENetworkUrl(true),
  apiKey: getDefaultMEENetworkApiKey(true)
});
```

### Testnet Limitations

**Works well:** Single-chain transactions, batching, gas estimation, smart account deployment, session key setup.

**May not work:** Cross-chain bridges, multi-chain swap routes, complex DeFi operations requiring solver infrastructure. Most bridge protocols and liquidity solvers don't operate on testnets.

**Recommendation:** Use testnets for single-chain logic, use mainnets with small amounts for cross-chain testing.

---

## Capability Summary

| Feature                   | Description                                                  |
| ------------------------- | ------------------------------------------------------------ |
| Gasless Transactions      | Users pay in any ERC-20 or you sponsor entirely              |
| Batch Operations          | Multiple calls in one atomic transaction                     |
| Cross-Chain Flows         | Bridge + swap + deposit with one signature                   |
| Runtime Injection         | Use actual balances/state at execution time                  |
| Conditional Execution     | Transactions wait for on-chain conditions                    |
| Cleanup Transactions      | Automatic fund recovery on cross-chain failures              |
| Simulation                | Validate and optimize before on-chain submission             |
| Smart Sessions            | Delegate permissions to agents/bots                          |
