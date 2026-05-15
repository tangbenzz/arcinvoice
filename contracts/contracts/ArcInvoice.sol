// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

contract ArcInvoice {
    IERC20 public immutable usdc;
    uint256 public nextInvoiceId;

    enum InvoiceStatus {
        Open,
        Paid,
        Cancelled
    }

    struct Invoice {
        uint256 id;
        address creator;
        address recipient;
        address payer;
        uint256 amount;
        string memo;
        uint256 dueDate;
        uint256 createdAt;
        uint256 paidAt;
        InvoiceStatus status;
    }

    mapping(uint256 => Invoice) public invoices;

    event InvoiceCreated(
        uint256 indexed invoiceId,
        address indexed creator,
        address indexed recipient,
        uint256 amount,
        string memo
    );

    event InvoicePaid(
        uint256 indexed invoiceId,
        address indexed payer,
        address indexed recipient,
        uint256 amount
    );

    event InvoiceCancelled(uint256 indexed invoiceId);

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    function createInvoice(
        address _recipient,
        uint256 _amount,
        string calldata _memo,
        uint256 _dueDate
    ) external returns (uint256) {
        require(_recipient != address(0), "Recipient is required");
        require(_amount > 0, "Amount must be greater than 0");

        uint256 invoiceId = nextInvoiceId;

        invoices[invoiceId] = Invoice({
            id: invoiceId,
            creator: msg.sender,
            recipient: _recipient,
            payer: address(0),
            amount: _amount,
            memo: _memo,
            dueDate: _dueDate,
            createdAt: block.timestamp,
            paidAt: 0,
            status: InvoiceStatus.Open
        });

        nextInvoiceId++;

        emit InvoiceCreated(invoiceId, msg.sender, _recipient, _amount, _memo);

        return invoiceId;
    }

    function payInvoice(uint256 _invoiceId) external {
        Invoice storage invoice = invoices[_invoiceId];

        require(invoice.creator != address(0), "Invoice does not exist");
        require(invoice.status == InvoiceStatus.Open, "Invoice is not open");

        invoice.status = InvoiceStatus.Paid;
        invoice.payer = msg.sender;
        invoice.paidAt = block.timestamp;

        bool ok = usdc.transferFrom(msg.sender, invoice.recipient, invoice.amount);
        require(ok, "USDC payment failed");

        emit InvoicePaid(_invoiceId, msg.sender, invoice.recipient, invoice.amount);
    }

    function cancelInvoice(uint256 _invoiceId) external {
        Invoice storage invoice = invoices[_invoiceId];

        require(invoice.creator != address(0), "Invoice does not exist");
        require(invoice.creator == msg.sender, "Only creator can cancel");
        require(invoice.status == InvoiceStatus.Open, "Invoice is not open");

        invoice.status = InvoiceStatus.Cancelled;

        emit InvoiceCancelled(_invoiceId);
    }

    function getInvoice(uint256 _invoiceId) external view returns (Invoice memory) {
        return invoices[_invoiceId];
    }

    function getInvoiceCount() external view returns (uint256) {
        return nextInvoiceId;
    }
}
