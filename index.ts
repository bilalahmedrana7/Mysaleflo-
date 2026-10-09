export type UserRole = 'SUPER_ADMIN' | 'DEALER' | 'ORDER_TAKER';

export type SubscriptionPlan = '1_MONTH' | '1_YEAR';

export type SubscriptionStatus = 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'SUSPENDED';

export interface DealerSubscription {
  plan: SubscriptionPlan;
  startDate: string;
  expiryDate: string;
  status: SubscriptionStatus;
  autoRenew?: boolean;
}

export interface Dealer {
  id: string;
  name: string;
  code: string;
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  subscription: DealerSubscription;
  active: boolean;
  isSoftDeleted?: boolean;
  deletedAt?: string;
  createdAt: string;
}

export interface OrderTakerLocation {
  orderTakerId?: string;
  dealerId?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  lastUpdated: string;
  addressLabel?: string;
}

export interface OrderTaker {
  id: string;
  dealerId: string;
  name: string; // Full Name
  fullName?: string; // Explicit alias for Full Name
  username: string;
  employeeCode: string;
  phone: string;
  email: string;
  password?: string;
  active: boolean; // Status: Active (true) or Inactive (false)
  status?: 'ACTIVE' | 'INACTIVE'; // Enum alias
  isSoftDeleted?: boolean; // For preserving historical orders/invoices safely
  deletedAt?: string;
  onlineStatus: 'ONLINE' | 'OFFLINE';
  lastSeenAt?: string;
  locationSharingEnabled: boolean;
  lastLocation?: OrderTakerLocation;
  createdAt: string;
  updatedAt?: string;
}

export interface CustomerShop {
  id: string;
  dealerId: string;
  shopName: string;
  ownerName: string; // Contact person
  contactPerson?: string; // Explicit alias for contact person
  phone: string;
  alternatePhone?: string;
  city: string;
  area?: string;
  address: string;
  openingBalance: number;
  currentBalance: number; // Positive = Receivable (Shop owes Dealer)
  status: 'ACTIVE' | 'INACTIVE';
  creditLimit?: number;
  isSoftDeleted?: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Product {
  id: string;
  dealerId: string;
  name: string; // Product Name (human-readable)
  productName?: string; // Optional alias for compatibility
  sku: string;
  category: string;
  unit: string; // e.g. Pieces, Boxes, Cartons, Kg, Packs, Liters, Dozens
  buyPrice: number;
  salePrice: number;
  profitPerUnit?: number; // Calculated: salePrice - buyPrice
  stock: number; // Current available stock quantity
  stockQuantity?: number; // Optional alias for compatibility
  minStockAlert: number; // Low stock alert threshold
  lowStockThreshold?: number; // Optional alias for compatibility
  status: 'ACTIVE' | 'INACTIVE';
  isSoftDeleted?: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  quantity: number;
  salePrice: number;
  discountPercent: number;
  discountAmount: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  dealerId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  orderTakerId: string;
  orderTakerName: string;
  items: OrderItem[];
  subtotal: number;
  totalDiscount: number;
  grandTotal: number;
  status: 'CONFIRMED' | 'DELIVERED' | 'CANCELLED';
  invoiceId: string;
  createdAt: string;
  notes?: string;
  clientRequestId?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  dealerId: string;
  dealerName: string;
  dealerPhone: string;
  dealerAddress: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  orderTakerId: string;
  orderTakerName: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID';
  cancelled?: boolean; // the order was cancelled; this invoice no longer counts
  date: string;
  printedCount: number;
  notes?: string;
}

export type StockTransactionType =
  | 'SALE_DEDUCTION'
  | 'RETURN_ADDITION'
  | 'INITIAL_STOCK'
  | 'OPENING_STOCK'
  | 'MANUAL_ADJUSTMENT'
  | 'CANCEL_RESTORE'
  | 'RESTOCK';

export interface StockTransaction {
  id: string;
  dealerId: string;
  productId: string;
  productName: string;
  sku: string;
  type: StockTransactionType;
  quantityChange: number; // negative for sales, positive for returns/restock
  previousStock: number;
  newStock: number;
  referenceId: string;
  referenceType: 'ORDER' | 'RETURN' | 'AUDIT' | 'MANUAL';
  timestamp: string;
  note?: string;
}

export interface CustomerLedgerEntry {
  id: string;
  dealerId: string;
  customerId: string;
  customerName: string;
  date: string;
  invoiceNo?: string;
  referenceType: 'SALE_INVOICE' | 'PAYMENT_RECEIVED' | 'SALES_RETURN' | 'OPENING_BALANCE' | 'ORDER_CANCELLED';
  description: string;
  debit: number; // Increases customer debt
  credit: number; // Decreases customer debt
  balance: number; // Running balance
}

export interface SalesReturn {
  id: string;
  dealerId: string;
  returnNumber: string;
  invoiceNumber?: string;
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  returnedQuantity: number;
  unitRefundPrice: number;
  totalRefundAmount: number;
  reason: string;
  date: string;
}

export interface PrinterSetting {
  id: string;
  dealerId: string;
  printerName: string;
  printerType: 'THERMAL_80MM' | 'A4_OFFICE_LASER' | 'A5_HALF_PAGE';
  paperSize: '80mm' | 'A4' | 'A5';
  isDefault: boolean;
  autoPrintOnConfirm: boolean;
  copies: number;
  headerNotes?: string;
  footerNotes?: string;
}

// ---- Phase 9: Payments, Recovery & Expenses ----
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'EASYPAISA_JAZZCASH' | 'CHEQUE';

export interface Payment {
  id: string;
  dealerId: string;
  receiptNumber: string;
  customerId: string;
  customerName: string;
  amount: number;
  method: PaymentMethod;
  invoiceNumbers: string[]; // invoices this payment was applied to (oldest first)
  notes?: string;
  receivedBy?: string;
  date: string;
  balanceAfter: number;
}

export type ExpenseCategory =
  | 'RENT'
  | 'SALARY'
  | 'FUEL_TRANSPORT'
  | 'UTILITIES'
  | 'REPAIRS'
  | 'MARKETING'
  | 'OTHER';

export interface Expense {
  id: string;
  dealerId: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  date: string; // ISO
  createdAt: string;
}

export interface ReminderLog {
  id: string;
  dealerId: string;
  customerId: string;
  channel: 'WHATSAPP' | 'CALL' | 'SMS';
  note?: string;
  promisedDate?: string; // customer's promise to pay (YYYY-MM-DD)
  date: string;
}
