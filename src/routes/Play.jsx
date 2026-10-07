import React, { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, CircleHelp, ExternalLink, Loader2, LockKeyhole, RefreshCw, Wallet, XCircle } from 'lucide-react'
import { PIGMENTS } from '../lib/pigments'
import { BrowserProvider } from 'ethers'
import {
  CHAIN,
  POOL_ADDRESS,
  connectWallet,
  explainError,
  explorerTx,
  hasWallet,
  parseRound,
  readState,
  sendContract,
  shortenAddress,
} from '../lib/psyrob'

const pigment = (id) => PIGMENTS.find((item) => item.id === Number(id))
const fmt = (value) => {
  try { return Number(value).toLocaleString() } catch { return '0' }
}

export default function Play() {
  const [wallet, setWallet] = useState(null)
  const [selected, setSelected] = useState(null)
  const [chain, setChain] = useState(null)
  const [readNote, setReadNote] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [tx, setTx] = useState('')
  const [result, setResult] = useState(null)
  const [tick, setTick] = useState(0)

  const preview = chain?.preview
  const open = Boolean(preview?.open)
  const selectedPigment = pigment(open ? preview.color : selected)
  const rolledPigment = preview?.ready ? pigment(preview.rolled) : null

  async function refresh(address = wallet?.address) {
    try {
      const next = await readState(address)
      setChain(next)
      setReadNote('')
    } catch (err) {
      setReadNote(explainError(err))
    }
  }

  useEffect(() => {
    let stop = false
    const run = async () => {
      try {
        const next = await readState(wallet?.address)
        if (!stop) { setChain(next); setReadNote('') }
      } catch (err) {
        if (!stop) setReadNote(explainError(err))
      }
    }
    run()
    const id = setInterval(run, 4000)
    return () => { stop = true; clearInterval(id) }
  }, [wallet?.address, tick])

  useEffect(() => {
    const eth = window.ethereum
    if (!eth?.on) return undefined
    const onAccounts = async (accounts) => {
      if (!accounts?.length) { setWallet(null); return }
      try {
        const provider = new BrowserProvider(eth)
        const signer = await provider.getSigner()
        setWallet({ provider, signer, address: await signer.getAddress() })
      } catch { setWallet(null) }
    }
    const onChain = () => setTick((n) => n + 1)
    eth.on('accountsChanged', onAccounts)
    eth.on('chainChanged', onChain)
    return () => {
      eth.removeListener?.('accountsChanged', onAccounts)
      eth.removeListener?.('chainChanged', onChain)
    }
  }, [])

  async function connect() {
    setError('')
    setBusy('connect')
    try {
      const next = await connectWallet()
      setWallet(next)
      await refresh(next.address)
    } catch (err) {
      setError(explainError(err))
    } finally {
      setBusy('')
    }
  }

  async function lock() {
    if (!wallet) return connect()
    if (selected === null) { setError('Pick one pigment first.'); return }
    setError('')
    setResult(null)
    setBusy('lock')
    try {
      const response = await sendContract(wallet.signer, 'lock', [selected])
      setTx(response.hash)
      const receipt = await response.wait()
      if (receipt.status !== 1) throw new Error('The lock transaction was mined and failed.')
      await refresh(wallet.address)
    } catch (err) {
      setError(explainError(err))
    } finally {
      setBusy('')
    }
  }

  async function settle() {
    if (!wallet) return connect()
    setError('')
    setBusy('settle')
    try {
      const response = await sendContract(wallet.signer, 'settle', [])
      setTx(response.hash)
      const receipt = await response.wait()
      if (receipt.status !== 1) throw new Error('Settle was mined and failed.')
      setResult(parseRound(receipt))
      await refresh(wallet.address)
    } catch (err) {
      setError(explainError(err))
    } finally {
      setBusy('')
    }
  }

  async function abandon() {
    if (!wallet) return connect()
    setError('')
    setBusy('abandon')
    try {
      const response = await sendContract(wallet.signer, 'abandon', [])
      setTx(response.hash)
      const receipt = await response.wait()
      if (receipt.status !== 1) throw new Error('Abandon was mined and failed.')
      setResult(null)
      await refresh(wallet.address)
    } catch (err) {
      setError(explainError(err))
    } finally {
      setBusy('')
    }
  }

  const statusLine = useMemo(() => {
    if (!wallet) return 'Connect MetaMask on PSYROB. The roll is blockhash(lock block) mod 8.'
    if (!preview?.open) return 'Choose a pigment and lock it. The color is fixed by the next block.'
    if (preview.expired) return `Locked in block ${preview.commitBlock}. The hash expired. Abandon it, then lock again.`
    if (!preview.ready) {
      const left = Math.max(0, preview.commitBlock + 1 - (chain?.block || 0))
      return left > 0
        ? `Locked in block ${preview.commitBlock}. Waiting for block ${preview.commitBlock + 1} (now ${chain?.block ?? '…'}).`
        : `Locked in block ${preview.commitBlock}. The next block is in. Settle to draw.`
    }
    return rolledPigment && selectedPigment && preview.rolled === preview.color
      ? `${rolledPigment.name} came up. It matches. Settle to take 1 COLOR from the pool.`
      : `${rolledPigment?.name || 'A color'} came up. Your lock was ${selectedPigment?.name}. Settle to close the round.`
  }, [wallet, preview, chain?.block, rolledPigment, selectedPigment])

  const primaryDisabled = Boolean(busy)
  let primaryLabel = 'Lock my guess'
  let primaryAction = lock
  if (busy === 'lock') primaryLabel = 'Locking…'
  else if (busy === 'settle') primaryLabel = 'Settling…'
  else if (busy === 'abandon') primaryLabel = 'Abandoning…'
  else if (open && preview.expired) { primaryLabel = 'Abandon guess'; primaryAction = abandon }
  else if (open && preview.ready) { primaryLabel = preview.rolled === preview.color ? 'Settle and take 1 COLOR' : 'Settle round'; primaryAction = settle }
  else if (open) { primaryLabel = 'Waiting for the next block'; primaryAction = () => {} }

  const swatch = rolledPigment && open && preview.ready ? rolledPigment : selectedPigment

  return (
    <main className="max-w-6xl mx-auto px-5 py-10 sm:py-14">
      <section className="grid lg:grid-cols-[1.15fr_.85fr] gap-8 items-start">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cinnabar/30 bg-cinnabar/10 text-cinnabar text-xs font-semibold uppercase tracking-[.18em]">8 pigments · 1 block · on-chain</div>
          <h1 className="font-display text-5xl sm:text-7xl leading-[.9] mt-5 max-w-3xl">Guess the color.<br /><span className="text-cinnabar">Trust the chain.</span></h1>
          <p className="mt-6 text-paper/65 text-lg max-w-xl leading-relaxed">Lock one of eight pigments. The next block's hash picks the color. A match pays 1 COLOR out of the pool this contract keeps.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={connect} className="px-5 py-3 rounded-xl bg-paper text-ink font-bold hover:opacity-90 flex items-center gap-2">
              <Wallet size={18} />{wallet ? shortenAddress(wallet.address) : 'Connect MetaMask'}
            </button>
            <a href={`${CHAIN.explorer}/address/${POOL_ADDRESS}`} target="_blank" rel="noreferrer" className="px-5 py-3 rounded-xl border border-paper/15 text-paper/75 hover:bg-paper/5 flex items-center gap-2">
              View pool <ExternalLink size={16} />
            </a>
          </div>
          {!hasWallet() && <p className="mt-4 text-sm text-paper/45">No wallet detected in this browser. Install MetaMask, add PSYROB chain {CHAIN.id}, then reload.</p>}
        </div>

        <div className="rounded-3xl border border-paper/10 bg-clay p-5 sm:p-7 shadow-2xl">
          <div className="flex items-center justify-between mb-5">
            <span className="text-xs uppercase tracking-[.2em] text-paper/45">Pool</span>
            <button onClick={() => refresh()} className="text-paper/50 hover:text-paper" aria-label="Refresh pool"><RefreshCw size={16} /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="COLOR in pool" value={chain ? fmt(chain.pool) : '—'} />
            <Stat label="Your COLOR" value={wallet ? fmt(chain?.balance ?? 0) : '—'} />
            <Stat label="Paid out" value={chain ? fmt(chain.paidOut) : '—'} />
            <Stat label="Block" value={chain?.block || '—'} />
          </div>
          {readNote && <div className="mt-4 text-sm text-amber-200/90">{readNote}</div>}
          <div className="mt-5 p-4 rounded-2xl bg-ink/60 border border-paper/10 text-sm text-paper/60 flex gap-3">
            <CircleHelp className="shrink-0 mt-0.5" size={17} />
            <span>Everyone plays the same pool at {shortenAddress(POOL_ADDRESS)}. Reads go through MetaMask because the public RPC blocks browser CORS.</span>
          </div>
        </div>
      </section>

      <section className="mt-12 grid lg:grid-cols-[.7fr_1.3fr] gap-4">
        <div className="rounded-3xl border border-paper/10 bg-clay p-6 flex flex-col justify-between min-h-72">
          <div>
            <div className="text-xs uppercase tracking-[.2em] text-paper/40">The well</div>
            <h2 className="font-display text-3xl mt-1">{swatch ? swatch.name : 'No pigment'}</h2>
          </div>
          <div className="well-stir mt-6 h-40 rounded-[2rem] border border-paper/10 shadow-inner" style={{ background: swatch ? swatch.hex : '#2a241e' }} />
          <p className="mt-4 text-sm text-paper/55">{open && preview.ready ? 'Rolled from the lock block hash.' : 'Your lock, or the color you are about to lock.'}</p>
        </div>

        <div className="rounded-3xl border border-paper/10 bg-clay/70 overflow-hidden">
          <div className="p-5 sm:p-7 border-b border-paper/10 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[.2em] text-paper/40">Your pigment</div>
              <h2 className="font-display text-3xl mt-1">{open ? 'Guess is locked' : 'Choose one'}</h2>
            </div>
            <div className="text-xs text-paper/45">1 / 8 chance · 1 COLOR on a match</div>
          </div>
          <div className="p-5 sm:p-7 grid grid-cols-2 md:grid-cols-4 gap-3">
            {PIGMENTS.map((item) => {
              const active = open ? preview.color === item.id : selected === item.id
              const hit = open && preview.ready && preview.rolled === item.id
              return (
                <button
                  key={item.id}
                  disabled={Boolean(busy) || open}
                  onClick={() => { setSelected(item.id); setError('') }}
                  className={`text-left rounded-2xl border p-3 transition disabled:opacity-80 ${active ? 'border-paper ring-2 ring-cinnabar' : 'border-paper/10 hover:border-paper/30'} ${hit ? 'ring-2 ring-emerald-300' : ''}`}
                >
                  <div className="h-16 rounded-xl mb-3 shadow-inner" style={{ background: item.hex }} />
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm">{item.name}</span>
                    <span className="text-xs text-paper/35">{item.id}</span>
                  </div>
                </button>
              )
            })}
          </div>
          <div className="p-5 sm:p-7 bg-ink/30 border-t border-paper/10">
            <div className="flex flex-col md:flex-row md:items-center gap-5">
              <div className="flex-1">
                <div className="text-xs uppercase tracking-[.18em] text-paper/40">{open ? 'Locked' : 'Selected'}</div>
                <div className="mt-1 text-xl font-semibold">{selectedPigment ? selectedPigment.name : 'Nothing yet'}</div>
                <div className="mt-2 text-sm text-paper/60">{statusLine}</div>
              </div>
              <div className="flex flex-col gap-2 min-w-48">
                <button onClick={primaryAction} disabled={primaryDisabled || (open && !preview.ready && !preview.expired)} className="px-6 py-3.5 rounded-xl bg-cinnabar text-ink font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                  {busy ? <Loader2 size={18} className="animate-spin" /> : <LockKeyhole size={18} />} {primaryLabel}
                </button>
                {open && !preview.expired && (
                  <button onClick={abandon} disabled={Boolean(busy)} className="px-6 py-2.5 rounded-xl border border-paper/15 text-paper/70 text-sm disabled:opacity-50">
                    Abandon without drawing
                  </button>
                )}
              </div>
            </div>
            {tx && <a className="mt-4 inline-flex items-center gap-1 text-xs text-cinnabar hover:underline" href={explorerTx(tx)} target="_blank" rel="noreferrer">Latest transaction <ExternalLink size={12} /></a>}
            {error && <div className="mt-4 flex gap-2 items-start text-sm text-red-300"><XCircle size={17} className="shrink-0 mt-0.5" />{error}</div>}
            {result && (
              <div className={`mt-4 flex gap-3 items-start text-sm ${result.matched ? 'text-green-300' : 'text-paper/80'}`}>
                <CheckCircle2 size={17} className="shrink-0 mt-0.5" />
                <span>
                  Rolled {pigment(result.rolled)?.name}. You locked {pigment(result.guess)?.name}.{' '}
                  {result.matched && result.paid && 'Match. 1 COLOR moved from the pool to you.'}
                  {result.matched && !result.paid && 'Match, but the pool was empty so nothing was paid.'}
                  {!result.matched && 'No match. The token stayed in the pool.'}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mt-10 grid md:grid-cols-3 gap-4 text-sm">
        <Info title="Lock" body="lock(color) stores your pigment and the current block. You cannot lock again until this round is settled or abandoned." />
        <Info title="Wait one block" body="blockhash(lock block) does not exist until the next block, and only for 256 blocks after that." />
        <Info title="Settle" body="settle() pays 1 COLOR from the pool when the rolled index matches. A miss closes the round and pays nothing." />
      </section>
      <footer className="py-10 text-xs text-paper/35 flex flex-col sm:flex-row gap-2 justify-between">
        <span>PSYROB testnet · EVM Shanghai · chain 87870</span>
        <span>Legacy type-0 transactions · gas price {CHAIN.gasPrice.toString()} wei</span>
      </footer>
    </main>
  )
}

function Stat({ label, value }) {
  return <div className="rounded-2xl border border-paper/10 bg-ink/40 p-4"><div className="text-xs text-paper/35">{label}</div><div className="mt-1 font-semibold truncate">{String(value)}</div></div>
}
function Info({ title, body }) {
  return <div className="rounded-2xl border border-paper/10 bg-clay p-5"><div className="font-display text-xl">{title}</div><p className="mt-2 text-paper/50 leading-relaxed">{body}</p></div>
}
