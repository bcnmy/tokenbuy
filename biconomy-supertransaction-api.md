# Biconomy Supertransaction API

## Overview

The Supertransaction API is a REST API that lets you build and execute complex blockchain operations—swaps, bridges, DeFi deposits—without writing smart contracts. Users sign once, and Biconomy's MEE (Modular Execution Environment) network handles everything across chains.

**Base URL:** `https://api.biconomy.io`

## Core Flow

Every supertransaction follows four steps:

1. **Build your flow** — Define operations (swap, bridge, contract call) using `composeFlows`
2. **Get a quote** — `POST /v1/quote` → receive execution costs, routing info, and a signable payload
3. **Sign the payload** — User signs once (format depends on wallet type)
4. **Execute** — `POST /v1/execute` → Biconomy handles all blockchain complexity

## API Endpoints

| Endpoint                  | Method | Purpose                                  |
| ------------------------- | ------ | ---------------------------------------- |
| `/v1/quote`               | POST   | Get execution quote and signable payload |
| `/v1/execute`             | POST   | Submit signed quote for execution        |
| `/v1/explorer/{hash}`     | GET    | Track execution status                   |

## Instruction Types (composeFlows)

The `composeFlows` array defines what you want to do. It supports four instruction types:

| Type                          | Use Case                          | Example               |
| ----------------------------- | --------------------------------- | --------------------- |
| `/instructions/intent-simple` | Token swaps (same or cross-chain) | Swap USDC → ETH       |
| `/instructions/intent`        | Complex multi-token operations    | Rebalance portfolio   |
| `/instructions/build`         | Custom contract calls             | Deposit into Aave     |
| `/instructions/build-raw`     | Pre-encoded calldata              | Advanced integrations |

### intent-simple

```json
{
  "type": "/instructions/intent-simple",
  "data": {
    "srcChainId": 8453,
    "dstChainId": 10,
    "srcToken": "0x833589...",
    "dstToken": "0x94b008...",
    "amount": "100000000",
    "slippage": 0.01
  }
}
```

### build (custom contract calls)

```json
{
  "type": "/instructions/build",
  "data": {
    "chainId": 8453,
    "to": "0xContractAddress",
    "functionSignature": "function deposit(uint256 amount)",
    "args": ["1000000000"]
  }
}
```

### intent (multi-token operations)

```json
{
  "type": "/instructions/intent",
  "data": {
    "slippage": 0.01,
    "inputPositions": [{ "chainToken": {}, "amount": "..." }],
    "targetPositions": [{ "chainToken": {}, "weight": 1.0 }]
  }
}
```

---

## Account Modes

The API supports three wallet modes, chosen via the `mode` field in the quote request.

### 1. Smart Account (`smart-account`)

For Biconomy Nexus accounts or ERC-4337 smart accounts. Simplest mode.

- No `fundingTokens` needed — smart account already holds tokens
- Always exactly one signature (EIP-712 typed data)
- Native gas abstraction; can pay gas from any chain
- User signs once regardless of operation complexity

```json
{
  "mode": "smart-account",
  "ownerAddress": "0x...",
  "composeFlows": [...]
}
```

### 2. EOA (`eoa`)

For standard wallets (MetaMask, Rabby, Trust Wallet, WalletConnect).

- **Requires `fundingTokens`** — you must specify which tokens the user will spend
- One signature per funding token
- Uses Fusion execution under the hood
- `feeToken` must match one of the `fundingTokens`

```json
{
  "mode": "eoa",
  "ownerAddress": "0x...",
  "fundingTokens": [{
    "tokenAddress": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    "chainId": 8453,
    "amount": "100000000"
  }],
  "feeToken": {
    "address": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    "chainId": 8453
  },
  "composeFlows": [...]
}
```

**Important:** In EOA mode, swapped tokens land in a temporary Nexus account. You must add a withdrawal instruction to send them back to the user's EOA, or the user won't see them in their wallet.

```json
{
  "type": "/instructions/build",
  "data": {
    "chainId": 10,
    "to": "0xTokenContract",
    "functionSignature": "function transfer(address to, uint256 value)",
    "args": [
      "0xUserEOA",
      { "type": "runtimeErc20Balance", "tokenAddress": "0x...", "constraints": { "gte": "1" } }
    ]
  }
}
```

### 3. EIP-7702 (`eoa-7702`)

For embedded wallets (Privy, Dynamic, Turnkey) with EIP-7702 delegation support.

- No `fundingTokens` needed
- Single signature like smart accounts
- Native gas abstraction
- Requires first-time authorization (delegation), after which subsequent quotes work normally

```json
{
  "mode": "eoa-7702",
  "ownerAddress": "0x...",
  "composeFlows": [...]
}
```

**First-time authorization:** If the user hasn't delegated yet, the API returns a **412 error** with authorization data. You sign the authorization and retry the quote with it included.

### Mode Comparison

| Feature          | EOA             | Smart Account       | EIP-7702         |
| ---------------- | --------------- | ------------------- | ---------------- |
| Wallet support   | All wallets     | Smart accounts only | Embedded wallets |
| `fundingTokens`  | Required        | Not needed          | Not needed       |
| Signatures       | 1 per token     | Always 1            | Always 1         |
| Gas payment      | Same-chain only | Any chain           | Any chain        |
| First-time setup | None            | Account deploy      | Authorization    |

---

## Gas Options

- **Sponsored (gasless):** Omit `feeToken` — gas is paid from your Biconomy sponsorship account (requires API key with sponsorship enabled)
- **User pays in token:** Set `feeToken` to deduct gas cost from user's token balance

```json
{
  "feeToken": {
    "address": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    "chainId": 8453
  }
}
```

---

## Quote Response Structure

```json
{
  "ownerAddress": "0x...",
  "fee": {
    "amount": "50000",
    "token": "0x...",
    "chainId": 8453
  },
  "quoteType": "simple",
  "payloadToSign": [{ "signablePayload": { "..." } }],
  "returnedData": [{
    "outputAmount": "99500000",
    "minOutputAmount": "98505000",
    "route": { "summary": "lifi => across" }
  }]
}
```

| Field           | Description                                             |
| --------------- | ------------------------------------------------------- |
| `fee`           | Gas cost in the specified token                         |
| `quoteType`     | Signature method: `simple`, `permit`, or `onchain`      |
| `payloadToSign` | Array of data the user needs to sign                    |
| `returnedData`  | Expected outputs and routing info                       |

---

## Signing the Payload

The signature format depends on the mode and `quoteType`:

| Mode            | quoteType  | Signature Format       | Method                       |
| --------------- | ---------- | ---------------------- | ---------------------------- |
| `smart-account` | `simple`   | EIP-712 Typed Data     | `signTypedData`              |
| `eoa-7702`      | `simple`   | Personal Message       | `signMessage`                |
| `eoa`           | `permit`   | EIP-712 (ERC20 Permit) | `signTypedData`              |
| `eoa`           | `onchain`  | Transaction            | `sendTransaction` (tx hash)  |

### Simple — EIP-712 Typed Data (Smart Account)

```typescript
const signature = await walletClient.signTypedData({
  ...payload.signablePayload,
  account
});
```

### Simple — Personal Message (EIP-7702)

```typescript
const signature = await walletClient.signMessage({
  message: payload.signablePayload.message,
  account
});
```

### Permit — Gasless ERC20 Approval (EOA)

Token supports EIP-2612. User signs typed data off-chain — no gas needed.

```typescript
const signature = await walletClient.signTypedData({
  ...payload.signablePayload,
  account
});
```

### Onchain — Approval Transaction (EOA)

Token doesn't support permit. User must send an on-chain approval transaction.

```typescript
const txHash = await walletClient.sendTransaction({
  to: payload.to,
  data: payload.data,
  value: BigInt(payload.value || '0')
});
await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 5 });
// txHash is used as the "signature"
```

### Detecting the Format

```typescript
function isTypedDataPayload(payload) {
  return 'domain' in payload && 'primaryType' in payload;
}

const signature = isTypedDataPayload(payload.signablePayload)
  ? await walletClient.signTypedData({ ...payload.signablePayload, account })
  : await walletClient.signMessage({ ...payload.signablePayload, account });
```

---

## Execution

Submit the full quote response with signed payloads:

```typescript
const result = await fetch('https://api.biconomy.io/v1/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ...quote,
    payloadToSign: [{ ...payload, signature }]
  })
}).then(r => r.json());
```

### Response

```json
{
  "success": true,
  "supertxHash": "0x9a72f87a...",
  "error": null
}
```

**Note:** `success: true` means the transaction was *accepted* for execution, not that it's complete. Use `supertxHash` to track completion.

### Tracking Status

**MEE Explorer:** `https://meescan.biconomy.io/details/{supertxHash}`

**Polling:**

```typescript
const status = await fetch(
  `https://network.biconomy.io/v1/explorer/${supertxHash}`,
  { headers: { 'Authorization': `Bearer ${apiKey}` } }
).then(r => r.json());
, // status.status is "SUCCESS", "FAILED", or pending
```

Quotes expire after ~30 seconds, so get a fresh one if the user takes too long to sign.

---

## Complete End-to-End Example (Smart Account)

```typescript
const USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const USDT_OP = '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58';

// 1. Get quote
const quote = await fetch('https://api.biconomy.io/v1/quote', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': 'YOUR_API_KEY' },
  body: JSON.stringify({
    mode: 'smart-account',
    ownerAddress: account.address,
    feeToken: { address: USDC_BASE, chainId: 8453 },
    composeFlows: [{
      type: '/instructions/intent-simple',
      data: {
        srcChainId: 8453,
        dstChainId: 10,
        srcToken: USDC_BASE,
        dstToken: USDT_OP,
        amount: '100000000',
        slippage: 0.01
      }
    }]
  })
}).then(r => r.json());

// 2. Sign (always one EIP-712 signature for smart accounts)
const payload = quote.payloadToSign[0];
const signature = await walletClient.signTypedData({
  ...payload.signablePayload,
  account
});

// 3. Execute
const result = await fetch('https://api.biconomy.io/v1/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ...quote,
    payloadToSign: [{ ...payload, signature }]
  })
}).then(r => r.json());

// 4. Track
console.log(`https://meescan.biconomy.io/details/${result.supertxHash}`);
```

---

## Key Takeaways

- **Three endpoints** — quote, execute, and explorer — cover the entire lifecycle
- **Three account modes** — smart-account (simplest), eoa (broadest wallet support), eoa-7702 (embedded wallets)
- **Multi-chain in one signature** — Biconomy handles cross-chain routing, bridging, and gas settlement
- **Gasless option** — omit `feeToken` to sponsor gas for users
- **Composable** — chain multiple instructions (swap → bridge → deposit) in a single `composeFlows` array
- **No smart contracts required** — define operations declaratively via the REST API
