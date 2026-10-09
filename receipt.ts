import { Payment, Dealer } from '../types';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function printReceipt(payment: Payment, dealer: Pick<Dealer, 'name' | 'phone' | 'address'> | undefined) {
  const w = window.open('', '_blank', 'width=420,height=640');
  if (!w) {
    alert('Please allow pop-ups to print the receipt.');
    return;
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(payment.receiptNumber)}</title>
<style>body{font-family:Arial,sans-serif;max-width:300px;margin:12px auto;font-size:13px;color:#111}
h2,h3,p{margin:2px 0;text-align:center}hr{border:0;border-top:1px dashed #555;margin:8px 0}
.r{display:flex;justify-content:space-between;margin:3px 0}.big{font-size:18px;font-weight:bold}</style></head><body>
<h2>${esc(dealer?.name || 'My Saleflo')}</h2>
<p>${esc(dealer?.address || '')}</p><p>${esc(dealer?.phone || '')}</p><hr>
<h3>PAYMENT RECEIPT</h3>
<div class="r"><span>Receipt #</span><b>${esc(payment.receiptNumber)}</b></div>
<div class="r"><span>Date</span><span>${esc(new Date(payment.date).toLocaleString())}</span></div>
<div class="r"><span>Customer</span><b>${esc(payment.customerName)}</b></div>
<div class="r"><span>Method</span><span>${esc(payment.method.replace(/_/g, ' '))}</span></div>
${payment.invoiceNumbers.length ? `<div class="r"><span>Against</span><span>${esc(payment.invoiceNumbers.join(', '))}</span></div>` : ''}
<hr><div class="r big"><span>Received</span><span>Rs ${Math.round(payment.amount).toLocaleString()}</span></div>
<div class="r"><span>Balance Due</span><span>Rs ${Math.round(payment.balanceAfter).toLocaleString()}</span></div>
${payment.notes ? `<p>${esc(payment.notes)}</p>` : ''}<hr><p>Thank you!</p>
<script>window.onload=function(){window.print();}</script></body></html>`;
  w.document.write(html);
  w.document.close();
}

// Provisional slip for an order taken without signal (the real invoice is created when it reaches the server)
export function printOrderSlip(
  entry: {
    id: string;
    createdAt: string;
    customerName: string;
    lines: { name: string; quantity: number; discountPercent: number; unitPrice: number }[];
    estimatedTotal: number;
  },
  info: { dealerName?: string; orderTakerName?: string }
) {
  const w = window.open('', '_blank', 'width=420,height=640');
  if (!w) {
    alert('Please allow pop-ups to print the slip.');
    return;
  }
  const rows = entry.lines
    .map((l) => {
      const amount = l.quantity * l.unitPrice * (1 - (l.discountPercent || 0) / 100);
      return `<tr><td>${esc(l.name)}</td><td style="text-align:center">${l.quantity}</td><td style="text-align:right">${Math.round(amount).toLocaleString()}</td></tr>`;
    })
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Order slip</title>
<style>body{font-family:Arial,sans-serif;max-width:300px;margin:12px auto;font-size:13px;color:#111}
h2,h3,p{margin:2px 0;text-align:center}hr{border:0;border-top:1px dashed #555;margin:8px 0}
table{width:100%;border-collapse:collapse}td,th{padding:3px 0;font-size:12px}th{text-align:left;border-bottom:1px solid #999}
.r{display:flex;justify-content:space-between;margin:3px 0}.warn{border:1px solid #b45309;color:#92400e;padding:6px;margin:8px 0;text-align:center;font-size:11px}</style></head><body>
<h2>${esc(info.dealerName || 'My Saleflo')}</h2>
<h3>ORDER SLIP (PROVISIONAL)</h3>
<div class="warn">Taken without signal. Stock and the final invoice are confirmed when the order is sent.</div>
<div class="r"><span>Date</span><span>${esc(new Date(entry.createdAt).toLocaleString())}</span></div>
<div class="r"><span>Shop</span><b>${esc(entry.customerName)}</b></div>
<div class="r"><span>Taken by</span><span>${esc(info.orderTakerName || '')}</span></div>
<div class="r"><span>Ref</span><span>${esc(entry.id.slice(0, 8))}</span></div>
<hr><table><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Rs</th></tr>${rows}</table><hr>
<div class="r"><b>Approx. total</b><b>Rs ${Math.round(entry.estimatedTotal).toLocaleString()}</b></div>
<p style="font-size:11px">Final prices are the dealer's current prices.</p>
<script>window.onload=function(){window.print();}</script></body></html>`;
  w.document.write(html);
  w.document.close();
}
