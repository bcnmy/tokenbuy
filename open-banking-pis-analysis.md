# Open Banking Payment Initiation (PIS) Aggregator Analysis

**Context:** tokenbuy needs to replace the current "copy IBAN and manually transfer" step with a one-click pay-by-bank flow. When a user completes the swap form, instead of showing them a Monerium IBAN to copy, we initiate a payment directly from their bank account to the Monerium IBAN with the exact amount prefilled. The existing `watchForEureDeposit` polling continues to work unchanged — we just need the money to arrive at Monerium's IBAN faster and with less friction.

**Date:** March 2026

---

## Table of Contents

1. [How Open Banking PIS Works](#1-how-open-banking-pis-works)
2. [Architecture Fit for tokenbuy](#2-architecture-fit-for-tokenbuy)
3. [Provider Deep Dives](#3-provider-deep-dives)
   - [TrueLayer](#31-truelayer)
   - [Yapily](#32-yapily)
   - [Plaid Payment Initiation](#33-plaid-payment-initiation)
   - [Tink (Visa)](#34-tink-visa)
   - [Token.io](#35-tokenio)
   - [Volt](#36-volt)
   - [Brite Payments](#37-brite-payments)
   - [GoCardless](#38-gocardless)
   - [finAPI / Qwist](#39-finapi--qwist)
4. [Comparison Matrix](#4-comparison-matrix)
5. [Crypto On-Ramp Compatibility](#5-crypto-on-ramp-compatibility)
6. [SEPA Instant Regulation Impact](#6-sepa-instant-regulation-impact)
7. [Integration Architecture for tokenbuy](#7-integration-architecture-for-tokenbuy)
8. [Recommendation](#8-recommendation)

---

## 1. How Open Banking PIS Works

Under PSD2, **Payment Initiation Service Providers (PISPs)** can initiate payments from a user's bank account on behalf of a third party. The flow:

```
User clicks "Pay" → Aggregator creates payment consent
→ User redirected to their bank → User authorizes via biometrics/PIN
→ Bank executes SEPA transfer to the specified beneficiary IBAN
→ Aggregator notifies you via webhook
```

You do NOT need to be a regulated PISP yourself. The aggregator holds the license (FCA in UK, Bank of Lithuania / other EU NCAs for EEA) and acts as the regulated TPP on your behalf. You integrate their API.

### Key Concepts

| Term | Meaning |
|------|---------|
| **PISP** | Payment Initiation Service Provider — the regulated entity initiating payments |
| **AISP** | Account Information Service Provider — reads account data (not needed here) |
| **TPP** | Third Party Provider — umbrella term for PISPs and AISPs |
| **Open-loop payment** | Payment goes to any external IBAN you specify (what we need) |
| **Closed-loop payment** | Payment goes to the aggregator's merchant account (not ideal for us) |
| **SCA** | Strong Customer Authentication — the bank-side authorization step |
| **SEPA Credit Transfer** | Standard EUR transfer, settles in 1 business day |
| **SEPA Instant** | EUR transfer settling in <10 seconds, 24/7/365 |
| **VRP** | Variable Recurring Payments — for subscriptions (not needed here) |

---

## 2. Architecture Fit for tokenbuy

### Current Flow
```
1. User enters amount + token + wallet address
2. User goes through Monerium KYC/auth (if needed)
3. User sees IBAN + amount + reference → copies to their bank app
4. User manually initiates SEPA transfer from their bank
5. watchForEureDeposit() polls for EURe balance change on Gnosis
6. Swap EURe → target token (future step)
```

### Proposed Flow with Open Banking PIS
```
1. User enters amount + token + wallet address
2. User goes through Monerium KYC/auth (if needed)
3. User clicks "Pay with Bank" button
4. Aggregator widget opens → user selects their bank
5. User redirected to bank → authorizes payment with biometrics
6. SEPA transfer sent to Monerium IBAN with correct amount + reference
7. User redirected back → watchForEureDeposit() polls as before
8. Swap EURe → target token (future step)
```

### Critical Requirement: Open-Loop to External IBAN

The payment must go **directly to the Monerium IBAN** — not to an intermediary merchant account that we'd then need to forward from. This means we need an aggregator that supports **open-loop payment initiation** where we specify the beneficiary IBAN in the API call.

Most aggregators support this because that's literally what PSD2 payment initiation is — you tell the user's bank to send money to a specified account. Some providers (notably TrueLayer V3) have shifted toward a **closed-loop model** where payments go to a merchant account first, which would add an unwanted intermediary step.

---

## 3. Provider Deep Dives

### 3.1 TrueLayer

**Website:** https://truelayer.com  
**Docs:** https://docs.truelayer.com  
**Regulation:** FCA-authorized PISP (UK), passported across EU  

#### Coverage
- **Countries:** 12 EU countries + UK
- **Banks:** 68+ institutions
- **Currencies:** GBP, EUR + local currencies

#### API Architecture

TrueLayer has two API versions with different models:

**Payments V2 (Legacy):** Open-loop model — you specify a beneficiary with IBAN, and the payment goes directly to that account. This is what we'd want.

**Payments V3 (Current):** Closed-loop model — payments go to a **TrueLayer merchant account** first. You then issue payouts from the merchant account. This adds latency and complexity for our use case.

V3 `POST /v3/payments` create payment request:
```json
{
  "amount_in_minor": 5000,
  "currency": "EUR",
  "payment_method": {
    "type": "bank_transfer",
    "beneficiary": {
      "type": "merchant_account",
      "merchant_account_id": "your-merchant-account-id"
    }
  }
}
```

Note: the beneficiary in V3 is `merchant_account`, not an external IBAN. For our use case, we'd need to:
1. Receive funds into a TrueLayer merchant account
2. Trigger a payout to the Monerium IBAN
3. Wait for that payout to settle

This two-hop model adds 1+ business day of latency (unless using SEPA Instant for the payout leg too) and operational complexity.

#### Frontend Integration

- **Web SDK:** Modal overlay with bank selection, authorization redirect, return handling
- **Embedded Payment Page (EPP):** Inline component, includes localization and QR auth for desktop
- **React Native SDK:** Native screens for mobile apps
- No official Next.js-specific SDK, but the Web SDK works in any web framework

#### Webhook Statuses

| Status | Terminal? | Meaning |
|--------|-----------|---------|
| `authorization_required` | No | Payment created, user hasn't acted |
| `authorizing` | No | User started bank authorization |
| `authorized` | No | User completed auth, payment submitted |
| `executed` | Yes (open-loop) | Payment accepted by bank |
| `settled` | Yes (closed-loop) | Funds landed in merchant account |
| `failed` | Yes | Payment failed |

#### Pricing
- Custom pricing, not publicly listed
- Startup and Scale tiers available
- Contact sales for quotes
- Positioned as significantly cheaper than card payments

#### Crypto Use Case
TrueLayer **explicitly supports crypto on-ramps**. They have a dedicated "Pay by Bank for Crypto" product and a live partnership with Bybit. Pre-populated payee details, biometric auth, real-time confirmation, and automated reconciliation are all available. This is a first-class use case for them.

#### Verdict for tokenbuy
The V3 closed-loop model is architecturally suboptimal — it introduces a merchant account intermediary between the user and Monerium. If TrueLayer V2 (open-loop) is still available and supported, it would be a strong fit. The crypto-friendly positioning and Bybit case study are major positives. However, the move to closed-loop in V3 suggests the open-loop path may be deprecated or less supported going forward.

**If the goal is to route payments through a merchant account** (i.e., you receive funds, then forward to Monerium), TrueLayer V3 is excellent. If the goal is direct-to-Monerium, clarify with TrueLayer whether V2 open-loop or V3 with external beneficiary is still supported.

---

### 3.2 Yapily

**Website:** https://yapily.com  
**Docs:** https://docs.yapily.com  
**Regulation:** FCA-authorized (UK), Bank of Lithuania (EEA)  

#### Coverage
- **Countries:** 19 (Belgium, Denmark, Estonia, Finland, France, Germany, Iceland, Ireland, Italy, Latvia, Lithuania, Netherlands, Norway, Portugal, Spain, Sweden, UK, Austria + more)
- **Banks:** 2,000+ institutions
- **Currencies:** EUR, GBP, DKK, SEK, NOK, PLN, ISK

#### API Architecture

Yapily uses a **direct open-loop model** — you specify the payee IBAN and the payment goes directly there. No intermediary merchant account.

`POST /payments` request body:
```json
{
  "type": "DOMESTIC_PAYMENT",
  "paymentIdempotencyId": "unique-id-here",
  "amount": {
    "amount": 50.00,
    "currency": "EUR"
  },
  "payee": {
    "name": "Monerium ehf.",
    "accountIdentifications": [
      {
        "type": "IBAN",
        "identification": "IS12345678901234567890"
      }
    ]
  },
  "reference": "TB-A1B2C3D4"
}
```

This is exactly what we need — the payment goes from the user's bank account directly to the Monerium IBAN with the correct amount and reference.

Payment types available:
- `DOMESTIC_PAYMENT` — standard SEPA credit transfer (1 business day)
- `DOMESTIC_INSTANT_PAYMENT` — SEPA Instant (<10 seconds)
- `INTERNATIONAL_PAYMENT` — cross-border (requires IBAN + BIC)

#### Frontend Integration

Two options:
- **Yapily Connect (Hosted Pages):** Pre-built web flow handling bank selection, consent, and authorization. Fastest to integrate.
- **Direct API:** Full control over the UI. You build the bank selection and redirect handling yourself.

#### Webhook Statuses

| Event | Meaning |
|-------|---------|
| `single_payment.status.completed` | Payment reached COMPLETED status |
| `single_payment.status.updated` | Payment status changed (COMPLETED or FAILED) |
| `single_payment.iso_status.updated` | ISO status detail changed |

Note: webhook support is currently in **Private Beta**. Some institutions don't provide payment status updates. Polling the payment status endpoint is the fallback.

#### Licensing Model

Two paths:
- **Yapily Connect:** Yapily holds the TPP license. You go live in **days**, not months. Yapily handles bank registrations across 2,000+ institutions. This is the recommended path for startups.
- **Own TPP License:** You register as a TPP yourself and use Yapily as infrastructure. Much longer timeline.

#### Pricing
- **Sandbox:** Free "Try Before You Buy" tier
- **Production:** Base cost + usage-based fees (not publicly listed)
- **Enterprise:** Custom pricing
- Contact sales for specific rates

#### Crypto Use Case
Yapily **explicitly markets a "Crypto made simple" solution** on their website. They enable instant wallet top-ups from bank accounts for crypto purchases. This is a supported, first-class use case. Their end-user terms and business terms don't prohibit crypto-related payment initiation.

#### Verdict for tokenbuy
**Strongest architectural fit.** The open-loop model sends money directly to the Monerium IBAN with no intermediary. The API is clean and simple — one POST with the payee IBAN, amount, and reference. Yapily Connect handles the regulatory complexity and gets you live in days. Crypto is explicitly supported. 19-country coverage is broader than TrueLayer. The main downside is webhooks being in beta — but our existing polling-based `watchForEureDeposit` makes this a non-issue since we don't rely on the aggregator's webhook to know when funds arrived.

---

### 3.3 Plaid Payment Initiation

**Website:** https://plaid.com  
**Docs:** https://plaid.com/docs/payment-initiation  
**Regulation:** FCA-authorized, EU-regulated  

#### Coverage
- **Countries:** 20 EU markets + UK
- **Payment rails:** SEPA Credit Transfer, SEPA Instant, Faster Payments (UK), local rails (PLN, DKK, SEK, NOK)
- **Banks:** Not publicly listed, but Plaid connects to 9,600+ institutions globally

#### API Architecture

Plaid uses a recipient + payment model:

1. Create a recipient with IBAN:
```json
POST /payment-initiation/recipient/create
{
  "name": "Monerium ehf.",
  "iban": "IS12345678901234567890",
  "bacs": null
}
```

2. Create a payment:
```json
POST /payment-initiation/payment/create
{
  "recipient_id": "recipient-id-from-step-1",
  "amount": {
    "currency": "EUR",
    "value": 50.00
  },
  "reference": "TB-A1B2C3D4"
}
```

3. Create a Link token and open Plaid Link for user authorization

This is open-loop — payments go directly to the specified IBAN recipient.

#### Frontend Integration

- **Plaid Link:** Drop-in module for bank selection and payment authorization
- Available for web, iOS, Android, React Native
- Well-documented, battle-tested UX (Plaid Link is used by thousands of fintech apps)

#### Pricing
- Payment Initiation is **only available on Custom (Scale) plans** — not Pay-as-you-go or Growth
- Must contact sales for pricing
- SEPA Instant rails offered at **no additional cost** (as of late 2025, per the EU Instant Payments Regulation)

#### Key Feature: Verification of Payee (VoP)
Plaid has launched **Verification of Payee** to validate recipient information before payment initiation. This is now mandated by the EU Instant Payments Regulation and helps prevent fraud and misdirected payments.

#### Crypto Use Case
Not explicitly marketed for crypto. Plaid's primary use cases are lending, account funding, and e-commerce. Would need to confirm with sales whether crypto on-ramp is an approved use case under their terms.

#### Verdict for tokenbuy
Strong technical fit — open-loop to any IBAN, clean API, excellent Plaid Link UX. The downside is that Payment Initiation requires a Custom plan, meaning higher commitment and sales-gated access. Plaid's focus is more US-centric; EU payment initiation is a secondary product. Crypto use case support is unclear. Best suited if you're already a Plaid customer or plan to use other Plaid products.

---

### 3.4 Tink (Visa)

**Website:** https://tink.com  
**Docs:** https://docs.tink.com  
**Regulation:** Licensed by Swedish FSA, passported across EU  
**Ownership:** Acquired by Visa in 2022  

#### Coverage
- **Countries:** 18 EU countries + UK (46 countries total for data, fewer for PIS)
- **Banks:** 509+ institutions tracked
- **SEPA Instant coverage:** ~80% of all EU providers
- **SEPA Credit coverage:** All European providers

#### Payment Schemes

| Scheme | Speed | Coverage | Max Amount | Fees | Availability |
|--------|-------|----------|-----------|------|-------------|
| SEPA Instant | <10 seconds | ~80% EU providers | €100,000 | €0–€1.50 | 24/7/365 |
| SEPA Credit | 1 business day | All EU providers | €999,999,999 | None | Mon–Fri |

#### API Architecture
Tink supports payment initiation to external IBANs. The API follows a consent → authorization → payment execution pattern similar to other providers.

#### Frontend Integration
- Tink Link: Pre-built UI for bank selection and payment authorization
- Customizable styling
- Web and mobile SDKs

#### 2025 Updates
- **Smart Routing:** Automatically routes payments through the most reliable payment rail
- **Risk Signals:** Real-time fraud detection for payment initiation
- Preparing for full SEPA Instant mandate (October 2025)

#### Pricing
- **Enterprise-only** — no public pricing
- Must contact sales for custom quotes
- Not available for self-serve or startup tiers

#### Crypto Use Case
Not explicitly marketed for crypto. Tink focuses on financial services, e-commerce, and traditional banking use cases. Would need to verify.

#### Verdict for tokenbuy
Tink is technically capable but targets large enterprises. The Visa backing provides stability and broad bank coverage. However, enterprise-only pricing and the lack of a startup-friendly onboarding path make it less accessible. The Smart Routing feature is interesting — it could automatically choose SEPA Instant where available and fall back to SEPA Credit otherwise. Worth considering if the product scales to enterprise volume.

---

### 3.5 Token.io

**Website:** https://token.io  
**Docs:** https://developer.token.io  
**Regulation:** Licensed PISP across multiple EU jurisdictions  

#### Coverage
- **Markets:** 20 countries (AT, BE, DE, DK, EE, ES, FI, FR, HU, IE, IT, LT, LV, NL, NO, PL, PT, RO, SE, UK)
- **Bank accounts reached:** 567 million+ across Europe
- **Coverage depth:** >80% of bank accounts in each supported country

#### PIS v2 API Status by Country

| Status | Countries |
|--------|-----------|
| **Production-ready** | AT, BE, EE, FI, FR, DE, IE, LV, LT, NL, PT, ES, UK |
| **Beta** | DK, HU, IT, PL |
| **Test only** | LU, NO, RO, SE |

#### API Architecture
Token.io uses a reseller/white-label model. You integrate their API, and they handle the PISP regulation. Payment initiation supports single immediate payments and future-dated payments via the Payments v2 API.

API rate limit: 1,000 requests per minute per TPP member.

#### Pricing
- Not publicly listed
- Contact sales for custom pricing
- Positioned as infrastructure for other payment companies (B2B2C model)

#### Crypto Use Case
Not explicitly marketed. Token.io focuses on B2B payment infrastructure. Less likely to have specific support for crypto on-ramp use cases.

#### Verdict for tokenbuy
Token.io has impressive coverage (567M bank accounts) but is oriented toward B2B infrastructure — it powers other payment companies rather than serving direct merchants. The API maturity varies significantly by country (4 countries still beta, 4 test-only). More suitable as the infrastructure behind another payment product than as a direct integration for a startup.

---

### 3.6 Volt

**Website:** https://volt.io  
**Docs:** https://docs.volt.io  
**Regulation:** Licensed across EU and UK  

#### Coverage
- **Banks:** 1,668+ institutions
- **Territories:** 25+ (EU, UK, Australia, Brazil, US)
- **Coverage is the broadest** of any provider analyzed

#### API Architecture
Volt offers a unified Global API with multiple authorization flows:
- **Redirect:** User redirected to bank for authorization
- **Pre-authorization:** Consent obtained before payment
- **Embedded:** Authorization embedded in your UI
- **Decoupled:** Authorization on a separate device

Integration options:
- Hosted checkout (Volt-managed payment page)
- API-only (build your own UI)
- Mobile SDK
- Embedded checkout

#### Migration Note
Volt is currently migrating from a legacy Payments API to a new **Global Unified Payments API**. The legacy API was deprecated at end of 2025. New integrations should use the Global API.

#### Pricing
- Not publicly listed
- Contact sales for custom pricing

#### Crypto Use Case
Not explicitly marketed for crypto, but the global coverage (including Brazil PIX, US ACH) suggests broad payment use case support.

#### Verdict for tokenbuy
Volt has the broadest bank coverage (1,668+ banks) and the most flexible authorization model (4 different flows). The global coverage is overkill for our EU-only use case but provides room to grow. The API migration adds some risk — documentation and stability may be in flux. A strong contender if bank coverage breadth is the priority.

---

### 3.7 Brite Payments

**Website:** https://britepayments.com  
**Docs:** https://docs.britepayments.com  
**Regulation:** PSD2-authorized  

#### Coverage
- **Banks:** 3,800+ European banks
- **Markets:** EU-focused
- **Proprietary network:** Brite Instant Payments Network (Brite IPN)

#### Architecture
Brite goes beyond standard Open Banking PIS — they operate a proprietary **instant payments network** that wraps Open Banking. This means:
- Payments settle in <60 seconds
- 24/7/365 availability
- Automated reconciliation
- Instant refund capability
- Merchant FX for multi-currency settlement

Integration:
1. Display Brite payment assets on your page
2. Create a payment session via `POST /api/session.create_deposit`
3. Render the Brite Client (JavaScript SDK) on frontend
4. Handle transaction notifications

REST API with OAuth 2.0 authentication.

#### Stats
- 90%+ conversion rate for returning users
- No chargebacks (bank-authorized payments can't be charged back)
- Real-time fund settlement

#### Pricing
- Not publicly listed
- Contact sales for pricing

#### Crypto Use Case
Not explicitly marketed, but the instant settlement and high conversion rates are aligned with crypto on-ramp needs.

#### Verdict for tokenbuy
Brite's proprietary IPN network is interesting — it adds a layer of reliability and speed on top of standard Open Banking. The 3,800+ bank coverage is strong. However, the proprietary network means you're more locked into Brite's ecosystem than with pure Open Banking providers. The instant settlement (<60s) is very attractive for our use case where speed matters (user is waiting for EURe to appear). Worth exploring if the settlement speed advantage justifies the lock-in.

---

### 3.8 GoCardless

**Website:** https://gocardless.com  
**Docs:** https://developer.gocardless.com  
**Regulation:** FCA-authorized  

#### Coverage
- **Banks:** 2,227+ institutions
- **Countries:** 30+ (54 territories for some products)
- **Payment methods:** Instant Bank Pay (Open Banking PIS), SEPA Direct Debit, Faster Payments, ACH

#### Pricing (publicly listed!)

| Plan | Domestic | International | Cap |
|------|----------|---------------|-----|
| **Standard** | 1% + £0.20 | 2% + £0.20 | £4 domestic |
| **Advanced** | 1.25% + £0.20 | 2.25% + £0.20 | £5 domestic |
| **Pro** | 1.4% + £0.20 | 2.4% + £0.20 | £5.60 domestic |
| **Custom** | Volume-based | Volume-based | Custom |

Additional fees:
- Refund fee: £0.50
- Chargeback fee: £5 (if >15/month)
- Custom payment pages: £150/month

No setup fees. No hidden costs. Instant Bank Pay has no high-value transaction surcharge.

#### Product: Instant Bank Pay
GoCardless's Open Banking payment initiation product. Supports one-off and recurring payment collection via open banking. Uses real exchange rates (powered by Wise) for international payments.

#### Crypto Use Case
Not explicitly marketed for crypto. GoCardless focuses on recurring payments, invoicing, and B2B billing. The Instant Bank Pay product is more of an add-on to their Direct Debit core.

#### Verdict for tokenbuy
GoCardless is the only provider with fully transparent public pricing. The 1% + £0.20 standard rate is straightforward. However, 1% per transaction is significant for our use case — on a €500 purchase, that's €5 in PIS fees on top of the ~0.3% swap fee. GoCardless is also primarily a Direct Debit company; Instant Bank Pay is a secondary product. The crypto use case isn't explicitly supported. Better suited for subscription billing than one-off crypto on-ramp payments.

---

### 3.9 finAPI / Qwist

**Website:** https://finapi.io / https://qwist.com  
**Docs:** https://documentation.finapi.io  
**Regulation:** Licensed in Germany, EU-wide  

#### Coverage
- **Banks:** 2,000+ institutions (primarily Germany)
- **Markets:** EU-focused, strongest in DACH region

#### Key Features
- **Web Form Integration:** Pre-built, white-label web form for payment authorization
- **Verification of Payee (VoP):** Validates recipient info before payment
- **SEPA Credit Transfer + SEPA Instant** support
- Pre-populated payment details reduce user errors
- Claims 80% cost reduction vs conventional payment methods

#### Verdict for tokenbuy
Strong in the German/DACH market. The pre-populated web form approach is similar to what we need. However, coverage outside DACH is weaker than the top-tier providers. Better as a supplement for German users than as the sole provider.

---

## 4. Comparison Matrix

| Provider | Countries | Banks | Open-Loop to IBAN | Crypto Supported | SEPA Instant | Pricing Model | Frontend SDK | Startup-Friendly |
|----------|-----------|-------|-------------------|-----------------|--------------|---------------|-------------|-----------------|
| **Yapily** | 19 | 2,000+ | **Yes (native)** | **Yes (explicit)** | Yes | Custom | Hosted Pages + API | **Yes (days to live)** |
| **TrueLayer** | 13 | 68+ | V2 only (V3 is closed-loop) | **Yes (explicit)** | Yes | Custom | Web SDK + EPP | Yes |
| **Plaid** | 21 | 9,600+ (global) | **Yes** | Unclear | Yes (no extra cost) | Custom (Scale plan only) | Plaid Link | No (enterprise gate) |
| **Tink** | 18+ | 509+ | Yes | Unclear | Yes (smart routing) | Enterprise-only | Tink Link | No |
| **Token.io** | 20 | 567M accounts | Yes | Unlikely | Yes | Custom (B2B) | White-label | No (B2B focus) |
| **Volt** | 25+ | 1,668+ | Yes | Unclear | Yes | Custom | Hosted + SDK | Moderate |
| **Brite** | EU | 3,800+ | Yes (via IPN) | Unclear | Yes (<60s own network) | Custom | JS SDK | Moderate |
| **GoCardless** | 30+ | 2,227+ | Yes | Unlikely | Yes | **1% + £0.20 (public)** | Billing flow | No (billing focus) |
| **finAPI** | EU (DACH focus) | 2,000+ | Yes | Unclear | Yes | Custom | Web Form | Moderate |

---

## 5. Crypto On-Ramp Compatibility

This is a critical filter. Some providers explicitly prohibit or don't support crypto-related use cases in their terms of service.

### Explicitly Crypto-Friendly

| Provider | Evidence |
|----------|----------|
| **TrueLayer** | Dedicated "Pay by Bank for Crypto" product page. Live partnership with Bybit exchange. Case studies for crypto deposits. |
| **Yapily** | "Crypto made simple" solution page. Explicitly markets instant wallet top-ups for crypto purchases. |

### Likely Compatible (but verify)

| Provider | Notes |
|----------|-------|
| **Volt** | Global A2A payments focus, broad use case support, no explicit crypto mention |
| **Brite** | Instant payments focus, no explicit restriction, but no crypto marketing |

### Likely Restricted or Unclear

| Provider | Notes |
|----------|-------|
| **Plaid** | Primarily lending/account funding focus. Crypto not explicitly mentioned in EU PIS docs. Verify with sales. |
| **Tink** | Visa-owned, conservative positioning. No crypto marketing. Enterprise approval process likely scrutinizes use cases. |
| **GoCardless** | Billing/invoicing focus. Not positioned for crypto. |
| **Token.io** | B2B infrastructure. Would depend on the end-client's use case approval. |

---

## 6. SEPA Instant Regulation Impact

As of **October 5, 2025**, the EU Instant Payments Regulation (IPR) mandates that **all EU payment service providers** that support standard SEPA Credit Transfers must also support **SEPA Instant Credit Transfers**. This means:

- **All EU banks** must now accept and send SEPA Instant payments
- Settlement in **<10 seconds**, 24/7/365
- The previous €100,000 transaction cap has been removed
- **Verification of Payee (VoP)** is now required for SEPA Instant

### Impact on tokenbuy

This is hugely positive:
1. **Near-instant settlement:** When a user authorizes a payment via Open Banking PIS, and the bank uses SEPA Instant, the funds arrive at Monerium's IBAN within 10 seconds.
2. **Universal coverage:** Previously, SEPA Instant was optional and many banks didn't support it. Now it's mandatory across the EU.
3. **24/7 availability:** No more "payment will arrive next business day" — works weekends and holidays.
4. **Faster end-to-end flow:** User authorizes → 10s SEPA Instant → Monerium mints EURe → swap → token delivered. Total time could be under 2 minutes.

The combination of Open Banking PIS + mandatory SEPA Instant creates the optimal payment rail for crypto on-ramps in the EU.

---

## 7. Integration Architecture for tokenbuy

### Recommended Architecture (with Yapily as example)

#### Server-Side

```
POST /api/pay-by-bank/create
  → Validate amount, reference, user session
  → Call Yapily: POST /payment-authorisations
    {
      type: "DOMESTIC_INSTANT_PAYMENT",    // or DOMESTIC_PAYMENT fallback
      paymentIdempotencyId: unique_id,
      amount: { amount: 50.00, currency: "EUR" },
      payee: {
        name: "Monerium ehf.",
        accountIdentifications: [
          { type: "IBAN", identification: monerium_iban }
        ]
      },
      reference: "TB-A1B2C3D4"
    }
  → Return { authorisationUrl, paymentId } to client

GET /api/pay-by-bank/callback
  → User returns from bank after authorization
  → Verify payment status with Yapily
  → Redirect to processing view
  → watchForEureDeposit() starts polling
```

#### Client-Side

```
SwapCard (existing)
  → User fills in swap details
  → After Monerium auth, instead of showing IBAN copy screen:
  → "Pay with Bank" button
  → Opens Yapily Connect hosted page (or redirect)
  → User selects bank → redirected to bank → authorizes
  → Redirected back to /callback → ProcessingView shown
  → watchForEureDeposit() runs as before
```

#### Key Implementation Notes

1. **Reference matching:** The payment reference (`TB-A1B2C3D4`) must match what Monerium expects for the EURe mint to be associated with the correct wallet. Verify Monerium's reference requirements.

2. **Amount precision:** SEPA payments use 2 decimal places for EUR. Ensure the amount from the swap form is correctly formatted.

3. **Fallback flow:** Always keep the manual IBAN copy flow as a fallback for users whose banks aren't supported or who prefer manual transfer. Not all 100% of banks will work with every aggregator.

4. **Redirect handling:** The user will be redirected away from your site (to their bank) and back. Use the existing `saveFlowStateForRedirect()` / `loadFlowStateAfterRedirect()` pattern to persist swap state across the redirect.

5. **Idempotency:** Always generate a unique `paymentIdempotencyId` per payment attempt. If the user abandons and retries, create a new payment — don't reuse the same ID.

---

## 8. Recommendation

### Primary: Yapily

**Why:**
- **Direct open-loop to IBAN** — payments go straight to Monerium, no intermediary
- **Explicit crypto on-ramp support** — not a gray area, it's a marketed use case
- **19 EU countries, 2,000+ banks** — broadest EU-focused coverage
- **Yapily Connect licensing** — go live in days, not months
- **Clean API** — one POST with IBAN, amount, reference. Simple.
- **SEPA Instant support** — combined with the IPR mandate, near-instant settlement
- **Hosted Pages option** — minimal frontend work to get started

**Risks:**
- Webhooks in Private Beta (mitigated: we use on-chain polling anyway)
- Pricing not public (need to negotiate)

### Runner-Up: TrueLayer

**Why:**
- **Strongest crypto positioning** — Bybit partnership, dedicated crypto product
- **Excellent developer experience** — Web SDK, React Native SDK, comprehensive docs
- **Rich webhook/status system** — if we ever want to show real-time payment status before on-chain confirmation

**Risks:**
- V3 API is closed-loop (merchant account intermediary)
- Need to confirm V2 open-loop is still available and supported
- Fewer EU countries (13 vs Yapily's 19)

### Worth Exploring: Volt

**Why:**
- **1,668+ banks** — second broadest coverage
- **Multiple auth flows** — redirect, embedded, decoupled
- **Global reach** — if tokenbuy expands beyond EU

**Risks:**
- API migration in progress (legacy → Global API)
- Crypto use case not explicitly confirmed
- Less startup-friendly onboarding

### Not Recommended for tokenbuy

| Provider | Reason |
|----------|--------|
| **Plaid** | Enterprise-gated pricing, unclear crypto support, US-centric focus |
| **Tink** | Enterprise-only, no public pricing, Visa ownership may restrict crypto |
| **Token.io** | B2B infrastructure play, not direct merchant integration |
| **GoCardless** | 1% fee too high for on-ramp, billing-focused product |
| **finAPI** | DACH-focused, limited coverage outside Germany |
| **Brite** | Proprietary network lock-in, unclear crypto stance |

---

## Next Steps

1. **Contact Yapily sales** — request sandbox access, confirm crypto on-ramp is approved, get pricing
2. **Contact TrueLayer sales** — ask specifically about V2 open-loop availability and crypto approval
3. **Verify with Monerium** — confirm their IBAN accepts SEPA Instant, and that the payment reference format works for automated EURe minting
4. **Prototype with Yapily sandbox** — build the `POST /payment-authorisations` → redirect → callback flow
5. **Keep manual IBAN fallback** — not all users' banks will be supported; always offer the copy-IBAN path as Plan B
