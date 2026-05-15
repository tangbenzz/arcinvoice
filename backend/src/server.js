import "dotenv/config";
import express from "express";
import cors from "cors";
import { createPublicClient, defineChain, formatUnits, getAddress, http, isAddress } from "viem";

const PORT = Number(process.env.PORT || 8788);
const ARC_RPC_URL = process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network";
const INVOICE_ADDRESS = process.env.INVOICE_ADDRESS;

const statusNames = ["Open", "Paid", "Cancelled"];

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [ARC_RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: "ArcScan",
      url: "https://testnet.arcscan.app",
    },
  },
  testnet: true,
});

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(ARC_RPC_URL),
});

const invoiceAbi = [
  {
    inputs: [],
    name: "getInvoiceCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_invoiceId", type: "uint256" }],
    name: "getInvoice",
    outputs: [
      {
        components: [
          { internalType: "uint256", name: "id", type: "uint256" },
          { internalType: "address", name: "creator", type: "address" },
          { internalType: "address", name: "recipient", type: "address" },
          { internalType: "address", name: "payer", type: "address" },
          { internalType: "uint256", name: "amount", type: "uint256" },
          { internalType: "string", name: "memo", type: "string" },
          { internalType: "uint256", name: "dueDate", type: "uint256" },
          { internalType: "uint256", name: "createdAt", type: "uint256" },
          { internalType: "uint256", name: "paidAt", type: "uint256" },
          { internalType: "enum ArcInvoice.InvoiceStatus", name: "status", type: "uint8" }
        ],
        internalType: "struct ArcInvoice.Invoice",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

function formatDate(value) {
  const number = Number(value);
  if (!number) return null;
  return new Date(number * 1000).toISOString();
}

function normalizeAddress(address) {
  if (!address || !isAddress(address)) {
    throw new Error("Invalid address");
  }
  return getAddress(address).toLowerCase();
}

function sameAddress(a, b) {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

function formatInvoice(rawInvoice) {
  const invoice = Array.isArray(rawInvoice)
    ? {
        id: rawInvoice[0],
        creator: rawInvoice[1],
        recipient: rawInvoice[2],
        payer: rawInvoice[3],
        amount: rawInvoice[4],
        memo: rawInvoice[5],
        dueDate: rawInvoice[6],
        createdAt: rawInvoice[7],
        paidAt: rawInvoice[8],
        status: rawInvoice[9],
      }
    : rawInvoice;

  const status = Number(invoice.status);

  return {
    id: Number(invoice.id),
    creator: invoice.creator,
    recipient: invoice.recipient,
    payer: invoice.payer,
    amountRaw: invoice.amount.toString(),
    amount: formatUnits(invoice.amount, 6),
    memo: invoice.memo,
    dueDate: Number(invoice.dueDate),
    dueDateISO: formatDate(invoice.dueDate),
    createdAt: Number(invoice.createdAt),
    createdAtISO: formatDate(invoice.createdAt),
    paidAt: Number(invoice.paidAt),
    paidAtISO: formatDate(invoice.paidAt),
    status,
    statusName: statusNames[status] || "Unknown",
  };
}

async function getInvoices() {
  if (!INVOICE_ADDRESS || !isAddress(INVOICE_ADDRESS)) {
    throw new Error("Missing or invalid INVOICE_ADDRESS in backend .env");
  }

  const count = await publicClient.readContract({
    address: INVOICE_ADDRESS,
    abi: invoiceAbi,
    functionName: "getInvoiceCount",
  });

  const ids = Array.from({ length: Number(count) }, (_, index) => BigInt(index));

  const invoices = await Promise.all(
    ids.map(async (id) => {
      const rawInvoice = await publicClient.readContract({
        address: INVOICE_ADDRESS,
        abi: invoiceAbi,
        functionName: "getInvoice",
        args: [id],
      });

      return formatInvoice(rawInvoice);
    })
  );

  return invoices.reverse();
}

function buildStats(invoices) {
  const openInvoices = invoices.filter((invoice) => invoice.status === 0);
  const paidInvoices = invoices.filter((invoice) => invoice.status === 1);
  const cancelledInvoices = invoices.filter((invoice) => invoice.status === 2);

  const openRaw = openInvoices.reduce((sum, invoice) => sum + BigInt(invoice.amountRaw), 0n);
  const paidRaw = paidInvoices.reduce((sum, invoice) => sum + BigInt(invoice.amountRaw), 0n);

  return {
    totalInvoices: invoices.length,
    openInvoices: openInvoices.length,
    paidInvoices: paidInvoices.length,
    cancelledInvoices: cancelledInvoices.length,
    openVolume: formatUnits(openRaw, 6),
    paidVolume: formatUnits(paidRaw, 6),
  };
}

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
  })
);

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    name: "ArcInvoice Backend",
    status: "running",
    chain: "Arc Testnet",
    chainId: 5042002,
    invoiceAddress: INVOICE_ADDRESS,
  });
});

app.get("/health", (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.get("/api/invoices", async (req, res) => {
  try {
    const invoices = await getInvoices();
    let filtered = invoices;

    const { status, address } = req.query;

    if (status !== undefined) {
      filtered = filtered.filter((invoice) => String(invoice.status) === String(status));
    }

    if (address) {
      const normalized = normalizeAddress(String(address));
      filtered = filtered.filter(
        (invoice) =>
          sameAddress(invoice.creator, normalized) ||
          sameAddress(invoice.recipient, normalized) ||
          sameAddress(invoice.payer, normalized)
      );
    }

    res.json({
      invoices: filtered,
      stats: buildStats(invoices),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Failed to fetch invoices" });
  }
});

app.get("/api/invoices/:id", async (req, res) => {
  try {
    const invoices = await getInvoices();
    const invoice = invoices.find((item) => item.id === Number(req.params.id));

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    res.json({ invoice });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Failed to fetch invoice" });
  }
});

app.get("/api/stats", async (req, res) => {
  try {
    const invoices = await getInvoices();
    res.json(buildStats(invoices));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Failed to fetch stats" });
  }
});

app.listen(PORT, () => {
  console.log("");
  console.log("====================================");
  console.log(" ArcInvoice Backend is running");
  console.log("====================================");
  console.log(` Local:     http://localhost:${PORT}`);
  console.log(` Health:    http://localhost:${PORT}/health`);
  console.log(` Invoices:  http://localhost:${PORT}/api/invoices`);
  console.log(` Contract:  ${INVOICE_ADDRESS}`);
  console.log("====================================");
  console.log("");
});
