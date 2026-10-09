import {
  Order,
  OrderItem,
  Invoice,
  Product,
  CustomerShop,
  OrderTaker,
  StockTransaction,
  CustomerLedgerEntry,
} from '../types';

// Shared order-confirmation rules, used by the browser store (dealer) and by the server (order takers),
// so stock, invoice and ledger are always calculated the same way.

export interface OrderBook {
  products: Product[];
  orders: Order[];
  invoices: Invoice[];
  stockTransactions: StockTransaction[];
  ledgerEntries: CustomerLedgerEntry[];
  customers: CustomerShop[];
  orderTakers: OrderTaker[];
}

export interface OrderPayload {
  customerId: string;
  orderTakerId: string;
  items: { productId: string; quantity: number; salePrice: number; discountPercent?: number }[];
  paidAmount: number;
  notes?: string;
  clientRequestId?: string;
  createdAt?: string; // when the order was really taken (orders taken offline are sent later)
}

export function confirmOrder(
  book: OrderBook,
  dealer: { name: string; phone: string; address: string },
  dealerId: string,
  payload: OrderPayload
): { book: OrderBook; order: Order; invoice: Invoice } {
    const customer = book.customers.find((c) => c.id === payload.customerId && c.dealerId === dealerId);
    if (!customer) throw new Error('Customer shop not found');

    const orderTaker = book.orderTakers.find(
      (ot) => ot.id === payload.orderTakerId && ot.dealerId === dealerId
    );
    if (!orderTaker) throw new Error('Order Taker not found');

    if (!payload.items || payload.items.length === 0) {
      throw new Error('Order must contain at least one product with quantity.');
    }

    // 1. Validate items and stock availability
    const preparedItems: OrderItem[] = [];
    const stockDeductions: {
      product: Product;
      quantity: number;
      previousStock: number;
      newStock: number;
    }[] = [];

    for (const item of payload.items) {
      if (!item.quantity || item.quantity <= 0) {
        throw new Error('Quantity must be a positive number for each product.');
      }
      const product = book.products.find((p) => p.id === item.productId && p.dealerId === dealerId);
      if (!product) throw new Error(`Product ${item.productId} not found in Dealer inventory.`);

      if (product.stock < item.quantity) {
        throw new Error(
          `Insufficient stock for "${product.name}". Available: ${product.stock}, Requested: ${item.quantity}`
        );
      }

      const discPct = item.discountPercent || 0;
      const gross = item.quantity * item.salePrice;
      const discountAmount = Math.round((gross * discPct) / 100);
      const lineTotal = gross - discountAmount;

      preparedItems.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        unit: product.unit,
        quantity: item.quantity,
        salePrice: item.salePrice,
        discountPercent: discPct,
        discountAmount,
        lineTotal,
      });

      stockDeductions.push({
        product,
        quantity: item.quantity,
        previousStock: product.stock,
        newStock: product.stock - item.quantity,
      });
    }

    const subtotal = preparedItems.reduce((acc, it) => acc + it.quantity * it.salePrice, 0);
    const totalDiscount = preparedItems.reduce((acc, it) => acc + it.discountAmount, 0);
    const grandTotal = subtotal - totalDiscount;

    const orderSeq = book.orders.filter((o) => o.dealerId === dealerId).length + 1;
    const invSeq = book.invoices.filter((i) => i.dealerId === dealerId).length + 1;
    const orderNumber = `ORD-2026-${String(orderSeq).padStart(4, '0')}`;
    const invoiceNumber = `INV-2026-${String(invSeq).padStart(4, '0')}`;

    const orderId = `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const invoiceId = `inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const nowIso = payload.createdAt || new Date().toISOString();

    // 2. Create Order
    const newOrder: Order = {
      id: orderId,
      dealerId,
      orderNumber,
      customerId: customer.id,
      customerName: customer.shopName,
      customerPhone: customer.phone,
      orderTakerId: orderTaker.id,
      orderTakerName: orderTaker.name,
      items: preparedItems,
      subtotal,
      totalDiscount,
      grandTotal,
      status: 'CONFIRMED',
      invoiceId,
      createdAt: nowIso,
      notes: payload.notes,
      clientRequestId: payload.clientRequestId,
    };

    // 3. Create Automatic Sale Invoice (NEVER exposes Buy Price)
    const paid = Math.min(grandTotal, Math.max(0, payload.paidAmount || 0));
    const due = grandTotal - paid;
    const paymentStatus = due === 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID';

    const newInvoice: Invoice = {
      id: invoiceId,
      invoiceNumber,
      orderId,
      dealerId,
      dealerName: dealer.name,
      dealerPhone: dealer.phone,
      dealerAddress: dealer.address,
      customerId: customer.id,
      customerName: customer.shopName,
      customerPhone: customer.phone,
      customerAddress: customer.address,
      orderTakerId: orderTaker.id,
      orderTakerName: orderTaker.name,
      items: preparedItems,
      subtotal,
      discount: totalDiscount,
      grandTotal,
      paidAmount: paid,
      dueAmount: due,
      paymentStatus,
      date: nowIso,
      printedCount: 0,
      notes: payload.notes,
    };

    // 4. Atomic Stock Reduction & Transaction Log
    const newStockTransactions: StockTransaction[] = [...book.stockTransactions];
    const updatedProducts = book.products.map((p) => {
      const deduction = stockDeductions.find((sd) => sd.product.id === p.id);
      if (deduction) {
        newStockTransactions.unshift({
          id: `stx-${Date.now()}-${Math.random()}`,
          dealerId,
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          type: 'SALE_DEDUCTION',
          quantityChange: -deduction.quantity,
          previousStock: deduction.previousStock,
          newStock: deduction.newStock,
          referenceId: orderId,
          referenceType: 'ORDER',
          timestamp: nowIso,
          note: `Order ${orderNumber} confirmed sale deduction`,
        });
        return { ...p, stock: deduction.newStock };
      }
      return p;
    });

    // 5. Update Customer Ledger
    const currentCustomerBalance = customer.currentBalance;
    const newCustomerBalanceAfterDebit = currentCustomerBalance + grandTotal;
    const finalCustomerBalance = newCustomerBalanceAfterDebit - paid;

    const newLedgerEntries = [...book.ledgerEntries];

    // Debit entry for invoice total
    newLedgerEntries.unshift({
      id: `ledg-${Date.now()}-1`,
      dealerId,
      customerId: customer.id,
      customerName: customer.shopName,
      date: nowIso,
      invoiceNo: invoiceNumber,
      referenceType: 'SALE_INVOICE',
      description: `Sale Invoice ${invoiceNumber} issued against Order ${orderNumber}`,
      debit: grandTotal,
      credit: 0,
      balance: newCustomerBalanceAfterDebit,
    });

    // If payment was collected at order confirmation, add credit entry
    if (paid > 0) {
      newLedgerEntries.unshift({
        id: `ledg-${Date.now()}-2`,
        dealerId,
        customerId: customer.id,
        customerName: customer.shopName,
        date: nowIso,
        invoiceNo: invoiceNumber,
        referenceType: 'PAYMENT_RECEIVED',
        description: `Payment received against Invoice ${invoiceNumber}`,
        debit: 0,
        credit: paid,
        balance: finalCustomerBalance,
      });
    }

    const updatedCustomers = book.customers.map((c) =>
      c.id === customer.id ? { ...c, currentBalance: finalCustomerBalance } : c
    );

    const nextBook: OrderBook = {
      ...book,
      products: updatedProducts,
      orders: [newOrder, ...book.orders],
      invoices: [newInvoice, ...book.invoices],
      stockTransactions: newStockTransactions,
      ledgerEntries: newLedgerEntries,
      customers: updatedCustomers,
    };

    return { book: nextBook, order: newOrder, invoice: newInvoice };
}

// ---------------------------------------------------------------------------
// Delivery and cancellation
// ---------------------------------------------------------------------------

export function markDelivered(book: OrderBook, dealerId: string, orderId: string, nowIso: string): OrderBook {
  const order = book.orders.find((o) => o.id === orderId && o.dealerId === dealerId);
  if (!order) throw new Error('Order not found.');
  if (order.status === 'DELIVERED') throw new Error('This order is already marked as delivered.');
  if (order.status === 'CANCELLED') throw new Error('A cancelled order cannot be delivered.');
  return {
    ...book,
    orders: book.orders.map((o) => (o.id === orderId ? { ...o, status: 'DELIVERED' as const, deliveredAt: nowIso } : o)),
  };
}

// Cancels an order that has NOT been delivered: stock goes back, the invoice no longer counts and the
// customer's balance drops by the invoice total. Money the customer already paid stays as their advance
// (balance goes below zero) so nothing is lost; it can be settled against their next bill.
export function cancelOrder(
  book: OrderBook,
  returns: { dealerId: string; invoiceNumber?: string }[],
  dealerId: string,
  orderId: string,
  reason: string,
  nowIso: string
): OrderBook {
  const order = book.orders.find((o) => o.id === orderId && o.dealerId === dealerId);
  if (!order) throw new Error('Order not found.');
  if (order.status === 'CANCELLED') throw new Error('This order is already cancelled.');
  if (order.status === 'DELIVERED') {
    throw new Error('A delivered order cannot be cancelled. Use a Sales Return for goods that came back.');
  }
  const invoice = book.invoices.find((i) => i.orderId === order.id && i.dealerId === dealerId);
  if (!invoice) throw new Error('The invoice for this order was not found.');
  if (returns.some((r) => r.dealerId === dealerId && r.invoiceNumber === invoice.invoiceNumber)) {
    throw new Error('This order already has a sales return, so it cannot be cancelled.');
  }
  const customer = book.customers.find((c) => c.id === order.customerId && c.dealerId === dealerId);
  if (!customer) throw new Error('Customer not found.');
  const cleanReason = String(reason || '').trim().slice(0, 200);

  // 1. Put the goods back in stock
  const stockTransactions = [...book.stockTransactions];
  const products = book.products.map((p) => {
    const lines = order.items.filter((it) => it.productId === p.id);
    if (p.dealerId !== dealerId || lines.length === 0) return p;
    const qty = lines.reduce((s, it) => s + it.quantity, 0);
    stockTransactions.unshift({
      id: `stk-cancel-${Date.now()}-${p.id}`,
      dealerId,
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      type: 'CANCEL_RESTORE',
      quantityChange: qty,
      previousStock: p.stock,
      newStock: p.stock + qty,
      referenceId: order.id,
      referenceType: 'ORDER',
      timestamp: nowIso,
      note: `Order ${order.orderNumber} cancelled`,
    });
    return { ...p, stock: p.stock + qty };
  });

  // 2. Reverse the invoice in the customer's account
  const newBalance = customer.currentBalance - invoice.grandTotal;
  const ledgerEntries = [
    {
      id: `ledg-cancel-${Date.now()}`,
      dealerId,
      customerId: customer.id,
      customerName: customer.shopName,
      date: nowIso,
      invoiceNo: invoice.invoiceNumber,
      referenceType: 'ORDER_CANCELLED' as const,
      description: `Order ${order.orderNumber} cancelled — Invoice ${invoice.invoiceNumber} reversed${cleanReason ? ': ' + cleanReason : ''}`,
      debit: 0,
      credit: invoice.grandTotal,
      balance: newBalance,
    },
    ...book.ledgerEntries,
  ];

  return {
    ...book,
    products,
    stockTransactions,
    ledgerEntries,
    customers: book.customers.map((c) => (c.id === customer.id ? { ...c, currentBalance: newBalance } : c)),
    invoices: book.invoices.map((i) => (i.id === invoice.id ? { ...i, cancelled: true, dueAmount: 0 } : i)),
    orders: book.orders.map((o) => (o.id === order.id ? { ...o, status: 'CANCELLED' as const, cancelledAt: nowIso, cancelReason: cleanReason } : o)),
  };
}
