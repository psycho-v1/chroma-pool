import React, { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, CircleHelp, ExternalLink, Loader2, LockKeyhole, RefreshCw, Wallet, XCircle } from 'lucide-react'
import { DEPLOYED_POOL_ADDRESS } from '../App'
import { CHAIN, connectWallet, explorerTx, readPool, sendContract, shortenAddress, waitForNextBlock } from '../lib/psyrob'
import { PIGMENTS } from '../lib/pigments'

const fmt = (n) => { try { return Number(n).toLocaleString(undefined, { maximumFractionDigits: 4 }) } catch { return '0' } }

export default function Play() {
  const [wallet, setWallet] = useState(null)
  const [selected, setSelected] = useState(null)
  const [phase, setPhase] = useState('idle')
  const [lockBlock, setLockBlock] = useState(null)
  const [tx, setTx] = useState('')
  const [message, setMessage] = useState('Choose a pigment. The chain decides the result.')
  const [error, setError] = useState('')
  const [pool, setPool] = useState(0n)
  const [balance, setBalance] = useState(0n)
  const [block, setBlock] = useState(0)

  const selectedPigment = useMemo(() => PIGMENTS.find(p => p.id === selected), [selected])

  async function refresh() {
    try {
      const r = await readPool(DEPLOYED_POOL_ADDRESS, wallet?.address)
      setPool(r.pool); setBalance(r.balance); setBlock(r.block)
    } catch (e) { setError(e?.shortMessage || e?.message || 'Could not read PSYROB.') }
  }

  useEffect(() => { refresh(); const id = setInterval(refresh, 7000); return () => clearInterval(id) }, [wallet?.address])

  async function connect() {
    setError(''); setMessage('Opening wallet…')
    try { const w = await connectWallet(); setWallet(w); setMessage(`Connected ${shortenAddress(w.address)}.`) }
    catch (e) { setError(e?.shortMessage || e?.message || 'Wallet connection failed.'); setMessage('Wallet not connected.') }
  }

  async function lock() {
    if (!wallet) return connect()
    if (selected === null) return setError('Pick one pigment first.')
    setError(''); setPhase('locking'); setMessage(`Locking ${selectedPigment.name}…`)
    try {
      const response = await sendContract(wallet.signer, DEPLOYED_POOL_ADDRESS, 'lock', [selected])
      setTx(response.hash)
      setMessage('Lock transaction submitted. Waiting for confirmation…')
      const receipt = await response.wait()
      const lb = Number(receipt.blockNumber)
      setLockBlock(lb)
      setPhase('waiting')
      setMessage(`Locked in block ${lb}. Waiting for the next block…`)
      await waitForNextBlock(wallet.provider, lb)
      setPhase('settling')
      setMessage('Next block arrived. Settling your roll…')
      const settleTx = await sendContract(wallet.signer, DEPLOYED_POOL_ADDRESS, 'settle')
      setTx(settleTx.hash)
      await settleTx.wait()
      setPhase('done')
      setMessage('Round settled. Check the result in your wallet/transaction receipt.')
      await refresh()
    } catch (e) {
      setPhase('idle')
      setError(e?.shortMessage || e?.reason || e?.message || 'Transaction failed.')
      setMessage('Round stopped.')
    }
  }

  return <main className="max-w-6xl mx-auto px-5 py-10 sm:py-14">
    <section className="grid lg:grid-cols-[1.2fr_.8fr] gap-8 items-start">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cinnabar/30 bg-cinnabar/10 text-cinnabar text-xs font-semibold uppercase tracking-[.18em]">8 pigments · 1 block · on-chain</div>
        <h1 className="font-display text-5xl sm:text-7xl leading-[.9] mt-5 max-w-3xl">Guess the color.<br/><span className="text-cinnabar">Trust the chain.</span></h1>
        <p className="mt-6 text-paper/65 text-lg max-w-xl leading-relaxed">Pick one of eight pigments. Lock your guess, wait exactly one block, then settle. The deployed ColorPool contract rolls the blockhash modulo eight.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button onClick={connect} className="px-5 py-3 rounded-xl bg-paper text-ink font-bold hover:opacity-90 transition flex items-center gap-2"><Wallet size={18}/>{wallet ? shortenAddress(wallet.address) : 'Connect MetaMask'}</button>
          <a href={`${CHAIN.explorer}/address/${DEPLOYED_POOL_ADDRESS}`} target="_blank" rel="noreferrer" className="px-5 py-3 rounded-xl border border-paper/15 text-paper/75 hover:bg-paper/5 transition flex items-center gap-2">View pool <ExternalLink size={16}/></a>
        </div>
      </div>

      <div className="rounded-3xl border border-paper/10 bg-clay p-5 sm:p-7 shadow-2xl">
        <div className="flex items-center justify-between mb-5"><span className="text-xs uppercase tracking-[.2em] text-paper/45">Pool status</span><button onClick={refresh} className="text-paper/50 hover:text-paper"><RefreshCw size={16}/></button></div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Pool balance" value={`${fmt(pool)} COLOR`} />
          <Stat label="Your COLOR" value={fmt(balance)} />
          <Stat label="Chain block" value={block || '—'} />
          <Stat label="Pool" value={shortenAddress(DEPLOYED_POOL_ADDRESS)} />
        </div>
        <div className="mt-6 p-4 rounded-2xl bg-ink/60 border border-paper/8 text-sm text-paper/60 flex gap-3"><CircleHelp className="shrink-0 mt-0.5" size={17}/><span>Players do not deploy anything. Everyone plays against the same live ColorPool contract.</span></div>
      </div>
    </section>

    <section className="mt-12 rounded-3xl border border-paper/10 bg-clay/70 overflow-hidden">
      <div className="p-5 sm:p-7 border-b border-paper/10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div><div className="text-xs uppercase tracking-[.2em] text-paper/40">Your pigment</div><h2 className="font-display text-3xl mt-1">Choose one</h2></div>
        <div className="text-xs text-paper/45">1 / 8 chance · 1 COLOR on win</div>
      </div>
      <div className="p-5 sm:p-7 grid grid-cols-2 md:grid-cols-4 gap-3">
        {PIGMENTS.map(p => <button key={p.id} disabled={phase === 'locking' || phase === 'waiting' || phase === 'settling'} onClick={() => { setSelected(p.id); setError('') }} className={`group text-left rounded-2xl border p-4 transition ${selected === p.id ? 'border-paper ring-2 ring-cinnabar' : 'border-paper/10 hover:border-paper/30'} disabled:opacity-60`}>
          <div className="h-20 rounded-xl mb-4 shadow-inner" style={{ background: p.hex }} />
          <div className="flex items-center justify-between"><span className="font-semibold">{p.name}</span><span className="text-xs text-paper/35">{p.id}</span></div>
        </button>)}
      </div>
      <div className="p-5 sm:p-7 bg-ink/30 border-t border-paper/10">
        <div className="flex flex-col md:flex-row md:items-center gap-5">
          <div className="flex-1"><div className="text-xs uppercase tracking-[.18em] text-paper/40">Selected</div><div className="mt-1 text-xl font-semibold">{selectedPigment ? selectedPigment.name : 'Nothing yet'}</div></div>
          <button onClick={lock} disabled={phase === 'locking' || phase === 'waiting' || phase === 'settling'} className="px-7 py-3.5 rounded-xl bg-cinnabar text-ink font-bold disabled:opacity-50 flex items-center justify-center gap-2 min-w-48">
            {(phase === 'locking' || phase === 'waiting' || phase === 'settling') ? <Loader2 size={18} className="animate-spin"/> : <LockKeyhole size={18}/>} {phase === 'locking' ? 'Locking…' : phase === 'waiting' ? 'Waiting…' : phase === 'settling' ? 'Settling…' : 'Lock my guess'}
          </button>
        </div>
        <div className="mt-5 text-sm text-paper/60">{message}</div>
        {lockBlock && <div className="mt-2 text-xs text-paper/35">Lock block: {lockBlock}</div>}
        {tx && <a className="mt-2 inline-flex items-center gap-1 text-xs text-cinnabar hover:underline" href={explorerTx(tx)} target="_blank" rel="noreferrer">Latest transaction <ExternalLink size={12}/></a>}
        {error && <div className="mt-4 flex gap-2 items-start text-sm text-red-300"><XCircle size={17} className="shrink-0"/>{error}</div>}
        {phase === 'done' && <div className="mt-4 flex gap-2 items-start text-sm text-green-300"><CheckCircle2 size={17} className="shrink-0"/>Round settled on-chain.</div>}
      </div>
    </section>

    <section className="mt-10 grid md:grid-cols-3 gap-4 text-sm">
      <Info title="Lock" body="Your pigment is stored in the ColorPool contract with the current block as the commit block." />
      <Info title="Wait" body="The app waits until a later block exists before asking the contract to settle." />
      <Info title="Settle" body="ColorPool computes uint256(blockhash(lockBlock)) % 8 and pays 1 COLOR when it matches." />
    </section>

    <footer className="py-10 text-xs text-paper/35 flex flex-col sm:flex-row gap-2 justify-between"><span>PSYROB testnet · EVM Shanghai · chain 87870</span><span>Legacy type-0 transactions · fixed gas price</span></footer>
  </main>
}

function Stat({ label, value }) { return <div className="rounded-2xl border border-paper/8 bg-ink/40 p-4"><div className="text-xs text-paper/35">{label}</div><div className="mt-1 font-semibold text-sm truncate">{String(value)}</div></div> }
function Info({ title, body }) { return <div className="rounded-2xl border border-paper/10 bg-clay p-5"><div className="font-display text-xl">{title}</div><p className="mt-2 text-paper/50 leading-relaxed">{body}</p></div> }
