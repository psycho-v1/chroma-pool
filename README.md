# Chroma Pool

Guess one of eight pigments. The rolled color is `uint256(blockhash(lockBlock)) % 8`. A match draws **1 COLOR** from the pool the contract keeps.

There is no application server. The wallet talks to PSYROB. The contract is the backend.

Play: https://psycho-v1.github.io/chroma-pool/

## Chain

| | |
| --- | --- |
| Network | PSYROB testnet |
| Chain ID | 87870 (`0x1573e`) |
| RPC | https://rpc.psyrob.com |
| Explorer | https://explorer.psyrob.com |
| EVM | Shanghai |
| Transactions | Legacy type 0, EIP-155 only |
| Gas price | 47619047619 wei |
| Block gas limit | 15,000,000 |

`PREVRANDAO` is zero on this chain. The roll uses `blockhash`.

## Live pool

`0x8202C6768562BEBe8A138E4A6e67363BeE552f98`

Constructor minted 1,000,000 COLOR into the contract. Players use this address. The Deploy page can compile and deploy another pool; it does not replace the live one.

The public RPC does not send CORS headers, so the page reads the chain through MetaMask (`eth_call`) once the wallet is on chain 87870.

## Play

1. Connect MetaMask on PSYROB.
2. Pick a pigment and lock it.
3. Wait until the next block. The page shows the rolled color from `preview`.
4. Settle. A match transfers 1 COLOR (0 decimals) to you. A miss closes the round.
5. If the hash is older than 256 blocks, abandon the guess and lock again.

Pigments: 0 vermilion, 1 marigold, 2 sap, 3 cerulean, 4 indigo, 5 orchid, 6 ivory, 7 lampblack.

## Deploy page

`/#/deploy` compiles [src/contracts/ColorPool.sol](src/contracts/ColorPool.sol) in the browser (Solidity 0.8.28, `evmVersion: shanghai`, optimizer 200), rejects PREVRANDAO and post-Shanghai opcodes, and sends a legacy type-0 deployment at the fixed gas price.
