const contractAddressEl = document.getElementById("contractAddress");
const apiStatusEl = document.getElementById("apiStatus");
const refreshButton = document.getElementById("refreshButton");
const tableBody = document.getElementById("invoiceTableBody");
const emptyState = document.getElementById("emptyState");

const statFields = [
  "totalInvoices",
  "openInvoices",
  "paidInvoices",
  "cancelledInvoices",
  "openVolume",
  "paidVolume",
];

function shortenAddress(address) {
  if (!address) return "-";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function statusClass(statusName) {
  switch (statusName) {
    case "Open":
      return "badge badge-open";
    case "Paid":
      return "badge badge-paid";
    case "Cancelled":
      return "badge badge-cancelled";
    default:
      return "badge";
  }
}

function renderStats(stats) {
  for (const field of statFields) {
    const el = document.getElementById(field);
    if (el) {
      el.textContent = stats[field] ?? "-";
    }
  }
}

function renderInvoices(invoices) {
  tableBody.innerHTML = "";

  if (!invoices.length) {
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  for (const invoice of invoices) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>#${invoice.id}</td>
      <td><span class="${statusClass(invoice.statusName)}">${invoice.statusName}</span></td>
      <td>${invoice.amount}</td>
      <td title="${invoice.creator}">${shortenAddress(invoice.creator)}</td>
      <td title="${invoice.recipient}">${shortenAddress(invoice.recipient)}</td>
      <td>${formatDate(invoice.dueDateISO)}</td>
      <td>${invoice.memo || "-"}</td>
    `;
    tableBody.appendChild(row);
  }
}

async function loadData() {
  apiStatusEl.textContent = "Refreshing...";

  const [rootResponse, invoicesResponse] = await Promise.all([
    fetch("/health"),
    fetch("/api/invoices"),
  ]);

  if (!rootResponse.ok || !invoicesResponse.ok) {
    throw new Error("Failed to fetch invoice data");
  }

  const health = await rootResponse.json();
  const invoicesPayload = await invoicesResponse.json();

  apiStatusEl.textContent = health.ok ? "Online" : "Offline";
  renderStats(invoicesPayload.stats);
  renderInvoices(invoicesPayload.invoices);
}

async function loadContractInfo() {
  const response = await fetch("/api/config");
  if (!response.ok) {
    contractAddressEl.textContent = "Unavailable";
    return;
  }

  const payload = await response.json();
  contractAddressEl.textContent = payload.invoiceAddress || "Not configured";
}

async function boot() {
  try {
    await Promise.all([loadData(), loadContractInfo()]);
  } catch (error) {
    apiStatusEl.textContent = "Error";
    emptyState.classList.remove("hidden");
    emptyState.innerHTML = `
      <h3>Unable to load dashboard</h3>
      <p>${error.message}</p>
    `;
  }
}

refreshButton.addEventListener("click", () => {
  loadData().catch((error) => {
    apiStatusEl.textContent = "Error";
    console.error(error);
  });
});

boot();
