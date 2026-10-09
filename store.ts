import {
  Dealer,
  OrderTaker,
  CustomerShop,
  Product,
  Order,
  OrderItem,
  Invoice,
  StockTransaction,
  StockTransactionType,
  CustomerLedgerEntry,
  SalesReturn,
  PrinterSetting,
  Payment,
  PaymentMethod,
  Expense,
  ExpenseCategory,
  ReminderLog,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../types';
import { confirmOrder, markDelivered, cancelOrder, OrderBook } from '../shared/orders';
import { calculateExpiryDate, computeSubscriptionStatus } from '../utils/subscription';

const STORAGE_KEY = 'mysaleflo_database_v1';
// Demo data is for development only. A production build starts empty and gets its data from the server.
const SEED_DEMO = !import.meta.env?.PROD;

interface AppDatabase {
  dealers: Dealer[];
  orderTakers: OrderTaker[];
  customers: CustomerShop[];
  products: Product[];
  orders: Order[];
  invoices: Invoice[];
  stockTransactions: StockTransaction[];
  ledgerEntries: CustomerLedgerEntry[];
  returns: SalesReturn[];
  printerSettings: PrinterSetting[];
  // Phase 9 (optional so older saved data still loads)
  payments?: Payment[];
  expenses?: Expense[];
  reminders?: ReminderLog[];
}

const INITIAL_DEALERS: Dealer[] = [
  {
    id: 'dealer-apex-101',
    name: 'Apex Distribution Ltd',
    code: 'APEX-101',
    contactPerson: 'Mian Tariq Jameel',
    phone: '+92 300 8472910',
    email: 'admin@apexdistributors.pk',
    city: 'Karachi',
    address: 'Plot 42-B, Korangi Industrial Area, Sector 15',
    active: true,
    subscription: {
      plan: '1_YEAR',
      startDate: '2026-01-01',
      expiryDate: '2026-12-31',
      status: 'ACTIVE',
      autoRenew: true,
    },
    createdAt: '2026-01-01T08:00:00Z',
  },
  {
    id: 'dealer-metro-202',
    name: 'Metro Wholesale Supply',
    code: 'METRO-202',
    contactPerson: 'Chaudhry Riaz Ahmed',
    phone: '+92 321 4492819',
    email: 'accounts@metrowholesale.pk',
    city: 'Lahore',
    address: 'Warehouse #8, Circular Road Commercial Hub',
    active: true,
    subscription: {
      plan: '1_MONTH',
      startDate: '2026-09-15',
      expiryDate: '2026-10-15',
      status: 'ACTIVE',
      autoRenew: false,
    },
    createdAt: '2026-09-15T10:00:00Z',
  },
  {
    id: 'dealer-sub-expired-303',
    name: 'Frontier FMCG Traders',
    code: 'FRONTIER-303',
    contactPerson: 'Zia-ur-Rahman',
    phone: '+92 333 9182746',
    email: 'zia@frontierfmcg.pk',
    city: 'Peshawar',
    address: 'Shop 14, Ashraf Road Wholesale Market',
    active: false,
    subscription: {
      plan: '1_MONTH',
      startDate: '2026-08-01',
      expiryDate: '2026-09-01',
      status: 'EXPIRED',
      autoRenew: false,
    },
    createdAt: '2026-08-01T09:00:00Z',
  },
];

const INITIAL_ORDER_TAKERS: OrderTaker[] = [
  {
    id: 'ot-apex-01',
    dealerId: 'dealer-apex-101',
    name: 'Tariq Mahmood',
    username: 'tariq.sales',
    employeeCode: 'OT-APX-01',
    phone: '+92 301 5551234',
    email: 'tariq.sales@apexdistributors.pk',
    password: 'password123',
    active: true,
    onlineStatus: 'ONLINE',
    locationSharingEnabled: true,
    lastLocation: {
      latitude: 24.8607,
      longitude: 67.0011,
      accuracy: 12,
      lastUpdated: '2026-10-01T09:02:15Z',
      addressLabel: 'Saddar Electronics & FMCG Market, Karachi',
    },
    createdAt: '2026-01-10T09:00:00Z',
  },
  {
    id: 'ot-apex-02',
    dealerId: 'dealer-apex-101',
    name: 'Kamran Raza',
    username: 'kamran.raza',
    employeeCode: 'OT-APX-02',
    phone: '+92 302 9998877',
    email: 'kamran.raza@apexdistributors.pk',
    password: 'password123',
    active: true,
    onlineStatus: 'OFFLINE',
    locationSharingEnabled: false,
    lastLocation: {
      latitude: 24.9056,
      longitude: 67.0822,
      accuracy: 25,
      lastUpdated: '2026-09-30T17:45:00Z',
      addressLabel: 'Gulshan-e-Iqbal Block 13-D, Karachi',
    },
    createdAt: '2026-01-15T11:00:00Z',
  },
  {
    id: 'ot-metro-01',
    dealerId: 'dealer-metro-202',
    name: 'Usman Ali Cheema',
    username: 'usman.sales',
    employeeCode: 'OT-MTR-01',
    phone: '+92 322 7776655',
    email: 'usman.sales@metrowholesale.pk',
    password: 'password123',
    active: true,
    onlineStatus: 'ONLINE',
    locationSharingEnabled: true,
    lastLocation: {
      latitude: 31.5204,
      longitude: 74.3587,
      accuracy: 15,
      lastUpdated: '2026-10-01T08:50:30Z',
      addressLabel: 'Mall Road Wholesale District, Lahore',
    },
    createdAt: '2026-09-16T08:30:00Z',
  },
];

const INITIAL_CUSTOMERS: CustomerShop[] = [
  // Apex Customers
  {
    id: 'cust-apx-01',
    dealerId: 'dealer-apex-101',
    shopName: 'Al-Madina Super Store',
    ownerName: 'Haji Muhammad Shafiq',
    contactPerson: 'Haji Muhammad Shafiq',
    phone: '+92 300 2198734',
    city: 'Karachi',
    area: 'Burns Road',
    address: 'Shop 12-14, Main Burns Road',
    openingBalance: 15000,
    currentBalance: 32500,
    status: 'ACTIVE',
    creditLimit: 100000,
    createdAt: '2026-01-12T10:00:00Z',
  },
  {
    id: 'cust-apx-abc',
    dealerId: 'dealer-apex-101',
    shopName: 'ABC General Store',
    ownerName: 'Muhammad Tariq',
    contactPerson: 'Muhammad Tariq',
    phone: '0300-1234567',
    alternatePhone: '0321-9876543',
    city: 'Karachi',
    area: 'Main Market',
    address: 'Shop 5, Block B, Main Market',
    openingBalance: 10000,
    currentBalance: 10000,
    status: 'ACTIVE',
    creditLimit: 75000,
    createdAt: '2026-01-14T11:00:00Z',
  },
  {
    id: 'cust-apx-ahmed',
    dealerId: 'dealer-apex-101',
    shopName: 'Ahmed Traders',
    ownerName: 'Ahmed Ali Khan',
    contactPerson: 'Ahmed Ali Khan',
    phone: '0301-4455667',
    city: 'Karachi',
    area: 'Tariq Road',
    address: 'Plaza 22, Commercial Area, Tariq Road',
    openingBalance: 5000,
    currentBalance: 8500,
    status: 'ACTIVE',
    creditLimit: 50000,
    createdAt: '2026-01-15T09:30:00Z',
  },
  {
    id: 'cust-apx-bilal',
    dealerId: 'dealer-apex-101',
    shopName: 'Bilal Mart',
    ownerName: 'Bilal Hussain',
    contactPerson: 'Bilal Hussain',
    phone: '0333-8899112',
    city: 'Karachi',
    area: 'Gulshan-e-Iqbal',
    address: 'Plot 104, Block 6, Gulshan-e-Iqbal',
    openingBalance: 0,
    currentBalance: 14200,
    status: 'ACTIVE',
    creditLimit: 80000,
    createdAt: '2026-01-18T14:00:00Z',
  },
  {
    id: 'cust-apx-city',
    dealerId: 'dealer-apex-101',
    shopName: 'City Super Store',
    ownerName: 'Farhan Sheikh',
    contactPerson: 'Farhan Sheikh',
    phone: '0345-2233445',
    city: 'Karachi',
    area: 'Clifton',
    address: 'Near 3 Talwar, Main Clifton Road',
    openingBalance: 20000,
    currentBalance: 20000,
    status: 'ACTIVE',
    creditLimit: 120000,
    createdAt: '2026-01-20T16:00:00Z',
  },
  {
    id: 'cust-apx-02',
    dealerId: 'dealer-apex-101',
    shopName: 'Bismillah Cash & Carry',
    ownerName: 'Sheikh Waqas Ahmed',
    contactPerson: 'Sheikh Waqas Ahmed',
    phone: '+92 333 4872190',
    city: 'Karachi',
    area: 'Bahadurabad',
    address: 'Plot 88, Bahadurabad Main Market',
    openingBalance: 0,
    currentBalance: 12400,
    status: 'ACTIVE',
    creditLimit: 80000,
    createdAt: '2026-01-15T12:00:00Z',
  },
  {
    id: 'cust-apx-03',
    dealerId: 'dealer-apex-101',
    shopName: 'Zubair Mart & Departmental Store',
    ownerName: 'Zubair Farooqi',
    contactPerson: 'Zubair Farooqi',
    phone: '+92 312 9012384',
    city: 'Karachi',
    area: 'Gulistan-e-Jauhar',
    address: 'Commercial Block 7, Gulistan-e-Jauhar',
    openingBalance: 5000,
    currentBalance: 5000,
    status: 'ACTIVE',
    creditLimit: 50000,
    createdAt: '2026-02-01T09:00:00Z',
  },
  {
    id: 'cust-apx-04',
    dealerId: 'dealer-apex-101',
    shopName: 'Rahman General Store',
    ownerName: 'Abdul Rahman',
    contactPerson: 'Abdul Rahman',
    phone: '+92 345 6789012',
    city: 'Karachi',
    area: 'North Nazimabad',
    address: 'Main Chowk, North Nazimabad Block C',
    openingBalance: 0,
    currentBalance: 0,
    status: 'ACTIVE',
    creditLimit: 30000,
    createdAt: '2026-02-10T14:00:00Z',
  },
  // Metro Customers
  {
    id: 'cust-mtr-01',
    dealerId: 'dealer-metro-202',
    shopName: 'Chenab Traders',
    ownerName: 'Chaudhry Nisar',
    contactPerson: 'Chaudhry Nisar',
    phone: '+92 321 8899001',
    city: 'Lahore',
    area: 'Akbari Mandi',
    address: 'Akbari Mandi Grain Market, Shop 45',
    openingBalance: 25000,
    currentBalance: 48000,
    status: 'ACTIVE',
    creditLimit: 150000,
    createdAt: '2026-09-18T10:00:00Z',
  },
  {
    id: 'cust-mtr-02',
    dealerId: 'dealer-metro-202',
    shopName: 'Sultan Grocery Center',
    ownerName: 'Malik Sultan',
    contactPerson: 'Malik Sultan',
    phone: '+92 334 1122334',
    city: 'Lahore',
    area: 'Model Town',
    address: 'Model Town Link Road, Plaza 2',
    openingBalance: 0,
    currentBalance: 16500,
    status: 'ACTIVE',
    creditLimit: 60000,
    createdAt: '2026-09-20T11:00:00Z',
  },
];

const INITIAL_PRODUCTS: Product[] = [
  // Apex Products
  {
    id: 'prod-apx-coca-15l',
    dealerId: 'dealer-apex-101',
    name: 'Coca Cola 1.5L',
    sku: 'KO-1500ML',
    category: 'Beverages',
    unit: 'Bottles',
    buyPrice: 150,
    salePrice: 180,
    stock: 250,
    minStockAlert: 30,
    status: 'ACTIVE',
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'prod-apx-coca-500ml',
    dealerId: 'dealer-apex-101',
    name: 'Coca Cola 500ml',
    sku: 'KO-500ML',
    category: 'Beverages',
    unit: 'Bottles',
    buyPrice: 85,
    salePrice: 100,
    stock: 320,
    minStockAlert: 40,
    status: 'ACTIVE',
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'prod-apx-coca-can',
    dealerId: 'dealer-apex-101',
    name: 'Coca Cola Can',
    sku: 'KO-250CAN',
    category: 'Beverages',
    unit: 'Cans',
    buyPrice: 95,
    salePrice: 120,
    stock: 180,
    minStockAlert: 25,
    status: 'ACTIVE',
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'prod-apx-pepsi-15l',
    dealerId: 'dealer-apex-101',
    name: 'Pepsi 1.5L',
    sku: 'PEP-1500ML',
    category: 'Beverages',
    unit: 'Bottles',
    buyPrice: 145,
    salePrice: 175,
    stock: 220,
    minStockAlert: 30,
    status: 'ACTIVE',
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'prod-apx-pepsi-500ml',
    dealerId: 'dealer-apex-101',
    name: 'Pepsi 500ml',
    sku: 'PEP-500ML',
    category: 'Beverages',
    unit: 'Bottles',
    buyPrice: 80,
    salePrice: 95,
    stock: 280,
    minStockAlert: 35,
    status: 'ACTIVE',
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'prod-apx-milk-1l',
    dealerId: 'dealer-apex-101',
    name: 'Milk 1L',
    sku: 'MLK-1000ML',
    category: 'Dairy',
    unit: 'Packs',
    buyPrice: 240,
    salePrice: 280,
    stock: 160,
    minStockAlert: 20,
    status: 'ACTIVE',
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'prod-apx-milk-500ml',
    dealerId: 'dealer-apex-101',
    name: 'Milk 500ml',
    sku: 'MLK-500ML',
    category: 'Dairy',
    unit: 'Packs',
    buyPrice: 130,
    salePrice: 155,
    stock: 190,
    minStockAlert: 25,
    status: 'ACTIVE',
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'prod-apx-biscuits-fam',
    dealerId: 'dealer-apex-101',
    name: 'Biscuits Family Pack',
    sku: 'BSC-FAMPACK',
    category: 'Confectionery',
    unit: 'Packs',
    buyPrice: 190,
    salePrice: 230,
    stock: 140,
    minStockAlert: 20,
    status: 'ACTIVE',
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'prod-apx-01',
    dealerId: 'dealer-apex-101',
    name: 'Classic Cola 1.5L (Pack of 6)',
    sku: 'CC-1500P6',
    category: 'Beverages',
    unit: 'Packs',
    buyPrice: 650,
    salePrice: 780,
    stock: 140,
    minStockAlert: 20,
    status: 'ACTIVE',
    createdAt: '2026-01-05T09:00:00Z',
  },
  {
    id: 'prod-apx-02',
    dealerId: 'dealer-apex-101',
    name: 'Golden Valley Premium Tea 450g',
    sku: 'GVT-450',
    category: 'Hot Beverages',
    unit: 'Boxes',
    buyPrice: 460,
    salePrice: 550,
    stock: 85,
    minStockAlert: 15,
    status: 'ACTIVE',
    createdAt: '2026-01-05T09:30:00Z',
  },
  {
    id: 'prod-apx-03',
    dealerId: 'dealer-apex-101',
    name: 'Crispy Wave BBQ Chips 45g (Box of 24)',
    sku: 'CW-BBQ-24',
    category: 'Snacks',
    unit: 'Boxes',
    buyPrice: 840,
    salePrice: 1050,
    stock: 60,
    minStockAlert: 10,
    status: 'ACTIVE',
    createdAt: '2026-01-06T10:00:00Z',
  },
  {
    id: 'prod-apx-04',
    dealerId: 'dealer-apex-101',
    name: 'Sunflow Pure Cooking Oil 5L Bottle',
    sku: 'SPO-5L',
    category: 'Cooking Essentials',
    unit: 'Pieces',
    buyPrice: 2450,
    salePrice: 2750,
    stock: 35,
    minStockAlert: 12,
    status: 'ACTIVE',
    createdAt: '2026-01-06T11:00:00Z',
  },
  {
    id: 'prod-apx-05',
    dealerId: 'dealer-apex-101',
    name: 'Digestive Whole Wheat Biscuits (Pack of 12)',
    sku: 'DWB-12P',
    category: 'Confectionery',
    unit: 'Packs',
    buyPrice: 380,
    salePrice: 470,
    stock: 110,
    minStockAlert: 25,
    status: 'ACTIVE',
    createdAt: '2026-01-08T12:00:00Z',
  },
  {
    id: 'prod-apx-06',
    dealerId: 'dealer-apex-101',
    name: 'Crystal Pure Mineral Water 500ml (Carton of 24)',
    sku: 'CPM-500-24',
    category: 'Beverages',
    unit: 'Cartons',
    buyPrice: 520,
    salePrice: 650,
    stock: 8, // Low stock indicator!
    minStockAlert: 15,
    status: 'ACTIVE',
    createdAt: '2026-01-10T14:00:00Z',
  },
  // Metro Products
  {
    id: 'prod-mtr-01',
    dealerId: 'dealer-metro-202',
    name: 'Super Kernel Basmati Rice 10kg Bag',
    sku: 'SKB-10KG',
    category: 'Grains & Pulses',
    unit: 'Pieces',
    buyPrice: 3100,
    salePrice: 3600,
    stock: 45,
    minStockAlert: 10,
    status: 'ACTIVE',
    createdAt: '2026-09-17T09:00:00Z',
  },
  {
    id: 'prod-mtr-02',
    dealerId: 'dealer-metro-202',
    name: 'Pure Desi Ghee 1kg Tin',
    sku: 'PDG-1KG',
    category: 'Dairy & Fats',
    unit: 'Pieces',
    buyPrice: 1950,
    salePrice: 2350,
    stock: 30,
    minStockAlert: 8,
    status: 'ACTIVE',
    createdAt: '2026-09-17T09:30:00Z',
  },
];

const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord-apx-001',
    dealerId: 'dealer-apex-101',
    orderNumber: 'ORD-2026-0101',
    customerId: 'cust-apx-01',
    customerName: 'Al-Madina Super Store',
    customerPhone: '+92 300 2198734',
    orderTakerId: 'ot-apex-01',
    orderTakerName: 'Tariq Mahmood',
    items: [
      {
        productId: 'prod-apx-01',
        productName: 'Classic Cola 1.5L (Pack of 6)',
        sku: 'CC-1500P6',
        unit: 'Packs',
        quantity: 10,
        salePrice: 780,
        discountPercent: 0,
        discountAmount: 0,
        lineTotal: 7800,
      },
      {
        productId: 'prod-apx-02',
        productName: 'Golden Valley Premium Tea 450g',
        sku: 'GVT-450',
        unit: 'Boxes',
        quantity: 5,
        salePrice: 550,
        discountPercent: 0,
        discountAmount: 0,
        lineTotal: 2750,
      },
      {
        productId: 'prod-apx-04',
        productName: 'Sunflow Pure Cooking Oil 5L Bottle',
        sku: 'SPO-5L',
        unit: 'Pieces',
        quantity: 4,
        salePrice: 2750,
        discountPercent: 0,
        discountAmount: 0,
        lineTotal: 11000,
      },
    ],
    subtotal: 21550,
    totalDiscount: 0,
    grandTotal: 21550,
    status: 'CONFIRMED',
    invoiceId: 'inv-apx-001',
    createdAt: '2026-09-28T11:20:00Z',
    notes: 'Urgent delivery before evening market rush',
  },
  {
    id: 'ord-apx-002',
    dealerId: 'dealer-apex-101',
    orderNumber: 'ORD-2026-0102',
    customerId: 'cust-apx-02',
    customerName: 'Bismillah Cash & Carry',
    customerPhone: '+92 333 4872190',
    orderTakerId: 'ot-apex-01',
    orderTakerName: 'Tariq Mahmood',
    items: [
      {
        productId: 'prod-apx-03',
        productName: 'Crispy Wave BBQ Chips 45g (Box of 24)',
        sku: 'CW-BBQ-24',
        unit: 'Boxes',
        quantity: 8,
        salePrice: 1050,
        discountPercent: 0,
        discountAmount: 0,
        lineTotal: 8400,
      },
      {
        productId: 'prod-apx-05',
        productName: 'Digestive Whole Wheat Biscuits (Pack of 12)',
        sku: 'DWB-12P',
        unit: 'Packs',
        quantity: 10,
        salePrice: 470,
        discountPercent: 0,
        discountAmount: 0,
        lineTotal: 4700,
      },
    ],
    subtotal: 13100,
    totalDiscount: 700,
    grandTotal: 12400,
    status: 'CONFIRMED',
    invoiceId: 'inv-apx-002',
    createdAt: '2026-09-29T14:15:00Z',
    notes: 'Regular weekly stock replenishing',
  },
];

const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'inv-apx-001',
    invoiceNumber: 'INV-2026-0101',
    orderId: 'ord-apx-001',
    dealerId: 'dealer-apex-101',
    dealerName: 'Apex Distribution Ltd',
    dealerPhone: '+92 300 8472910',
    dealerAddress: 'Plot 42-B, Korangi Industrial Area, Sector 15, Karachi',
    customerId: 'cust-apx-01',
    customerName: 'Al-Madina Super Store',
    customerPhone: '+92 300 2198734',
    customerAddress: 'Shop 12-14, Main Burns Road, Karachi',
    orderTakerId: 'ot-apex-01',
    orderTakerName: 'Tariq Mahmood',
    items: INITIAL_ORDERS[0].items,
    subtotal: 21550,
    discount: 0,
    grandTotal: 21550,
    paidAmount: 4050,
    dueAmount: 17500,
    paymentStatus: 'PARTIAL',
    date: '2026-09-28T11:20:00Z',
    printedCount: 1,
    notes: 'Urgent delivery before evening market rush',
  },
  {
    id: 'inv-apx-002',
    invoiceNumber: 'INV-2026-0102',
    orderId: 'ord-apx-002',
    dealerId: 'dealer-apex-101',
    dealerName: 'Apex Distribution Ltd',
    dealerPhone: '+92 300 8472910',
    dealerAddress: 'Plot 42-B, Korangi Industrial Area, Sector 15, Karachi',
    customerId: 'cust-apx-02',
    customerName: 'Bismillah Cash & Carry',
    customerPhone: '+92 333 4872190',
    customerAddress: 'Plot 88, Bahadurabad Main Market, Karachi',
    orderTakerId: 'ot-apex-01',
    orderTakerName: 'Tariq Mahmood',
    items: INITIAL_ORDERS[1].items,
    subtotal: 13100,
    discount: 700,
    grandTotal: 12400,
    paidAmount: 0,
    dueAmount: 12400,
    paymentStatus: 'UNPAID',
    date: '2026-09-29T14:15:00Z',
    printedCount: 2,
    notes: 'Regular weekly stock replenishing',
  },
];

const INITIAL_STOCK_TX: StockTransaction[] = [
  {
    id: 'stx-apx-001',
    dealerId: 'dealer-apex-101',
    productId: 'prod-apx-01',
    productName: 'Classic Cola 1.5L (Pack of 6)',
    sku: 'CC-1500P6',
    type: 'INITIAL_STOCK',
    quantityChange: 150,
    previousStock: 0,
    newStock: 150,
    referenceId: 'AUDIT-INIT',
    referenceType: 'AUDIT',
    timestamp: '2026-01-05T09:00:00Z',
    note: 'Initial opening stock intake',
  },
  {
    id: 'stx-apx-002',
    dealerId: 'dealer-apex-101',
    productId: 'prod-apx-01',
    productName: 'Classic Cola 1.5L (Pack of 6)',
    sku: 'CC-1500P6',
    type: 'SALE_DEDUCTION',
    quantityChange: -10,
    previousStock: 150,
    newStock: 140,
    referenceId: 'ord-apx-001',
    referenceType: 'ORDER',
    timestamp: '2026-09-28T11:20:00Z',
    note: 'Order #ORD-2026-0101 confirmed sale deduction',
  },
  {
    id: 'stx-apx-003',
    dealerId: 'dealer-apex-101',
    productId: 'prod-apx-02',
    productName: 'Golden Valley Premium Tea 450g',
    sku: 'GVT-450',
    type: 'SALE_DEDUCTION',
    quantityChange: -5,
    previousStock: 90,
    newStock: 85,
    referenceId: 'ord-apx-001',
    referenceType: 'ORDER',
    timestamp: '2026-09-28T11:20:00Z',
    note: 'Order #ORD-2026-0101 confirmed sale deduction',
  },
  {
    id: 'stx-apx-004',
    dealerId: 'dealer-apex-101',
    productId: 'prod-apx-04',
    productName: 'Sunflow Pure Cooking Oil 5L Bottle',
    sku: 'SPO-5L',
    type: 'SALE_DEDUCTION',
    quantityChange: -4,
    previousStock: 39,
    newStock: 35,
    referenceId: 'ord-apx-001',
    referenceType: 'ORDER',
    timestamp: '2026-09-28T11:20:00Z',
    note: 'Order #ORD-2026-0101 confirmed sale deduction',
  },
  {
    id: 'stx-apx-005',
    dealerId: 'dealer-apex-101',
    productId: 'prod-apx-03',
    productName: 'Crispy Wave BBQ Chips 45g (Box of 24)',
    sku: 'CW-BBQ-24',
    type: 'SALE_DEDUCTION',
    quantityChange: -8,
    previousStock: 68,
    newStock: 60,
    referenceId: 'ord-apx-002',
    referenceType: 'ORDER',
    timestamp: '2026-09-29T14:15:00Z',
    note: 'Order #ORD-2026-0102 confirmed sale deduction',
  },
  {
    id: 'stx-apx-006',
    dealerId: 'dealer-apex-101',
    productId: 'prod-apx-05',
    productName: 'Digestive Whole Wheat Biscuits (Pack of 12)',
    sku: 'DWB-12P',
    type: 'SALE_DEDUCTION',
    quantityChange: -10,
    previousStock: 120,
    newStock: 110,
    referenceId: 'ord-apx-002',
    referenceType: 'ORDER',
    timestamp: '2026-09-29T14:15:00Z',
    note: 'Order #ORD-2026-0102 confirmed sale deduction',
  },
];

const INITIAL_LEDGER: CustomerLedgerEntry[] = [
  {
    id: 'ledg-apx-001',
    dealerId: 'dealer-apex-101',
    customerId: 'cust-apx-01',
    customerName: 'Al-Madina Super Store',
    date: '2026-01-12T10:00:00Z',
    referenceType: 'OPENING_BALANCE',
    description: 'Opening Balance on onboarding',
    debit: 15000,
    credit: 0,
    balance: 15000,
  },
  {
    id: 'ledg-apx-002',
    dealerId: 'dealer-apex-101',
    customerId: 'cust-apx-01',
    customerName: 'Al-Madina Super Store',
    date: '2026-09-28T11:20:00Z',
    invoiceNo: 'INV-2026-0101',
    referenceType: 'SALE_INVOICE',
    description: 'Automatic sale invoice generated against Order ORD-2026-0101',
    debit: 21550,
    credit: 0,
    balance: 36550,
  },
  {
    id: 'ledg-apx-003',
    dealerId: 'dealer-apex-101',
    customerId: 'cust-apx-01',
    customerName: 'Al-Madina Super Store',
    date: '2026-09-28T12:00:00Z',
    invoiceNo: 'INV-2026-0101',
    referenceType: 'PAYMENT_RECEIVED',
    description: 'Cash payment received at time of delivery',
    debit: 0,
    credit: 4050,
    balance: 32500,
  },
  {
    id: 'ledg-apx-004',
    dealerId: 'dealer-apex-101',
    customerId: 'cust-apx-02',
    customerName: 'Bismillah Cash & Carry',
    date: '2026-09-29T14:15:00Z',
    invoiceNo: 'INV-2026-0102',
    referenceType: 'SALE_INVOICE',
    description: 'Automatic sale invoice generated against Order ORD-2026-0102',
    debit: 12400,
    credit: 0,
    balance: 12400,
  },
];

const INITIAL_RETURNS: SalesReturn[] = [
  {
    id: 'ret-apx-001',
    dealerId: 'dealer-apex-101',
    returnNumber: 'RET-2026-0001',
    invoiceNumber: 'INV-2026-0090',
    customerId: 'cust-apx-03',
    customerName: 'Zubair Mart & Departmental Store',
    productId: 'prod-apx-05',
    productName: 'Digestive Whole Wheat Biscuits (Pack of 12)',
    returnedQuantity: 2,
    unitRefundPrice: 470,
    totalRefundAmount: 940,
    reason: 'Packaging slightly damaged in carton transit',
    date: '2026-09-25T16:00:00Z',
  },
];

const INITIAL_PRINTERS: PrinterSetting[] = [
  {
    id: 'prt-apx-01',
    dealerId: 'dealer-apex-101',
    printerName: 'Front Dispatch Thermal Printer (80mm)',
    printerType: 'THERMAL_80MM',
    paperSize: '80mm',
    isDefault: true,
    autoPrintOnConfirm: true,
    copies: 2,
    headerNotes: 'Apex Distribution Ltd — Official Sale Receipt',
    footerNotes: 'Thank you for your business. Goods once sold cannot be returned without original receipt.',
  },
  {
    id: 'prt-apx-02',
    dealerId: 'dealer-apex-101',
    printerName: 'Accounts Laser Printer (A4 Tax Invoice)',
    printerType: 'A4_OFFICE_LASER',
    paperSize: 'A4',
    isDefault: false,
    autoPrintOnConfirm: false,
    copies: 1,
    headerNotes: 'Apex Distribution Ltd — Commercial Sales Tax Invoice',
    footerNotes: 'Subject to Karachi Jurisdiction. Payment due within agreed credit terms.',
  },
  {
    id: 'prt-mtr-01',
    dealerId: 'dealer-metro-202',
    printerName: 'Main Counter Thermal (80mm)',
    printerType: 'THERMAL_80MM',
    paperSize: '80mm',
    isDefault: true,
    autoPrintOnConfirm: true,
    copies: 1,
    headerNotes: 'Metro Wholesale Supply — Commercial Slip',
    footerNotes: 'Inquiries: Call +92 321 4492819',
  },
];

class MultiTenantStore {
  private data: AppDatabase;

  constructor() {
    this.data = this.loadDatabase();
  }

  private loadDatabase(): AppDatabase {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Ensure new initial products (like Coca Cola, Pepsi, Milk) are present
        if (SEED_DEMO && parsed && Array.isArray(parsed.products)) {
          const existingIds = new Set(parsed.products.map((p: Product) => p.id));
          let merged = false;
          for (const initProd of INITIAL_PRODUCTS) {
            if (!existingIds.has(initProd.id)) {
              parsed.products.push(initProd);
              merged = true;
            }
          }
          if (merged) {
            this.saveDatabase(parsed);
          }
        }

        // Ensure new initial customer shops (like ABC General Store, Ahmed Traders) are present
        if (SEED_DEMO && parsed && Array.isArray(parsed.customers)) {
          const existingCustIds = new Set(parsed.customers.map((c: CustomerShop) => c.id));
          let custMerged = false;
          for (const initCust of INITIAL_CUSTOMERS) {
            if (!existingCustIds.has(initCust.id)) {
              parsed.customers.push(initCust);
              custMerged = true;
            }
          }
          if (custMerged) {
            this.saveDatabase(parsed);
          }
        }
        return parsed;
      }
    } catch {
      // Fallback if localStorage unavailable
    }
    const initialDb: AppDatabase = SEED_DEMO
      ? {
          dealers: INITIAL_DEALERS,
          orderTakers: INITIAL_ORDER_TAKERS,
          customers: INITIAL_CUSTOMERS,
          products: INITIAL_PRODUCTS,
          orders: INITIAL_ORDERS,
          invoices: INITIAL_INVOICES,
          stockTransactions: INITIAL_STOCK_TX,
          ledgerEntries: INITIAL_LEDGER,
          returns: INITIAL_RETURNS,
          printerSettings: INITIAL_PRINTERS,
        }
      : {
          dealers: [],
          orderTakers: [],
          customers: [],
          products: [],
          orders: [],
          invoices: [],
          stockTransactions: [],
          ledgerEntries: [],
          returns: [],
          printerSettings: [],
        };
    this.saveDatabase(initialDb);
    return initialDb;
  }

  private listeners = new Set<() => void>();

  // Phase 11: lets the sync service know whenever data changes
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private saveDatabase(data: AppDatabase) {
    this.data = data;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Could not write to localStorage:', e);
    }
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.warn('Store listener failed:', e);
      }
    });
  }

  // --- Reset to seed data ---
  public resetToSeedData() {
    const initialDb: AppDatabase = SEED_DEMO
      ? {
          dealers: INITIAL_DEALERS,
          orderTakers: INITIAL_ORDER_TAKERS,
          customers: INITIAL_CUSTOMERS,
          products: INITIAL_PRODUCTS,
          orders: INITIAL_ORDERS,
          invoices: INITIAL_INVOICES,
          stockTransactions: INITIAL_STOCK_TX,
          ledgerEntries: INITIAL_LEDGER,
          returns: INITIAL_RETURNS,
          printerSettings: INITIAL_PRINTERS,
        }
      : {
          dealers: [],
          orderTakers: [],
          customers: [],
          products: [],
          orders: [],
          invoices: [],
          stockTransactions: [],
          ledgerEntries: [],
          returns: [],
          printerSettings: [],
        };
    this.saveDatabase(initialDb);
    return initialDb;
  }

  // =========================================================================
  // 1. SUPER ADMIN METHODS (STRICT PRIVACY ENFORCED)
  // Super Admin CANNOT query products, prices, customers, orders, or invoices!
  // =========================================================================

  // Synchronize subscription statuses based on current date
  public syncSubscriptionStatuses(): void {
    const todayStr = new Date().toISOString().split('T')[0];
    let changed = false;

    for (const dealer of this.data.dealers) {
      if (!dealer.subscription) continue;
      const oldStatus = dealer.subscription.status;
      const newStatus = computeSubscriptionStatus(
        dealer.subscription.startDate,
        dealer.subscription.expiryDate,
        !dealer.active
      );

      if (oldStatus !== newStatus) {
        dealer.subscription.status = newStatus;
        changed = true;
      }
    }

    if (changed) {
      this.saveDatabase({ ...this.data });
    }
  }

  public getPlatformDealers(): Dealer[] {
    this.syncSubscriptionStatuses();
    return [...this.data.dealers];
  }

  public addDealer(dealerData: Omit<Dealer, 'id' | 'createdAt'>): Dealer {
    const timestamp = Date.now();
    const uniqueTenantId = `dealer-tenant-${timestamp}-${Math.floor(Math.random() * 1000)}`;

    const plan = dealerData.subscription.plan;
    const startDate = dealerData.subscription.startDate || new Date().toISOString().split('T')[0];
    const expiryDate =
      dealerData.subscription.expiryDate || calculateExpiryDate(startDate, plan);
    const status = computeSubscriptionStatus(startDate, expiryDate, !dealerData.active);

    const newDealer: Dealer = {
      ...dealerData,
      id: uniqueTenantId,
      code: dealerData.code || `DLR-${Math.floor(100 + Math.random() * 900)}`,
      subscription: {
        ...dealerData.subscription,
        startDate,
        expiryDate,
        status,
      },
      createdAt: new Date().toISOString(),
    };

    const updated = {
      ...this.data,
      dealers: [newDealer, ...this.data.dealers],
    };
    this.saveDatabase(updated);
    return newDealer;
  }

  public updateDealer(id: string, updates: Partial<Dealer>): Dealer {
    const updatedDealers = this.data.dealers.map((d) => (d.id === id ? { ...d, ...updates } : d));
    const target = updatedDealers.find((d) => d.id === id);
    if (!target) throw new Error('Dealer not found');

    if (updates.active !== undefined && target.subscription) {
      target.subscription.status = computeSubscriptionStatus(
        target.subscription.startDate,
        target.subscription.expiryDate,
        !target.active
      );
    }

    this.saveDatabase({ ...this.data, dealers: updatedDealers });
    return target;
  }

  public toggleDealerActive(id: string): Dealer {
    const dealer = this.data.dealers.find((d) => d.id === id);
    if (!dealer) throw new Error('Dealer not found');
    const nextActive = !dealer.active;
    return this.updateDealer(id, { active: nextActive });
  }

  public updateDealerSubscription(
    dealerId: string,
    plan: SubscriptionPlan,
    startDate: string,
    expiryDate: string,
    status?: SubscriptionStatus,
    autoRenew: boolean = true
  ): Dealer {
    const dealer = this.data.dealers.find((d) => d.id === dealerId);
    if (!dealer) throw new Error('Dealer not found');

    if (expiryDate < startDate) {
      throw new Error('Subscription expiry date cannot be earlier than start date.');
    }

    const computedStatus = status || computeSubscriptionStatus(startDate, expiryDate, !dealer.active);

    const nextActive = (computedStatus === 'ACTIVE' || computedStatus === 'EXPIRING_SOON') ? true : dealer.active;

    return this.updateDealer(dealerId, {
      active: nextActive,
      subscription: {
        plan,
        startDate,
        expiryDate,
        status: computedStatus,
        autoRenew,
      },
    });
  }

  public checkDealerHistoricalRecords(dealerId: string): {
    hasRecords: boolean;
    ordersCount: number;
    invoicesCount: number;
    productsCount: number;
    customersCount: number;
    orderTakersCount: number;
    stockTxCount: number;
    ledgerCount: number;
    returnsCount: number;
    summary: string;
  } {
    const ordersCount = this.data.orders.filter((o) => o.dealerId === dealerId).length;
    const invoicesCount = this.data.invoices.filter((i) => i.dealerId === dealerId).length;
    const productsCount = this.data.products.filter((p) => p.dealerId === dealerId).length;
    const customersCount = this.data.customers.filter((c) => c.dealerId === dealerId).length;
    const orderTakersCount = this.data.orderTakers.filter((o) => o.dealerId === dealerId).length;
    const stockTxCount = this.data.stockTransactions.filter((s) => s.dealerId === dealerId).length;
    const ledgerCount = this.data.ledgerEntries.filter((l) => l.dealerId === dealerId).length;
    const returnsCount = this.data.returns.filter((r) => r.dealerId === dealerId).length;

    const total =
      ordersCount +
      invoicesCount +
      productsCount +
      customersCount +
      orderTakersCount +
      stockTxCount +
      ledgerCount +
      returnsCount;

    return {
      hasRecords: total > 0,
      ordersCount,
      invoicesCount,
      productsCount,
      customersCount,
      orderTakersCount,
      stockTxCount,
      ledgerCount,
      returnsCount,
      summary: total > 0
        ? `Found ${ordersCount} orders, ${invoicesCount} invoices, ${customersCount} customers, and ${productsCount} products. Safe deletion rule applies.`
        : 'Zero business records found. Physical deletion is safe.',
    };
  }

  public safeDeleteDealer(id: string): {
    success: boolean;
    softDeleted: boolean;
    message: string;
    dealerName: string;
  } {
    const dealer = this.data.dealers.find((d) => d.id === id);
    if (!dealer) throw new Error('Dealer not found');

    const analysis = this.checkDealerHistoricalRecords(id);

    // Section 19: If Dealer has historical or business records, DO NOT physically destroy the data!
    if (analysis.hasRecords) {
      this.updateDealer(id, {
        active: false,
        isSoftDeleted: true,
      });

      return {
        success: true,
        softDeleted: true,
        dealerName: dealer.name,
        message: `Dealer '${dealer.name}' has historical business records (${analysis.ordersCount} orders, ${analysis.invoicesCount} invoices). To protect financial records from corruption, this Dealer account has been safely deactivated & suspended. All historical archives remain intact.`,
      };
    }

    // Zero records: safe to hard delete
    const dealerName = dealer.name;
    const remainingDealers = this.data.dealers.filter((d) => d.id !== id);
    this.saveDatabase({ ...this.data, dealers: remainingDealers });

    return {
      success: true,
      softDeleted: false,
      dealerName,
      message: `Dealer '${dealerName}' had no historical records and was permanently removed safely.`,
    };
  }

  public deleteDealer(id: string): boolean {
    const res = this.safeDeleteDealer(id);
    return res.success;
  }

  // =========================================================================
  // 2. DEALER ISOLATED QUERY & MUTATION LAYER (MULTI-TENANT ENFORCEMENT)
  // Every query requires a verified dealerId. Dealer A can never see Dealer B!
  // =========================================================================

  // Dealers come from the server (the server decides the dealer ID). Returns true if anything changed.
  public upsertDealers(dealers: Dealer[], replaceAll = false): boolean {
    const incoming = new Map(dealers.map((d) => [d.id, d]));
    const kept = replaceAll ? [] : this.data.dealers.filter((d) => !incoming.has(d.id));
    const next = [...dealers, ...kept];
    if (JSON.stringify(next) === JSON.stringify(this.data.dealers)) return false;
    this.saveDatabase({ ...this.data, dealers: next });
    return true;
  }

  // Order taker phones only: while orders wait to be sent, keep their stock out of the picture shown on this phone
  public reserveLocalStock(dealerId: string, reserved: Record<string, number>): void {
    const ids = Object.keys(reserved);
    if (ids.length === 0) return;
    this.saveDatabase({
      ...this.data,
      products: this.data.products.map((p) =>
        p.dealerId === dealerId && reserved[p.id] ? { ...p, stock: Math.max(0, p.stock - reserved[p.id]) } : p
      ),
    });
  }

  public getDealerById(dealerId: string): Dealer | undefined {
    return this.data.dealers.find((d) => d.id === dealerId);
  }

  public getDealerProducts(dealerId: string, includeArchived = false): Product[] {
    return this.data.products.filter(
      (p) => p.dealerId === dealerId && (includeArchived ? true : !p.isSoftDeleted)
    );
  }

  public getDealerCustomers(dealerId: string, includeArchived = false): CustomerShop[] {
    return this.data.customers.filter(
      (c) => c.dealerId === dealerId && (includeArchived ? true : !c.isSoftDeleted)
    );
  }

  public getDealerOrderTakers(dealerId: string, includeArchived = false): OrderTaker[] {
    return this.data.orderTakers.filter(
      (ot) => ot.dealerId === dealerId && (includeArchived || !ot.isSoftDeleted)
    );
  }

  public getDealerOrders(dealerId: string): Order[] {
    return this.data.orders.filter((o) => o.dealerId === dealerId);
  }

  public getDealerInvoices(dealerId: string): Invoice[] {
    return this.data.invoices.filter((inv) => inv.dealerId === dealerId);
  }

  public getDealerStockTransactions(dealerId: string): StockTransaction[] {
    return this.data.stockTransactions.filter((st) => st.dealerId === dealerId);
  }

  public getDealerLedger(dealerId: string, customerId?: string): CustomerLedgerEntry[] {
    return this.data.ledgerEntries.filter(
      (l) => l.dealerId === dealerId && (!customerId || l.customerId === customerId)
    );
  }

  public getDealerReturns(dealerId: string): SalesReturn[] {
    return this.data.returns.filter((r) => r.dealerId === dealerId);
  }


  // =========================================================================
  // PHASE 9: PAYMENTS, RECOVERY REMINDERS, EXPENSES (dealer-scoped)
  // =========================================================================
  public getDealerPayments(dealerId: string): Payment[] {
    return (this.data.payments || []).filter((p) => p.dealerId === dealerId);
  }

  public getDealerExpenses(dealerId: string): Expense[] {
    return (this.data.expenses || []).filter((e) => e.dealerId === dealerId);
  }

  public getDealerReminders(dealerId: string): ReminderLog[] {
    return (this.data.reminders || []).filter((r) => r.dealerId === dealerId);
  }

  // Record a payment from a customer: credits the ledger, lowers the balance,
  // applies the amount to the oldest unpaid invoices and issues a receipt.
  public recordPayment(
    dealerId: string,
    payload: { customerId: string; amount: number; method: PaymentMethod; notes?: string; receivedBy?: string }
  ): Payment {
    const amount = Math.round(Number(payload.amount) * 100) / 100;
    if (!isFinite(amount) || amount <= 0) throw new Error('Payment amount must be greater than zero.');
    const customer = this.data.customers.find((c) => c.id === payload.customerId && c.dealerId === dealerId);
    if (!customer) throw new Error('Customer not found.');

    const nowIso = new Date().toISOString();
    const balanceAfter = customer.currentBalance - amount;

    // Apply to oldest unpaid invoices first
    let remaining = amount;
    const touched: string[] = [];
    const invoices = [...this.data.invoices]
      .map((inv, idx) => ({ inv, idx }))
      .filter(({ inv }) => inv.dealerId === dealerId && inv.customerId === customer.id && inv.dueAmount > 0)
      .sort((a, b) => a.inv.date.localeCompare(b.inv.date));
    const updatedInvoices = [...this.data.invoices];
    for (const { inv, idx } of invoices) {
      if (remaining <= 0) break;
      const apply = Math.min(remaining, inv.dueAmount);
      const paidAmount = inv.paidAmount + apply;
      const dueAmount = inv.dueAmount - apply;
      updatedInvoices[idx] = {
        ...inv,
        paidAmount,
        dueAmount,
        paymentStatus: dueAmount <= 0 ? 'PAID' : 'PARTIAL',
      };
      touched.push(inv.invoiceNumber);
      remaining -= apply;
    }

    const existing = this.data.payments || [];
    const receiptNumber = `RCT-${String(existing.length + 1).padStart(5, '0')}`;
    const payment: Payment = {
      id: `pay-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      dealerId,
      receiptNumber,
      customerId: customer.id,
      customerName: customer.shopName,
      amount,
      method: payload.method,
      invoiceNumbers: touched,
      notes: payload.notes,
      receivedBy: payload.receivedBy,
      date: nowIso,
      balanceAfter,
    };

    const ledgerEntry: CustomerLedgerEntry = {
      id: `ledg-pay-${Date.now()}`,
      dealerId,
      customerId: customer.id,
      customerName: customer.shopName,
      date: nowIso,
      invoiceNo: touched[0],
      referenceType: 'PAYMENT_RECEIVED',
      description: `Payment ${receiptNumber} (${payload.method.replace(/_/g, ' ')})${payload.notes ? ': ' + payload.notes : ''}`,
      debit: 0,
      credit: amount,
      balance: balanceAfter,
    };

    this.saveDatabase({
      ...this.data,
      invoices: updatedInvoices,
      customers: this.data.customers.map((c) => (c.id === customer.id ? { ...c, currentBalance: balanceAfter } : c)),
      ledgerEntries: [ledgerEntry, ...this.data.ledgerEntries],
      payments: [payment, ...existing],
    });
    return payment;
  }

  public addExpense(
    dealerId: string,
    payload: { category: ExpenseCategory; description: string; amount: number; date?: string }
  ): Expense {
    const amount = Number(payload.amount);
    if (!isFinite(amount) || amount <= 0) throw new Error('Expense amount must be greater than zero.');
    const expense: Expense = {
      id: `exp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      dealerId,
      category: payload.category,
      description: payload.description.trim() || payload.category,
      amount,
      date: payload.date ? new Date(payload.date + 'T12:00:00').toISOString() : new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    this.saveDatabase({ ...this.data, expenses: [expense, ...(this.data.expenses || [])] });
    return expense;
  }

  public deleteExpense(dealerId: string, expenseId: string): void {
    this.saveDatabase({
      ...this.data,
      expenses: (this.data.expenses || []).filter((e) => !(e.id === expenseId && e.dealerId === dealerId)),
    });
  }

  public logReminder(
    dealerId: string,
    payload: { customerId: string; channel: ReminderLog['channel']; note?: string; promisedDate?: string }
  ): ReminderLog {
    const customer = this.data.customers.find((c) => c.id === payload.customerId && c.dealerId === dealerId);
    if (!customer) throw new Error('Customer not found.');
    const log: ReminderLog = {
      id: `rem-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      dealerId,
      customerId: customer.id,
      channel: payload.channel,
      note: payload.note,
      promisedDate: payload.promisedDate,
      date: new Date().toISOString(),
    };
    this.saveDatabase({ ...this.data, reminders: [log, ...(this.data.reminders || [])] });
    return log;
  }


  // =========================================================================
  // PHASE 10: DEALER BACKUP & RESTORE (only this dealer's own records)
  // =========================================================================
  public exportDealerBackup(dealerId: string) {
    const d = this.data;
    const mine = <T extends { dealerId: string }>(arr: T[] | undefined) => (arr || []).filter((x) => x.dealerId === dealerId);
    return {
      app: 'My Saleflo',
      version: 1,
      dealerId,
      exportedAt: new Date().toISOString(),
      orderTakers: mine(d.orderTakers).map((o) => ({ ...o, password: undefined })), // never export passwords
      customers: mine(d.customers),
      products: mine(d.products),
      orders: mine(d.orders),
      invoices: mine(d.invoices),
      stockTransactions: mine(d.stockTransactions),
      ledgerEntries: mine(d.ledgerEntries),
      returns: mine(d.returns),
      printerSettings: mine(d.printerSettings),
      payments: mine(d.payments),
      expenses: mine(d.expenses),
      reminders: mine(d.reminders),
    };
  }

  // Replaces this dealer's business records with the backup. Other dealers are never touched.
  public restoreDealerBackup(dealerId: string, backup: any): { restored: number } {
    if (!backup || backup.app !== 'My Saleflo' || backup.version !== 1) {
      throw new Error('This is not a valid My Saleflo backup file.');
    }
    if (backup.dealerId !== dealerId) {
      throw new Error('This backup belongs to a different dealer and cannot be restored here.');
    }
    const keys = ['customers', 'products', 'orders', 'invoices', 'stockTransactions', 'ledgerEntries', 'returns', 'printerSettings', 'payments', 'expenses', 'reminders'] as const;
    for (const k of keys) {
      if (!Array.isArray(backup[k])) throw new Error(`Backup is missing "${k}".`);
      if (backup[k].some((r: any) => r?.dealerId !== dealerId)) {
        throw new Error(`Backup contains records that do not belong to this dealer ("${k}").`);
      }
    }
    const d: any = this.data;
    const next: any = { ...d };
    let restored = 0;
    for (const k of keys) {
      const others = (d[k] || []).filter((r: any) => r.dealerId !== dealerId);
      next[k] = [...backup[k], ...others];
      restored += backup[k].length;
    }
    this.saveDatabase(next);
    return { restored };
  }

  public getDealerPrinterSettings(dealerId: string): PrinterSetting[] {
    return this.data.printerSettings.filter((ps) => ps.dealerId === dealerId);
  }

  // --- Phase 3: Product Mutations with Full Tenant Isolation & Validation ---
  public addProduct(
    dealerId: string,
    data: {
      name: string;
      productName?: string;
      sku: string;
      category?: string;
      unit?: string;
      buyPrice: number;
      salePrice: number;
      stock?: number;
      openingStock?: number;
      minStockAlert?: number;
      lowStockThreshold?: number;
      status?: 'ACTIVE' | 'INACTIVE';
    }
  ): { product: Product; transaction?: StockTransaction } {
    const cleanName = (data.name || data.productName || '').trim();
    if (!cleanName) {
      throw new Error('Product Name is required and cannot be empty.');
    }

    const cleanSku = (data.sku || '').trim();
    if (!cleanSku) {
      throw new Error('SKU / Product Code is required and cannot be empty.');
    }

    // Section 6: SKU uniqueness within Dealer/Tenant scope
    const existingSku = this.data.products.find(
      (p) =>
        p.dealerId === dealerId &&
        p.sku.toLowerCase() === cleanSku.toLowerCase() &&
        !p.isSoftDeleted
    );
    if (existingSku) {
      throw new Error(`SKU '${cleanSku}' already exists in your product catalog. Please use a unique SKU.`);
    }

    const buyPrice = Number(data.buyPrice);
    if (isNaN(buyPrice) || buyPrice < 0) {
      throw new Error('Buy Price must be a valid, non-negative number.');
    }

    const salePrice = Number(data.salePrice);
    if (isNaN(salePrice) || salePrice < 0) {
      throw new Error('Sale Price must be a valid, non-negative number.');
    }

    const initialQty = Number(data.stock !== undefined ? data.stock : (data.openingStock || 0));
    if (isNaN(initialQty) || initialQty < 0) {
      throw new Error('Stock Quantity must be a valid, non-negative number.');
    }

    const minAlert = Number(
      data.minStockAlert !== undefined ? data.minStockAlert : (data.lowStockThreshold || 10)
    );
    if (isNaN(minAlert) || minAlert < 0) {
      throw new Error('Low Stock Alert Threshold must be a valid, non-negative number.');
    }

    // Section 11: Profit per unit calculated automatically
    const profitPerUnit = Number((salePrice - buyPrice).toFixed(2));
    const nowIso = new Date().toISOString();

    const newProduct: Product = {
      id: `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      dealerId,
      name: cleanName,
      productName: cleanName,
      sku: cleanSku,
      category: (data.category || 'General').trim(),
      unit: (data.unit || 'Pieces').trim(),
      buyPrice,
      salePrice,
      profitPerUnit,
      stock: initialQty,
      stockQuantity: initialQty,
      minStockAlert: minAlert,
      lowStockThreshold: minAlert,
      status: data.status || 'ACTIVE',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    let initialTx: StockTransaction | undefined;
    if (initialQty > 0) {
      initialTx = {
        id: `stx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        dealerId,
        productId: newProduct.id,
        productName: newProduct.name,
        sku: newProduct.sku,
        type: 'INITIAL_STOCK',
        quantityChange: initialQty,
        previousStock: 0,
        newStock: initialQty,
        referenceId: 'INITIAL-CATALOG',
        referenceType: 'AUDIT',
        timestamp: nowIso,
        note: `Opening stock initialized at ${initialQty} ${newProduct.unit}`,
      };
    }

    this.saveDatabase({
      ...this.data,
      products: [newProduct, ...this.data.products],
      stockTransactions: initialTx
        ? [initialTx, ...this.data.stockTransactions]
        : this.data.stockTransactions,
    });

    return { product: newProduct, transaction: initialTx };
  }

  public updateProduct(
    dealerId: string,
    productId: string,
    updates: Partial<Product>
  ): Product {
    const product = this.data.products.find(
      (p) => p.id === productId && p.dealerId === dealerId
    );
    if (!product) throw new Error('Product not found or unauthorized');

    if (updates.name !== undefined) {
      const clean = updates.name.trim();
      if (!clean) throw new Error('Product Name cannot be empty.');
      product.name = clean;
      product.productName = clean;
    }

    if (updates.sku !== undefined) {
      const cleanSku = updates.sku.trim();
      if (!cleanSku) throw new Error('SKU cannot be empty.');
      if (cleanSku.toLowerCase() !== product.sku.toLowerCase()) {
        const conflict = this.data.products.find(
          (p) =>
            p.dealerId === dealerId &&
            p.id !== productId &&
            p.sku.toLowerCase() === cleanSku.toLowerCase() &&
            !p.isSoftDeleted
        );
        if (conflict) {
          throw new Error(`SKU '${cleanSku}' is already used by product '${conflict.name}'.`);
        }
      }
      product.sku = cleanSku;
    }

    if (updates.category !== undefined) {
      product.category = updates.category.trim() || 'General';
    }

    if (updates.unit !== undefined) {
      product.unit = updates.unit.trim() || 'Pieces';
    }

    if (updates.buyPrice !== undefined) {
      const val = Number(updates.buyPrice);
      if (isNaN(val) || val < 0) throw new Error('Buy Price must be non-negative.');
      product.buyPrice = val;
    }

    if (updates.salePrice !== undefined) {
      const val = Number(updates.salePrice);
      if (isNaN(val) || val < 0) throw new Error('Sale Price must be non-negative.');
      product.salePrice = val;
    }

    // Recalculate profitPerUnit
    product.profitPerUnit = Number((product.salePrice - product.buyPrice).toFixed(2));

    if (updates.minStockAlert !== undefined || updates.lowStockThreshold !== undefined) {
      const val = Number(
        updates.minStockAlert !== undefined ? updates.minStockAlert : updates.lowStockThreshold
      );
      if (isNaN(val) || val < 0) throw new Error('Low Stock Threshold must be non-negative.');
      product.minStockAlert = val;
      product.lowStockThreshold = val;
    }

    if (updates.status !== undefined) {
      product.status = updates.status;
    }

    product.updatedAt = new Date().toISOString();

    const updatedList = this.data.products.map((p) =>
      p.id === productId && p.dealerId === dealerId ? { ...product } : p
    );

    this.saveDatabase({ ...this.data, products: updatedList });
    return product;
  }

  // Restock or adjust inventory with negative stock prevention & ledger logging
  public adjustProductStock(
    dealerId: string,
    productId: string,
    quantityChange: number,
    type: StockTransactionType = 'MANUAL_ADJUSTMENT',
    note: string = '',
    referenceId: string = 'MANUAL-ADJ',
    referenceType: 'MANUAL' | 'ORDER' | 'RETURN' | 'AUDIT' = 'MANUAL'
  ): { product: Product; transaction: StockTransaction } {
    const product = this.data.products.find(
      (p) => p.id === productId && p.dealerId === dealerId
    );
    if (!product) throw new Error('Product not found or unauthorized');

    const change = Number(quantityChange);
    if (isNaN(change) || change === 0) {
      throw new Error('Quantity change must be a valid non-zero number.');
    }

    const previousStock = product.stock;
    const newStock = previousStock + change;

    // Negative stock prevention protocol
    if (newStock < 0) {
      throw new Error(
        `Insufficient stock for '${product.name}'. Current stock is ${previousStock}, requested deduction is ${Math.abs(change)}. Stock cannot become negative.`
      );
    }

    product.stock = newStock;
    product.stockQuantity = newStock;
    product.updatedAt = new Date().toISOString();

    const transaction: StockTransaction = {
      id: `stx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      dealerId,
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      type,
      quantityChange: change,
      previousStock,
      newStock,
      referenceId,
      referenceType,
      timestamp: new Date().toISOString(),
      note: note.trim() || (change > 0 ? `Restocked +${change} units` : `Manual adjustment ${change} units`),
    };

    const updatedProducts = this.data.products.map((p) =>
      p.id === productId && p.dealerId === dealerId ? { ...product } : p
    );

    this.saveDatabase({
      ...this.data,
      products: updatedProducts,
      stockTransactions: [transaction, ...this.data.stockTransactions],
    });

    return { product, transaction };
  }

  public toggleProductStatus(
    dealerId: string,
    productId: string,
    targetStatus?: 'ACTIVE' | 'INACTIVE'
  ): Product {
    const product = this.data.products.find(
      (p) => p.id === productId && p.dealerId === dealerId
    );
    if (!product) throw new Error('Product not found or unauthorized');

    const nextStatus = targetStatus || (product.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
    return this.updateProduct(dealerId, productId, { status: nextStatus });
  }

  // Safe delete check for historical records
  public checkProductHistoricalRecords(
    dealerId: string,
    productId: string
  ): {
    hasRecords: boolean;
    ordersCount: number;
    invoicesCount: number;
    returnsCount: number;
    stockTxCount: number;
    summary: string;
  } {
    const ordersCount = this.data.orders.filter(
      (o) => o.dealerId === dealerId && o.items.some((it) => it.productId === productId)
    ).length;

    const invoicesCount = this.data.invoices.filter(
      (i) => i.dealerId === dealerId && i.items.some((it) => it.productId === productId)
    ).length;

    const returnsCount = this.data.returns.filter(
      (r) => r.dealerId === dealerId && r.productId === productId
    ).length;

    const stockTxCount = this.data.stockTransactions.filter(
      (s) => s.dealerId === dealerId && s.productId === productId
    ).length;

    const total = ordersCount + invoicesCount + returnsCount;

    return {
      hasRecords: total > 0,
      ordersCount,
      invoicesCount,
      returnsCount,
      stockTxCount,
      summary:
        total > 0
          ? `Product is referenced in ${ordersCount} orders, ${invoicesCount} invoices, and ${returnsCount} returns. Safe deactivation applies.`
          : 'Zero sales or invoice records found. Safe to permanently remove.',
    };
  }

  // Safe Product Deletion
  public safeDeleteProduct(
    dealerId: string,
    productId: string
  ): {
    success: boolean;
    softDeleted: boolean;
    productName: string;
    message: string;
  } {
    const product = this.data.products.find(
      (p) => p.id === productId && p.dealerId === dealerId
    );
    if (!product) throw new Error('Product not found or unauthorized');

    const analysis = this.checkProductHistoricalRecords(dealerId, productId);

    if (analysis.hasRecords) {
      product.status = 'INACTIVE';
      product.isSoftDeleted = true;
      product.deletedAt = new Date().toISOString();

      const updatedProducts = this.data.products.map((p) =>
        p.id === productId ? { ...product } : p
      );
      this.saveDatabase({ ...this.data, products: updatedProducts });

      return {
        success: true,
        softDeleted: true,
        productName: product.name,
        message: `Product '${product.name}' is referenced in past records (${analysis.ordersCount} orders, ${analysis.invoicesCount} invoices). To preserve data integrity, this product was safely deactivated and archived.`,
      };
    }

    const prodName = product.name;
    const remainingProducts = this.data.products.filter(
      (p) => !(p.id === productId && p.dealerId === dealerId)
    );
    const remainingStockTx = this.data.stockTransactions.filter(
      (s) => !(s.productId === productId && s.dealerId === dealerId)
    );

    this.saveDatabase({
      ...this.data,
      products: remainingProducts,
      stockTransactions: remainingStockTx,
    });

    return {
      success: true,
      softDeleted: false,
      productName: prodName,
      message: `Product '${prodName}' had zero historical sales and was permanently removed safely.`,
    };
  }

  public deleteProduct(dealerId: string, productId: string): boolean {
    const result = this.safeDeleteProduct(dealerId, productId);
    return result.success;
  }

  // Real Inventory Valuations
  public getDealerInventoryValuation(dealerId: string): {
    totalProducts: number;
    totalStockQuantity: number;
    totalBuyValue: number;
    totalSaleValue: number;
    totalInventoryProfit: number;
    lowStockCount: number;
    outOfStockCount: number;
    inStockCount: number;
  } {
    const activeProducts = this.data.products.filter(
      (p) => p.dealerId === dealerId && !p.isSoftDeleted
    );

    let totalStockQuantity = 0;
    let totalBuyValue = 0;
    let totalSaleValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let inStockCount = 0;

    for (const p of activeProducts) {
      totalStockQuantity += p.stock;
      totalBuyValue += p.buyPrice * p.stock;
      totalSaleValue += p.salePrice * p.stock;

      if (p.stock === 0) {
        outOfStockCount++;
      } else if (p.stock <= p.minStockAlert) {
        lowStockCount++;
      } else {
        inStockCount++;
      }
    }

    const totalInventoryProfit = totalSaleValue - totalBuyValue;

    return {
      totalProducts: activeProducts.length,
      totalStockQuantity,
      totalBuyValue: Number(totalBuyValue.toFixed(2)),
      totalSaleValue: Number(totalSaleValue.toFixed(2)),
      totalInventoryProfit: Number(totalInventoryProfit.toFixed(2)),
      lowStockCount,
      outOfStockCount,
      inStockCount,
    };
  }

  public getDealerCategories(dealerId: string): string[] {
    const prods = this.data.products.filter(
      (p) => p.dealerId === dealerId && !p.isSoftDeleted
    );
    return Array.from(new Set(prods.map((p) => p.category))).filter(Boolean);
  }

  // Frequently Ordered / Recently Used Products for fast Order Taker workflow
  public getFrequentlyOrderedProducts(dealerId: string, limit = 6): Product[] {
    const orders = this.getDealerOrders(dealerId);
    const orderCounts: Record<string, number> = {};
    for (const order of orders) {
      for (const item of order.items) {
        orderCounts[item.productId] = (orderCounts[item.productId] || 0) + item.quantity;
      }
    }

    const activeProds = this.getDealerProducts(dealerId).filter((p) => p.status === 'ACTIVE' && p.stock > 0);
    // Sort by order counts descending, with preference to prominent FMCG items
    activeProds.sort((a, b) => {
      const countA = orderCounts[a.id] || 0;
      const countB = orderCounts[b.id] || 0;
      if (countB !== countA) return countB - countA;
      return a.name.localeCompare(b.name);
    });

    return activeProds.slice(0, limit);
  }

  // Scale catalog generator for benchmarking 200, 500, 1000+ products
  public seedScaleProducts(dealerId: string, targetCount = 250): number {
    const existing = this.getDealerProducts(dealerId);
    if (existing.length >= targetCount) {
      return existing.length;
    }

    const categories = ['Beverages', 'Dairy', 'Snacks', 'Staples & Grains', 'Confectionery', 'Personal Care', 'Edible Oils', 'Household'];
    const units = ['Bottles', 'Packs', 'Boxes', 'Cartons', 'Cans', 'Pieces'];
    const brands = [
      'Coca Cola', 'Pepsi', 'Milk', 'Sprite', 'Fanta', '7Up', 'Mirinda', 'Nestle', 'Lipton',
      'Tapal', 'National', 'Shan', 'Mitchells', 'Dawn', 'Shezan', 'Kolson', 'LU', 'Peak Freans',
      'Dalda', 'Mezan', 'Habib', 'Olpers', 'Tarang', 'Nurpur', 'Guard', 'Super Kernel', 'Lifebuoy',
      'Surf Excel', 'Ariel', 'Colgate', 'Dettol', 'Sunsilk', 'Head & Shoulders', 'Lux'
    ];
    const variants = [
      '1.5L', '500ml', '1L', '250ml', 'Can', 'Pack of 6', 'Family Pack', 'Economy Pack', '400g', '800g',
      '1kg', '5kg', '10kg', 'Single', 'Regular', 'Extra Large', 'Premium Gold', 'Classic'
    ];

    const toAdd: Product[] = [];
    const needed = targetCount - existing.length;
    const existingSkus = new Set(existing.map((p) => p.sku.toLowerCase()));

    let index = 1;
    while (toAdd.length < needed) {
      const b = brands[index % brands.length];
      const v = variants[Math.floor(index / brands.length) % variants.length];
      const cat = categories[index % categories.length];
      const u = units[index % units.length];
      const name = `${b} ${v} #${Math.floor(index / (brands.length * variants.length)) + 1}`.replace(' #1', '');
      const sku = `SKU-${b.slice(0, 3).toUpperCase()}-${index.toString().padStart(4, '0')}`;
      
      if (!existingSkus.has(sku.toLowerCase())) {
        existingSkus.add(sku.toLowerCase());
        const buyPrice = 50 + ((index * 7) % 1800);
        const salePrice = Math.round(buyPrice * 1.25);
        const stock = 10 + ((index * 13) % 250);
        toAdd.push({
          id: `prod-scale-${dealerId}-${Date.now()}-${index}`,
          dealerId,
          name,
          sku,
          category: cat,
          unit: u,
          buyPrice,
          salePrice,
          stock,
          minStockAlert: 15,
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
        });
      }
      index++;
    }

    this.data.products.push(...toAdd);
    this.saveDatabase(this.data);
    return this.getDealerProducts(dealerId).length;
  }

  // --- Phase 4: Customer / Shop Mutations ---
  public getCustomerById(dealerId: string, customerId: string): CustomerShop | undefined {
    return this.data.customers.find(
      (c) => c.id === customerId && c.dealerId === dealerId && !c.isSoftDeleted
    );
  }

  public addCustomer(
    dealerId: string,
    customer: {
      shopName: string;
      contactPerson?: string;
      ownerName?: string;
      phone: string;
      alternatePhone?: string;
      city?: string;
      area?: string;
      address?: string;
      openingBalance?: number;
      creditLimit?: number;
      status?: 'ACTIVE' | 'INACTIVE';
    }
  ): CustomerShop {
    const cleanShopName = (customer.shopName || '').trim();
    if (!cleanShopName) throw new Error('Shop Name is required.');

    const cleanPhone = (customer.phone || '').trim();
    if (!cleanPhone) throw new Error('Phone Number is required.');

    const openingBal = Number(customer.openingBalance !== undefined ? customer.openingBalance : 0);
    if (isNaN(openingBal) || openingBal < 0) {
      throw new Error('Opening Balance must be a non-negative monetary number.');
    }

    const contact = (customer.contactPerson || customer.ownerName || '').trim();

    const newCustomer: CustomerShop = {
      id: `cust-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      dealerId,
      shopName: cleanShopName,
      ownerName: contact || cleanShopName,
      contactPerson: contact || cleanShopName,
      phone: cleanPhone,
      alternatePhone: (customer.alternatePhone || '').trim(),
      city: (customer.city || 'Karachi').trim(),
      area: (customer.area || '').trim(),
      address: (customer.address || '').trim(),
      openingBalance: openingBal,
      currentBalance: openingBal, // Initialized monetary balance directly, zero fake transactions (Req 12)
      creditLimit: customer.creditLimit !== undefined ? Number(customer.creditLimit) : 50000,
      status: customer.status || 'ACTIVE',
      isSoftDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.saveDatabase({
      ...this.data,
      customers: [newCustomer, ...this.data.customers],
    });
    return newCustomer;
  }

  public updateCustomer(
    dealerId: string,
    customerId: string,
    updates: Partial<CustomerShop>
  ): CustomerShop {
    const cust = this.data.customers.find((c) => c.id === customerId && c.dealerId === dealerId);
    if (!cust) throw new Error('Customer not found or unauthorized');

    const updatedList = this.data.customers.map((c) => {
      if (c.id === customerId && c.dealerId === dealerId) {
        const updated = { ...c, ...updates, updatedAt: new Date().toISOString() };
        if (updates.contactPerson && !updates.ownerName) {
          updated.ownerName = updates.contactPerson;
        } else if (updates.ownerName && !updates.contactPerson) {
          updated.contactPerson = updates.ownerName;
        }
        return updated;
      }
      return c;
    });

    const updated = updatedList.find((c) => c.id === customerId)!;
    this.saveDatabase({ ...this.data, customers: updatedList });
    return updated;
  }

  public toggleCustomerStatus(
    dealerId: string,
    customerId: string,
    targetStatus?: 'ACTIVE' | 'INACTIVE'
  ): CustomerShop {
    const customer = this.data.customers.find((c) => c.id === customerId && c.dealerId === dealerId);
    if (!customer) throw new Error('Customer / Shop not found or unauthorized');

    const next = targetStatus || (customer.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
    return this.updateCustomer(dealerId, customerId, { status: next });
  }

  public checkCustomerHistoricalRecords(
    dealerId: string,
    customerId: string
  ): {
    hasRecords: boolean;
    ordersCount: number;
    invoicesCount: number;
    returnsCount: number;
    ledgerCount: number;
    summary: string;
  } {
    const ordersCount = this.data.orders.filter(
      (o) => o.customerId === customerId && o.dealerId === dealerId
    ).length;
    const invoicesCount = this.data.invoices.filter(
      (i) => i.customerId === customerId && i.dealerId === dealerId
    ).length;
    const returnsCount = this.data.returns.filter(
      (r) => r.customerId === customerId && r.dealerId === dealerId
    ).length;
    const ledgerCount = this.data.ledgerEntries.filter(
      (l) => l.customerId === customerId && l.dealerId === dealerId
    ).length;

    const total = ordersCount + invoicesCount + returnsCount + ledgerCount;

    return {
      hasRecords: total > 0,
      ordersCount,
      invoicesCount,
      returnsCount,
      ledgerCount,
      summary:
        total > 0
          ? `Customer is referenced in ${ordersCount} orders, ${invoicesCount} invoices, ${returnsCount} returns, and ${ledgerCount} ledger entries. Safe deactivation applies.`
          : 'Zero sales or financial records found. Safe to permanently remove.',
    };
  }

  public safeDeleteCustomer(
    dealerId: string,
    customerId: string
  ): {
    success: boolean;
    softDeleted: boolean;
    shopName: string;
    message: string;
  } {
    const customer = this.data.customers.find((c) => c.id === customerId && c.dealerId === dealerId);
    if (!customer) throw new Error('Customer / Shop not found or unauthorized.');

    const analysis = this.checkCustomerHistoricalRecords(dealerId, customerId);

    if (analysis.hasRecords) {
      customer.status = 'INACTIVE';
      customer.isSoftDeleted = true;
      customer.deletedAt = new Date().toISOString();
      customer.updatedAt = new Date().toISOString();

      const updatedList = this.data.customers.map((c) =>
        c.id === customerId ? { ...customer } : c
      );
      this.saveDatabase({ ...this.data, customers: updatedList });

      return {
        success: true,
        softDeleted: true,
        shopName: customer.shopName,
        message: `Customer '${customer.shopName}' is referenced in past records (${analysis.ordersCount} orders, ${analysis.invoicesCount} invoices, ${analysis.ledgerCount} ledger entries). Safely deactivated and archived.`,
      };
    }

    const shopName = customer.shopName;
    const remaining = this.data.customers.filter((c) => !(c.id === customerId && c.dealerId === dealerId));
    this.saveDatabase({ ...this.data, customers: remaining });

    return {
      success: true,
      softDeleted: false,
      shopName,
      message: `Customer '${shopName}' had zero historical transactions and was permanently removed safely.`,
    };
  }

  public getCustomerFinancialSummary(
    dealerId: string,
    customerId: string
  ): {
    openingBalance: number;
    currentBalance: number;
    totalDebit: number;
    totalCredit: number;
    outstandingBalance: number;
    ordersCount: number;
    invoicesCount: number;
  } {
    const customer = this.data.customers.find((c) => c.id === customerId && c.dealerId === dealerId);
    if (!customer) throw new Error('Customer not found or unauthorized');

    const customerLedger = this.data.ledgerEntries.filter(
      (l) => l.customerId === customerId && l.dealerId === dealerId
    );
    const totalDebit = customerLedger.reduce((acc, l) => acc + (l.debit || 0), 0);
    const totalCredit = customerLedger.reduce((acc, l) => acc + (l.credit || 0), 0);

    const ordersCount = this.data.orders.filter(
      (o) => o.customerId === customerId && o.dealerId === dealerId
    ).length;
    const invoicesCount = this.data.invoices.filter(
      (i) => i.customerId === customerId && i.dealerId === dealerId
    ).length;

    return {
      openingBalance: customer.openingBalance,
      currentBalance: customer.currentBalance,
      totalDebit,
      totalCredit,
      outstandingBalance: customer.currentBalance,
      ordersCount,
      invoicesCount,
    };
  }

  public getDealerCustomerKPIs(dealerId: string): {
    totalCustomers: number;
    activeCustomers: number;
    inactiveCustomers: number;
    outstandingCount: number;
    clearedCount: number;
    totalOutstanding: number;
  } {
    const custs = this.data.customers.filter((c) => c.dealerId === dealerId && !c.isSoftDeleted);

    let activeCount = 0;
    let inactiveCount = 0;
    let outstandingCount = 0;
    let clearedCount = 0;
    let totalOutstanding = 0;

    for (const c of custs) {
      if (c.status === 'ACTIVE') {
        activeCount++;
      } else {
        inactiveCount++;
      }

      if (c.currentBalance > 0) {
        outstandingCount++;
        totalOutstanding += c.currentBalance;
      } else {
        clearedCount++;
      }
    }

    return {
      totalCustomers: custs.length,
      activeCustomers: activeCount,
      inactiveCustomers: inactiveCount,
      outstandingCount,
      clearedCount,
      totalOutstanding: Number(totalOutstanding.toFixed(2)),
    };
  }

  // --- Order Taker Mutations ---
  public getOrderTakerById(orderTakerId: string): OrderTaker | undefined {
    return this.data.orderTakers.find((ot) => ot.id === orderTakerId);
  }

  public addOrderTaker(
    dealerId: string,
    data: {
      name: string;
      username: string;
      email: string;
      phone: string;
      password?: string;
      employeeCode?: string;
      id?: string; // use the server's id so login and data refer to the same person
      active?: boolean;
      locationSharingEnabled?: boolean;
    }
  ): OrderTaker {
    // Generate unique employee code if not provided
    const count = this.data.orderTakers.filter((o) => o.dealerId === dealerId).length + 1;
    const employeeCode = data.employeeCode?.trim() || `OT-${String(count).padStart(3, '0')}`;

    const newOT: OrderTaker = {
      id: data.id || `ot-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      dealerId, // strictly associated with authenticated dealer
      name: data.name.trim(),
      username: data.username.trim().toLowerCase(),
      employeeCode,
      phone: data.phone.trim(),
      email: data.email.trim().toLowerCase(),
      password: data.password,
      active: data.active !== undefined ? data.active : true,
      onlineStatus: 'OFFLINE',
      locationSharingEnabled:
        data.locationSharingEnabled !== undefined ? data.locationSharingEnabled : true,
      createdAt: new Date().toISOString(),
    };

    this.saveDatabase({
      ...this.data,
      orderTakers: [newOT, ...this.data.orderTakers],
    });
    return newOT;
  }

  public updateOrderTaker(
    dealerId: string,
    orderTakerId: string,
    updates: Partial<OrderTaker>
  ): OrderTaker {
    const ot = this.data.orderTakers.find(
      (o) => o.id === orderTakerId && o.dealerId === dealerId
    );
    if (!ot) throw new Error('Order Taker not found or unauthorized');

    const updatedOT: OrderTaker = {
      ...ot,
      ...updates,
      // If deactivated, update onlineStatus to OFFLINE
      onlineStatus: updates.active === false ? 'OFFLINE' : (updates.onlineStatus ?? ot.onlineStatus),
    };

    const updatedList = this.data.orderTakers.map((o) =>
      o.id === orderTakerId ? updatedOT : o
    );
    this.saveDatabase({ ...this.data, orderTakers: updatedList });
    return updatedOT;
  }

  public toggleOrderTakerActive(dealerId: string, orderTakerId: string): OrderTaker {
    const ot = this.data.orderTakers.find(
      (o) => o.id === orderTakerId && o.dealerId === dealerId
    );
    if (!ot) throw new Error('Order Taker not found or unauthorized');
    const newActive = !ot.active;
    return this.updateOrderTaker(dealerId, orderTakerId, {
      active: newActive,
      onlineStatus: newActive ? ot.onlineStatus : 'OFFLINE',
    });
  }

  public deactivateOrderTaker(dealerId: string, orderTakerId: string): OrderTaker {
    const ot = this.data.orderTakers.find(
      (o) => o.id === orderTakerId && o.dealerId === dealerId
    );
    if (!ot) throw new Error('Order Taker not found or unauthorized');
    return this.updateOrderTaker(dealerId, orderTakerId, {
      active: false,
      onlineStatus: 'OFFLINE',
    });
  }

  public checkOrderTakerTransactions(
    dealerId: string,
    orderTakerId: string
  ): { hasTransactions: boolean; ordersCount: number; invoicesCount: number } {
    const orders = this.data.orders.filter(
      (o) => o.dealerId === dealerId && o.orderTakerId === orderTakerId
    );
    const invoices = this.data.invoices.filter(
      (i) => i.dealerId === dealerId && i.orderTakerId === orderTakerId
    );
    return {
      hasTransactions: orders.length > 0 || invoices.length > 0,
      ordersCount: orders.length,
      invoicesCount: invoices.length,
    };
  }

  public deleteOrderTaker(
    dealerId: string,
    orderTakerId: string
  ): { softDeleted: boolean; message: string; orderTakerName: string; deleted: boolean } {
    const ot = this.data.orderTakers.find(
      (o) => o.id === orderTakerId && o.dealerId === dealerId
    );
    if (!ot) throw new Error('Order Taker not found or unauthorized');

    const { hasTransactions, ordersCount, invoicesCount } = this.checkOrderTakerTransactions(
      dealerId,
      orderTakerId
    );

    if (hasTransactions) {
      // Safe Delete Rule: strictly prevent destructive permanent database deletion
      throw new Error(
        'Cannot delete Order Taker with existing sales history. You can deactivate them instead.'
      );
    } else {
      // Hard delete safe since no business transactions are connected
      const remaining = this.data.orderTakers.filter((o) => o.id !== orderTakerId);
      this.saveDatabase({ ...this.data, orderTakers: remaining });
      return {
        softDeleted: false,
        deleted: true,
        orderTakerName: ot.name,
        message: 'Order Taker deleted successfully',
      };
    }
  }

  public authenticateOrderTaker(
    usernameOrEmail: string,
    password?: string
  ): { success: boolean; orderTaker?: OrderTaker; error?: string } {
    const cleaned = usernameOrEmail.trim().toLowerCase();
    const ot = this.data.orderTakers.find(
      (o) =>
        !o.isSoftDeleted &&
        (o.username.toLowerCase() === cleaned ||
          o.email.toLowerCase() === cleaned ||
          o.employeeCode.toLowerCase() === cleaned)
    );

    if (!ot) {
      return {
        success: false,
        error: `Order Taker account "${usernameOrEmail}" was not found. Please verify with your Dealer.`,
      };
    }

    if (!ot.active) {
      return {
        success: false,
        error: `Order Taker account for "${ot.name}" is currently Deactivated. Please contact your Dealer administrator.`,
      };
    }

    if (password && ot.password && ot.password !== password) {
      return {
        success: false,
        error: 'Incorrect password. Please verify your login credentials.',
      };
    }

    return {
      success: true,
      orderTaker: ot,
    };
  }

  public updateOrderTakerLocation(
    orderTakerId: string,
    latitude: number,
    longitude: number,
    accuracy: number = 10,
    addressLabel?: string
  ): OrderTaker {
    const ot = this.data.orderTakers.find((o) => o.id === orderTakerId);
    if (!ot) throw new Error('Order Taker not found');

    const updatedOT: OrderTaker = {
      ...ot,
      onlineStatus: 'ONLINE',
      locationSharingEnabled: true,
      lastLocation: {
        latitude,
        longitude,
        accuracy,
        lastUpdated: new Date().toISOString(),
        addressLabel: addressLabel || `Lat ${latitude.toFixed(4)}, Lng ${longitude.toFixed(4)}`,
      },
    };

    this.saveDatabase({
      ...this.data,
      orderTakers: this.data.orderTakers.map((o) => (o.id === orderTakerId ? updatedOT : o)),
    });
    return updatedOT;
  }

  public toggleOrderTakerLocationSharing(orderTakerId: string, enabled: boolean): OrderTaker {
    const ot = this.data.orderTakers.find((o) => o.id === orderTakerId);
    if (!ot) throw new Error('Order Taker not found');
    const updatedOT: OrderTaker = {
      ...ot,
      locationSharingEnabled: enabled,
      onlineStatus: enabled ? 'ONLINE' : 'OFFLINE',
    };
    this.saveDatabase({
      ...this.data,
      orderTakers: this.data.orderTakers.map((o) => (o.id === orderTakerId ? updatedOT : o)),
    });
    return updatedOT;
  }

  // =========================================================================
  // 3. CORE BUSINESS WORKFLOW:
  // Order Taker -> Customer -> Product -> Quantity -> Sale Price -> Confirm Order
  // -> AUTOMATIC SALE INVOICE -> Stock Update (atomic) -> Customer Ledger Update
  // =========================================================================

  // ---- Order delivery and cancellation (dealer only) ----
  public markOrderDelivered(dealerId: string, orderId: string): Order {
    const next = markDelivered(this.data as unknown as OrderBook, dealerId, orderId, new Date().toISOString());
    this.saveDatabase({ ...this.data, ...next });
    return this.data.orders.find((o) => o.id === orderId)!;
  }

  public cancelOrder(dealerId: string, orderId: string, reason: string): Order {
    const next = cancelOrder(this.data as unknown as OrderBook, this.data.returns, dealerId, orderId, reason, new Date().toISOString());
    this.saveDatabase({ ...this.data, ...next });
    return this.data.orders.find((o) => o.id === orderId)!;
  }

  public confirmOrderAndGenerateInvoice(
    dealerId: string,
    payload: {
      customerId: string;
      orderTakerId: string;
      items: {
        productId: string;
        quantity: number;
        salePrice: number;
        discountPercent?: number;
      }[];
      paidAmount: number;
      notes?: string;
      clientRequestId?: string;
    }
  ): { order: Order; invoice: Invoice } {
    const dealer = this.getDealerById(dealerId);
    if (!dealer) throw new Error('Dealer not found');
    const result = confirmOrder(this.data as unknown as OrderBook, dealer, dealerId, payload);
    this.saveDatabase({ ...this.data, ...result.book });
    return { order: result.order, invoice: result.invoice };
  }

  // --- Mark Invoice as Printed ---
  public incrementInvoicePrintCount(invoiceId: string): void {
    const invoices = this.data.invoices.map((inv) =>
      inv.id === invoiceId ? { ...inv, printedCount: (inv.printedCount || 0) + 1 } : inv
    );
    this.saveDatabase({ ...this.data, invoices });
  }

  // --- Process Sales Return ---
  public processSalesReturn(
    dealerId: string,
    payload: {
      customerId: string;
      productId: string;
      returnedQuantity: number;
      unitRefundPrice: number;
      reason: string;
      invoiceNumber?: string;
    }
  ): SalesReturn {
    const customer = this.data.customers.find((c) => c.id === payload.customerId && c.dealerId === dealerId);
    if (!customer) throw new Error('Customer not found');

    const product = this.data.products.find((p) => p.id === payload.productId && p.dealerId === dealerId);
    if (!product) throw new Error('Product not found');

    if (payload.returnedQuantity <= 0) {
      throw new Error('Returned quantity must be greater than zero');
    }

    const totalRefund = payload.returnedQuantity * payload.unitRefundPrice;
    const nowIso = new Date().toISOString();
    const returnNumber = `RET-2026-${String(this.data.returns.length + 1).padStart(4, '0')}`;

    const newReturn: SalesReturn = {
      id: `ret-${Date.now()}`,
      dealerId,
      returnNumber,
      invoiceNumber: payload.invoiceNumber,
      customerId: customer.id,
      customerName: customer.shopName,
      productId: product.id,
      productName: product.name,
      returnedQuantity: payload.returnedQuantity,
      unitRefundPrice: payload.unitRefundPrice,
      totalRefundAmount: totalRefund,
      reason: payload.reason,
      date: nowIso,
    };

    // 1. Add back to stock safely
    const previousStock = product.stock;
    const newStock = previousStock + payload.returnedQuantity;

    const updatedProducts = this.data.products.map((p) => (p.id === product.id ? { ...p, stock: newStock } : p));

    // 2. Add Stock Transaction Log
    const newStockTransactions: StockTransaction[] = [
      {
        id: `stx-${Date.now()}`,
        dealerId,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        type: 'RETURN_ADDITION',
        quantityChange: payload.returnedQuantity,
        previousStock,
        newStock,
        referenceId: newReturn.id,
        referenceType: 'RETURN',
        timestamp: nowIso,
        note: `Return ${returnNumber} stock replenishment: ${payload.reason}`,
      },
      ...this.data.stockTransactions,
    ];

    // 3. Customer Ledger Credit Adjustment
    const newCustomerBalance = customer.currentBalance - totalRefund;
    const newLedgerEntries: CustomerLedgerEntry[] = [
      {
        id: `ledg-${Date.now()}`,
        dealerId,
        customerId: customer.id,
        customerName: customer.shopName,
        date: nowIso,
        invoiceNo: payload.invoiceNumber,
        referenceType: 'SALES_RETURN',
        description: `Sales Return ${returnNumber}: ${payload.returnedQuantity}x ${product.name}`,
        debit: 0,
        credit: totalRefund,
        balance: newCustomerBalance,
      },
      ...this.data.ledgerEntries,
    ];

    const updatedCustomers = this.data.customers.map((c) =>
      c.id === customer.id ? { ...c, currentBalance: newCustomerBalance } : c
    );

    this.saveDatabase({
      ...this.data,
      products: updatedProducts,
      returns: [newReturn, ...this.data.returns],
      stockTransactions: newStockTransactions,
      ledgerEntries: newLedgerEntries,
      customers: updatedCustomers,
    });

    return newReturn;
  }

  // --- Printer Settings ---
  public updatePrinterSetting(
    dealerId: string,
    settingId: string,
    updates: Partial<PrinterSetting>
  ): PrinterSetting {
    const updated = this.data.printerSettings.map((p) =>
      p.id === settingId && p.dealerId === dealerId ? { ...p, ...updates } : p
    );
    const target = updated.find((p) => p.id === settingId);
    if (!target) throw new Error('Printer setting not found');
    this.saveDatabase({ ...this.data, printerSettings: updated });
    return target;
  }

  public addPrinterSetting(dealerId: string, setting: Omit<PrinterSetting, 'id' | 'dealerId'>): PrinterSetting {
    const newPrinter: PrinterSetting = {
      ...setting,
      id: `prt-${Date.now()}`,
      dealerId,
    };
    this.saveDatabase({
      ...this.data,
      printerSettings: [...this.data.printerSettings, newPrinter],
    });
    return newPrinter;
  }
}

export const store = new MultiTenantStore();
