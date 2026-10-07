const COMPILER_URL = 'https://cdn.jsdelivr.net/npm/solc@0.8.28/soljson.js'

function compileInWorker(input) {
  return new Promise((resolve, reject) => {
    const source = `
      self.onmessage = () => {
        try {
          importScripts(${JSON.stringify(COMPILER_URL)});
          var mod = self.Module;
          if (!mod || typeof mod.cwrap !== 'function') throw new Error('Compiler module did not initialize.');
          var version = mod.cwrap('solidity_version', 'string', [])();
          var compile = mod.cwrap('solidity_compile', 'string', ['string', 'number', 'number']);
          var raw = compile(${JSON.stringify(input)}, 0, 0);
          self.postMessage({ ok: true, version: version, raw: raw });
        } catch (err) {
          self.postMessage({ ok: false, error: String(err && err.message ? err.message : err) });
        }
      };
    `
    const blob = new Blob([source], { type: 'text/javascript' })
    const url = URL.createObjectURL(blob)
    const worker = new Worker(url)
    const timer = setTimeout(() => {
      worker.terminate()
      URL.revokeObjectURL(url)
      reject(new Error('The compiler took too long to start.'))
    }, 90000)
    worker.onmessage = (event) => {
      clearTimeout(timer)
      worker.terminate()
      URL.revokeObjectURL(url)
      const data = event.data
      if (!data?.ok || !data.raw || !data.version) {
        reject(new Error(data?.error || 'The compiler failed.'))
        return
      }
      resolve({ version: data.version, raw: data.raw })
    }
    worker.onerror = (event) => {
      clearTimeout(timer)
      worker.terminate()
      URL.revokeObjectURL(url)
      reject(new Error(event.message || 'The compiler worker failed.'))
    }
    worker.postMessage(0)
  })
}

function stripMetadata(hex) {
  const body = hex.replace(/^0x/, '')
  if (body.length < 4) return body
  const metaLen = Number.parseInt(body.slice(-4), 16)
  const suffix = (metaLen + 2) * 2
  if (!Number.isFinite(metaLen) || metaLen < 40 || metaLen > 300 || suffix >= body.length) return body
  const marker = body.slice(body.length - suffix, body.length - suffix + 2)
  if (marker !== 'a1' && marker !== 'a2' && marker !== 'a3') return body
  return body.slice(0, body.length - suffix)
}

export function auditShanghaiBytecode(bytecodeHex) {
  const hex = stripMetadata(bytecodeHex)
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  let sawBlockhash = false
  for (let i = 0; i < bytes.length; i++) {
    const op = bytes[i] ?? 0
    if (op === 0x40) sawBlockhash = true
    if (op === 0x44) throw new Error('Bytecode reads PREVRANDAO. This chain defines that as zero.')
    if (op === 0x49 || op === 0x4a || op === 0x5c || op === 0x5d || op === 0x5e) {
      throw new Error('Bytecode uses an opcode past Shanghai (' + op.toString(16) + ').')
    }
    if (op >= 0x60 && op <= 0x7f) i += op - 0x5f
  }
  if (!sawBlockhash) throw new Error('Compiled bytecode never reads BLOCKHASH.')
}

export async function compileColorPool(source) {
  const input = JSON.stringify({
    language: 'Solidity',
    sources: { 'ColorPool.sol': { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'shanghai',
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
    },
  })
  const { version, raw } = await compileInWorker(input)
  const output = JSON.parse(raw)
  const fatal = (output.errors || []).filter((item) => item.severity === 'error')
  if (fatal.length) throw new Error(fatal.map((item) => item.formattedMessage || item.message).join('\n'))
  const contract = output.contracts?.['ColorPool.sol']?.ColorPool
  if (!contract?.evm?.bytecode?.object) throw new Error('The compiler returned no bytecode.')
  const bytecode = contract.evm.bytecode.object.startsWith('0x') ? contract.evm.bytecode.object : '0x' + contract.evm.bytecode.object
  auditShanghaiBytecode(bytecode)
  return { version, abi: contract.abi, bytecode, initBytes: (bytecode.length - 2) / 2 }
}
