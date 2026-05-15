# ArcInvoice

ArcInvoice is a simple invoice backend plus smart contract project for Arc Testnet.

## Project Structure

- `backend/`: Express API for reading invoice data from the deployed contract
- `contracts/`: Solidity contract source and compiled artifacts

## Requirements

- Node.js 24+
- npm 11+
- A deployed `ArcInvoice` contract address on Arc Testnet

## Run The Backend

1. Install dependencies:

```powershell
cd D:\codex\arcinvoice\backend
npm install
```

2. Create the env file:

```powershell
copy .env.example .env
```

3. Edit `backend/.env` and set your contract address:

```env
PORT=8788
ARC_RPC_URL=https://rpc.testnet.arc.network
INVOICE_ADDRESS=0xYourArcInvoiceContractAddress
FRONTEND_URL=http://localhost:5173
```

4. Start the backend:

```powershell
npm run dev
```

## Available Endpoints

- `GET /`
- `GET /health`
- `GET /api/invoices`
- `GET /api/invoices/:id`
- `GET /api/stats`

## Notes

- The backend can start without `INVOICE_ADDRESS`, but invoice endpoints will fail until a valid contract address is provided.
- The backend default URL is `http://localhost:8788`.
- The current RPC target is Arc Testnet.

## Deploy The Contract

1. Install contract dependencies:

```powershell
cd D:\codex\arcinvoice\contracts
npm install
```

2. Create the contract env file:

```powershell
copy .env.example .env
```

3. Edit `contracts/.env`:

```env
PRIVATE_KEY=0xyourprivatekey
USDC_ADDRESS=0xYourUsdcTokenAddress
```

4. Deploy to Arc Testnet:

```powershell
npm run deploy:arc
```

5. Copy the deployed contract address into `backend/.env`:

```env
INVOICE_ADDRESS=0xYourDeployedArcInvoiceAddress
```

After that, restart the backend with `npm run dev`.
