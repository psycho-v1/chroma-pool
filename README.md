# Chroma Pool

Chroma Pool is a React + Vite frontend for the deployed PSYROB `ColorPool` contract.

## Live contract

- Network: PSYROB testnet
- Chain ID: 87870 (`0x1573e`)
- RPC: `https://rpc.psyrob.com`
- Explorer: `https://explorer.psyrob.com`
- ColorPool: `0x8202C6768562BEBe8A138E4A6e67363BeE552f98`
- Constructor pool size: `1000000`
- Transactions: legacy type 0 / EIP-155
- Fixed gas price: `47619047619` wei

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## GitHub Pages

The workflow at `.github/workflows/deploy.yml` builds on pushes to `main` and deploys `dist` through GitHub Pages Actions.

In the GitHub repository settings, set Pages → Build and deployment → Source to **GitHub Actions**. The Vite base is `./`, so the same build works for project-page URLs.

Expected project URL for the `psycho-v1` account and repository name `chroma-pool`:

`https://psycho-v1.github.io/chroma-pool/`

## Contract ABI note

The player UI uses the documented contract surface: `lock(uint8)`, `settle()`, `abandon()`, `fill(uint256)`, `poolBalance()`, and standard ERC-20-style `balanceOf`, `transfer`, and `approve` methods. The authoritative Solidity source was not supplied in this build, so the optional `/deploy` page deliberately does not compile or deploy an inferred contract.
