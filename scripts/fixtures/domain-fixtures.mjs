const now = '2026-10-03T12:00:00.000Z';

export const roomFeatures = [
  {
    id: 'RF-01',
    name: 'Aire acondicionado',
    description: 'Climatizacion individual.',
    created_at: now,
    updated_at: now,
  },
];

export const mediaImages = [
  {
    id: 'MED-01',
    alt_text: 'Cama matrimonial con vista al jardin',
    position: 0,
    primary: true,
    width: 1600,
    height: 1067,
    urls: {
      thumb: 'http://localhost:8080/api/v1/public/media/MED-01/thumb',
      medium: 'http://localhost:8080/api/v1/public/media/MED-01/medium',
      large: 'http://localhost:8080/api/v1/public/media/MED-01/large',
    },
  },
  {
    id: 'MED-02',
    position: 1,
    primary: false,
    width: 960,
    height: 640,
    urls: {
      thumb: 'http://localhost:8080/api/v1/public/media/MED-02/thumb',
      medium: 'http://localhost:8080/api/v1/public/media/MED-02/medium',
      large: 'http://localhost:8080/api/v1/public/media/MED-02/large',
    },
  },
];

export const roomTypes = [
  {
    id: 'RT-01',
    code: 'EST',
    name: 'Estandar',
    description: 'Habitacion base.',
    capacity: 2,
    bed_configuration: '1 cama matrimonial',
    room_feature_ids: ['RF-01'],
    active: true,
    images: mediaImages,
    created_at: now,
    updated_at: now,
  },
];

export const rooms = [
  {
    id: 'RM-101',
    room_number: '101',
    room_type_id: 'RT-01',
    floor: 1,
    status: 'available',
    housekeeping_status: 'clean',
    created_at: now,
    updated_at: now,
  },
  {
    id: 'RM-102',
    room_number: '102',
    room_type_id: 'RT-01',
    floor: 1,
    status: 'available',
    housekeeping_status: 'dirty',
    created_at: now,
    updated_at: now,
  },
];

export const guests = [
  {
    id: 'GST-001',
    first_name: 'Ana',
    last_name: 'Lopez',
    email: 'ana@example.com',
    phone: '+502 5555-0101',
    nationality: 'Guatemalteca',
    document_type: 'national_id',
    document_number: '1000 20000 0101',
    created_at: now,
    updated_at: now,
  },
];

export const rates = [
  {
    id: 'RATE-01',
    room_type_id: 'RT-01',
    name: 'Tarifa base',
    valid_from: '2026-01-01',
    valid_to: '2026-12-31',
    price_cents: 65000,
    currency: 'GTQ',
    minimum_nights: 1,
    refundable: true,
    active: true,
    created_at: now,
    updated_at: now,
  },
];

export const bookings = [
  {
    id: 'BKG-001',
    confirmation_code: 'PMS-001',
    guest_link_code: 'LNK-001',
    guest_id: 'GST-001',
    room_id: 'RM-101',
    room_type_id: 'RT-01',
    rate_id: 'RATE-01',
    check_in: '2026-10-10',
    check_out: '2026-10-12',
    status: 'confirmed',
    adults: 2,
    children: 0,
    total_amount_cents: 130000,
    currency: 'GTQ',
    created_at: now,
    updated_at: now,
  },
];

export const bookingCompanions = [
  {
    id: 'BCMP-001',
    booking_id: 'BKG-001',
    first_name: 'Luis',
    last_name: 'Lopez',
    document_type: 'national_id',
    document_number: '1000 20000 0102',
    guest_type: 'adult',
    created_at: now,
    updated_at: now,
  },
];

export const promotions = [
  {
    id: 'PROMO-01',
    code: 'EARLY',
    name: 'Reserva anticipada',
    description: 'Descuento base',
    discount_percent: 10,
    valid_from: '2026-01-01',
    valid_to: '2026-12-31',
    active: true,
    created_at: now,
    updated_at: now,
  },
];

export const users = [
  {
    id: 'USR-001',
    first_name: 'Maria',
    last_name: 'Perez',
    email: 'maria@example.com',
    role: 'admin',
    status: 'active',
    created_at: now,
    updated_at: now,
  },
  {
    id: 'USR-002',
    first_name: 'Jose',
    last_name: 'Garcia',
    email: 'jose@example.com',
    role: 'housekeeping',
    status: 'inactive',
    created_at: now,
    updated_at: now,
  },
];

export const permissions = [
  {
    id: 'PERM-001',
    key: 'dashboard.read',
    name: 'Ver tablero',
    description: 'Acceso al tablero.',
    created_at: now,
    updated_at: now,
  },
];

export const roles = [
  {
    id: 'ROLE-001',
    code: 'admin',
    name: 'Administrador',
    permission_ids: ['PERM-001'],
    active: true,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'ROLE-002',
    code: 'housekeeping',
    name: 'Limpieza',
    permission_ids: ['PERM-001'],
    active: true,
    created_at: now,
    updated_at: now,
  },
];

export const products = [
  {
    id: 'PRD-001',
    sku: 'RS-COFFEE',
    name: 'Cafe americano',
    description: 'Cafe de la casa',
    category: 'food_and_beverage',
    price_cents: 1500,
    currency: 'GTQ',
    active: true,
    images: [],
    created_at: now,
    updated_at: now,
  },
  {
    id: 'PRD-002',
    sku: 'RS-CAKE',
    name: 'Pastel',
    description: 'Postre',
    category: 'food_and_beverage',
    price_cents: 2800,
    currency: 'GTQ',
    active: false,
    images: [],
    created_at: now,
    updated_at: now,
  },
];

export const amenities = [
  {
    id: 'AMN-01',
    name: 'Piscina',
    description: 'Piscina principal',
    category: 'hotel',
    location: 'Terraza',
    opens_at: '08:00',
    closes_at: '20:00',
    active: true,
    images: [],
    created_at: now,
    updated_at: now,
  },
  {
    id: 'AMN-02',
    name: 'Wi-Fi',
    description: 'Internet continuo',
    category: 'hotel',
    location: 'Todo el hotel',
    active: false,
    images: [],
    created_at: now,
    updated_at: now,
  },
];

export const guestAccounts = [
  {
    id: 'GACC-001',
    booking_id: 'BKG-001',
    guest_id: 'GST-001',
    status: 'open',
    balance_cents: 50000,
    currency: 'GTQ',
    opened_at: now,
    created_at: now,
    updated_at: now,
  },
];

export const charges = [
  {
    id: 'CHG-001',
    booking_id: 'BKG-001',
    description: 'Estancia',
    quantity: 1,
    unit_price_cents: 130000,
    amount_cents: 130000,
    currency: 'GTQ',
    category: 'stay',
    status: 'posted',
    charged_at: now,
    created_by_user_id: 'USR-001',
    created_at: now,
  },
  {
    id: 'CHG-002',
    booking_id: 'BKG-001',
    description: 'Duplicado',
    quantity: 1,
    unit_price_cents: 1000,
    amount_cents: 1000,
    currency: 'GTQ',
    category: 'other',
    status: 'voided',
    void_reason: 'Cargo duplicado.',
    charged_at: now,
    created_at: now,
  },
];

export const payments = [
  {
    id: 'PAY-001',
    booking_id: 'BKG-001',
    amount_cents: 60000,
    currency: 'GTQ',
    method: 'cash',
    status: 'completed',
    transaction_reference: 'RCB-001',
    paid_at: now,
    processed_by_user_id: 'USR-001',
    created_at: now,
  },
];

export const deposits = [
  {
    id: 'DEP-001',
    booking_id: 'BKG-001',
    guest_id: 'GST-001',
    amount_cents: 20000,
    currency: 'GTQ',
    method: 'card',
    status: 'held',
    collected_at: now,
    created_at: now,
    updated_at: now,
  },
];

export const cashSessions = [
  {
    id: 'CS-001',
    opened_by_user_id: 'USR-001',
    status: 'closed',
    opening_balance_cents: 100000,
    expected_balance_cents: 155000,
    counted_balance_cents: 155000,
    difference_cents: 0,
    opened_at: now,
    closed_at: now,
    created_at: now,
    updated_at: now,
  },
  {
    id: 'CS-002',
    opened_by_user_id: 'USR-001',
    status: 'open',
    opening_balance_cents: 155000,
    opened_at: now,
    created_at: now,
    updated_at: now,
  },
];

export const cashMovements = [
  {
    id: 'CMV-001',
    cash_session_id: 'CS-001',
    type: 'income',
    amount_cents: 60000,
    payment_id: 'PAY-001',
    responsible_user_id: 'USR-001',
    occurred_at: now,
    created_at: now,
  },
  {
    id: 'CMV-002',
    cash_session_id: 'CS-001',
    type: 'expense',
    amount_cents: 5000,
    responsible_user_id: 'USR-001',
    occurred_at: now,
    created_at: now,
  },
];

export const inventoryItems = [
  {
    id: 'INV-001',
    sku: 'HK-TOWEL',
    name: 'Toalla',
    description: 'Toalla blanca',
    category: 'housekeeping',
    unit: 'unit',
    current_quantity: 3,
    minimum_quantity: 4,
    active: true,
    created_at: now,
    updated_at: now,
  },
];

export const inventoryMovements = [
  {
    id: 'IMV-001',
    inventory_item_id: 'INV-001',
    type: 'in',
    reason: 'purchase',
    quantity: 10,
    responsible_user_id: 'USR-001',
    occurred_at: now,
    created_at: now,
  },
  {
    id: 'IMV-002',
    inventory_item_id: 'INV-001',
    type: 'out',
    reason: 'consumption',
    quantity: 7,
    responsible_user_id: 'USR-001',
    occurred_at: now,
    created_at: now,
  },
];

export const auditLogs = [
  {
    id: 'AUD-001',
    user_id: 'USR-001',
    module: 'cash',
    action: 'open',
    entity_type: 'cash_session',
    entity_id: 'CS-001',
    occurred_at: now,
    created_at: now,
  },
];

export const orders = [
  {
    id: 'ORD-001',
    booking_id: 'BKG-001',
    room_id: 'RM-101',
    guest_id: 'GST-001',
    items: [{ product_id: 'PRD-001', quantity: 2, unit_price_cents: 1500 }],
    status: 'pending',
    currency: 'GTQ',
    requested_at: now,
    created_at: now,
    updated_at: now,
  },
];

export const serviceRequests = [
  {
    id: 'SR-001',
    booking_id: 'BKG-001',
    room_id: 'RM-101',
    guest_id: 'GST-001',
    type: 'housekeeping',
    description: 'Toallas extra',
    status: 'pending',
    requested_at: now,
    created_at: now,
    updated_at: now,
  },
];

export const allCatalogs = {
  roomFeatures,
  roomTypes,
  rooms,
  guests,
  rates,
  bookings,
  bookingCompanions,
  promotions,
  users,
  permissions,
  roles,
  products,
  amenities,
  guestAccounts,
  charges,
  payments,
  deposits,
  cashSessions,
  cashMovements,
  inventoryItems,
  inventoryMovements,
  auditLogs,
  orders,
  serviceRequests,
};

export const allRecords = Object.values(allCatalogs).flat();
