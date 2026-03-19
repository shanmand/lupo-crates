
export enum UserRole {
  ADMIN = 'System Administrator',
  MANAGER = 'Crates Manager',
  STAFF = 'Crates Department',
  EXECUTIVE = 'Dashboard Viewer'
}

export type Permission = 
  | 'MANAGE_FEES' 
  | 'MANAGE_USERS' 
  | 'APPROVE_CLAIMS' 
  | 'VIEW_SETTLEMENT' 
  | 'WRITE_MOVEMENTS' 
  | 'VERIFY_RECEIPTS'
  | 'MANAGE_LOSSES'
  | 'VIEW_DASHBOARD'
  | 'VIEW_AUDIT_LOGS';

export enum LocationType {
  CRATES_DEPT = 'Crates Dept',
  WAREHOUSE = 'Warehouse',
  COLD_STORAGE = 'Cold Storage',
  AT_CUSTOMER = 'At Customer',
  IN_TRANSIT = 'In Transit',
  RETURNING = 'Returning to Supplier',
  LOST = 'Lost/Written Off'
}

export enum PartnerType {
  INTERNAL = 'Internal',
  CUSTOMER = 'Customer',
  SUPPLIER = 'Supplier'
}

export enum BillingModel {
  DAILY_RENTAL = 'Daily Rental (Supermarket)',
  ISSUE_FEE = 'Issue Fee (QSR)',
  NONE = 'None'
}

export enum OwnershipType {
  INTERNAL = 'Internal',
  EXTERNAL = 'External'
}

export enum LocationCategory {
  HOME = 'Home',
  EXTERNAL = 'External'
}

export enum AssetType {
  CRATE = 'Crate',
  PALLET = 'Pallet'
}

export enum FeeType {
  DAILY_RENTAL = 'Daily Rental (Supermarket)',
  ISSUE_FEE = 'Issue Fee (QSR)',
  REPLACEMENT_FEE = 'Replacement Fee (Lost Equipment)',
  SALVAGE_CREDIT = 'Salvage Credit (Scrapped Assets)'
}

export enum LossType {
  MISSING = 'Missing/Lost',
  SCRAPPED = 'Scrapped (Unrepairable)',
  CUSTOMER_LIABLE = 'Customer Liable',
  STOCK_TAKE_VARIANCE = 'Stock Take Variance'
}

export enum MovementCondition {
  CLEAN = 'Clean',
  DIRTY = 'Dirty',
  DAMAGED = 'Damaged'
}

export type ClaimStatus = 'Lodged' | 'Under Assessment' | 'Returned for Assessment' | 'Accepted' | 'Rejected';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  branch_id: string; // e.g., 'LOC-JHB-01'
}

export interface AssetMaster {
  id: string;
  name: string;
  type: AssetType;
  dimensions: string;
  material: string;
  billing_model: BillingModel;
  ownership_type: OwnershipType;
  supplier_id?: string;
  is_internal?: boolean;
  fee_type?: string;
}

export interface FeeSchedule {
  id: string;
  asset_id: string;
  fee_type: FeeType;
  amount_zar: number;
  effective_from: string; // ISO Date
  effective_to: string | null; // NULL means currently active
  is_active?: boolean; // NEW: For admin bulk management
}

export interface Branch {
  id: string;
  name: string;
  created_at?: string;
}

export interface Location {
  id: string;
  name: string;
  type: LocationType;
  category: LocationCategory;
  branch_id?: string;
  partner_type: PartnerType;
}

export interface MovementDestination {
  id: string;
  name: string;
  partner_type: string;
  display_name: string;
  type?: string;
  category?: string;
}

export interface Source {
  id: string;
  name: string;
  partner_type: string;
  display_name: string;
  sort_group: number;
  branch_id?: string;
  type?: string;
  category?: string;
}

export interface Truck {
  id: string;
  plate_number: string;
  model?: string;
  capacity?: number;
  license_disc_expiry?: string;
  last_renewal_cost_zar?: number;
  license_doc_url?: string;
  branch_id?: string;
  created_at?: string;
}

export interface TruckRoadworthyHistory {
  id: string;
  truck_id: string;
  test_date: string;
  expiry_date: string;
  certificate_number?: string;
  test_fee_zar?: number;
  repair_costs_zar?: number;
  result?: string;
  notes?: string;
  created_at?: string;
}

export interface Driver {
  id: string;
  full_name: string;
  license_number?: string;
  license_expiry?: string;
  prdp_expiry?: string;
  license_doc_url?: string;
  phone?: string;
  contact_number?: string;
  branch_id?: string;
  is_active?: boolean;
  created_at?: string;
}

export interface FleetExpense {
  branch_id: string;
  branch_name: string;
  truck_id: string;
  plate_number: string;
  expense_type: string;
  amount: number;
  expense_date: string;
  license_doc_url?: string;
}

export interface Inspection {
  id?: string;
  driver_id: string;
  truck_id: string;
  inspection_date?: string;
  odometer_reading: number;
  tyres_ok: boolean;
  lights_ok: boolean;
  brakes_ok: boolean;
  fluids_ok: boolean;
  license_disc_present: boolean;
  odometer_photo_url?: string;
  fault_description?: string;
  fault_photo_url?: string;
  is_grounded: boolean;
  branch_id?: string;
  latitude?: number;
  longitude?: number;
  created_at?: string;
}

export interface Batch {
  id: string;
  asset_id: string;
  quantity: number;
  current_location_id: string;
  created_at: string;
  status: 'Pending' | 'Success' | 'Lost' | 'In-Transit' | 'Settled';
  is_settled?: boolean;
  settled_at?: string;
  transaction_date?: string;
  transfer_confirmed_by_customer?: boolean;
  confirmation_date?: string;
}

export interface BatchMovement {
  id: string;
  batch_id: string;
  from_location_id: string;
  to_location_id: string;
  truck_id?: string;
  driver_id?: string;
  timestamp: string;
  condition: MovementCondition;
  origin_user_id: string;
  transaction_date?: string;
}

export interface LogisticsTrace {
  movement_id: string;
  batch_id: string;
  transaction_date: string;
  timestamp: string;
  driver_name: string;
  quantity: number;
  to_location_name: string;
  to_location_id: string;
  from_location_name: string;
  truck_plate: string;
  condition: MovementCondition;
  custodian_branch_id: string;
}

export interface BatchVerification {
  id: string;
  batch_id: string;
  verified_by: string; // User ID
  received_quantity: number;
  expected_quantity: number;
  variance: number;
  timestamp: string;
  notes: string;
}

export interface ThaanSlip {
  id: string;
  batch_id: string;
  doc_url: string;
  is_signed: boolean;
  signed_at: string | null;
}

export interface CollectionRequest {
  id: string;
  customer_id: string;
  customer_name?: string;
  asset_id: string;
  asset_name?: string;
  estimated_quantity: number;
  preferred_pickup_date: string;
  contact_person?: string;
  contact_number?: string;
  status: 'Pending' | 'Assigned' | 'Completed' | 'Cancelled';
  created_at: string;
}

export interface Claim {
  id: string;
  batch_id: string;
  truck_id: string;
  driver_id: string;
  thaan_slip_id: string;
  type: 'Damaged' | 'Dirty';
  amount_claimed_zar: number;
  status: ClaimStatus;
  created_at: string;
  settled_at?: string;
}

export interface AssetLoss {
  id: string;
  batch_id: string;
  loss_type: LossType;
  lost_quantity: number;
  last_known_location_id: string;
  last_driver_name?: string;
  last_truck_plate?: string;
  last_thaan_url?: string;
  reported_by: string; // User ID
  timestamp: string;
  transaction_date?: string;
  notes: string;
  supplier_notified: boolean;
  supplier_invoice_ref?: string;
  is_rechargeable: boolean;
}

export interface ClaimAudit {
  id: string;
  claim_id: string;
  status_from: ClaimStatus | 'None';
  status_to: ClaimStatus;
  updated_by: string;
  timestamp: string;
  notes?: string;
}

export interface InventoryRecord {
  location_id: string;
  asset_id: string;
  quantity: number;
}

export interface AuditLog {
  id: string;
  entity_id: string;
  entity_type: 'Batch' | 'Fee' | 'Claim' | 'Verification';
  action: string;
  old_value: string;
  new_value: string;
  user_id: string;
  timestamp: string;
}

export interface DashboardStats {
  available: number;
  at_customers: number;
  in_transit: number;
  maintenance: number;
  total_fleet: number;
  lost_missing: number;
  damaged: number;
  pending_charges: number;
  open_loss_cases: number;
  accrued_rental: number;
  settlement_liability: number;
  active_customers: number;
  movements_today: number;
}

export interface BatchForensics {
  date: string;
  type: string;
  from_location: string;
  to_location: string;
  quantity: number;
}

export interface AssetIntelligence {
  asset_code: string;
  asset_type: string;
  ownership: string;
  status: string;
  condition: string;
  customer: string;
  charge_type: string;
  accrued: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  priority: 'Low' | 'Medium' | 'High';
  due_date: string;
  assigned_to?: string;
  location_id?: string;
  created_by?: string;
  task_type?: 'General' | 'Stock Take';
  branch_id?: string;
  created_at: string;
}

export interface StockTake {
  id: string;
  location_id: string;
  take_date: string;
  performed_by: string;
  notes?: string;
  created_at: string;
}

export interface StockTakeItem {
  id: string;
  stock_take_id: string;
  asset_id: string;
  system_quantity: number;
  physical_count: number;
  variance: number;
}

export interface Settlement {
  id: string;
  supplier_id: string;
  start_date: string;
  end_date: string;
  gross_liability: number;
  discount_amount: number;
  net_payable: number;
  settled_by: string;
  created_at: string;
}

export interface BusinessParty {
  id: string;
  name: string;
  party_type: 'Customer' | 'Supplier';
  contact_person?: string;
  email?: string;
  phone?: string;
  created_at: string;
}

export interface Discount {
  id: string;
  settlement_id: string;
  amount: number;
  reason: string;
  created_at: string;
}

export interface Trip {
  id: string;
  driver_id: string;
  truck_id: string;
  route_name?: string;
  status: 'Planned' | 'In Progress' | 'Completed' | 'Cancelled';
  start_time?: string;
  end_time?: string;
  created_at?: string;
}

export interface TripStop {
  id: string;
  trip_id: string;
  location_id: string;
  sequence_number: number;
  planned_arrival?: string;
  actual_arrival?: string;
  actual_departure?: string;
  status: 'Pending' | 'Arrived' | 'Departed' | 'Skipped';
  notes?: string;
  created_at?: string;
}
