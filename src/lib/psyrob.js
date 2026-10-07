import { AbiCoder, BrowserProvider, Contract, Interface, getAddress, isAddress } from 'ethers'

export const CHAIN = {
  id: 87870,
  hex: '0x1573e',
  name: 'PSYROB Testnet',
  rpc: 'https://rpc.psyrob.com',
  explorer: 'https://explorer.psyrob.com',
  gasPrice: 47619047619n,
  gasPriceHex: '0xb165100c3',
  maxGas: 15000000n,
}

export const POOL_ADDRESS = '0x8202C6768562BEBe8A138E4A6e67363BeE552f98'

export const COLOR_POOL_ABI = [
  'function decimals() view returns (uint8)',
  'function COLOR_COUNT() view returns (uint8)',
  'function owner() view returns (address)',
  'function poolBalance() view returns (uint256)',
  'function paidOut() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function preview(address) view returns (bool open, uint8 color, uint64 commitBlock, bool ready, bool expired, uint8 rolled, bytes32 entropy)',
  'function guesses(address) view returns (uint8 color, uint64 commitBlock, bool open)',
  'function lock(uint8 color)',
  'function settle()',
  'function abandon()',
  'function fill(uint256 amount)',
  'error ColorOutOfRange()',
  'error GuessPending()',
  'error NoGuess()',
  'error TooSoon()',
  'error HashExpired()',
  'error NotOwner()',
  'error BadAmount()',
  'event GuessLocked(address indexed player, uint8 color, uint64 commitBlock)',
  'event RoundSettled(address indexed player, uint8 guess, uint8 rolled, bool matched, bool paid, bytes32 entropy)',
  'event PoolFilled(address indexed from, uint256 amount)',
  'event Transfer(address indexed from, address indexed to, uint256 amount)',
]

const iface = new Interface(COLOR_POOL_ABI)

const REVERT_TEXT = {
  ColorOutOfRange: 'Pick a pigment from 0 to 7.',
  GuessPending: 'You already have a guess open. Settle it, or abandon it if the hash expired.',
  NoGuess: 'There is no open guess on this address.',
  TooSoon: 'The lock is still in the latest block. Wait until the next block, then settle.',
  HashExpired: 'The block hash expired (more than 256 blocks old). Abandon the guess and lock again.',
  NotOwner: 'Only the address that deployed the pool can fill it.',
  BadAmount: 'That amount is not allowed. The pool accepts 1 to 1,000,000 tokens per fill.',
}

export function shortenAddress(address) {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ''
}

export function explorerTx(hash) { return `${CHAIN.explorer}/tx/${hash}` }
export function explorerAddress(address) { return `${CHAIN.explorer}/address/${address}` }

function ethereum() {
  if (typeof window === 'undefined') return null
  const eth = window.ethereum
  return eth && typeof eth.request === 'function' ? eth : null
}

export function hasWallet() {
  return Boolean(ethereum())
}

async function walletOnPsyrob() {
  const eth = ethereum()
  if (!eth) return false
  try {
    const id = await eth.request({ method: 'eth_chainId' })
    return BigInt(id) === BigInt(CHAIN.id)
  } catch {
    return false
  }
}

async function rpc(method, params) {
  if (await walletOnPsyrob()) {
    return ethereum().request({ method, params })
  }
  let response
  try {
    response = await fetch(CHAIN.rpc, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })
  } catch {
    const err = new Error('This browser cannot read rpc.psyrob.com directly (the RPC sends no CORS header). Connect MetaMask on PSYROB, chain 87870.')
    err.code = 'RPC_BLOCKED'
    throw err
  }
  const body = await response.json()
  if (body.error) {
    const err = new Error(body.error.message || 'RPC error')
    err.code = body.error.code
    throw err
  }
  return body.result
}

function decodeRevertData(data) {
  if (typeof data !== 'string' || !data.startsWith('0x') || data === '0x') return ''
  try {
    const parsed = iface.parseError(data)
    if (parsed?.name && REVERT_TEXT[parsed.name]) return REVERT_TEXT[parsed.name]
    if (parsed?.name) return parsed.name
  } catch { /* not a known custom error */ }
  return ''
}

export function explainError(err) {
  if (!err) return 'Something failed.'
  if (err.code === 'RPC_BLOCKED') return err.message
  const named = err?.revert?.name || err?.errorName
  if (named && REVERT_TEXT[named]) return REVERT_TEXT[named]
  const fromData = decodeRevertData(err?.data) || decodeRevertData(err?.error?.data) || decodeRevertData(err?.info?.error?.data)
  if (fromData) return fromData
  const msg = err.shortMessage || err.reason || err.message || 'Something failed.'
  if (/failed to fetch|failed to detect network|missing response|CORS/i.test(msg)) {
    return 'This browser cannot read rpc.psyrob.com directly. Connect MetaMask and switch to PSYROB (chain 87870).'
  }
  if (/user rejected|user denied|ACTION_REJECTED/i.test(msg)) return 'The wallet request was rejected.'
  return msg.replace(/^execution reverted:?\s*/i, 'The contract rejected the call. ')
}

export async function ensureChain() {
  const eth = ethereum()
  if (!eth) throw new Error('MetaMask was not found. Install MetaMask, then play.')
  const current = await eth.request({ method: 'eth_chainId' })
  if (BigInt(current) === BigInt(CHAIN.id)) return
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN.hex }] })
  } catch (err) {
    if (err?.code !== 4902 && err?.code !== -32603) throw err
    await eth.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: CHAIN.hex,
        chainName: CHAIN.name,
        nativeCurrency: { name: 'PSY', symbol: 'PSY', decimals: 18 },
        rpcUrls: [CHAIN.rpc],
        blockExplorerUrls: [CHAIN.explorer],
      }],
    })
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN.hex }] })
  }
}

export async function connectWallet() {
  const eth = ethereum()
  if (!eth) throw new Error('MetaMask was not found. Install MetaMask, then play.')
  const accounts = await eth.request({ method: 'eth_requestAccounts' })
  await ensureChain()
  const provider = new BrowserProvider(eth)
  const signer = await provider.getSigner()
  const address = getAddress(accounts?.[0] || await signer.getAddress())
  const network = await provider.getNetwork()
  if (Number(network.chainId) !== CHAIN.id) {
    throw new Error('MetaMask is not on PSYROB (chain 87870). Switch networks and connect again.')
  }
  return { provider, signer, address }
}

export async function readState(player) {
  const poolAddr = getAddress(POOL_ADDRESS)
  const calls = [
    ['poolBalance', []],
    ['paidOut', []],
    ['totalSupply', []],
    ['owner', []],
  ]
  if (player && isAddress(player)) calls.push(['balanceOf', [player]], ['preview', [player]])

  const [blockHex, ...results] = await Promise.all([
    rpc('eth_blockNumber', []),
    ...calls.map(([fn, args]) => rpc('eth_call', [{ to: poolAddr, data: iface.encodeFunctionData(fn, args) }, 'latest'])),
  ])

  const decoded = results.map((raw, i) => iface.decodeFunctionResult(calls[i][0], raw))
  const state = {
    block: Number(BigInt(blockHex)),
    pool: decoded[0][0],
    paidOut: decoded[1][0],
    totalSupply: decoded[2][0],
    owner: getAddress(decoded[3][0]),
    balance: 0n,
    preview: null,
  }
  if (player && isAddress(player)) {
    state.balance = decoded[4][0]
    const p = decoded[5]
    state.preview = {
      open: Boolean(p.open),
      color: Number(p.color),
      commitBlock: Number(p.commitBlock),
      ready: Boolean(p.ready),
      expired: Boolean(p.expired),
      rolled: Number(p.rolled),
      entropy: p.entropy,
    }
  }
  return state
}

export async function sendContract(signer, method, args = []) {
  const contract = new Contract(POOL_ADDRESS, COLOR_POOL_ABI, signer)
  const populated = await contract[method].populateTransaction(...args)
  return signer.sendTransaction({
    to: populated.to,
    data: populated.data,
    type: 0,
    gasPrice: CHAIN.gasPrice,
    gasLimit: populated.gasLimit,
    value: 0n,
  })
}

export function parseRound(receipt) {
  for (const log of receipt?.logs || []) {
    try {
      const parsed = iface.parseLog(log)
      if (parsed?.name !== 'RoundSettled') continue
      return {
        guess: Number(parsed.args.guess),
        rolled: Number(parsed.args.rolled),
        matched: Boolean(parsed.args.matched),
        paid: Boolean(parsed.args.paid),
        entropy: parsed.args.entropy,
      }
    } catch { /* other log */ }
  }
  return null
}

export function encodeConstructor(poolSize) {
  return AbiCoder.defaultAbiCoder().encode(['uint256'], [poolSize])
}
