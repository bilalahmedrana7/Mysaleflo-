import {
  Dealer,
  OrderTaker,
  CustomerShop,
  Product,
  Order,
  Invoice,
  StockTransaction,
  StockTransactionType,
  CustomerLedgerEntry,
  SalesReturn,
  PrinterSetting,
} from '../types';
import { hashPassword, StoredUser } from './auth';

// -------------------------------------------------------------
// Seed Database with Cryptographically Hashed Passwords
// -------------------------------------------------------------

// Generate pre-hashed credentials
const IS_PROD = process.env.NODE_ENV === 'production';
if (IS_PROD && (!process.env.SUPER_ADMIN_PASSWORD || process.env.SUPER_ADMIN_PASSWORD.length < 12)) {
  throw new Error('SUPER_ADMIN_PASSWORD (min 12 characters) must be set in the environment for production.');
}
const superAdminPass = hashPassword(IS_PROD ? (process.env.SUPER_ADMIN_PASSWORD as string) : 'SuperAdminPassword123!');
const apexDealerPass = hashPassword('ApexPassword123!');
const metroDealerPass = hashPassword('MetroPassword123!');
const frontierDealerPass = hashPassword('FrontierPass123!');
const tariqPass = hashPassword('password123');
const kamranPass = hashPassword('password123');
const usmanPass = hashPassword('password123');

export const INITIAL_USERS: StoredUser[] = [
  {
    id: 'user-superadmin-01',
    username: 'superadmin',
    email: 'superadmin@mysaleflo.com',
    name: 'My Saleflo Platform Administrator',
    role: 'SUPER_ADMIN',
    passwordHash: superAdminPass.hash,
    passwordSalt: superAdminPass.salt,
    active: true,
  },
  {
    id: 'user-dealer-apex',
    username: 'apex.dealer',
    email: 'admin@apexdistributors.pk',
    name: 'Apex Distribution Ltd (Admin)',
    role: 'DEALER',
    dealerId: 'dealer-apex-101',
    passwordHash: apexDealerPass.hash,
    passwordSalt: apexDealerPass.salt,
    active: true,
    subscriptionStatus: 'ACTIVE',
  },
  {
    id: 'user-dealer-metro',
    username: 'metro.dealer',
    email: 'accounts@metrowholesale.pk',
    name: 'Metro Wholesale Supply (Admin)',
    role: 'DEALER',
    dealerId: 'dealer-metro-202',
    passwordHash: metroDealerPass.hash,
    passwordSalt: metroDealerPass.salt,
    active: true,
    subscriptionStatus: 'ACTIVE',
  },
  {
    id: 'user-dealer-frontier',
    username: 'frontier.dealer',
    email: 'zia@frontierfmcg.pk',
    name: 'Frontier FMCG Traders (Expired Subscription)',
    role: 'DEALER',
    dealerId: 'dealer-sub-expired-303',
    passwordHash: frontierDealerPass.hash,
    passwordSalt: frontierDealerPass.salt,
    active: false,
    subscriptionStatus: 'EXPIRED',
  },
  {
    id: 'user-ot-apex-01',
    username: 'tariq.sales',
    email: 'tariq.sales@apexdistributors.pk',
    name: 'Tariq Mahmood (Apex Field Rep)',
    role: 'ORDER_TAKER',
    dealerId: 'dealer-apex-101',
    orderTakerId: 'ot-apex-01',
    passwordHash: tariqPass.hash,
    passwordSalt: tariqPass.salt,
    active: true,
  },
  {
    id: 'user-ot-apex-02',
    username: 'kamran.raza',
    email: 'kamran.raza@apexdistributors.pk',
    name: 'Kamran Raza (Apex Field Rep - No Sales Yet)',
    role: 'ORDER_TAKER',
    dealerId: 'dealer-apex-101',
    orderTakerId: 'ot-apex-02',
    passwordHash: kamranPass.hash,
    passwordSalt: kamranPass.salt,
    active: true,
  },
  {
    id: 'user-ot-metro-01',
    username: 'usman.sales',
    email: 'usman.sales@metrowholesale.pk',
    name: 'Usman Ali Cheema (Metro Field Rep)',
    role: 'ORDER_TAKER',
    dealerId: 'dealer-metro-202',
    orderTakerId: 'ot-metro-01',
    passwordHash: usmanPass.hash,
    passwordSalt: usmanPass.salt,
    active: true,
  },
];

export const INITIAL_DEALERS: Dealer[] = [
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

export const INITIAL_ORDER_TAKERS: OrderTaker[] = [
  {
    id: 'ot-apex-01',
    dealerId: 'dealer-apex-101',
    name: 'Tariq Mahmood',
    username: 'tariq.sales',
    employeeCode: 'OT-APX-01',
    phone: '+92 301 5551234',
    email: 'tariq.sales@apexdistributors.pk',
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

export const INITIAL_CUSTOMERS: CustomerShop[] = [
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

export const INITIAL_PRODUCTS: Product[] = [
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
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'prod-apx-02',
    dealerId: 'dealer-apex-101',
    name: 'Golden Valley Premium Tea 450g',
    sku: 'GVT-450',
    category: 'Hot Beverages',
    unit: 'Cartons',
    buyPrice: 1100,
    salePrice: 1350,
    stock: 85,
    minStockAlert: 15,
    status: 'ACTIVE',
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'prod-apx-03',
    dealerId: 'dealer-apex-101',
    name: 'Crispy Wave BBQ Chips 45g (Box of 24)',
    sku: 'CW-BBQ-24',
    category: 'Snacks & Confectionery',
    unit: 'Boxes',
    buyPrice: 720,
    salePrice: 900,
    stock: 60,
    minStockAlert: 10,
    status: 'ACTIVE',
    createdAt: '2026-01-10T10:00:00Z',
  },
  // Metro Products
  {
    id: 'prod-mtr-coca-15l',
    dealerId: 'dealer-metro-202',
    name: 'Coca Cola 1.5L',
    sku: 'MTR-KO-15L',
    category: 'Beverages',
    unit: 'Bottles',
    buyPrice: 152,
    salePrice: 180,
    stock: 300,
    minStockAlert: 40,
    status: 'ACTIVE',
    createdAt: '2026-09-17T09:00:00Z',
  },
  {
    id: 'prod-mtr-pepsi-15l',
    dealerId: 'dealer-metro-202',
    name: 'Pepsi 1.5L',
    sku: 'MTR-PEP-15L',
    category: 'Beverages',
    unit: 'Bottles',
    buyPrice: 146,
    salePrice: 175,
    stock: 250,
    minStockAlert: 35,
    status: 'ACTIVE',
    createdAt: '2026-09-17T09:00:00Z',
  },
  {
    id: 'prod-mtr-milk-1l',
    dealerId: 'dealer-metro-202',
    name: 'Milk 1L',
    sku: 'MTR-MLK-1L',
    category: 'Dairy',
    unit: 'Packs',
    buyPrice: 242,
    salePrice: 280,
    stock: 210,
    minStockAlert: 30,
    status: 'ACTIVE',
    createdAt: '2026-09-17T09:00:00Z',
  },
  {
    id: 'prod-mtr-01',
    dealerId: 'dealer-metro-202',
    name: 'Super Basmati Rice 10kg Premium Sack',
    sku: 'SBR-10KG',
    category: 'Staples & Grains',
    unit: 'Sacks',
    buyPrice: 3200,
    salePrice: 3600,
    stock: 210,
    minStockAlert: 30,
    status: 'ACTIVE',
    createdAt: '2026-09-17T09:00:00Z',
  },
  {
    id: 'prod-mtr-02',
    dealerId: 'dealer-metro-202',
    name: 'Sunrise Canola Cooking Oil 5L Can',
    sku: 'SCO-5L',
    category: 'Edible Oils',
    unit: 'Cans',
    buyPrice: 2450,
    salePrice: 2750,
    stock: 95,
    minStockAlert: 15,
    status: 'ACTIVE',
    createdAt: '2026-09-17T09:00:00Z',
  },
];

export const INITIAL_ORDERS: Order[] = [
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
        unit: 'Cartons',
        quantity: 5,
        salePrice: 1350,
        discountPercent: 0,
        discountAmount: 0,
        lineTotal: 6750,
      },
    ],
    subtotal: 14550,
    totalDiscount: 0,
    grandTotal: 14550,
    status: 'CONFIRMED',
    invoiceId: 'inv-apx-001',
    createdAt: '2026-09-28T11:20:00Z',
    notes: 'Urgent delivery before evening market rush',
  },
  {
    id: 'ord-mtr-001',
    dealerId: 'dealer-metro-202',
    orderNumber: 'ORD-2026-0201',
    customerId: 'cust-mtr-01',
    customerName: 'Chenab Traders',
    customerPhone: '+92 321 8899001',
    orderTakerId: 'ot-metro-01',
    orderTakerName: 'Usman Ali Cheema',
    items: [
      {
        productId: 'prod-mtr-01',
        productName: 'Super Basmati Rice 10kg Premium Sack',
        sku: 'SBR-10KG',
        unit: 'Sacks',
        quantity: 8,
        salePrice: 3600,
        discountPercent: 0,
        discountAmount: 0,
        lineTotal: 28800,
      },
    ],
    subtotal: 28800,
    totalDiscount: 0,
    grandTotal: 28800,
    status: 'CONFIRMED',
    invoiceId: 'inv-mtr-001',
    createdAt: '2026-09-29T10:00:00Z',
    notes: 'Monthly bulk grains delivery',
  },
];

export const INITIAL_INVOICES: Invoice[] = [
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
    subtotal: 14550,
    discount: 0,
    grandTotal: 14550,
    paidAmount: 4050,
    dueAmount: 10500,
    paymentStatus: 'PARTIAL',
    date: '2026-09-28T11:20:00Z',
    printedCount: 1,
    notes: 'Urgent delivery before evening rush',
  },
  {
    id: 'inv-mtr-001',
    invoiceNumber: 'INV-2026-0201',
    orderId: 'ord-mtr-001',
    dealerId: 'dealer-metro-202',
    dealerName: 'Metro Wholesale Supply',
    dealerPhone: '+92 321 4492819',
    dealerAddress: 'Warehouse #8, Circular Road Commercial Hub, Lahore',
    customerId: 'cust-mtr-01',
    customerName: 'Chenab Traders',
    customerPhone: '+92 321 8899001',
    customerAddress: 'Akbari Mandi Grain Market, Shop 45, Lahore',
    orderTakerId: 'ot-metro-01',
    orderTakerName: 'Usman Ali Cheema',
    items: INITIAL_ORDERS[1].items,
    subtotal: 28800,
    discount: 0,
    grandTotal: 28800,
    paidAmount: 0,
    dueAmount: 28800,
    paymentStatus: 'UNPAID',
    date: '2026-09-29T10:00:00Z',
    printedCount: 1,
    notes: 'Monthly bulk grains delivery',
  },
];

export const INITIAL_STOCK_TX: StockTransaction[] = [
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
];

export const INITIAL_LEDGER: CustomerLedgerEntry[] = [
  {
    id: 'ledg-apx-001',
    dealerId: 'dealer-apex-101',
    customerId: 'cust-apx-01',
    customerName: 'Al-Madina Super Store',
    date: '2026-09-28T11:20:00Z',
    invoiceNo: 'INV-2026-0101',
    referenceType: 'SALE_INVOICE',
    description: 'Automatic sale invoice generated against Order ORD-2026-0101',
    debit: 14550,
    credit: 0,
    balance: 29550,
  },
];

export const INITIAL_RETURNS: SalesReturn[] = [];

export const INITIAL_PRINTERS: PrinterSetting[] = [
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
    footerNotes: 'Thank you for your business.',
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

// In-Memory Database Engine with Strict Multi-Tenant Enforcement
// In production only the Super Admin account is seeded; demo dealers/data are development-only.
const seed = <T>(items: T[]): T[] => (IS_PROD ? [] : [...items]);

class ServerDatabase {
  public users: StoredUser[] = IS_PROD ? INITIAL_USERS.filter((u) => u.role === 'SUPER_ADMIN') : [...INITIAL_USERS];
  public dealers: Dealer[] = seed(INITIAL_DEALERS);
  public orderTakers: OrderTaker[] = seed(INITIAL_ORDER_TAKERS);
  public customers: CustomerShop[] = seed(INITIAL_CUSTOMERS);
  public products: Product[] = seed(INITIAL_PRODUCTS);
  public orders: Order[] = seed(INITIAL_ORDERS);
  public invoices: Invoice[] = seed(INITIAL_INVOICES);
  public stockTransactions: StockTransaction[] = seed(INITIAL_STOCK_TX);
  public ledgerEntries: CustomerLedgerEntry[] = seed(INITIAL_LEDGER);
  public returns: SalesReturn[] = seed(INITIAL_RETURNS);
  public printerSettings: PrinterSetting[] = seed(INITIAL_PRINTERS);

  // Find User by username or email
  public findUserByLogin(login: string): StoredUser | undefined {
    const clean = login.trim().toLowerCase();
    return this.users.find(
      (u) => u.username.toLowerCase() === clean || u.email.toLowerCase() === clean
    );
  }

  // Tenant-isolated getters
  public getDealerProducts(dealerId: string, includeArchived = false): Product[] {
    return this.products.filter((p) => p.dealerId === dealerId && (includeArchived ? true : !p.isSoftDeleted));
  }

  public getDealerCustomers(dealerId: string, includeArchived = false): CustomerShop[] {
    return this.customers.filter((c) => c.dealerId === dealerId && (includeArchived ? true : !c.isSoftDeleted));
  }

  public getDealerOrderTakers(dealerId: string): OrderTaker[] {
    return this.orderTakers.filter((o) => o.dealerId === dealerId && !o.isSoftDeleted);
  }

  public getDealerOrders(dealerId: string): Order[] {
    return this.orders.filter((o) => o.dealerId === dealerId);
  }

  public getDealerInvoices(dealerId: string): Invoice[] {
    return this.invoices.filter((i) => i.dealerId === dealerId);
  }

  public getDealerStockTx(dealerId: string): StockTransaction[] {
    return this.stockTransactions.filter((s) => s.dealerId === dealerId);
  }

  public getDealerLedger(dealerId: string): CustomerLedgerEntry[] {
    return this.ledgerEntries.filter((l) => l.dealerId === dealerId);
  }

  public getDealerReturns(dealerId: string): SalesReturn[] {
    return this.returns.filter((r) => r.dealerId === dealerId);
  }

  public getDealerPrinters(dealerId: string): PrinterSetting[] {
    return this.printerSettings.filter((p) => p.dealerId === dealerId);
  }

  // Check if resource belongs to dealer
  public verifyResourceOwnership(
    resourceType: 'orders' | 'invoices' | 'products' | 'customers' | 'orderTakers' | 'stock' | 'ledger' | 'printers',
    resourceId: string,
    dealerId: string
  ): { exists: boolean; authorized: boolean } {
    let item: any;
    switch (resourceType) {
      case 'orders':
        item = this.orders.find((x) => x.id === resourceId);
        break;
      case 'invoices':
        item = this.invoices.find((x) => x.id === resourceId);
        break;
      case 'products':
        item = this.products.find((x) => x.id === resourceId);
        break;
      case 'customers':
        item = this.customers.find((x) => x.id === resourceId);
        break;
      case 'orderTakers':
        item = this.orderTakers.find((x) => x.id === resourceId);
        break;
      case 'stock':
        item = this.stockTransactions.find((x) => x.id === resourceId);
        break;
      case 'ledger':
        item = this.ledgerEntries.find((x) => x.id === resourceId);
        break;
      case 'printers':
        item = this.printerSettings.find((x) => x.id === resourceId);
        break;
      default:
        return { exists: false, authorized: false };
    }

    if (!item) return { exists: false, authorized: false };
    return { exists: true, authorized: item.dealerId === dealerId };
  }

  // =========================================================================
  // PHASE 2: DEALER & SUBSCRIPTION MANAGEMENT METHODS
  // =========================================================================

  // Synchronize subscription statuses based on current date
  public syncSubscriptionStatuses(): void {
    const todayStr = new Date().toISOString().split('T')[0];

    for (const dealer of this.dealers) {
      if (!dealer.subscription) continue;

      if (!dealer.active) {
        dealer.subscription.status = 'SUSPENDED';
      } else if (todayStr > dealer.subscription.expiryDate) {
        dealer.subscription.status = 'EXPIRED';
      } else {
        const today = new Date(todayStr).getTime();
        const expiry = new Date(dealer.subscription.expiryDate).getTime();
        const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        if (diffDays <= 7 && diffDays >= 0) {
          dealer.subscription.status = 'EXPIRING_SOON';
        } else {
          dealer.subscription.status = 'ACTIVE';
        }
      }

      // Synchronize associated user
      const user = this.users.find((u) => u.dealerId === dealer.id && u.role === 'DEALER');
      if (user) {
        user.subscriptionStatus = dealer.subscription.status;
        user.active = dealer.active;
      }
    }
  }

  // Super Admin: List all dealers with synchronized statuses
  public getAllDealers(): Dealer[] {
    this.syncSubscriptionStatuses();
    return [...this.dealers];
  }

  // Super Admin: Get Dealer by ID
  public getDealerById(id: string): Dealer | undefined {
    this.syncSubscriptionStatuses();
    return this.dealers.find((d) => d.id === id);
  }

  // Super Admin: Create a new Dealer with unique Tenant ID and initial credentials
  public createDealer(data: {
    name: string;
    contactPerson: string;
    phone: string;
    email: string;
    username?: string;
    password: string;
    city?: string;
    address?: string;
    plan: '1_MONTH' | '1_YEAR';
    startDate?: string;
    expiryDate?: string;
    active?: boolean;
  }): { dealer: Dealer; user: StoredUser } {
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanUsername = (data.username || data.email.split('@')[0] || `dealer_${Date.now()}`)
      .trim()
      .toLowerCase();

    // Check for duplicate username or email
    const existingUser = this.findUserByLogin(cleanUsername) || this.findUserByLogin(cleanEmail);
    if (existingUser) {
      throw new Error(`An account with username '${cleanUsername}' or email '${cleanEmail}' already exists.`);
    }

    const timestamp = Date.now();
    const uniqueTenantId = `dealer-tenant-${timestamp}-${Math.floor(Math.random() * 1000)}`;
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const tenantCode = `DLR-${data.city ? data.city.slice(0, 3).toUpperCase() : 'PAK'}-${randomSuffix}`;

    const startDate = data.startDate || new Date().toISOString().split('T')[0];
    let expiryDate = data.expiryDate;
    if (!expiryDate) {
      const d = new Date(startDate);
      if (data.plan === '1_MONTH') {
        d.setDate(d.getDate() + 30);
      } else {
        d.setDate(d.getDate() + 365);
      }
      expiryDate = d.toISOString().split('T')[0];
    }

    const isActive = data.active !== false;
    const status: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' = isActive ? 'ACTIVE' : 'SUSPENDED';

    const newDealer: Dealer = {
      id: uniqueTenantId,
      name: data.name.trim(),
      code: tenantCode,
      contactPerson: data.contactPerson.trim(),
      phone: data.phone.trim(),
      email: cleanEmail,
      city: data.city?.trim() || 'Karachi',
      address: data.address?.trim() || 'Commercial Area',
      active: isActive,
      subscription: {
        plan: data.plan,
        startDate,
        expiryDate,
        status: status === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED',
        autoRenew: true,
      },
      createdAt: new Date().toISOString(),
    };

    // Hash password with cryptographically secure PBKDF2 + salt
    const hashed = hashPassword(data.password);
    const newUser: StoredUser = {
      id: `user-${uniqueTenantId}`,
      username: cleanUsername,
      email: cleanEmail,
      name: `${newDealer.name} (Admin)`,
      role: 'DEALER',
      dealerId: uniqueTenantId,
      passwordHash: hashed.hash,
      passwordSalt: hashed.salt,
      active: isActive,
      subscriptionStatus: status,
    };

    this.dealers.unshift(newDealer);
    this.users.unshift(newUser);

    return { dealer: newDealer, user: newUser };
  }

  // Super Admin: Edit Dealer information
  public updateDealer(
    dealerId: string,
    updates: {
      name?: string;
      contactPerson?: string;
      phone?: string;
      email?: string;
      city?: string;
      address?: string;
      active?: boolean;
    }
  ): Dealer {
    const dealer = this.dealers.find((d) => d.id === dealerId);
    if (!dealer) throw new Error('Dealer not found');

    if (updates.name !== undefined) dealer.name = updates.name.trim();
    if (updates.contactPerson !== undefined) dealer.contactPerson = updates.contactPerson.trim();
    if (updates.phone !== undefined) dealer.phone = updates.phone.trim();
    if (updates.email !== undefined) dealer.email = updates.email.trim();
    if (updates.city !== undefined) dealer.city = updates.city.trim();
    if (updates.address !== undefined) dealer.address = updates.address.trim();

    if (updates.active !== undefined) {
      dealer.active = updates.active;
      if (!dealer.active) {
        dealer.subscription.status = 'SUSPENDED';
      } else {
        const todayStr = new Date().toISOString().split('T')[0];
        dealer.subscription.status = todayStr > dealer.subscription.expiryDate ? 'EXPIRED' : 'ACTIVE';
      }
    }

    // Sync with StoredUser
    const user = this.users.find((u) => u.dealerId === dealerId && u.role === 'DEALER');
    if (user) {
      if (updates.name !== undefined) user.name = `${dealer.name} (Admin)`;
      if (updates.email !== undefined) user.email = dealer.email;
      if (updates.active !== undefined) user.active = dealer.active;
      user.subscriptionStatus = dealer.subscription.status;
    }

    return dealer;
  }

  // Super Admin: Update / Renew Subscription
  public updateDealerSubscription(
    dealerId: string,
    plan: '1_MONTH' | '1_YEAR',
    startDate: string,
    expiryDate: string,
    status?: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'SUSPENDED',
    autoRenew: boolean = true
  ): Dealer {
    const dealer = this.dealers.find((d) => d.id === dealerId);
    if (!dealer) throw new Error('Dealer not found');

    // Validation: Expiry Date must not be earlier than Start Date
    if (expiryDate < startDate) {
      throw new Error('Subscription expiry date cannot be earlier than the start date.');
    }

    const todayStr = new Date().toISOString().split('T')[0];
    let computedStatus = status;

    if (!computedStatus) {
      if (!dealer.active) {
        computedStatus = 'SUSPENDED';
      } else if (todayStr > expiryDate) {
        computedStatus = 'EXPIRED';
      } else {
        const today = new Date(todayStr).getTime();
        const expiry = new Date(expiryDate).getTime();
        const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        computedStatus = diffDays <= 7 && diffDays >= 0 ? 'EXPIRING_SOON' : 'ACTIVE';
      }
    }

    dealer.subscription = {
      plan,
      startDate,
      expiryDate,
      status: computedStatus,
      autoRenew,
    };

    // If subscription is made active, make sure dealer and user active flags are consistent
    if (computedStatus === 'ACTIVE' || computedStatus === 'EXPIRING_SOON') {
      dealer.active = true;
    }

    const user = this.users.find((u) => u.dealerId === dealerId && u.role === 'DEALER');
    if (user) {
      user.subscriptionStatus = computedStatus;
      user.active = dealer.active;
    }

    return dealer;
  }

  // Super Admin: Toggle Active / Inactive Status
  public toggleDealerStatus(dealerId: string, targetStatus?: boolean): Dealer {
    const dealer = this.dealers.find((d) => d.id === dealerId);
    if (!dealer) throw new Error('Dealer not found');

    const nextActive = targetStatus !== undefined ? targetStatus : !dealer.active;
    dealer.active = nextActive;

    const todayStr = new Date().toISOString().split('T')[0];
    if (!nextActive) {
      dealer.subscription.status = 'SUSPENDED';
    } else {
      dealer.subscription.status = todayStr > dealer.subscription.expiryDate ? 'EXPIRED' : 'ACTIVE';
    }

    const user = this.users.find((u) => u.dealerId === dealerId && u.role === 'DEALER');
    if (user) {
      user.active = nextActive;
      user.subscriptionStatus = dealer.subscription.status;
    }

    return dealer;
  }

  // Safe Delete: Check if dealer has historical business transactions or records
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
    const ordersCount = this.orders.filter((o) => o.dealerId === dealerId).length;
    const invoicesCount = this.invoices.filter((i) => i.dealerId === dealerId).length;
    const productsCount = this.products.filter((p) => p.dealerId === dealerId).length;
    const customersCount = this.customers.filter((c) => c.dealerId === dealerId).length;
    const orderTakersCount = this.orderTakers.filter((o) => o.dealerId === dealerId).length;
    const stockTxCount = this.stockTransactions.filter((s) => s.dealerId === dealerId).length;
    const ledgerCount = this.ledgerEntries.filter((l) => l.dealerId === dealerId).length;
    const returnsCount = this.returns.filter((r) => r.dealerId === dealerId).length;

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

  // Safe Delete: Delete or Soft-Delete / Deactivate Dealer
  public safeDeleteDealer(dealerId: string): {
    success: boolean;
    softDeleted: boolean;
    message: string;
    dealerName: string;
  } {
    const dealer = this.dealers.find((d) => d.id === dealerId);
    if (!dealer) throw new Error('Dealer not found');

    const analysis = this.checkDealerHistoricalRecords(dealerId);

    // Section 19: If Dealer has historical or business records, DO NOT physically destroy the data!
    if (analysis.hasRecords) {
      dealer.active = false;
      dealer.subscription.status = 'SUSPENDED';
      dealer.isSoftDeleted = true;

      const user = this.users.find((u) => u.dealerId === dealerId && u.role === 'DEALER');
      if (user) {
        user.active = false;
        user.subscriptionStatus = 'SUSPENDED';
      }

      return {
        success: true,
        softDeleted: true,
        dealerName: dealer.name,
        message: `Dealer '${dealer.name}' has historical business records (${analysis.ordersCount} orders, ${analysis.invoicesCount} invoices). To protect financial records from corruption, this Dealer account has been safely deactivated & suspended. All historical archives remain intact.`,
      };
    }

    // Zero records: safe to hard delete
    const dealerName = dealer.name;
    this.dealers = this.dealers.filter((d) => d.id !== dealerId);
    this.users = this.users.filter((u) => u.dealerId !== dealerId);

    return {
      success: true,
      softDeleted: false,
      dealerName,
      message: `Dealer '${dealerName}' had no historical records and was permanently removed safely.`,
    };
  }

  // =========================================================================
  // PHASE 3: PRODUCT & STOCK MANAGEMENT METHODS (TENANT-ISOLATED)
  // =========================================================================

  // Add Product with Opening Stock & Atomic Stock Movement Logging
  public addProduct(
    dealerId: string,
    data: {
      name: string;
      sku: string;
      category: string;
      unit: string;
      buyPrice: number;
      salePrice: number;
      stock?: number;
      openingStock?: number;
      minStockAlert?: number;
      lowStockThreshold?: number;
      status?: 'ACTIVE' | 'INACTIVE';
    }
  ): { product: Product; transaction?: StockTransaction } {
    const cleanName = data.name.trim();
    if (!cleanName) {
      throw new Error('Product Name is required and cannot be empty.');
    }

    const cleanSku = data.sku.trim();
    if (!cleanSku) {
      throw new Error('SKU / Product Code is required and cannot be empty.');
    }

    // Section 6: SKU uniqueness within Dealer / Tenant scope
    const existingSku = this.products.find(
      (p) => p.dealerId === dealerId && p.sku.toLowerCase() === cleanSku.toLowerCase() && !p.isSoftDeleted
    );
    if (existingSku) {
      throw new Error(`SKU '${cleanSku}' already exists in your product catalog. Please use a unique SKU.`);
    }

    // Section 9 & 10: Validate numeric, non-negative monetary values
    const buyPrice = Number(data.buyPrice);
    if (isNaN(buyPrice) || buyPrice < 0) {
      throw new Error('Buy Price must be a valid, non-negative number.');
    }

    const salePrice = Number(data.salePrice);
    if (isNaN(salePrice) || salePrice < 0) {
      throw new Error('Sale Price must be a valid, non-negative number.');
    }

    // Section 12 & 14: Quantity must be numeric and non-negative
    const initialQty = Number(data.stock !== undefined ? data.stock : (data.openingStock || 0));
    if (isNaN(initialQty) || initialQty < 0) {
      throw new Error('Initial/Opening Stock Quantity must be a valid, non-negative number.');
    }

    const minAlert = Number(data.minStockAlert !== undefined ? data.minStockAlert : (data.lowStockThreshold || 10));
    if (isNaN(minAlert) || minAlert < 0) {
      throw new Error('Low Stock Alert Threshold must be a valid, non-negative number.');
    }

    // Section 11: Profit per unit calculated automatically
    const profitPerUnit = Number((salePrice - buyPrice).toFixed(2));

    const timestamp = new Date().toISOString();
    const newProduct: Product = {
      id: `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      dealerId,
      name: cleanName,
      productName: cleanName,
      sku: cleanSku,
      category: data.category.trim() || 'General',
      unit: data.unit.trim() || 'Pieces',
      buyPrice,
      salePrice,
      profitPerUnit,
      stock: initialQty,
      stockQuantity: initialQty,
      minStockAlert: minAlert,
      lowStockThreshold: minAlert,
      status: data.status || 'ACTIVE',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.products.unshift(newProduct);

    // Section 15: Stock movement for opening stock
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
        timestamp,
        note: `Opening stock initialized at ${initialQty} ${newProduct.unit}`,
      };
      this.stockTransactions.unshift(initialTx);
    }

    return { product: newProduct, transaction: initialTx };
  }

  // Edit Product details
  public updateProduct(
    dealerId: string,
    productId: string,
    updates: {
      name?: string;
      sku?: string;
      category?: string;
      unit?: string;
      buyPrice?: number;
      salePrice?: number;
      minStockAlert?: number;
      lowStockThreshold?: number;
      status?: 'ACTIVE' | 'INACTIVE';
    }
  ): Product {
    const product = this.products.find((p) => p.id === productId && p.dealerId === dealerId);
    if (!product) {
      throw new Error('Product not found or unauthorized.');
    }

    if (updates.name !== undefined) {
      const cleanName = updates.name.trim();
      if (!cleanName) throw new Error('Product Name cannot be empty.');
      product.name = cleanName;
      product.productName = cleanName;
    }

    if (updates.sku !== undefined) {
      const cleanSku = updates.sku.trim();
      if (!cleanSku) throw new Error('SKU cannot be empty.');
      // Check uniqueness if SKU is changing
      if (cleanSku.toLowerCase() !== product.sku.toLowerCase()) {
        const conflict = this.products.find(
          (p) => p.dealerId === dealerId && p.id !== productId && p.sku.toLowerCase() === cleanSku.toLowerCase() && !p.isSoftDeleted
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
      if (isNaN(val) || val < 0) throw new Error('Buy Price must be a non-negative number.');
      product.buyPrice = val;
    }

    if (updates.salePrice !== undefined) {
      const val = Number(updates.salePrice);
      if (isNaN(val) || val < 0) throw new Error('Sale Price must be a non-negative number.');
      product.salePrice = val;
    }

    // Recalculate profitPerUnit
    product.profitPerUnit = Number((product.salePrice - product.buyPrice).toFixed(2));

    if (updates.minStockAlert !== undefined || updates.lowStockThreshold !== undefined) {
      const val = Number(updates.minStockAlert !== undefined ? updates.minStockAlert : updates.lowStockThreshold);
      if (isNaN(val) || val < 0) throw new Error('Low Stock Threshold must be a non-negative number.');
      product.minStockAlert = val;
      product.lowStockThreshold = val;
    }

    if (updates.status !== undefined) {
      product.status = updates.status;
    }

    product.updatedAt = new Date().toISOString();
    return product;
  }

  // Adjust / Restock inventory with Negative Stock Protection and Atomic Movement Logging
  public adjustProductStock(
    dealerId: string,
    productId: string,
    quantityChange: number,
    type: StockTransactionType = 'MANUAL_ADJUSTMENT',
    note: string = '',
    referenceId: string = 'MANUAL-ADJ',
    referenceType: 'MANUAL' | 'ORDER' | 'RETURN' | 'AUDIT' = 'MANUAL'
  ): { product: Product; transaction: StockTransaction } {
    const product = this.products.find((p) => p.id === productId && p.dealerId === dealerId);
    if (!product) {
      throw new Error('Product not found or unauthorized.');
    }

    const change = Number(quantityChange);
    if (isNaN(change) || change === 0) {
      throw new Error('Quantity change must be a non-zero number.');
    }

    const previousStock = product.stock;
    const newStock = previousStock + change;

    // Section 19 & 31: Stock Safety & Negative Stock Prevention
    if (newStock < 0) {
      throw new Error(
        `Insufficient stock for '${product.name}'. Current stock is ${previousStock}, requested deduction is ${Math.abs(change)}. Stock cannot become negative.`
      );
    }

    // Atomically update product stock
    product.stock = newStock;
    product.stockQuantity = newStock;
    product.updatedAt = new Date().toISOString();

    // Log Stock Transaction
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

    this.stockTransactions.unshift(transaction);

    return { product, transaction };
  }

  // Toggle Product Status (Active / Inactive)
  public toggleProductStatus(dealerId: string, productId: string, targetStatus?: 'ACTIVE' | 'INACTIVE'): Product {
    const product = this.products.find((p) => p.id === productId && p.dealerId === dealerId);
    if (!product) throw new Error('Product not found or unauthorized.');

    const nextStatus = targetStatus || (product.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
    product.status = nextStatus;
    product.updatedAt = new Date().toISOString();
    return product;
  }

  // Check if product is referenced in historical business transactions
  public checkProductHistoricalRecords(dealerId: string, productId: string): {
    hasRecords: boolean;
    ordersCount: number;
    invoicesCount: number;
    returnsCount: number;
    stockTxCount: number;
    summary: string;
  } {
    const ordersCount = this.orders.filter(
      (o) => o.dealerId === dealerId && o.items.some((it) => it.productId === productId)
    ).length;

    const invoicesCount = this.invoices.filter(
      (i) => i.dealerId === dealerId && i.items.some((it) => it.productId === productId)
    ).length;

    const returnsCount = this.returns.filter(
      (r) => r.dealerId === dealerId && r.productId === productId
    ).length;

    const stockTxCount = this.stockTransactions.filter(
      (s) => s.dealerId === dealerId && s.productId === productId
    ).length;

    const total = ordersCount + invoicesCount + returnsCount;

    return {
      hasRecords: total > 0,
      ordersCount,
      invoicesCount,
      returnsCount,
      stockTxCount,
      summary: total > 0
        ? `Product is referenced in ${ordersCount} orders, ${invoicesCount} invoices, and ${returnsCount} returns. Safe deactivation rule applies.`
        : 'Zero sales or invoice records found. Safe to permanently remove.',
    };
  }

  // Safe Product Deletion (Section 28)
  public safeDeleteProduct(dealerId: string, productId: string): {
    success: boolean;
    softDeleted: boolean;
    productName: string;
    message: string;
  } {
    const product = this.products.find((p) => p.id === productId && p.dealerId === dealerId);
    if (!product) throw new Error('Product not found or unauthorized.');

    const analysis = this.checkProductHistoricalRecords(dealerId, productId);

    // Section 28: If product has historical records, soft delete / deactivate to preserve historical sales
    if (analysis.hasRecords) {
      product.status = 'INACTIVE';
      product.isSoftDeleted = true;
      product.deletedAt = new Date().toISOString();

      return {
        success: true,
        softDeleted: true,
        productName: product.name,
        message: `Product '${product.name}' is referenced in past business records (${analysis.ordersCount} orders, ${analysis.invoicesCount} invoices). To preserve historical data integrity, this product was safely deactivated and archived.`,
      };
    }

    // Clean product: hard delete
    const prodName = product.name;
    this.products = this.products.filter((p) => !(p.id === productId && p.dealerId === dealerId));
    this.stockTransactions = this.stockTransactions.filter(
      (s) => !(s.productId === productId && s.dealerId === dealerId)
    );

    return {
      success: true,
      softDeleted: false,
      productName: prodName,
      message: `Product '${prodName}' had zero historical sales and was permanently removed safely.`,
    };
  }

  // Calculate Real Dealer Inventory Valuations (Section 17 & 27)
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
    const activeProducts = this.products.filter((p) => p.dealerId === dealerId && !p.isSoftDeleted);

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

  // Get distinct categories for dealer
  public getDealerCategories(dealerId: string): string[] {
    const prods = this.products.filter((p) => p.dealerId === dealerId && !p.isSoftDeleted);
    return Array.from(new Set(prods.map((p) => p.category))).filter(Boolean);
  }

  // =========================================================================
  // PHASE 4: DEALER CUSTOMER / SHOP MANAGEMENT ENGINE METHODS
  // Strictly isolated by Dealer Tenant ID. Enforces proper monetary opening
  // balance, safe deletion, and status controls.
  // =========================================================================

  public getCustomerById(dealerId: string, customerId: string): CustomerShop | undefined {
    return this.customers.find((c) => c.id === customerId && c.dealerId === dealerId && !c.isSoftDeleted);
  }

  public addCustomer(
    dealerId: string,
    data: {
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
    const cleanShopName = (data.shopName || '').trim();
    if (!cleanShopName) {
      throw new Error('Shop Name is required and cannot be empty.');
    }

    const cleanPhone = (data.phone || '').trim();
    if (!cleanPhone) {
      throw new Error('Phone Number is required and cannot be empty.');
    }

    const openingBalance = Number(data.openingBalance !== undefined ? data.openingBalance : 0);
    if (isNaN(openingBalance) || openingBalance < 0) {
      throw new Error('Opening Balance must be a valid, non-negative monetary number.');
    }

    const contact = (data.contactPerson || data.ownerName || '').trim();

    const timestamp = Date.now();
    const newCustomer: CustomerShop = {
      id: `cust-${dealerId}-${timestamp}-${Math.floor(Math.random() * 1000)}`,
      dealerId,
      shopName: cleanShopName,
      ownerName: contact || cleanShopName,
      contactPerson: contact || cleanShopName,
      phone: cleanPhone,
      alternatePhone: (data.alternatePhone || '').trim(),
      city: (data.city || 'Karachi').trim(),
      area: (data.area || '').trim(),
      address: (data.address || '').trim(),
      openingBalance,
      currentBalance: openingBalance, // Properly initialized monetary balance (Req 12)
      creditLimit: data.creditLimit !== undefined ? Number(data.creditLimit) : 50000,
      status: data.status || 'ACTIVE',
      isSoftDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.customers.unshift(newCustomer);
    return newCustomer;
  }

  public updateCustomer(
    dealerId: string,
    customerId: string,
    updates: {
      shopName?: string;
      contactPerson?: string;
      ownerName?: string;
      phone?: string;
      alternatePhone?: string;
      city?: string;
      area?: string;
      address?: string;
      creditLimit?: number;
      status?: 'ACTIVE' | 'INACTIVE';
    }
  ): CustomerShop {
    const customer = this.customers.find((c) => c.id === customerId && c.dealerId === dealerId);
    if (!customer) {
      throw new Error('Customer / Shop not found or unauthorized.');
    }

    if (updates.shopName !== undefined) {
      const cleanName = updates.shopName.trim();
      if (!cleanName) throw new Error('Shop Name cannot be empty.');
      customer.shopName = cleanName;
    }

    if (updates.contactPerson !== undefined || updates.ownerName !== undefined) {
      const person = (updates.contactPerson || updates.ownerName || '').trim();
      customer.contactPerson = person;
      customer.ownerName = person;
    }

    if (updates.phone !== undefined) {
      const cleanPhone = updates.phone.trim();
      if (!cleanPhone) throw new Error('Phone Number cannot be empty.');
      customer.phone = cleanPhone;
    }

    if (updates.alternatePhone !== undefined) {
      customer.alternatePhone = updates.alternatePhone.trim();
    }

    if (updates.city !== undefined) {
      customer.city = updates.city.trim();
    }

    if (updates.area !== undefined) {
      customer.area = updates.area.trim();
    }

    if (updates.address !== undefined) {
      customer.address = updates.address.trim();
    }

    if (updates.creditLimit !== undefined) {
      const limit = Number(updates.creditLimit);
      if (!isNaN(limit) && limit >= 0) {
        customer.creditLimit = limit;
      }
    }

    if (updates.status !== undefined) {
      customer.status = updates.status;
    }

    customer.updatedAt = new Date().toISOString();
    return customer;
  }

  public toggleCustomerStatus(
    dealerId: string,
    customerId: string,
    targetStatus?: 'ACTIVE' | 'INACTIVE'
  ): CustomerShop {
    const customer = this.customers.find((c) => c.id === customerId && c.dealerId === dealerId);
    if (!customer) throw new Error('Customer / Shop not found or unauthorized.');

    const next = targetStatus || (customer.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
    customer.status = next;
    customer.updatedAt = new Date().toISOString();
    return customer;
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
    const ordersCount = this.orders.filter(
      (o) => o.customerId === customerId && o.dealerId === dealerId
    ).length;
    const invoicesCount = this.invoices.filter(
      (i) => i.customerId === customerId && i.dealerId === dealerId
    ).length;
    const returnsCount = this.returns.filter(
      (r) => r.customerId === customerId && r.dealerId === dealerId
    ).length;
    const ledgerCount = this.ledgerEntries.filter(
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
    const customer = this.customers.find((c) => c.id === customerId && c.dealerId === dealerId);
    if (!customer) throw new Error('Customer / Shop not found or unauthorized.');

    const analysis = this.checkCustomerHistoricalRecords(dealerId, customerId);

    // If customer has historical records, soft-delete / deactivate safely
    if (analysis.hasRecords) {
      customer.status = 'INACTIVE';
      customer.isSoftDeleted = true;
      customer.deletedAt = new Date().toISOString();
      customer.updatedAt = new Date().toISOString();

      return {
        success: true,
        softDeleted: true,
        shopName: customer.shopName,
        message: `Customer '${customer.shopName}' is referenced in past records (${analysis.ordersCount} orders, ${analysis.invoicesCount} invoices, ${analysis.ledgerCount} ledger entries). To preserve accounting integrity, this shop was safely deactivated and archived.`,
      };
    }

    // Clean customer: safe to permanently remove
    const shopName = customer.shopName;
    this.customers = this.customers.filter((c) => !(c.id === customerId && c.dealerId === dealerId));

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
    const customer = this.customers.find((c) => c.id === customerId && c.dealerId === dealerId);
    if (!customer) throw new Error('Customer not found or unauthorized');

    const customerLedger = this.ledgerEntries.filter(
      (l) => l.customerId === customerId && l.dealerId === dealerId
    );
    const totalDebit = customerLedger.reduce((acc, l) => acc + (l.debit || 0), 0);
    const totalCredit = customerLedger.reduce((acc, l) => acc + (l.credit || 0), 0);

    const ordersCount = this.orders.filter(
      (o) => o.customerId === customerId && o.dealerId === dealerId
    ).length;
    const invoicesCount = this.invoices.filter(
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
    const custs = this.customers.filter((c) => c.dealerId === dealerId && !c.isSoftDeleted);

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

  // =========================================================================
  // PHASE 5: ORDER TAKER MANAGEMENT, STATUS & LOCATION ENGINE METHODS
  // Strictly isolated by Dealer Tenant ID. Supports add, edit, activate/deactivate,
  // safe delete, real presence/heartbeat, and browser location updates.
  // =========================================================================

  public getOrderTakerById(dealerId: string, orderTakerId: string): OrderTaker | undefined {
    return this.orderTakers.find(
      (ot) => ot.id === orderTakerId && ot.dealerId === dealerId && !ot.isSoftDeleted
    );
  }

  public addOrderTaker(
    dealerId: string,
    data: {
      fullName?: string;
      name?: string;
      username?: string;
      email?: string;
      phone: string;
      password?: string;
      status?: 'ACTIVE' | 'INACTIVE';
      active?: boolean;
      locationSharingEnabled?: boolean;
    }
  ): { orderTaker: OrderTaker; user: StoredUser } {
    const rawName = (data.fullName || data.name || '').trim();
    if (!rawName) {
      throw new Error('Order Taker Full Name is required and cannot be empty.');
    }

    const rawPhone = (data.phone || '').trim();
    if (!rawPhone) {
      throw new Error('Phone Number is required and cannot be empty.');
    }

    const cleanUsername = (data.username || data.email?.split('@')[0] || `ot_${Date.now()}`)
      .trim()
      .toLowerCase();
    if (!cleanUsername) {
      throw new Error('Username or Email is required for Order Taker login.');
    }

    const cleanEmail = (data.email || `${cleanUsername}@dealer.pk`).trim().toLowerCase();

    // Check for duplicate username or email across users
    const existing = this.findUserByLogin(cleanUsername) || this.findUserByLogin(cleanEmail);
    if (existing) {
      throw new Error(`An account with username '${cleanUsername}' or email '${cleanEmail}' already exists.`);
    }

    const count = this.orderTakers.filter((o) => o.dealerId === dealerId).length + 1;
    const employeeCode = `OT-${String(count).padStart(3, '0')}`;
    const timestamp = Date.now();
    const id = `ot-${dealerId}-${timestamp}-${Math.floor(Math.random() * 1000)}`;

    const isActive = data.status ? data.status === 'ACTIVE' : data.active !== false;
    const locSharing = data.locationSharingEnabled !== undefined ? data.locationSharingEnabled : true;
    const nowIso = new Date().toISOString();

    const newOT: OrderTaker = {
      id,
      dealerId,
      name: rawName,
      fullName: rawName,
      username: cleanUsername,
      employeeCode,
      phone: rawPhone,
      email: cleanEmail,
      active: isActive,
      status: isActive ? 'ACTIVE' : 'INACTIVE',
      isSoftDeleted: false,
      onlineStatus: 'OFFLINE',
      lastSeenAt: undefined,
      locationSharingEnabled: locSharing,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // Hash password with cryptographically secure PBKDF2 + salt
    const plainPass = data.password;
    if (!plainPass || String(plainPass).length < 8) {
      throw new Error('Password is required and must be at least 8 characters.');
    }
    const hashed = hashPassword(plainPass);
    const newUser: StoredUser = {
      id: `user-${id}`,
      username: cleanUsername,
      email: cleanEmail,
      name: `${rawName} (${employeeCode})`,
      role: 'ORDER_TAKER',
      dealerId,
      orderTakerId: id,
      passwordHash: hashed.hash,
      passwordSalt: hashed.salt,
      active: isActive,
    };

    this.orderTakers.unshift(newOT);
    this.users.unshift(newUser);

    return { orderTaker: newOT, user: newUser };
  }

  public updateOrderTaker(
    dealerId: string,
    orderTakerId: string,
    updates: {
      fullName?: string;
      name?: string;
      phone?: string;
      username?: string;
      email?: string;
      password?: string;
      status?: 'ACTIVE' | 'INACTIVE';
      active?: boolean;
      locationSharingEnabled?: boolean;
    }
  ): OrderTaker {
    const ot = this.orderTakers.find((o) => o.id === orderTakerId && o.dealerId === dealerId);
    if (!ot) {
      throw new Error('Order Taker not found or unauthorized.');
    }

    if (updates.fullName !== undefined || updates.name !== undefined) {
      const n = (updates.fullName || updates.name || '').trim();
      if (!n) throw new Error('Full Name cannot be empty.');
      ot.name = n;
      ot.fullName = n;
    }

    if (updates.phone !== undefined) {
      const p = updates.phone.trim();
      if (!p) throw new Error('Phone Number cannot be empty.');
      ot.phone = p;
    }

    if (updates.email !== undefined) {
      ot.email = updates.email.trim().toLowerCase();
    }

    if (updates.status !== undefined) {
      ot.active = updates.status === 'ACTIVE';
      ot.status = updates.status;
      if (!ot.active) {
        ot.onlineStatus = 'OFFLINE';
      }
    } else if (updates.active !== undefined) {
      ot.active = updates.active;
      ot.status = updates.active ? 'ACTIVE' : 'INACTIVE';
      if (!ot.active) {
        ot.onlineStatus = 'OFFLINE';
      }
    }

    if (updates.locationSharingEnabled !== undefined) {
      ot.locationSharingEnabled = updates.locationSharingEnabled;
    }

    // Sync user account
    const user = this.users.find(
      (u) => u.orderTakerId === orderTakerId && u.dealerId === dealerId
    );
    if (user) {
      user.name = `${ot.name} (${ot.employeeCode})`;
      user.active = ot.active;
      if (updates.password && updates.password.trim()) {
        const hashed = hashPassword(updates.password.trim());
        user.passwordHash = hashed.hash;
        user.passwordSalt = hashed.salt;
      }
    }

    ot.updatedAt = new Date().toISOString();
    return ot;
  }

  public toggleOrderTakerStatus(
    dealerId: string,
    orderTakerId: string,
    targetStatus?: 'ACTIVE' | 'INACTIVE'
  ): OrderTaker {
    const ot = this.orderTakers.find((o) => o.id === orderTakerId && o.dealerId === dealerId);
    if (!ot) throw new Error('Order Taker not found or unauthorized.');

    const nextActive = targetStatus ? targetStatus === 'ACTIVE' : !ot.active;
    return this.updateOrderTaker(dealerId, orderTakerId, {
      active: nextActive,
      status: nextActive ? 'ACTIVE' : 'INACTIVE',
    });
  }

  public checkOrderTakerHistoricalRecords(
    dealerId: string,
    orderTakerId: string
  ): {
    hasRecords: boolean;
    ordersCount: number;
    invoicesCount: number;
    summary: string;
  } {
    const ordersCount = this.orders.filter(
      (o) => o.orderTakerId === orderTakerId && o.dealerId === dealerId
    ).length;
    const invoicesCount = this.invoices.filter(
      (i) => i.orderTakerId === orderTakerId && i.dealerId === dealerId
    ).length;

    const total = ordersCount + invoicesCount;
    return {
      hasRecords: total > 0,
      ordersCount,
      invoicesCount,
      summary:
        total > 0
          ? `Order Taker is referenced in ${ordersCount} orders and ${invoicesCount} invoices. Safe deactivation/archival applies.`
          : 'Zero sales or invoice records found. Safe to permanently delete.',
    };
  }

  public safeDeleteOrderTaker(
    dealerId: string,
    orderTakerId: string
  ): {
    success: boolean;
    softDeleted: boolean;
    orderTakerName: string;
    message: string;
  } {
    const ot = this.orderTakers.find((o) => o.id === orderTakerId && o.dealerId === dealerId);
    if (!ot) throw new Error('Order Taker not found or unauthorized.');

    const analysis = this.checkOrderTakerHistoricalRecords(dealerId, orderTakerId);

    // If order taker has historical records, soft-delete and preserve historical integrity
    if (analysis.hasRecords) {
      ot.active = false;
      ot.status = 'INACTIVE';
      ot.onlineStatus = 'OFFLINE';
      ot.isSoftDeleted = true;
      ot.deletedAt = new Date().toISOString();
      ot.updatedAt = new Date().toISOString();

      const user = this.users.find(
        (u) => u.orderTakerId === orderTakerId && u.dealerId === dealerId
      );
      if (user) {
        user.active = false;
      }

      return {
        success: true,
        softDeleted: true,
        orderTakerName: ot.name,
        message: `Order Taker '${ot.name}' is referenced in past records (${analysis.ordersCount} orders, ${analysis.invoicesCount} invoices). To preserve transaction audit integrity, this representative was safely deactivated and archived.`,
      };
    }

    // Clean order taker: safe to permanently remove
    const name = ot.name;
    this.orderTakers = this.orderTakers.filter(
      (o) => !(o.id === orderTakerId && o.dealerId === dealerId)
    );
    this.users = this.users.filter(
      (u) => !(u.orderTakerId === orderTakerId && u.dealerId === dealerId)
    );

    return {
      success: true,
      softDeleted: false,
      orderTakerName: name,
      message: `Order Taker '${name}' had zero historical orders and was permanently removed safely.`,
    };
  }

  // Record presence heartbeat (Online/Offline + Last Seen)
  public updateOrderTakerPresence(
    dealerId: string,
    orderTakerId: string,
    onlineStatus: 'ONLINE' | 'OFFLINE'
  ): OrderTaker {
    const ot = this.orderTakers.find((o) => o.id === orderTakerId && o.dealerId === dealerId);
    if (!ot) throw new Error('Order Taker not found or unauthorized.');

    ot.onlineStatus = onlineStatus;
    ot.lastSeenAt = new Date().toISOString();
    ot.updatedAt = new Date().toISOString();
    return ot;
  }

  // Record verified browser GPS location (No fake GPS, respects Location Sharing)
  public updateOrderTakerLocation(
    dealerId: string,
    orderTakerId: string,
    coords: {
      latitude: number;
      longitude: number;
      accuracy?: number;
      addressLabel?: string;
    }
  ): OrderTaker {
    const ot = this.orderTakers.find((o) => o.id === orderTakerId && o.dealerId === dealerId);
    if (!ot) throw new Error('Order Taker not found or unauthorized.');

    if (!ot.locationSharingEnabled) {
      throw new Error('Location updates rejected: Location Sharing is turned OFF for this Order Taker.');
    }

    if (typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number' || isNaN(coords.latitude) || isNaN(coords.longitude)) {
      throw new Error('Invalid coordinates: Latitude and Longitude must be valid numbers.');
    }

    const nowIso = new Date().toISOString();
    ot.lastLocation = {
      orderTakerId: ot.id,
      dealerId: ot.dealerId,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      addressLabel: coords.addressLabel || `Lat ${coords.latitude.toFixed(4)}, Lng ${coords.longitude.toFixed(4)}`,
      lastUpdated: nowIso,
    };
    ot.onlineStatus = 'ONLINE';
    ot.lastSeenAt = nowIso;
    ot.updatedAt = nowIso;

    return ot;
  }

  // Toggle Location Sharing ON/OFF
  public toggleOrderTakerLocationSharing(
    dealerId: string,
    orderTakerId: string,
    enabled?: boolean
  ): OrderTaker {
    const ot = this.orderTakers.find((o) => o.id === orderTakerId && o.dealerId === dealerId);
    if (!ot) throw new Error('Order Taker not found or unauthorized.');

    const nextVal = enabled !== undefined ? enabled : !ot.locationSharingEnabled;
    ot.locationSharingEnabled = nextVal;
    ot.updatedAt = new Date().toISOString();
    return ot;
  }

  // Get KPI counts for Dealer Dashboard Order Takers Section
  public getDealerOrderTakerKPIs(dealerId: string): {
    totalOrderTakers: number;
    activeOrderTakers: number;
    inactiveOrderTakers: number;
    onlineOrderTakers: number;
    offlineOrderTakers: number;
    locationSharingOnCount: number;
    locationSharingOffCount: number;
  } {
    const list = this.orderTakers.filter((o) => o.dealerId === dealerId && !o.isSoftDeleted);

    let activeCount = 0;
    let inactiveCount = 0;
    let onlineCount = 0;
    let offlineCount = 0;
    let sharingOnCount = 0;
    let sharingOffCount = 0;

    for (const ot of list) {
      if (ot.active) {
        activeCount++;
      } else {
        inactiveCount++;
      }

      if (ot.onlineStatus === 'ONLINE') {
        onlineCount++;
      } else {
        offlineCount++;
      }

      if (ot.locationSharingEnabled) {
        sharingOnCount++;
      } else {
        sharingOffCount++;
      }
    }

    return {
      totalOrderTakers: list.length,
      activeOrderTakers: activeCount,
      inactiveOrderTakers: inactiveCount,
      onlineOrderTakers: onlineCount,
      offlineOrderTakers: offlineCount,
      locationSharingOnCount: sharingOnCount,
      locationSharingOffCount: sharingOffCount,
    };
  }

  // Confirm Order & Generate Automatic Invoice (Atomic Stock Deduction & Ledger Update)
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
    // Double-submission / Idempotency protection check (Section 14)
    if (payload.clientRequestId) {
      const existingOrder = this.orders.find(
        (o) => o.dealerId === dealerId && o.clientRequestId === payload.clientRequestId
      );
      if (existingOrder) {
        const existingInv = this.invoices.find(
          (i) => i.id === existingOrder.invoiceId || i.orderId === existingOrder.id
        );
        if (existingInv) {
          return { order: existingOrder, invoice: existingInv };
        }
      }
    }

    const dealer = this.getDealerById(dealerId);
    if (!dealer) throw new Error('Dealer not found');

    const customer = this.customers.find((c) => c.id === payload.customerId && c.dealerId === dealerId);
    if (!customer) throw new Error('Customer shop not found or unauthorized');

    const orderTaker = this.orderTakers.find(
      (ot) => ot.id === payload.orderTakerId && ot.dealerId === dealerId
    );
    if (!orderTaker) throw new Error('Order Taker representative not found or unauthorized');

    if (!payload.items || payload.items.length === 0) {
      throw new Error('Order must contain at least one product item.');
    }

    // 1. Verify Stock & Prepare Items
    const preparedItems = [];
    const stockDeductions: { product: Product; quantity: number; previousStock: number; newStock: number }[] = [];

    for (const item of payload.items) {
      const product = this.products.find((p) => p.id === item.productId && p.dealerId === dealerId);
      if (!product) {
        throw new Error(`Product with ID "${item.productId}" not found in your catalog.`);
      }

      if (item.quantity <= 0) {
        throw new Error(`Quantity for "${product.name}" must be greater than zero.`);
      }

      // Negative stock prevention protocol
      if (product.stock < item.quantity) {
        throw new Error(
          `Insufficient stock for "${product.name}". Available: ${product.stock}, Requested: ${item.quantity}. Cannot fulfill order.`
        );
      }

      const discPct = Math.min(100, Math.max(0, item.discountPercent || 0));
      const grossPrice = item.quantity * item.salePrice;
      const discountAmount = Number(((grossPrice * discPct) / 100).toFixed(2));
      const lineTotal = Number((grossPrice - discountAmount).toFixed(2));

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

    const orderSeq = this.orders.filter((o) => o.dealerId === dealerId).length + 1;
    const invSeq = this.invoices.filter((i) => i.dealerId === dealerId).length + 1;
    const orderNumber = `ORD-2026-${String(orderSeq).padStart(4, '0')}`;
    const invoiceNumber = `INV-2026-${String(invSeq).padStart(4, '0')}`;

    const orderId = `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const invoiceId = `inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const nowIso = new Date().toISOString();

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

    // 4. Atomic Stock Reduction & Movement Transaction
    for (const deduction of stockDeductions) {
      deduction.product.stock = deduction.newStock;
      deduction.product.stockQuantity = deduction.newStock;
      deduction.product.updatedAt = nowIso;

      this.stockTransactions.unshift({
        id: `stx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        dealerId,
        productId: deduction.product.id,
        productName: deduction.product.name,
        sku: deduction.product.sku,
        type: 'SALE_DEDUCTION',
        quantityChange: -deduction.quantity,
        previousStock: deduction.previousStock,
        newStock: deduction.newStock,
        referenceId: orderId,
        referenceType: 'ORDER',
        timestamp: nowIso,
        note: `Order ${orderNumber} confirmed sale deduction`,
      });
    }

    // 5. Update Customer Ledger
    const currentCustomerBalance = customer.currentBalance;
    const newCustomerBalanceAfterDebit = currentCustomerBalance + grandTotal;
    const finalCustomerBalance = newCustomerBalanceAfterDebit - paid;

    // Debit entry for invoice total
    this.ledgerEntries.unshift({
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

    if (paid > 0) {
      this.ledgerEntries.unshift({
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

    customer.currentBalance = finalCustomerBalance;

    this.orders.unshift(newOrder);
    this.invoices.unshift(newInvoice);

    return { order: newOrder, invoice: newInvoice };
  }

  public getOrderById(dealerId: string, orderId: string): Order | undefined {
    return this.orders.find((o) => o.id === orderId && o.dealerId === dealerId);
  }

  public getInvoiceById(dealerId: string, invoiceId: string): Invoice | undefined {
    return this.invoices.find((i) => i.id === invoiceId && i.dealerId === dealerId);
  }

  public getInvoiceByOrderId(dealerId: string, orderId: string): Invoice | undefined {
    return this.invoices.find((i) => (i.orderId === orderId || i.id === orderId) && i.dealerId === dealerId);
  }

  public incrementInvoicePrintCount(dealerId: string, invoiceId: string): Invoice {
    const inv = this.invoices.find((i) => i.id === invoiceId && i.dealerId === dealerId);
    if (!inv) throw new Error('Invoice not found or unauthorized.');
    inv.printedCount = (inv.printedCount || 0) + 1;
    return inv;
  }

  // Process Sales Return
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
    const customer = this.customers.find((c) => c.id === payload.customerId && c.dealerId === dealerId);
    if (!customer) throw new Error('Customer not found');

    const product = this.products.find((p) => p.id === payload.productId && p.dealerId === dealerId);
    if (!product) throw new Error('Product not found');

    if (payload.returnedQuantity <= 0) {
      throw new Error('Returned quantity must be greater than zero');
    }

    const totalRefund = payload.returnedQuantity * payload.unitRefundPrice;
    const nowIso = new Date().toISOString();
    const returnNumber = `RET-2026-${String(this.returns.length + 1).padStart(4, '0')}`;

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
    product.stock = newStock;
    product.stockQuantity = newStock;
    product.updatedAt = nowIso;

    // 2. Add Stock Transaction Log
    this.stockTransactions.unshift({
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
    });

    // 3. Customer Ledger Credit Adjustment
    const newCustomerBalance = customer.currentBalance - totalRefund;
    this.ledgerEntries.unshift({
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
    });

    customer.currentBalance = newCustomerBalance;
    this.returns.unshift(newReturn);

    return newReturn;
  }

  // =========================================================================
  // PHASE 7: PRINTING & PRINTER SETTINGS ENGINE METHODS
  // Strictly isolated by Dealer Tenant ID. Enforces default printer, paper formats,
  // copy count, auto-print flags, and safe read-only reprint operations.
  // =========================================================================

  public getPrinterById(dealerId: string, printerId: string): PrinterSetting | undefined {
    return this.printerSettings.find((p) => p.id === printerId && p.dealerId === dealerId);
  }

  public getDefaultPrinter(dealerId: string): PrinterSetting | undefined {
    const list = this.getDealerPrinters(dealerId);
    return list.find((p) => p.isDefault) || list[0];
  }

  public addPrinterSetting(
    dealerId: string,
    data: {
      printerName: string;
      printerType?: 'THERMAL_80MM' | 'A4_OFFICE_LASER' | 'A5_HALF_PAGE';
      paperSize: '80mm' | 'A4' | 'A5';
      isDefault?: boolean;
      autoPrintOnConfirm?: boolean;
      copies?: number;
      headerNotes?: string;
      footerNotes?: string;
    }
  ): PrinterSetting {
    const name = (data.printerName || '').trim();
    if (!name) throw new Error('Printer Name is required and cannot be empty.');

    const copies = Math.max(1, Math.min(10, Number(data.copies || 1)));
    const paperSize = data.paperSize || '80mm';
    let pType = data.printerType;
    if (!pType) {
      pType = paperSize === '80mm' ? 'THERMAL_80MM' : paperSize === 'A5' ? 'A5_HALF_PAGE' : 'A4_OFFICE_LASER';
    }

    const currentPrinters = this.getDealerPrinters(dealerId);
    const shouldBeDefault = data.isDefault !== undefined ? data.isDefault : currentPrinters.length === 0;

    if (shouldBeDefault) {
      currentPrinters.forEach((p) => {
        p.isDefault = false;
      });
    }

    const id = `prt-${dealerId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newPrinter: PrinterSetting = {
      id,
      dealerId,
      printerName: name,
      printerType: pType,
      paperSize,
      isDefault: shouldBeDefault,
      autoPrintOnConfirm: !!data.autoPrintOnConfirm,
      copies,
      headerNotes: data.headerNotes?.trim(),
      footerNotes: data.footerNotes?.trim(),
    };

    this.printerSettings.unshift(newPrinter);
    return newPrinter;
  }

  public updatePrinterSetting(
    dealerId: string,
    printerId: string,
    updates: Partial<PrinterSetting>
  ): PrinterSetting {
    const printer = this.printerSettings.find((p) => p.id === printerId && p.dealerId === dealerId);
    if (!printer) throw new Error('Printer profile not found or unauthorized.');

    if (updates.printerName !== undefined) {
      const n = updates.printerName.trim();
      if (!n) throw new Error('Printer Name cannot be empty.');
      printer.printerName = n;
    }

    if (updates.paperSize !== undefined) {
      printer.paperSize = updates.paperSize;
      if (!updates.printerType) {
        printer.printerType = updates.paperSize === '80mm' ? 'THERMAL_80MM' : updates.paperSize === 'A5' ? 'A5_HALF_PAGE' : 'A4_OFFICE_LASER';
      }
    }

    if (updates.printerType !== undefined) {
      printer.printerType = updates.printerType;
    }

    if (updates.copies !== undefined) {
      printer.copies = Math.max(1, Math.min(10, Number(updates.copies)));
    }

    if (updates.autoPrintOnConfirm !== undefined) {
      printer.autoPrintOnConfirm = !!updates.autoPrintOnConfirm;
    }

    if (updates.headerNotes !== undefined) {
      printer.headerNotes = updates.headerNotes;
    }

    if (updates.footerNotes !== undefined) {
      printer.footerNotes = updates.footerNotes;
    }

    if (updates.isDefault === true) {
      this.getDealerPrinters(dealerId).forEach((p) => {
        p.isDefault = p.id === printerId;
      });
    }

    return printer;
  }

  public setDefaultPrinter(dealerId: string, printerId: string): PrinterSetting {
    const target = this.printerSettings.find((p) => p.id === printerId && p.dealerId === dealerId);
    if (!target) throw new Error('Printer profile not found or unauthorized.');

    this.getDealerPrinters(dealerId).forEach((p) => {
      p.isDefault = p.id === printerId;
    });

    return target;
  }

  public deletePrinterSetting(dealerId: string, printerId: string): { success: boolean; message: string } {
    const idx = this.printerSettings.findIndex((p) => p.id === printerId && p.dealerId === dealerId);
    if (idx === -1) throw new Error('Printer profile not found or unauthorized.');

    const deleted = this.printerSettings.splice(idx, 1)[0];

    // If the deleted printer was default, assign default to another printer if available
    if (deleted.isDefault) {
      const remaining = this.getDealerPrinters(dealerId);
      if (remaining.length > 0) {
        remaining[0].isDefault = true;
      }
    }

    return {
      success: true,
      message: `Printer profile '${deleted.printerName}' removed successfully.`,
    };
  }
}

export const serverDb = new ServerDatabase();
