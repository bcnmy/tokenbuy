import {
  toMultichainNexusAccount,
  createMeeClient,
  getMEEVersion,
  MEEVersion,
  runtimeERC20BalanceOf,
  runtimeNativeBalanceOf,
  greaterThanOrEqualTo,
} from '@biconomy/abstractjs'
import {
  type Account,
  type Address,
  type Chain,
  type Hex,
  type Transport,
  type WalletClient,
  http,
  erc20Abi,
  encodeFunctionData,
  maxUint256,
} from 'viem'
import {
  gnosis,
  mainnet,
  optimism,
  arbitrum,
  base,
  polygon,
  bsc,
  avalanche,
  scroll,
  linea,
} from 'viem/chains'
import { EURE_GNOSIS, type BungeeBuildTxResult } from './bungee'

const EURE_ADDRESS = EURE_GNOSIS.address as Address
const OPENOCEAN_API = 'https://open-api.openocean.finance/v3/100'
const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

const VIEM_CHAINS: Record<number, Chain> = {
  1: mainnet,
  10: optimism,
  56: bsc,
  100: gnosis,
  137: polygon,
  8453: base,
  42161: arbitrum,
  43114: avalanche,
  59144: linea,
  534352: scroll,
}

function getViemChain(chainId: number): Chain {
  const chain = VIEM_CHAINS[chainId]
  if (!chain) throw new Error(`Unsupported destination chain: ${chainId}`)
  return chain
}

/**
 * Amount of EURe (in EUR, human-readable) reserved from the Bungee input
 * to swap for xDAI on Gnosis, covering the bridge's native gas fee.
 * Typical bridge fees are ~0.07 xDAI; 0.20 EURe → ~0.23 xDAI gives 3x margin.
 */
export const BRIDGE_FEE_RESERVE_EUR = 0.20

/**
 * Returns the counterfactual Nexus smart account address on Gnosis
 * for a given signer. This is the address that will actually call
 * contracts on-chain (i.e. be msg.sender).
 */
export async function getNexusAddress(
  walletClient: WalletClient<Transport, Chain | undefined, Account>,
): Promise<Address> {
  const account = await toMultichainNexusAccount({
    signer: walletClient,
    chainConfigurations: [
      {
        chain: gnosis,
        transport: http(),
        version: getMEEVersion(MEEVersion.V2_1_0),
      },
    ],
  })

  return account.addressOn(gnosis.id, true) as Address
}

type XdaiSwapData = {
  to: Address
  data: Hex
  value: bigint
  inAmount: bigint
}

/**
 * Fetches calldata from OpenOcean to swap EURe → native xDAI on Gnosis.
 * Used to acquire the native gas fee required by bridge routes (e.g. Stargate).
 */
async function fetchXdaiSwap(
  eureAmountWei: bigint,
  nexusAddress: Address,
): Promise<XdaiSwapData> {
  const amountHuman = Number(eureAmountWei) / 1e18

  const url = new URL(`${OPENOCEAN_API}/swap_quote`)
  url.searchParams.set('inTokenAddress', EURE_ADDRESS)
  url.searchParams.set('outTokenAddress', NATIVE_TOKEN)
  url.searchParams.set('amount', amountHuman.toFixed(6))
  url.searchParams.set('gasPrice', '1')
  url.searchParams.set('slippage', '5')
  url.searchParams.set('account', nexusAddress)

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`OpenOcean API error: ${res.status}`)

  const json = await res.json()
  if (json.code !== 200 || !json.data) {
    throw new Error('Failed to get xDAI swap quote from OpenOcean')
  }

  return {
    to: json.data.to as Address,
    data: json.data.data as Hex,
    value: BigInt(json.data.value || '0'),
    inAmount: BigInt(json.data.inAmount),
  }
}

export type FusionSwapParams = {
  walletClient: WalletClient<Transport, Chain | undefined, Account>
  eureAmount: bigint
  bungeeTx: BungeeBuildTxResult
  recipientAddress: Address
  onStatusChange?: (status: 'preparing' | 'signing' | 'executing' | 'waiting', hash?: Hex) => void
}

export type FusionSwapResult = {
  hash: Hex
}

// ---------------------------------------------------------------------------
// Pre-signed supertransaction for paste-address mode
// ---------------------------------------------------------------------------

export type PrepareSupertxParams = {
  walletClient: WalletClient<Transport, Chain | undefined, Account>
  eureAmount: bigint
  bungeeTx: BungeeBuildTxResult
  recipientAddress: Address
  destinationToken: { address: string; chainId: number; decimals: number }
  onStatusChange?: (status: 'preparing' | 'signing' | 'submitting') => void
}

export type PrepareSupertxResult = {
  hash: Hex
  meeScanUrl: string
}

const SEVEN_DAYS_S = 7 * 24 * 60 * 60

export async function prepareSupertransaction(
  params: PrepareSupertxParams,
): Promise<PrepareSupertxResult> {
  const {
    walletClient,
    eureAmount,
    bungeeTx,
    recipientAddress,
    destinationToken,
    onStatusChange,
  } = params

  onStatusChange?.('preparing')

  const destChainId = destinationToken.chainId
  const destChain = getViemChain(destChainId)

  const chainConfigs = destChainId === gnosis.id
    ? [{ chain: gnosis, transport: http(), version: getMEEVersion(MEEVersion.V2_1_0) }]
    : [
        { chain: gnosis, transport: http(), version: getMEEVersion(MEEVersion.V2_1_0) },
        { chain: destChain, transport: http(), version: getMEEVersion(MEEVersion.V2_1_0) },
      ]

  const account = await toMultichainNexusAccount({
    signer: walletClient,
    chainConfigurations: chainConfigs,
  })

  const meeClient = await createMeeClient({ account })

  // --- Gnosis calls (same logic as executeFusionSwap) ---
  const gnosisCalls: Array<{ to: Address; data: Hex; value: bigint }> = []
  const bridgeFeeWei = BigInt(bungeeTx.txData.value || '0')

  if (bridgeFeeWei > BigInt(0)) {
    const nexusAddress = account.addressOn(gnosis.id, true) as Address
    const reserveWei = BigInt(Math.round(BRIDGE_FEE_RESERVE_EUR * 1e18))
    const swapInputWei = bridgeFeeWei * BigInt(2) < reserveWei
      ? bridgeFeeWei * BigInt(2)
      : reserveWei

    const swapData = await fetchXdaiSwap(swapInputWei, nexusAddress)

    gnosisCalls.push({
      to: EURE_ADDRESS,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [swapData.to, swapData.inAmount],
      }),
      value: BigInt(0),
    })

    gnosisCalls.push({
      to: swapData.to,
      data: swapData.data,
      value: swapData.value,
    })
  }

  if (bungeeTx.approvalData) {
    gnosisCalls.push({
      to: bungeeTx.approvalData.tokenAddress as Address,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [
          bungeeTx.approvalData.spenderAddress as Address,
          maxUint256,
        ],
      }),
      value: BigInt(0),
    })
  }

  gnosisCalls.push({
    to: bungeeTx.txData.to as Address,
    data: bungeeTx.txData.data as Hex,
    value: bridgeFeeWei,
  })

  // --- Destination chain: transfer output tokens to recipient ---
  const isNativeOutput =
    destinationToken.address.toLowerCase() === NATIVE_TOKEN.toLowerCase()

  const nexusOnDest = account.addressOn(destChainId, true)

  const destTransfer = isNativeOutput
    ? await account.buildComposable({
        type: 'nativeTokenTransfer',
        data: {
          chainId: destChainId,
          to: recipientAddress,
          value: runtimeNativeBalanceOf({
            targetAddress: nexusOnDest,
          }),
        },
      })
    : await account.buildComposable({
        type: 'transfer',
        data: {
          chainId: destChainId,
          tokenAddress: destinationToken.address as Address,
          recipient: recipientAddress,
          amount: runtimeERC20BalanceOf({
            tokenAddress: destinationToken.address as Address,
            targetAddress: nexusOnDest,
            constraints: [greaterThanOrEqualTo(BigInt(1))],
          }),
        },
      })

  // --- Combine: Gnosis batch + dest chain transfer ---
  const instructions: Parameters<typeof meeClient.getFusionQuote>[0]['instructions'] = [
    { calls: gnosisCalls, chainId: gnosis.id } as never,
    destTransfer,
  ]

  onStatusChange?.('signing')

  const upperBound = Math.floor(Date.now() / 1000) + SEVEN_DAYS_S

  const fusionQuote = await meeClient.getFusionQuote({
    trigger: {
      tokenAddress: EURE_ADDRESS,
      chainId: gnosis.id,
      amount: eureAmount,
    },
    instructions,
    feeToken: {
      address: EURE_ADDRESS,
      chainId: gnosis.id,
    },
    upperBoundTimestamp: upperBound,
    cleanUps: [
      {
        tokenAddress: EURE_ADDRESS,
        chainId: gnosis.id,
        recipientAddress,
      },
    ],
  })

  onStatusChange?.('submitting')

  const { hash } = await meeClient.executeFusionQuote({ fusionQuote })

  return {
    hash,
    meeScanUrl: `https://meescan.biconomy.io/details/${hash}`,
  }
}

// ---------------------------------------------------------------------------
// On-demand swap for connect-wallet mode (existing)
// ---------------------------------------------------------------------------

export async function executeFusionSwap(params: FusionSwapParams): Promise<FusionSwapResult> {
  const { walletClient, eureAmount, bungeeTx, recipientAddress, onStatusChange } = params

  onStatusChange?.('preparing')

  const currentChainId = await walletClient.getChainId()
  if (currentChainId !== gnosis.id) {
    await walletClient.switchChain({ id: gnosis.id })
  }

  const account = await toMultichainNexusAccount({
    signer: walletClient,
    chainConfigurations: [
      {
        chain: gnosis,
        transport: http(),
        version: getMEEVersion(MEEVersion.V2_1_0),
      },
    ],
  })

  const meeClient = await createMeeClient({ account })

  const calls: Array<{ to: Address; data: Hex; value: bigint }> = []
  const bridgeFeeWei = BigInt(bungeeTx.txData.value || '0')

  if (bridgeFeeWei > BigInt(0)) {
    const nexusAddress = account.addressOn(gnosis.id, true) as Address
    const reserveWei = BigInt(Math.round(BRIDGE_FEE_RESERVE_EUR * 1e18))
    const swapInputWei = bridgeFeeWei * BigInt(2) < reserveWei
      ? bridgeFeeWei * BigInt(2)
      : reserveWei

    const swapData = await fetchXdaiSwap(swapInputWei, nexusAddress)

    calls.push({
      to: EURE_ADDRESS,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [swapData.to, swapData.inAmount],
      }),
      value: BigInt(0),
    })

    calls.push({
      to: swapData.to,
      data: swapData.data,
      value: swapData.value,
    })
  }

  if (bungeeTx.approvalData) {
    calls.push({
      to: bungeeTx.approvalData.tokenAddress as Address,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [
          bungeeTx.approvalData.spenderAddress as Address,
          maxUint256,
        ],
      }),
      value: BigInt(0),
    })
  }

  calls.push({
    to: bungeeTx.txData.to as Address,
    data: bungeeTx.txData.data as Hex,
    value: bridgeFeeWei,
  })

  const instructions = [{
    calls,
    chainId: bungeeTx.txData.chainId,
  }]

  onStatusChange?.('signing')

  const fusionQuote = await meeClient.getFusionQuote({
    trigger: {
      tokenAddress: EURE_ADDRESS,
      chainId: gnosis.id,
      amount: eureAmount,
    },
    simulation: {
      simulate: true,
    },
    instructions,
    feeToken: {
      address: EURE_ADDRESS,
      chainId: gnosis.id,
    },
    cleanUps: [{
      tokenAddress: EURE_ADDRESS,
      chainId: gnosis.id,
      recipientAddress,
    }],
  })

  onStatusChange?.('executing')

  const { hash } = await meeClient.executeFusionQuote({ fusionQuote })

  onStatusChange?.('waiting', hash)

  await meeClient.waitForSupertransactionReceipt({ hash })

  return { hash }
}
