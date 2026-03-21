import { AssetMaster, AssetType, FeeSchedule, FeeType, Location, LocationType, LocationCategory, Truck, Driver, Batch, BatchMovement, MovementCondition, ThaanSlip, Claim, ClaimAudit, InventoryRecord, AssetLoss, LossType, AuditLog, UserRole, User, BillingModel, OwnershipType, PartnerType } from './types';

export const MOCK_TRUCKS: Truck[] = [
  { id: 'TRK-001', plate_number: 'GP 22 SH', model: 'Hino 300', capacity: 4000 },
  { id: 'TRK-002', plate_number: 'CA 99 LU', model: 'Isuzu NPR', capacity: 3500 },
  { id: 'TRK-003', plate_number: 'ZN 44 BB', model: 'Mercedes Atego', capacity: 8000 },
];

export const MOCK_DRIVERS: Driver[] = [
  { id: 'DRV-001', full_name: 'Dumisani Kumalo', license_number: 'L-9001', phone: '082 111 2222' },
  { id: 'DRV-002', full_name: 'Pieter van Wyk', license_number: 'L-9002', phone: '083 333 4444' },
  { id: 'DRV-003', full_name: 'Sipho Ndlovu', license_number: 'L-9003', phone: '084 555 6666' },
];

export const MOCK_USERS: User[] = [
  { id: 'U-001', name: 'John Dlamini', role: UserRole.ADMIN, branch_id: 'LOC-JHB-01' },
  { id: 'U-002', name: 'Sarah Mbeki', role: UserRole.MANAGER, branch_id: 'LOC-JHB-01' },
  { id: 'U-003', name: 'Thabo Sithole', role: UserRole.STAFF, branch_id: 'LOC-JHB-01' },
  { id: 'U-004', name: 'Nomvula Zulu', role: UserRole.EXECUTIVE, branch_id: 'LOC-JHB-01' },
];

export const MOCK_ASSETS: AssetMaster[] = [
  { id: 'SH-001', name: 'Lupo Standard Bread Crate', type: AssetType.CRATE, dimensions: '600x400x150mm', material: 'HDPE-Amber', billing_model: BillingModel.DAILY_RENTAL, ownership_type: OwnershipType.EXTERNAL },
  { id: 'SH-002', name: 'Lupo Confectionery Tray', type: AssetType.CRATE, dimensions: '600x400x90mm', material: 'HDPE-Clear', billing_model: BillingModel.DAILY_RENTAL, ownership_type: OwnershipType.EXTERNAL },
  { id: 'SH-003', name: 'Lupo Roll Crate (Deep)', type: AssetType.CRATE, dimensions: '600x400x210mm', material: 'HDPE-Blue', billing_model: BillingModel.DAILY_RENTAL, ownership_type: OwnershipType.EXTERNAL },
  { id: 'SH-P01', name: 'Heavy Duty Flour Pallet', type: AssetType.PALLET, dimensions: '1200x1000mm', material: 'Reinforced Pine', billing_model: BillingModel.ISSUE_FEE, ownership_type: OwnershipType.EXTERNAL },
  { id: 'SH-P02', name: 'Lupo Export Euro Pallet', type: AssetType.PALLET, dimensions: '1200x800mm', material: 'Heat-Treated Wood', billing_model: BillingModel.ISSUE_FEE, ownership_type: OwnershipType.EXTERNAL },
];

export const MOCK_LOCATIONS: Location[] = [
  { id: 'LOC-JHB-01', name: 'Lupo JHB Main Plant (Kya Sands)', type: LocationType.CRATES_DEPT, category: LocationCategory.HOME, partner_type: PartnerType.INTERNAL },
  { id: 'LOC-CPT-01', name: 'Lupo CPT Distribution Hub', type: LocationType.WAREHOUSE, category: LocationCategory.HOME, partner_type: PartnerType.INTERNAL },
  { id: 'LOC-DBN-01', name: 'Lupo KZN Depot', type: LocationType.WAREHOUSE, category: LocationCategory.HOME, partner_type: PartnerType.INTERNAL },
  { id: 'LOC-CUST-01', name: 'Pick n Pay Hyper Woodmead', type: LocationType.AT_CUSTOMER, category: LocationCategory.EXTERNAL, partner_type: PartnerType.CUSTOMER },
  { id: 'LOC-CUST-02', name: 'Spar Kyalami', type: LocationType.AT_CUSTOMER, category: LocationCategory.EXTERNAL, partner_type: PartnerType.CUSTOMER },
  { id: 'LOC-CUST-03', name: 'Checkers Sandton', type: LocationType.AT_CUSTOMER, category: LocationCategory.EXTERNAL, partner_type: PartnerType.CUSTOMER },
  { id: 'LOC-TRANS-01', name: 'Truck GP 22 SH (Lupo)', type: LocationType.IN_TRANSIT, category: LocationCategory.EXTERNAL, partner_type: PartnerType.INTERNAL },
  { id: 'LOC-TRANS-02', name: 'Truck CA 99 LU (Lupo)', type: LocationType.IN_TRANSIT, category: LocationCategory.EXTERNAL, partner_type: PartnerType.INTERNAL },
  { id: 'LOC-SUP-01', name: 'SHUKU Asset Recovery Yard', type: LocationType.RETURNING, category: LocationCategory.EXTERNAL, partner_type: PartnerType.SUPPLIER },
  { id: 'LOC-COLD-01', name: 'Lupo Frozen Vault A', type: LocationType.COLD_STORAGE, category: LocationCategory.EXTERNAL, partner_type: PartnerType.INTERNAL },
];

export const MOCK_FEES: FeeSchedule[] = [
  { id: 'FEE-2025-01', asset_id: 'SH-001', fee_type: FeeType.DAILY_RENTAL, amount_zar: 4.85, effective_from: '2025-01-01', effective_to: '2025-06-30' },
  { id: 'FEE-2025-02', asset_id: 'SH-001', fee_type: FeeType.DAILY_RENTAL, amount_zar: 5.15, effective_from: '2025-07-01', effective_to: null },
  { id: 'FEE-2025-03', asset_id: 'SH-P01', fee_type: FeeType.ISSUE_FEE, amount_zar: 145.00, effective_from: '2025-01-01', effective_to: null },
  { id: 'FEE-REP-01', asset_id: 'SH-001', fee_type: FeeType.REPLACEMENT_FEE, amount_zar: 135.00, effective_from: '2025-01-01', effective_to: null },
  { id: 'FEE-REP-02', asset_id: 'SH-P01', fee_type: FeeType.REPLACEMENT_FEE, amount_zar: 920.00, effective_from: '2025-01-01', effective_to: null },
  { id: 'FEE-SAL-01', asset_id: 'SH-001', fee_type: FeeType.SALVAGE_CREDIT, amount_zar: 15.00, effective_from: '2025-01-01', effective_to: null },
];

const generateMockData = () => {
  const batches: Batch[] = [];
  const movements: BatchMovement[] = [];
  const assetsIds = ['SH-001', 'SH-002', 'SH-003', 'SH-P01', 'SH-P02'];
  const locationsIds = ['LOC-JHB-01', 'LOC-CPT-01', 'LOC-DBN-01', 'LOC-CUST-01', 'LOC-CUST-02', 'LOC-COLD-01', 'LOC-TRANS-01', 'LOC-TRANS-02'];
  
  for (let i = 1; i <= 105; i++) {
    const assetId = assetsIds[Math.floor(Math.random() * assetsIds.length)];
    const batchId = `LB-BATCH-${i.toString().padStart(3, '0')}`;
    const qty = Math.floor(Math.random() * 400) + 50;
    const locId = locationsIds[Math.floor(Math.random() * locationsIds.length)];
    const location = MOCK_LOCATIONS.find(l => l.id === locId);
    const branchId = location?.branch_id || (locId.includes('JHB') ? 'Kya Sands' : (locId.includes('DBN') ? 'Durban' : 'Kya Sands'));
    const date = new Date(Date.now() - Math.floor(Math.random() * 60) * 24 * 60 * 60 * 1000).toISOString();
    
    batches.push({
      id: batchId,
      asset_id: assetId,
      quantity: qty,
      current_location_id: locId,
      created_at: date,
      status: Math.random() > 0.1 ? 'Success' : 'Pending',
      condition: MovementCondition.CLEAN
    });

    movements.push({
      id: `LB-MOV-${i}-1`,
      batch_id: batchId,
      from_location_id: 'LOC-JHB-01',
      to_location_id: locId,
      quantity: qty,
      transaction_date: date.split('T')[0],
      timestamp: date,
      condition: Math.random() > 0.05 ? MovementCondition.CLEAN : MovementCondition.DIRTY,
      origin_user_id: 'U-003',
      truck_id: MOCK_TRUCKS[Math.floor(Math.random() * MOCK_TRUCKS.length)].id,
      driver_id: MOCK_DRIVERS[Math.floor(Math.random() * MOCK_DRIVERS.length)].id
    });
  }

  return { batches, movements };
};

const { batches, movements } = generateMockData();

export const MOCK_BATCHES: Batch[] = batches;
export const MOCK_MOVEMENTS: BatchMovement[] = movements;

export const MOCK_LOSSES: AssetLoss[] = [
  { 
    id: 'LOSS-SH-001', 
    batch_id: 'LB-BATCH-001', 
    loss_type: LossType.MISSING,
    lost_quantity: 42, 
    last_known_location_id: 'LOC-CUST-01', 
    reported_by: 'U-003',
    timestamp: '2025-05-20T14:00:00Z',
    notes: 'Missing during Lupo Bread delivery at Hyper Woodmead.',
    supplier_notified: true,
    supplier_invoice_ref: 'SHUKU-INV-902',
    is_rechargeable: true
  },
  { 
    id: 'LOSS-SH-002', 
    batch_id: 'LB-BATCH-015', 
    loss_type: LossType.SCRAPPED,
    lost_quantity: 8, 
    last_known_location_id: 'LOC-JHB-01', 
    reported_by: 'U-003',
    timestamp: '2025-05-22T09:00:00Z',
    notes: 'Forklift damage at Lupo JHB loading bay.',
    supplier_notified: false,
    is_rechargeable: false
  },
];

export const MOCK_THAANS: ThaanSlip[] = [
  { id: 'THAAN-001', batch_id: 'LB-BATCH-001', doc_url: 'https://picsum.photos/seed/lupo1/400/600', is_signed: true, signed_at: '2025-05-12T09:15:00Z' },
  { id: 'THAAN-002', batch_id: 'LB-BATCH-002', doc_url: 'https://picsum.photos/seed/lupo2/400/600', is_signed: true, signed_at: '2025-05-15T11:45:00Z' },
];

export const MOCK_CLAIMS: Claim[] = [
  { 
    id: 'CLM-LB-001', 
    batch_id: 'LB-BATCH-012', 
    truck_id: 'TRK-001',
    driver_id: 'DRV-001', 
    thaan_slip_id: 'THAAN-001', 
    type: 'Damaged', 
    amount_claimed_zar: 4200.00, 
    status: 'Accepted', 
    created_at: '2025-05-10T10:00:00Z',
    settled_at: '2025-05-25T14:00:00Z'
  },
  { 
    id: 'CLM-LB-002', 
    batch_id: 'LB-BATCH-044', 
    truck_id: 'TRK-002',
    driver_id: 'DRV-003', 
    thaan_slip_id: 'THAAN-002', 
    type: 'Dirty', 
    amount_claimed_zar: 850.00, 
    status: 'Lodged', 
    created_at: '2025-05-28T09:00:00Z' 
  },
];

export const MOCK_CLAIM_AUDITS: ClaimAudit[] = [
  { id: 'AU-01', claim_id: 'CLM-LB-001', status_from: 'None', status_to: 'Lodged', updated_by: 'U-003', timestamp: '2025-05-10T10:00:00Z', notes: 'Damaged detected on Lupo Roll Crates.' },
  { id: 'AU-02', claim_id: 'CLM-LB-001', status_from: 'Lodged', status_to: 'Accepted', updated_by: 'U-001', timestamp: '2025-05-25T14:00:00Z', notes: 'Supplier SHUKU acknowledged fault.' },
];

export const MOCK_AUDIT_LOGS: AuditLog[] = [
  { id: 'AL-001', entity_id: 'LB-BATCH-101', entity_type: 'Batch', action: 'STATUS_CHANGE', old_value: 'In-Transit', new_value: 'At-Customer', user_id: 'U-003', timestamp: '2025-05-28T14:00:00Z' },
  { id: 'AL-002', entity_id: 'LB-BATCH-001', entity_type: 'Batch', action: 'LOSS_RECORDED', old_value: 'Active', new_value: 'Lost', user_id: 'U-003', timestamp: '2025-05-20T14:00:00Z' },
  { id: 'AL-003', entity_id: 'FEE-2025-02', entity_type: 'Fee', action: 'RATE_UPDATE', old_value: '4.85', new_value: '5.15', user_id: 'U-001', timestamp: '2025-06-30T00:00:00Z' },
  { id: 'AL-004', entity_id: 'CLM-LB-001', entity_type: 'Claim', action: 'CLAIM_APPROVAL', old_value: 'Lodged', new_value: 'Accepted', user_id: 'U-002', timestamp: '2025-05-25T14:00:00Z' },
];

export const MOCK_INVENTORY: InventoryRecord[] = [
  { location_id: 'LOC-JHB-01', asset_id: 'SH-001', quantity: 12500 },
  { location_id: 'LOC-CPT-01', asset_id: 'SH-001', quantity: 4200 },
  { location_id: 'LOC-DBN-01', asset_id: 'SH-001', quantity: 3800 },
  { location_id: 'LOC-COLD-01', asset_id: 'SH-002', quantity: 950 },
];
