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

// viaWallet is decided once per snapshot by the caller, so one refresh costs one eth_chainId.
async function rpc(method, params, viaWallet) {
  if (viaWallet) {
    return ethereum().request({ method, params })
  }
  let response
  let body
  try {
    response = await fetch(CHAIN.rpc, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })
    body = await response.json()
  } catch {
    // A wallet on another network is the usual cause once MetaMask is installed.
    const err = ethereum()
      ? new Error('MetaMask is on another network. Switch it to PSYROB (chain 87870) to read the pool.')
      : new Error('This browser cannot read rpc.psyrob.com directly (the RPC sends no CORS header). Connect MetaMask on PSYROB, chain 87870.')
    err.code = ethereum() ? 'WRONG_CHAIN' : 'RPC_BLOCKED'
    throw err
  }
  if (!body || typeof body !== 'object') throw new Error(`rpc.psyrob.com answered ${response.status} without a JSON-RPC body.`)
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
  if (err.code === 'RPC_BLOCKED' || err.code === 'WRONG_CHAIN') return err.message
  // ethers wraps wallet errors, so the wallet's own code can sit one or two levels down.
  const codes = [err.code, err?.info?.error?.code, err?.error?.code]
  if (codes.includes(4001) || codes.includes('ACTION_REJECTED')) return 'The wallet request was rejected.'
  if (codes.includes(-32002)) return 'MetaMask already has a request waiting. Open the extension and finish it.'
  if (err.code === 'TIMEOUT') return 'The transaction is still pending. Follow it in the explorer; the page updates once it is mined.'
  const named = err?.revert?.name || err?.errorName
  if (named && REVERT_TEXT[named]) return REVERT_TEXT[named]
  const fromData = decodeRevertData(err?.data) || decodeRevertData(err?.error?.data) || decodeRevertData(err?.info?.error?.data)
  if (fromData) return fromData
  const msg = err.shortMessage || err.reason || err.message || 'Something failed.'
  if (/failed to fetch|failed to detect network|missing response|CORS/i.test(msg)) {
    return 'This browser cannot read rpc.psyrob.com directly. Connect MetaMask and switch to PSYROB (chain 87870).'
  }
  if (/user rejected|user denied|ACTION_REJECTED/i.test(msg)) return 'The wallet request was rejected.'
  if (/insufficient funds/i.test(msg) || err.code === 'INSUFFICIENT_FUNDS') return 'This account does not have enough PSY to pay for gas.'
  if (/network changed|underlying network changed/i.test(msg)) return 'MetaMask changed network during the request. Switch back to PSYROB (chain 87870) and try again.'
  if (/invalid account/i.test(msg)) return 'That account is not connected to this page. Connect it in MetaMask and try again.'
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
    const code = err?.data?.originalError?.code ?? err?.code
    if (code !== 4902 && code !== -32603 && !/unrecognized chain/i.test(err?.message || '')) throw err
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

// The account this site is already allowed to see, without opening a wallet prompt.
export async function connectedAccount() {
  const eth = ethereum()
  if (!eth) return ''
  try {
    const accounts = await eth.request({ method: 'eth_accounts' })
    return accounts?.[0] && isAddress(accounts[0]) ? getAddress(accounts[0]) : ''
  } catch {
    return ''
  }
}

export async function connectWallet() {
  const eth = ethereum()
  if (!eth) throw new Error('MetaMask was not found. Install MetaMask, then play.')
  const accounts = await eth.request({ method: 'eth_requestAccounts' })
  await ensureChain()
  // Built after the switch: an ethers provider created on another chain rejects calls with "network changed".
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

  const viaWallet = await walletOnPsyrob()
  const [blockHex, ...results] = await Promise.all([
    rpc('eth_blockNumber', [], viaWallet),
    ...calls.map(([fn, args]) => rpc('eth_call', [{ to: poolAddr, data: iface.encodeFunctionData(fn, args) }, 'latest'], viaWallet)),
  ])

  if (results.some((raw) => typeof raw !== 'string' || raw === '0x')) {
    throw new Error(`No ColorPool contract answered at ${shortenAddress(poolAddr)} on this network.`)
  }
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

// Sends a pool transaction from `player`. The wallet is moved to PSYROB first, so a wallet that
// wandered to another network can never be asked to sign this call there.
export async function sendContract(player, method, args = []) {
  const eth = ethereum()
  if (!eth) throw new Error('MetaMask was not found. Install MetaMask, then play.')
  await ensureChain()
  const provider = new BrowserProvider(eth)
  const network = await provider.getNetwork()
  if (Number(network.chainId) !== CHAIN.id) {
    throw new Error('MetaMask is not on PSYROB (chain 87870). Switch networks and try again.')
  }
  const signer = await provider.getSigner(player)
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

// Waits for one confirmation. Gives up after `timeoutMs` so a stuck transaction cannot freeze the page,
// and follows the replacement when the player speeds the transaction up in MetaMask.
export async function waitMined(response, timeoutMs = 180000) {
  try {
    return await response.wait(1, timeoutMs)
  } catch (err) {
    if (err?.code === 'TRANSACTION_REPLACED' && err.reason === 'repriced' && err.receipt) return err.receipt
    throw err
  }
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
