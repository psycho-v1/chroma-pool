import React, { useState } from 'react'
import { ExternalLink } from 'lucide-react'
// The compiler is fed the .sol file itself, so the page can never deploy a stale copy of it.
import COLOR_POOL_SOURCE from '../contracts/ColorPool.sol?raw'
import { compileColorPool } from '../lib/compile'
import {
  CHAIN,
  POOL_ADDRESS,
  connectWallet,
  encodeConstructor,
  explainError,
  explorerAddress,
  explorerTx,
  shortenAddress,
} from '../lib/psyrob'

export default function Deploy() {
  const [account, setAccount] = useState('')
  const [poolSize, setPoolSize] = useState('1000000')
  const [compiled, setCompiled] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [tx, setTx] = useState('')
  const [deployed, setDeployed] = useState('')

  async function connect() {
    setError('')
    setBusy('connect')
    try { setAccount((await connectWallet()).address) }
    catch (err) { setError(explainError(err)) }
    finally { setBusy('') }
  }

  async function compile() {
    setError('')
    setDeployed('')
    setTx('')
    setCompiled(null)
    setBusy('compile')
    try { setCompiled(await compileColorPool(COLOR_POOL_SOURCE)) }
    catch (err) { setError(explainError(err)); setCompiled(null) }
    finally { setBusy('') }
  }

  async function deploy() {
    setError('')
    setTx('')
    setDeployed('')
    // BigInt() alone would accept '' as 0 and '0x10' as 16.
    const text = poolSize.trim()
    if (!/^\d{1,7}$/.test(text)) { setError('Pool size must be a whole number from 0 to 1,000,000.'); return }
    const size = BigInt(text)
    if (size > 1000000n) { setError('Initial pool must be from 0 to 1,000,000 COLOR.'); return }
    if (!compiled) { setError('Compile the contract first.'); return }
    setBusy('deploy')
    try {
      const wallet = await connectWallet()
      setAccount(wallet.address)
      const data = compiled.bytecode + encodeConstructor(size).slice(2)
      let gas = 2500000n
      try {
        const estimated = await wallet.provider.send('eth_estimateGas', [{
          from: wallet.address,
          data,
          gasPrice: CHAIN.gasPriceHex,
          value: '0x0',
        }])
        gas = (BigInt(estimated) * 12n) / 10n + 50000n
        if (gas > CHAIN.maxGas) gas = CHAIN.maxGas
      } catch { /* keep the manual ceiling */ }
      const hash = await wallet.provider.send('eth_sendTransaction', [{
        from: wallet.address,
        data,
        gas: '0x' + gas.toString(16),
        gasPrice: CHAIN.gasPriceHex,
        value: '0x0',
      }])
      setTx(hash)
      setBusy('mining')
      const receipt = await waitReceipt(wallet.provider, hash)
      if (Number(receipt.status) !== 1 || !receipt.contractAddress) {
        throw new Error('Deployment was mined and failed.')
      }
      setDeployed(receipt.contractAddress)
    } catch (err) {
      setError(explainError(err))
    } finally {
      setBusy('')
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-5 py-12">
      <div className="text-xs uppercase tracking-[.2em] text-cinnabar">Standalone deploy</div>
      <h1 className="font-display text-4xl sm:text-5xl mt-2">Compile ColorPool here.</h1>
      <p className="mt-4 text-paper/65 leading-relaxed">Players do not need this page. The live pool is already at <span className="text-paper">{shortenAddress(POOL_ADDRESS)}</span>. Deploying creates a second pool. Solidity 0.8.28, optimizer 200, evmVersion shanghai. The transaction is legacy type 0 at the fixed gas price.</p>

      <div className="mt-8 grid sm:grid-cols-2 gap-3 text-sm">
        <Fact k="Chain" v={`${CHAIN.id} · ${CHAIN.hex}`} />
        <Fact k="Gas price" v={`${CHAIN.gasPrice.toString()} wei`} />
        <Fact k="Block gas limit" v="15,000,000" />
        <Fact k="EVM" v="Shanghai · no PREVRANDAO" />
      </div>

      <label className="block mt-8 text-xs uppercase tracking-[.16em] text-paper/40">Initial pool size</label>
      <input value={poolSize} onChange={(e) => setPoolSize(e.target.value)} inputMode="numeric" className="mt-2 w-full rounded-2xl bg-clay border border-paper/10 px-4 py-3 text-paper outline-none focus:border-cinnabar" />

      <div className="mt-5 flex flex-wrap gap-3">
        <button onClick={connect} disabled={Boolean(busy)} className="px-5 py-3 rounded-xl border border-paper/15 disabled:opacity-50">{account ? shortenAddress(account) : 'Connect'}</button>
        <button onClick={compile} disabled={Boolean(busy)} className="px-5 py-3 rounded-xl bg-paper text-ink font-bold disabled:opacity-50">{busy === 'compile' ? 'Compiling…' : 'Compile'}</button>
        <button onClick={deploy} disabled={Boolean(busy) || !compiled} className="px-5 py-3 rounded-xl bg-cinnabar text-ink font-bold disabled:opacity-50">{busy === 'deploy' || busy === 'mining' ? 'Deploying…' : 'Deploy new pool'}</button>
      </div>
      {busy && <p className="mt-4 text-sm text-paper/60">{BUSY_TEXT[busy]}</p>}
      {compiled && <p className="mt-4 text-sm text-paper/70">Compiled {compiled.version}. Init code {compiled.initBytes.toLocaleString()} bytes. BLOCKHASH present, PREVRANDAO absent.</p>}
      {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
      {tx && <a className="mt-4 inline-flex items-center gap-1 text-sm text-cinnabar" href={explorerTx(tx)} target="_blank" rel="noreferrer">Deployment transaction <ExternalLink size={14} /></a>}
      {deployed && <a className="mt-3 block text-sm text-green-300 break-all" href={explorerAddress(deployed)} target="_blank" rel="noreferrer">Deployed {deployed}</a>}

      <div className="mt-10 rounded-3xl border border-paper/10 bg-clay p-5">
        <div className="text-xs uppercase tracking-[.16em] text-paper/40">Live game contract</div>
        <a className="mt-2 inline-flex items-center gap-2 text-paper hover:text-cinnabar break-all" href={explorerAddress(POOL_ADDRESS)} target="_blank" rel="noreferrer">{POOL_ADDRESS} <ExternalLink size={14} /></a>
        <p className="mt-3 text-sm text-paper/50">Return to Play to use this pool. A newly deployed address is not swapped in automatically.</p>
      </div>
    </main>
  )
}

const BUSY_TEXT = {
  connect: 'Connecting…',
  compile: 'Loading Solidity 0.8.28…',
  deploy: 'Deploying a legacy transaction…',
  mining: 'Waiting for the contract address…',
}

function Fact({ k, v }) {
  return <div className="rounded-2xl border border-paper/10 bg-clay px-4 py-3"><div className="text-paper/40 text-xs uppercase tracking-[.14em]">{k}</div><div className="mt-1">{v}</div></div>
}

// PSYROB makes a block about every 15 s, so allow a dozen blocks before giving up on the receipt.
async function waitReceipt(provider, hash) {
  for (let i = 0; i < 90; i++) {
    const receipt = await provider.getTransactionReceipt(hash)
    if (receipt) return receipt
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  throw new Error('The deployment is still pending after 3 minutes. Follow the transaction link; its receipt carries the new contract address.')
}
