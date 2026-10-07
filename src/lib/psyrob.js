import { BrowserProvider, JsonRpcProvider, Contract, getAddress, isAddress } from 'ethers'

export const CHAIN = {
  id: 87870,
  hex: '0x1573e',
  name: 'PSYROB Testnet',
  rpc: 'https://rpc.psyrob.com',
  explorer: 'https://explorer.psyrob.com',
  gasPrice: 47619047619n,
}

export const COLOR_POOL_ABI = [
  'function lock(uint8 color)',
  'function settle()',
  'function abandon()',
  'function fill(uint256 amount)',
  'function poolBalance() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to,uint256 amount) returns (bool)',
  'function approve(address spender,uint256 amount) returns (bool)',
]

export function shortenAddress(address) {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ''
}

export function explorerTx(hash) { return `${CHAIN.explorer}/tx/${hash}` }
export function explorerAddress(address) { return `${CHAIN.explorer}/address/${address}` }

export function makeReadProvider() { return new JsonRpcProvider(CHAIN.rpc, { chainId: CHAIN.id, name: CHAIN.name }) }

export async function connectWallet() {
  if (!window.ethereum) throw new Error('MetaMask was not found. Install MetaMask to play.')
  const provider = new BrowserProvider(window.ethereum, 'any')
  await provider.send('eth_requestAccounts', [])
  const network = await provider.getNetwork()
  if (Number(network.chainId) !== CHAIN.id) await switchToPSYROB(provider)
  const signer = await provider.getSigner()
  return { provider, signer, address: await signer.getAddress() }
}

export async function switchToPSYROB(provider) {
  try {
    await provider.send('wallet_switchEthereumChain', [{ chainId: CHAIN.hex }])
  } catch (err) {
    if (err?.code !== 4902) throw err
    await provider.send('wallet_addEthereumChain', [{
      chainId: CHAIN.hex,
      chainName: CHAIN.name,
      nativeCurrency: { name: 'PSYROB', symbol: 'PSYROB', decimals: 18 },
      rpcUrls: [CHAIN.rpc],
      blockExplorerUrls: [CHAIN.explorer],
    }])
  }
}

export async function sendLegacy(signer, tx) {
  return signer.sendTransaction({ ...tx, type: 0, gasPrice: CHAIN.gasPrice })
}

export async function sendContract(signer, address, method, args = []) {
  if (!isAddress(address)) throw new Error('Invalid ColorPool address.')
  const contract = new Contract(getAddress(address), COLOR_POOL_ABI, signer)
  const populated = await contract[method].populateTransaction(...args)
  return sendLegacy(signer, populated)
}

export async function waitForNextBlock(provider, lockBlock) {
  let block = await provider.getBlockNumber()
  while (block <= Number(lockBlock)) {
    await new Promise(r => setTimeout(r, 1500))
    block = await provider.getBlockNumber()
  }
  return block
}

export async function readPool(address, player) {
  const provider = makeReadProvider()
  const contract = new Contract(address, COLOR_POOL_ABI, provider)
  const [pool, balance, block] = await Promise.all([
    contract.poolBalance(),
    player ? contract.balanceOf(player) : 0n,
    provider.getBlockNumber(),
  ])
  return { pool, balance, block }
}
