import {
  toMultichainNexusAccount,
  createMeeClient,
  getMEEVersion,
  MEEVersion,
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
import { gnosis } from 'viem/chains'
import { EURE_GNOSIS, type BungeeBuildTxResult } from './bungee'

const EURE_ADDRESS = EURE_GNOSIS.address as Address
const OPENOCEAN_API = 'https://open-api.openocean.finance/v3/100'
const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

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

  if (bridgeFeeWei > 0n) {
    const nexusAddress = account.addressOn(gnosis.id, true) as Address
    const reserveWei = BigInt(Math.round(BRIDGE_FEE_RESERVE_EUR * 1e18))
    const swapInputWei = bridgeFeeWei * 2n < reserveWei
      ? bridgeFeeWei * 2n
      : reserveWei

    const swapData = await fetchXdaiSwap(swapInputWei, nexusAddress)

    calls.push({
      to: EURE_ADDRESS,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [swapData.to, swapData.inAmount],
      }),
      value: 0n,
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
      value: 0n,
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
