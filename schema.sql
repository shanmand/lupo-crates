
-- ==========================================
-- SHUKU CRATES & PALLETS TRACKING SCHEMA
-- FULL REFRESH / REWRITE SCRIPT
-- ==========================================

-- 1. CLEANUP (DROP EVERYTHING)
DROP VIEW IF EXISTS public.vw_executive_report CASCADE;
DROP VIEW IF EXISTS public.vw_daily_burn_rate CASCADE;
DROP VIEW IF EXISTS public.vw_inventory_summary CASCADE;
DROP VIEW IF EXISTS public.vw_inventory_map_data CASCADE;
DROP VIEW IF EXISTS public.vw_asset_registry CASCADE;
DROP VIEW IF EXISTS public.vw_stock_take_history CASCADE;
DROP VIEW IF EXISTS public.vw_loss_report CASCADE;
DROP VIEW IF EXISTS public.vw_all_sources CASCADE;
DROP VIEW IF EXISTS public.vw_all_origins CASCADE;
DROP VIEW IF EXISTS public.vw_movement_destinations CASCADE;
DROP VIEW IF EXISTS public.vw_assignable_personnel CASCADE;
DROP VIEW IF EXISTS public.vw_branch_fleet_expenses CASCADE;
DROP VIEW IF EXISTS public.vw_fleet_compliance_alerts CASCADE;
DROP VIEW IF EXISTS public.vw_fleet_readiness CASCADE;
DROP VIEW IF EXISTS public.vw_master_logistics_trace CASCADE;

DROP TABLE IF EXISTS public.batch_verifications CASCADE;
DROP TABLE IF EXISTS public.stock_take_items CASCADE;
DROP TABLE IF EXISTS public.stock_takes CASCADE;
DROP TABLE IF EXISTS public.asset_losses CASCADE;
DROP TABLE IF EXISTS public.batch_movements CASCADE;
DROP TABLE IF EXISTS public.batches CASCADE;
DROP TABLE IF EXISTS public.fee_schedule CASCADE;
DROP TABLE IF EXISTS public.role_permissions CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.drivers CASCADE;
DROP TABLE IF EXISTS public.trucks CASCADE;
DROP TABLE IF EXISTS public.locations CASCADE;
DROP TABLE IF EXISTS public.asset_master CASCADE;
DROP TABLE IF EXISTS public.branches CASCADE;
DROP TABLE IF EXISTS public.business_parties CASCADE;
DROP TABLE IF EXISTS public.trips CASCADE;
DROP TABLE IF EXISTS public.trip_stops CASCADE;
DROP TABLE IF EXISTS public.thaan_slips CASCADE;
DROP TABLE IF EXISTS public.claims CASCADE;
DROP TABLE IF EXISTS public.claim_audits CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.vehicle_inspections CASCADE;
DROP TABLE IF EXISTS public.driver_shifts CASCADE;
DROP TABLE IF EXISTS public.truck_roadworthy_history CASCADE;
DROP TABLE IF EXISTS public.collection_requests CASCADE;

-- DROP FUNCTIONS (using PL/pgSQL to handle overloaded functions)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT proname, oidvectortypes(proargtypes) as args
              FROM pg_proc
              INNER JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid
              WHERE proname IN (
                  'process_inventory_intake', 
                  'process_stock_take', 
                  'approve_stock_take', 
                  'process_asset_loss', 
                  'process_partial_loss',
                  'calculate_batch_accrual', 
                  'calculate_location_liability', 
                  'split_batch', 
                  'handle_new_user', 
                  'is_admin',
                  'check_and_create_supplier',
                  'delete_inventory_batch',
                  'update_inventory_batch',
                  'fn_on_verification_variance'
              )
                AND nspname = 'public')
    LOOP
        EXECUTE 'DROP FUNCTION public.' || r.proname || '(' || r.args || ') CASCADE';
    END LOOP;
END $$;

-- 2. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. CORE TABLES
CREATE TABLE public.branches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- Warehouse, At Customer, etc.
    category TEXT NOT NULL, -- Home, External
    branch_id TEXT REFERENCES public.branches(id),
    partner_type TEXT DEFAULT 'Internal', -- Internal, Customer, Supplier
    address TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.asset_master (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- Crate, Pallet
    dimensions TEXT,
    material TEXT,
    billing_model TEXT DEFAULT 'Daily Rental', -- Daily Rental, Issue Fee, None
    ownership_type TEXT DEFAULT 'Internal', -- Internal, External
    supplier_id TEXT, -- Reference to vw_all_sources(id)
    is_internal BOOLEAN DEFAULT TRUE,
    fee_type TEXT, -- Daily Rental, Issue Fee
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.fee_schedule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id TEXT REFERENCES public.asset_master(id),
    fee_type TEXT NOT NULL, -- Daily Rental, Replacement Fee, Issue Fee
    amount_zar NUMERIC(12, 2) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.business_parties (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    party_type TEXT NOT NULL, -- Customer, Supplier, Transporter
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.batches (
    id TEXT PRIMARY KEY,
    asset_id TEXT REFERENCES public.asset_master(id),
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    current_location_id TEXT, -- Can be from locations or business_parties
    status TEXT DEFAULT 'Success', -- Success, Lost, In-Transit, Retired
    transaction_date DATE DEFAULT CURRENT_DATE,
    transfer_confirmed_by_customer BOOLEAN DEFAULT FALSE,
    confirmation_date TIMESTAMPTZ,
    is_settled BOOLEAN DEFAULT FALSE,
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.batch_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id TEXT REFERENCES public.batches(id),
    from_location_id TEXT, -- Can be from locations or business_parties
    to_location_id TEXT, -- Can be from locations or business_parties
    truck_id TEXT,
    driver_id TEXT,
    moved_by_id TEXT,
    moved_by_name TEXT,
    origin_user_id UUID,
    quantity INTEGER,
    condition TEXT DEFAULT 'Good',
    notes TEXT,
    transaction_date DATE DEFAULT CURRENT_DATE,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.stock_takes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id TEXT, -- Can be from locations or business_parties
    take_date DATE NOT NULL,
    performed_by UUID,
    counter_name TEXT,
    status TEXT DEFAULT 'Pending Approval', -- Pending Approval, Approved, Rejected
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.stock_take_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stock_take_id UUID REFERENCES public.stock_takes(id) ON DELETE CASCADE,
    batch_id TEXT REFERENCES public.batches(id),
    asset_id TEXT REFERENCES public.asset_master(id),
    system_quantity INTEGER NOT NULL,
    physical_count INTEGER NOT NULL,
    variance INTEGER NOT NULL,
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.asset_losses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id TEXT REFERENCES public.batches(id),
    loss_type TEXT NOT NULL, -- Missing, Damaged, Theft
    lost_quantity INTEGER NOT NULL,
    location_id TEXT, -- Can be from locations or business_parties
    reported_by UUID,
    notes TEXT,
    is_settled BOOLEAN DEFAULT FALSE,
    transaction_date DATE DEFAULT CURRENT_DATE,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.batch_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id TEXT REFERENCES public.batches(id),
    verified_by UUID,
    received_quantity INT NOT NULL,
    expected_quantity INT NOT NULL,
    variance INT NOT NULL,
    notes TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name TEXT NOT NULL,
    permission TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role_name, permission)
);

-- Initial permissions for roles
INSERT INTO public.role_permissions (role_name, permission) VALUES
('System Administrator', 'MANAGE_USERS'),
('System Administrator', 'MANAGE_FEES'),
('System Administrator', 'WRITE_MOVEMENTS'),
('System Administrator', 'VIEW_REPORTS'),
('System Administrator', 'VIEW_DASHBOARD'),
('Crates Manager', 'WRITE_MOVEMENTS'),
('Crates Manager', 'VIEW_REPORTS'),
('Crates Manager', 'VIEW_DASHBOARD'),
('Dashboard Viewer', 'VIEW_REPORTS'),
('Dashboard Viewer', 'VIEW_DASHBOARD'),
('Crates Department', 'VIEW_DASHBOARD');

CREATE TABLE public.users (
    id UUID PRIMARY KEY,
    full_name TEXT,
    email TEXT UNIQUE,
    role_name TEXT DEFAULT 'Crates Department', -- System Administrator, Crates Manager, Crates Department, Dashboard Viewer
    home_branch_name TEXT DEFAULT 'Kya Sands',
    branch_id TEXT REFERENCES public.branches(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.trucks (
    id TEXT PRIMARY KEY,
    plate_number TEXT NOT NULL UNIQUE,
    model TEXT,
    capacity INTEGER,
    license_disc_expiry DATE,
    last_renewal_cost_zar NUMERIC DEFAULT 0,
    license_doc_url TEXT,
    branch_id TEXT REFERENCES public.branches(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.drivers (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    license_number TEXT,
    license_expiry DATE,
    prdp_expiry DATE,
    license_doc_url TEXT,
    branch_id TEXT REFERENCES public.branches(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.trips (
    id TEXT PRIMARY KEY,
    truck_id TEXT REFERENCES public.trucks(id),
    driver_id TEXT REFERENCES public.drivers(id),
    route_name TEXT,
    status TEXT DEFAULT 'Planned', -- Planned, In Progress, Completed, Cancelled
    scheduled_date DATE,
    scheduled_departure_time TEXT,
    start_odometer INTEGER,
    end_odometer INTEGER,
    start_location_id TEXT,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.trip_stops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id TEXT REFERENCES public.trips(id) ON DELETE CASCADE,
    location_id TEXT, -- Can be from locations or business_parties
    sequence_number INTEGER NOT NULL,
    status TEXT DEFAULT 'Pending', -- Pending, Arrived, Departed, Skipped
    planned_arrival TIMESTAMPTZ,
    actual_arrival TIMESTAMPTZ,
    actual_departure TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.collection_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id TEXT, -- Can be from locations or business_parties
    asset_id TEXT REFERENCES public.asset_master(id),
    estimated_quantity INTEGER NOT NULL,
    preferred_pickup_date DATE,
    contact_person TEXT,
    contact_number TEXT,
    status TEXT DEFAULT 'Pending', -- Pending, Assigned, Completed, Cancelled
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.thaan_slips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id TEXT REFERENCES public.batches(id),
    doc_url TEXT NOT NULL,
    is_signed BOOLEAN DEFAULT FALSE,
    signed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.claims (
    id TEXT PRIMARY KEY,
    batch_id TEXT REFERENCES public.batches(id),
    truck_id TEXT REFERENCES public.trucks(id),
    driver_id TEXT REFERENCES public.drivers(id),
    type TEXT NOT NULL, -- Damaged, Dirty, Missing
    amount_claimed_zar NUMERIC(12, 2),
    status TEXT DEFAULT 'Lodged', -- Lodged, Investigating, Settled, Rejected
    is_settled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.claim_audits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id TEXT REFERENCES public.claims(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    performed_by UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    performed_by UUID,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.vehicle_inspections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id TEXT REFERENCES public.drivers(id),
    truck_id TEXT REFERENCES public.trucks(id),
    inspection_date DATE DEFAULT CURRENT_DATE,
    odometer_reading INTEGER,
    odometer_photo_url TEXT,
    tyres_ok BOOLEAN DEFAULT true,
    lights_ok BOOLEAN DEFAULT true,
    brakes_ok BOOLEAN DEFAULT true,
    fluids_ok BOOLEAN DEFAULT true,
    license_disc_present BOOLEAN DEFAULT true,
    fault_description TEXT,
    fault_photo_url TEXT,
    is_grounded BOOLEAN DEFAULT false,
    branch_id TEXT REFERENCES public.branches(id),
    latitude NUMERIC,
    longitude NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.branch_budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id TEXT REFERENCES public.branches(id),
    budget_amount NUMERIC NOT NULL DEFAULT 0,
    budget_month DATE NOT NULL DEFAULT date_trunc('month', current_date),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.driver_shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id TEXT REFERENCES public.drivers(id),
    truck_id TEXT REFERENCES public.trucks(id),
    start_time TIMESTAMPTZ DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    manual_end_time TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.truck_roadworthy_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id TEXT REFERENCES public.trucks(id),
    expiry_date DATE NOT NULL,
    certificate_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. FUNCTIONS & RPCs

-- ACCRUAL ENGINE RPC
CREATE OR REPLACE FUNCTION public.calculate_batch_accrual(batch_id_input TEXT)
RETURNS NUMERIC AS $$
DECLARE
    v_total_accrual NUMERIC := 0;
    v_batch RECORD;
    v_end_date TIMESTAMPTZ;
BEGIN
    -- Get batch info
    SELECT * INTO v_batch FROM public.batches WHERE id = batch_id_input;
    IF NOT FOUND THEN RETURN 0; END IF;

    -- Determine the end date for accrual (accrue until settled or now)
    v_end_date := COALESCE(v_batch.settled_at, NOW());

    -- 1. Daily Rental Accrual (handles multiple fee periods)
    WITH DailyPhases AS (
        SELECT 
            fs.amount_zar,
            GREATEST(v_batch.transaction_date::timestamp, fs.effective_from::timestamp) as phase_start,
            LEAST(v_end_date, COALESCE(fs.effective_to::timestamp, '9999-12-31'::timestamp)) as phase_end
        FROM public.fee_schedule fs
        WHERE fs.asset_id = v_batch.asset_id
          AND fs.fee_type LIKE 'Daily Rental%'
          AND fs.is_active = TRUE
    )
    SELECT COALESCE(SUM(
        EXTRACT(DAY FROM (phase_end - phase_start)) * amount_zar * v_batch.quantity
    ), 0)
    INTO v_total_accrual
    FROM DailyPhases
    WHERE phase_end > phase_start;

    -- 2. Issue Fee (One-time fee per unit, added to liability)
    SELECT v_total_accrual + COALESCE(SUM(fs.amount_zar * v_batch.quantity), 0)
    INTO v_total_accrual
    FROM public.fee_schedule fs
    WHERE fs.asset_id = v_batch.asset_id
      AND fs.fee_type LIKE 'Issue Fee%'
      AND fs.is_active = TRUE
      AND fs.effective_from <= v_batch.transaction_date;

    -- 3. Replacement Fee (If Lost, use replacement cost at time of settlement or current)
    IF v_batch.status = 'Lost' THEN
        SELECT v_total_accrual + COALESCE(SUM(fs.amount_zar * v_batch.quantity), 0)
        INTO v_total_accrual
        FROM public.fee_schedule fs
        WHERE fs.asset_id = v_batch.asset_id
          AND fs.fee_type LIKE 'Replacement Fee%'
          AND fs.is_active = TRUE
          AND (
              (v_batch.is_settled = TRUE AND fs.effective_from <= v_batch.settled_at AND (fs.effective_to IS NULL OR fs.effective_to >= v_batch.settled_at))
              OR
              (v_batch.is_settled = FALSE AND fs.effective_to IS NULL)
          );
    END IF;

    RETURN v_total_accrual;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- LOCATION LIABILITY ENGINE
CREATE OR REPLACE FUNCTION public.calculate_location_liability(p_location_id TEXT)
RETURNS NUMERIC AS $$
DECLARE
    v_total NUMERIC := 0;
BEGIN
    SELECT COALESCE(SUM(public.calculate_batch_accrual(id)), 0)
    INTO v_total
    FROM public.batches
    WHERE current_location_id = p_location_id;
    
    RETURN v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- BATCH SPLITTING RPC
CREATE OR REPLACE FUNCTION public.split_batch(
    original_batch_id TEXT, 
    move_qty INTEGER, 
    new_location_id TEXT, 
    move_date DATE
) RETURNS TEXT AS $$
DECLARE
    v_asset_id TEXT;
    v_old_qty INTEGER;
    v_new_batch_id TEXT;
BEGIN
    -- Get original batch info
    SELECT asset_id, quantity INTO v_asset_id, v_old_qty 
    FROM public.batches 
    WHERE id = original_batch_id;

    IF v_old_qty < move_qty THEN
        RAISE EXCEPTION 'Insufficient quantity in batch %', original_batch_id;
    END IF;

    -- 1. Reduce original batch
    UPDATE public.batches 
    SET quantity = quantity - move_qty 
    WHERE id = original_batch_id;

    -- 2. Create new batch for the moved portion
    LOOP
        v_new_batch_id := original_batch_id || '-S' || floor(random() * 1000000)::text;
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.batches WHERE id = v_new_batch_id);
    END LOOP;
    
    INSERT INTO public.batches (id, asset_id, quantity, current_location_id, status, transaction_date)
    VALUES (v_new_batch_id, v_asset_id, move_qty, new_location_id, 'Success', move_date);

    -- 3. Record the movement
    INSERT INTO public.batch_movements (batch_id, from_location_id, to_location_id, transaction_date)
    VALUES (v_new_batch_id, (SELECT current_location_id FROM public.batches WHERE id = original_batch_id), new_location_id, move_date);

    RETURN v_new_batch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- AUTH SYNC TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, full_name, role_name, home_branch_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'role_name', NEW.raw_user_meta_data->>'home_branch_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger is created (or recreated)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- INTAKE FUNCTION
CREATE OR REPLACE FUNCTION process_inventory_intake(
    p_asset_id TEXT,
    p_quantity INTEGER,
    p_location_id TEXT,
    p_origin_id TEXT,
    p_notes TEXT,
    p_user_id TEXT -- Changed to TEXT for robustness (handles 'dev' etc)
) RETURNS TEXT AS $$
DECLARE
    v_batch_id TEXT;
    v_user_uuid UUID;
BEGIN
    -- Attempt to cast p_user_id to UUID, handle failure gracefully
    BEGIN
        v_user_uuid := p_user_id::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_user_uuid := NULL;
    END;

    LOOP
        v_batch_id := 'BAT-' || to_char(now(), 'YYYYMMDD') || '-' || floor(random() * 1000000)::text;
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.batches WHERE id = v_batch_id);
    END LOOP;
    
    INSERT INTO public.batches (id, asset_id, quantity, current_location_id, status, transaction_date)
    VALUES (v_batch_id, p_asset_id, p_quantity, p_location_id, 'Success', CURRENT_DATE);
    
    INSERT INTO public.batch_movements (batch_id, from_location_id, to_location_id, origin_user_id, quantity, condition, notes)
    VALUES (v_batch_id, p_origin_id, p_location_id, v_user_uuid, p_quantity, 'New/Intake', p_notes);
    
    RETURN v_batch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION delete_inventory_batch(p_batch_id TEXT)
RETURNS VOID AS $$
BEGIN
    -- Delete movements first
    DELETE FROM public.batch_movements WHERE batch_id = p_batch_id;
    -- Delete batch
    DELETE FROM public.batches WHERE id = p_batch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_inventory_intake(
    p_batch_id TEXT,
    p_asset_id TEXT,
    p_quantity INTEGER,
    p_location_id TEXT,
    p_origin_id TEXT,
    p_notes TEXT
) RETURNS VOID AS $$
BEGIN
    -- Update batch
    UPDATE public.batches
    SET asset_id = p_asset_id,
        quantity = p_quantity,
        current_location_id = p_location_id
    WHERE id = p_batch_id;

    -- Update movement
    UPDATE public.batch_movements
    SET from_location_id = p_origin_id,
        to_location_id = p_location_id,
        quantity = p_quantity,
        notes = p_notes
    WHERE batch_id = p_batch_id AND condition = 'New/Intake';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STOCK TAKE SUBMISSION
CREATE OR REPLACE FUNCTION process_stock_take(
    p_location_id TEXT, 
    p_performed_by UUID, 
    p_take_date DATE, 
    p_counter_name TEXT, 
    p_notes TEXT, 
    p_status TEXT, 
    p_items JSONB
) RETURNS UUID AS $$
DECLARE
    v_stock_take_id UUID;
    v_item JSONB;
    v_batch_id TEXT;
    v_physical_count INTEGER;
    v_system_qty INTEGER;
    v_asset_id TEXT;
    v_variance INTEGER;
BEGIN
    INSERT INTO public.stock_takes (location_id, take_date, performed_by, counter_name, status, notes) 
    VALUES (p_location_id, p_take_date, p_performed_by, p_counter_name, p_status, p_notes) 
    RETURNING id INTO v_stock_take_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_batch_id := v_item->>'batch_id';
        v_physical_count := (v_item->>'physical_count')::INTEGER;
        
        SELECT quantity, asset_id INTO v_system_qty, v_asset_id FROM public.batches WHERE id = v_batch_id;
        v_variance := v_system_qty - v_physical_count;
        
        INSERT INTO public.stock_take_items (stock_take_id, asset_id, batch_id, system_quantity, physical_count, variance, comments) 
        VALUES (v_stock_take_id, v_asset_id, v_batch_id, v_system_qty, v_physical_count, v_variance, v_item->>'comments');
        
        -- If auto-approved (no variances), apply immediately
        IF p_status = 'Approved' THEN
            UPDATE public.batches SET quantity = v_physical_count WHERE id = v_batch_id;
            IF v_variance > 0 THEN
                INSERT INTO public.asset_losses (batch_id, loss_type, lost_quantity, location_id, reported_by, notes)
                VALUES (v_batch_id, 'Stock Take Variance', v_variance, p_location_id, p_performed_by, 'Auto-approved stock take #' || v_stock_take_id::text);
            END IF;
        END IF;
    END LOOP;
    RETURN v_stock_take_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STOCK TAKE APPROVAL
CREATE OR REPLACE FUNCTION approve_stock_take(p_stock_take_id UUID, p_approved_by UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_item RECORD;
    v_location_id TEXT;
BEGIN
    SELECT location_id INTO v_location_id FROM public.stock_takes WHERE id = p_stock_take_id;
    
    FOR v_item IN SELECT * FROM public.stock_take_items WHERE stock_take_id = p_stock_take_id
    LOOP
        UPDATE public.batches SET quantity = v_item.physical_count WHERE id = v_item.batch_id;
        
        IF v_item.variance > 0 THEN
            INSERT INTO public.asset_losses (batch_id, loss_type, lost_quantity, location_id, reported_by, notes)
            VALUES (v_item.batch_id, 'Stock Take Variance', v_item.variance, v_location_id, p_approved_by, 'Approved stock take #' || p_stock_take_id::text);
        END IF;
    END LOOP;

    UPDATE public.stock_takes SET status = 'Approved' WHERE id = p_stock_take_id;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ASSET LOSS RECORDING
CREATE OR REPLACE FUNCTION fn_on_verification_variance() 
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.variance < 0 THEN
        INSERT INTO public.asset_losses (batch_id, loss_type, lost_quantity, timestamp, reported_by, notes) 
        VALUES (NEW.batch_id, 'Missing/Lost', ABS(NEW.variance), NOW(), NEW.verified_by, 'System generated: Variance detected during intake verification.');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_on_verification_variance
AFTER INSERT ON public.batch_verifications
FOR EACH ROW
EXECUTE FUNCTION fn_on_verification_variance();

CREATE OR REPLACE FUNCTION process_asset_loss(
    p_batch_id TEXT,
    p_lost_quantity INTEGER,
    p_loss_type TEXT,
    p_location_id TEXT,
    p_reported_by UUID,
    p_notes TEXT
) RETURNS UUID AS $$
DECLARE
    v_loss_id UUID;
BEGIN
    UPDATE public.batches 
    SET quantity = quantity - p_lost_quantity 
    WHERE id = p_batch_id;
    
    INSERT INTO public.asset_losses (batch_id, loss_type, lost_quantity, location_id, reported_by, notes)
    VALUES (p_batch_id, p_loss_type, p_lost_quantity, p_location_id, p_reported_by, p_notes)
    RETURNING id INTO v_loss_id;
    
    RETURN v_loss_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PARTIAL LOSS PROCESSING
CREATE OR REPLACE FUNCTION public.process_partial_loss(
    p_batch_id TEXT,
    p_lost_quantity INTEGER,
    p_reported_by UUID,
    p_notes TEXT,
    p_location_id TEXT
) RETURNS VOID AS $$
DECLARE
    v_original_qty INTEGER;
    v_asset_id TEXT;
    v_new_batch_id TEXT;
BEGIN
    -- Get original batch info
    SELECT quantity, asset_id INTO v_original_qty, v_asset_id 
    FROM public.batches 
    WHERE id = p_batch_id;

    IF v_original_qty IS NULL THEN
        RAISE EXCEPTION 'Batch % not found', p_batch_id;
    END IF;

    IF v_original_qty < p_lost_quantity THEN
        RAISE EXCEPTION 'Lost quantity (%) exceeds batch quantity (%)', p_lost_quantity, v_original_qty;
    END IF;

    -- 1. Record the loss
    INSERT INTO public.asset_losses (
        batch_id, 
        loss_type, 
        lost_quantity, 
        location_id, 
        reported_by, 
        notes, 
        transaction_date
    ) VALUES (
        p_batch_id, 
        'Partial Loss', 
        p_lost_quantity, 
        p_location_id, 
        p_reported_by, 
        p_notes, 
        CURRENT_DATE
    );

    -- 2. Handle batch adjustment
    IF v_original_qty = p_lost_quantity THEN
        -- Full loss: Just update status
        UPDATE public.batches 
        SET status = 'Lost', quantity = p_lost_quantity 
        WHERE id = p_batch_id;
    ELSE
        -- Partial loss: Reduce original, create new 'Lost' batch for tracking
        UPDATE public.batches 
        SET quantity = quantity - p_lost_quantity 
        WHERE id = p_batch_id;

        LOOP
            v_new_batch_id := p_batch_id || '-LOST-' || floor(random() * 1000000)::text;
            EXIT WHEN NOT EXISTS (SELECT 1 FROM public.batches WHERE id = v_new_batch_id);
        END LOOP;
        
        INSERT INTO public.batches (
            id, 
            asset_id, 
            quantity, 
            current_location_id, 
            status, 
            transaction_date
        ) VALUES (
            v_new_batch_id, 
            v_asset_id, 
            p_lost_quantity, 
            p_location_id, 
            'Lost', 
            CURRENT_DATE
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- AUTO-SUPPLIER LOGIC
CREATE OR REPLACE FUNCTION public.check_and_create_supplier(p_supplier_id TEXT)
RETURNS VOID AS $$
BEGIN
    -- 1. Ensure it exists in locations
    IF NOT EXISTS (SELECT 1 FROM public.locations WHERE id = p_supplier_id) THEN
        INSERT INTO public.locations (id, name, type, category, partner_type)
        VALUES (p_supplier_id, 'Auto-Registered: ' || p_supplier_id, 'Supplier', 'External', 'Supplier');
    END IF;

    -- 2. Ensure it exists in business_parties
    IF NOT EXISTS (SELECT 1 FROM public.business_parties WHERE id = p_supplier_id) THEN
        INSERT INTO public.business_parties (id, name, party_type)
        VALUES (p_supplier_id, p_supplier_id, 'Supplier');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- BATCH MANAGEMENT RPCs
CREATE OR REPLACE FUNCTION public.delete_inventory_batch(p_batch_id TEXT)
RETURNS VOID AS $$
BEGIN
    DELETE FROM public.batch_movements WHERE batch_id = p_batch_id;
    DELETE FROM public.asset_losses WHERE batch_id = p_batch_id;
    DELETE FROM public.claims WHERE batch_id = p_batch_id;
    DELETE FROM public.thaan_slips WHERE batch_id = p_batch_id;
    DELETE FROM public.batches WHERE id = p_batch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.update_inventory_batch(
    p_batch_id TEXT,
    p_quantity INTEGER,
    p_date_received DATE
) RETURNS VOID AS $$
BEGIN
    UPDATE public.batches 
    SET quantity = p_quantity, 
        transaction_date = p_date_received
    WHERE id = p_batch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. VIEWS

-- ALL SOURCES (FOR SELECTORS)
CREATE OR REPLACE VIEW public.vw_all_sources AS
SELECT 
    id,
    name,
    partner_type,
    branch_id,
    type,
    category,
    address,
    latitude,
    longitude,
    name || ' (' || partner_type || ')' as display_name,
    CASE 
        WHEN partner_type = 'Internal' AND type != 'In Transit' THEN 1 
        WHEN type = 'In Transit' THEN 3
        ELSE 2 
    END as sort_group,
    'Location' as source_table
FROM public.locations
UNION ALL
SELECT 
    id::text,
    name,
    party_type as partner_type,
    NULL as branch_id,
    'Business Party' as type,
    'External' as category,
    address,
    NULL::NUMERIC as latitude,
    NULL::NUMERIC as longitude,
    name || ' (' || party_type || ')' as display_name,
    2 as sort_group,
    'BusinessParty' as source_table
FROM public.business_parties;

-- ORIGINS (FOR LOGISTICS)
CREATE OR REPLACE VIEW public.vw_all_origins AS
SELECT * FROM public.vw_all_sources
ORDER BY sort_group, name;

-- DESTINATIONS (FOR LOGISTICS)
CREATE OR REPLACE VIEW public.vw_movement_destinations AS
SELECT * FROM public.vw_all_sources
ORDER BY sort_group, name;

-- PENDING COLLECTIONS
DROP VIEW IF EXISTS public.vw_pending_collections CASCADE;
CREATE OR REPLACE VIEW public.vw_pending_collections AS
SELECT 
    cr.*,
    s.name as customer_name,
    am.name as asset_name
FROM public.collection_requests cr
LEFT JOIN public.vw_all_sources s ON cr.customer_id = s.id
JOIN public.asset_master am ON cr.asset_id = am.id
WHERE cr.status = 'Pending';

-- MASTER LOGISTICS TRACE
CREATE OR REPLACE VIEW public.vw_master_logistics_trace AS
SELECT 
    bm.id AS movement_id,
    bm.batch_id,
    bm.transaction_date,
    bm.timestamp,
    d.full_name AS driver_name,
    COALESCE(bm.quantity, b.quantity) AS quantity,
    s_to.name AS to_location_name,
    s_to.id AS to_location_id,
    s_from.name AS from_location_name,
    t.plate_number AS truck_plate,
    bm.condition,
    s_to.branch_id AS custodian_branch_id
FROM public.batch_movements bm
JOIN public.batches b ON bm.batch_id = b.id
LEFT JOIN public.vw_all_sources s_to ON bm.to_location_id = s_to.id
LEFT JOIN public.vw_all_sources s_from ON bm.from_location_id = s_from.id
LEFT JOIN public.drivers d ON bm.driver_id = d.id
LEFT JOIN public.trucks t ON bm.truck_id = t.id;

-- FLEET COMPLIANCE ALERTS
DROP VIEW IF EXISTS public.vw_fleet_compliance_alerts CASCADE;
CREATE OR REPLACE VIEW public.vw_fleet_compliance_alerts AS
SELECT 
    t.id as truck_id,
    t.plate_number,
    t.license_disc_expiry as license_expiry,
    d.id as driver_id,
    d.full_name as driver_name,
    d.license_expiry as driver_license_expiry,
    d.prdp_expiry,
    CASE 
        WHEN t.license_disc_expiry < CURRENT_DATE THEN 'Expired'
        WHEN t.license_disc_expiry < CURRENT_DATE + INTERVAL '30 days' THEN 'Critical'
        WHEN t.license_disc_expiry < CURRENT_DATE + INTERVAL '90 days' THEN 'Warning'
        ELSE 'Valid'
    END as truck_status,
    CASE 
        WHEN d.license_expiry < CURRENT_DATE OR d.prdp_expiry < CURRENT_DATE THEN 'Expired'
        WHEN d.license_expiry < CURRENT_DATE + INTERVAL '30 days' OR d.prdp_expiry < CURRENT_DATE + INTERVAL '30 days' THEN 'Critical'
        ELSE 'Valid'
    END as driver_status
FROM public.trucks t
FULL OUTER JOIN public.drivers d ON t.branch_id = d.branch_id;

-- FLEET READINESS
DROP VIEW IF EXISTS public.vw_fleet_readiness CASCADE;
CREATE OR REPLACE VIEW public.vw_fleet_readiness AS
SELECT 
    t.id as truck_id,
    t.plate_number,
    t.branch_id,
    b.name as branch_name,
    t.license_disc_expiry,
    CASE 
        WHEN t.license_disc_expiry < CURRENT_DATE THEN 'Expired'
        WHEN t.license_disc_expiry < CURRENT_DATE + INTERVAL '30 days' THEN 'Critical'
        WHEN t.license_disc_expiry < CURRENT_DATE + INTERVAL '90 days' THEN 'Warning'
        ELSE 'Compliant'
    END as license_status,
    COALESCE(t.last_renewal_cost_zar, 0) as last_renewal_cost,
    (
        SELECT COALESCE(SUM(test_fee_zar + repair_costs_zar), 0)
        FROM public.truck_roadworthy_history
        WHERE truck_id = t.id AND test_date >= DATE_TRUNC('year', CURRENT_DATE)
    ) as ytd_roadworthy_costs,
    (
        SELECT result
        FROM public.truck_roadworthy_history
        WHERE truck_id = t.id
        ORDER BY test_date DESC
        LIMIT 1
    ) as last_roadworthy_result,
    (
        SELECT expiry_date
        FROM public.truck_roadworthy_history
        WHERE truck_id = t.id
        ORDER BY test_date DESC
        LIMIT 1
    ) as roadworthy_expiry
FROM public.trucks t
LEFT JOIN public.branches b ON t.branch_id = b.id;

-- BRANCH FLEET EXPENSES
DROP VIEW IF EXISTS public.vw_branch_fleet_expenses CASCADE;
CREATE OR REPLACE VIEW public.vw_branch_fleet_expenses AS
SELECT 
    t.branch_id::text,
    b.name::text as branch_name,
    t.id::text as truck_id,
    t.plate_number::text,
    'License Renewal'::text as expense_type,
    COALESCE(t.last_renewal_cost_zar, 0)::numeric as amount,
    t.license_disc_expiry::date as expense_date,
    t.license_doc_url::text
FROM public.trucks t
JOIN public.branches b ON t.branch_id = b.id
WHERE t.last_renewal_cost_zar > 0

UNION ALL

SELECT 
    t.branch_id::text,
    b.name::text as branch_name,
    t.id::text as truck_id,
    t.plate_number::text,
    'COF/Roadworthy'::text as expense_type,
    (COALESCE(rh.test_fee_zar, 0) + COALESCE(rh.repair_costs_zar, 0))::numeric as amount,
    rh.test_date::date as expense_date,
    t.license_doc_url::text
FROM public.truck_roadworthy_history rh
JOIN public.trucks t ON rh.truck_id::text = t.id::text
JOIN public.branches b ON t.branch_id = b.id;

-- DAILY BURN RATE
DROP VIEW IF EXISTS public.vw_daily_burn_rate CASCADE;
CREATE OR REPLACE VIEW public.vw_daily_burn_rate AS
SELECT 
    br.name AS branch_name, 
    s.name AS location_name, 
    s.id AS location_id, 
    br.id AS branch_id, 
    SUM(bt.quantity * fs.amount_zar) AS daily_burn_rate, 
    COUNT(bt.id) AS batch_count, 
    AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - bt.transaction_date))/86400) AS avg_duration_days
FROM public.batches bt 
JOIN public.vw_all_sources s ON bt.current_location_id = s.id 
LEFT JOIN public.branches br ON s.branch_id = br.id 
JOIN public.fee_schedule fs ON bt.asset_id = fs.asset_id
WHERE bt.transfer_confirmed_by_customer = FALSE 
  AND fs.effective_to IS NULL
GROUP BY br.name, s.name, s.id, br.id;

-- DASHBOARD STATS
DROP VIEW IF EXISTS public.vw_dashboard_stats CASCADE;
CREATE OR REPLACE VIEW public.vw_dashboard_stats AS
SELECT
    COALESCE(br.name, 'Global/Unassigned') as branch_name,
    COALESCE(SUM(b.quantity), 0) as total_units,
    COALESCE(SUM(CASE WHEN s.type = 'In Transit' THEN b.quantity ELSE 0 END), 0) as pending_units,
    COALESCE(SUM(CASE WHEN b.status = 'Success' THEN b.quantity ELSE 0 END), 0) as success_units,
    COALESCE(SUM(CASE WHEN (CURRENT_DATE - b.transaction_date) > 14 AND b.transfer_confirmed_by_customer = false THEN b.quantity ELSE 0 END), 0) as stagnant_units,
    COALESCE(SUM(public.calculate_batch_accrual(b.id)), 0) as pending_charges,
    COALESCE(SUM(public.calculate_batch_accrual(b.id)), 0) as accrued_rental,
    -- Extra fields for compatibility
    COALESCE(SUM(CASE WHEN s.category = 'Home' AND s.type != 'In Transit' THEN b.quantity ELSE 0 END), 0) as available,
    COALESCE(SUM(CASE WHEN s.partner_type = 'Customer' THEN b.quantity ELSE 0 END), 0) as at_customers,
    COALESCE(SUM(CASE WHEN s.type = 'In Transit' THEN b.quantity ELSE 0 END), 0) as in_transit,
    COALESCE(SUM(b.quantity), 0) as total_fleet
FROM public.batches b
LEFT JOIN public.vw_all_sources s ON b.current_location_id = s.id
LEFT JOIN public.branches br ON s.branch_id = br.id
WHERE (
    b.transfer_confirmed_by_customer = FALSE 
    OR 
    DATE_TRUNC('month', b.confirmation_date) = DATE_TRUNC('month', CURRENT_DATE)
)
GROUP BY br.name;

-- BATCH FORENSICS (Recent Activity)
CREATE OR REPLACE VIEW public.vw_batch_forensics AS
SELECT 
    bm.timestamp as date,
    bm.condition as type,
    bm.batch_id,
    bm.quantity,
    s_from.name as from_location,
    s_to.name as to_location,
    br.name as branch_name,
    bm.timestamp
FROM public.batch_movements bm
JOIN public.batches b ON bm.batch_id = b.id
LEFT JOIN public.vw_all_sources s_from ON bm.from_location_id = s_from.id
LEFT JOIN public.vw_all_sources s_to ON bm.to_location_id = s_to.id
LEFT JOIN public.branches br ON s_to.branch_id = br.id;

-- EXECUTIVE REPORT
DROP VIEW IF EXISTS public.vw_executive_report CASCADE;
CREATE OR REPLACE VIEW public.vw_executive_report AS
WITH branch_metrics AS (
    SELECT 
        b.id as branch_id,
        b.name as branch_name,
        -- Total units currently managed by this branch
        COALESCE(SUM(bt.quantity), 0) as total_units,
        -- Stagnant units (> 14 days)
        COALESCE(SUM(CASE WHEN (CURRENT_DATE - bt.transaction_date) > 14 AND bt.transfer_confirmed_by_customer = false THEN bt.quantity ELSE 0 END), 0) as stagnant_units,
        -- Financial Drainage (> 21 days)
        COALESCE(SUM(CASE WHEN (CURRENT_DATE - bt.transaction_date) > 21 AND bt.transfer_confirmed_by_customer = false THEN public.calculate_batch_accrual(bt.id) ELSE 0 END), 0) as financial_drainage,
        -- Loss Count (from asset_losses)
        (
            SELECT COALESCE(SUM(al.lost_quantity), 0)
            FROM public.asset_losses al
            JOIN public.locations l ON al.location_id = l.id
            WHERE l.branch_id = b.id
        ) as lost_units
    FROM public.branches b
    LEFT JOIN public.locations loc ON b.id = loc.branch_id
    LEFT JOIN public.batches bt ON loc.id = bt.current_location_id
    GROUP BY b.id, b.name
),
forensics AS (
    -- Get the oldest stagnant batch for each branch
    SELECT DISTINCT ON (l.branch_id)
        l.branch_id,
        bm.driver_id,
        d.full_name as driver_name,
        l.name as last_location,
        bt.id as batch_id,
        bt.transaction_date
    FROM public.batches bt
    JOIN public.locations l ON bt.current_location_id = l.id
    LEFT JOIN public.batch_movements bm ON bt.id = bm.batch_id
    LEFT JOIN public.drivers d ON bm.driver_id = d.id
    WHERE (CURRENT_DATE - bt.transaction_date) > 14 
      AND bt.transfer_confirmed_by_customer = false
    ORDER BY l.branch_id, bt.transaction_date ASC, bm.timestamp DESC
)
SELECT 
    m.branch_id,
    m.branch_name,
    m.total_units,
    m.stagnant_units,
    m.financial_drainage,
    m.lost_units,
    CASE WHEN (m.total_units + m.lost_units) > 0 THEN (m.lost_units::float / (m.total_units + m.lost_units)) * 100 ELSE 0 END as loss_ratio,
    f.driver_name as oldest_stagnant_driver,
    f.last_location as oldest_stagnant_location,
    f.batch_id as oldest_stagnant_batch_id
FROM branch_metrics m
LEFT JOIN forensics f ON m.branch_id = f.branch_id;

-- INVENTORY MAP DATA
CREATE OR REPLACE VIEW public.vw_inventory_map_data AS
SELECT 
    s.id as id,
    s.name as name,
    s.latitude,
    s.longitude,
    s.type,
    s.branch_id,
    SUM(b.quantity) as total_assets,
    COUNT(DISTINCT b.asset_id) as asset_types
FROM public.batches b
JOIN public.vw_all_sources s ON b.current_location_id = s.id
GROUP BY s.id, s.name, s.latitude, s.longitude, s.type, s.branch_id;

-- ASSIGNABLE PERSONNEL
CREATE OR REPLACE VIEW public.vw_assignable_personnel AS
SELECT 
    id::text, 
    full_name as name, 
    role_name as role, 
    'User' as type,
    branch_id,
    is_active
FROM public.users
UNION ALL
SELECT 
    id, 
    full_name as name, 
    'Driver' as role, 
    'Driver' as type,
    branch_id,
    is_active
FROM public.drivers;

-- INVENTORY SUMMARY
DROP VIEW IF EXISTS public.vw_inventory_summary CASCADE;
CREATE OR REPLACE VIEW public.vw_inventory_summary AS
SELECT 
    b.current_location_id as location_id,
    COALESCE(s.name, 'Unknown Location') as location_name,
    COALESCE(s.type, 'Unknown') as location_type,
    s.branch_id,
    b.asset_id,
    COALESCE(am.name, 'Unknown Asset') as asset_name,
    am.type as asset_type,
    SUM(b.quantity) as total_quantity,
    COUNT(b.id) as batch_count
FROM public.batches b
LEFT JOIN public.vw_all_sources s ON b.current_location_id = s.id
LEFT JOIN public.asset_master am ON b.asset_id = am.id
WHERE b.status = 'Success' AND b.quantity > 0
  AND (
    b.transfer_confirmed_by_customer = FALSE 
    OR 
    DATE_TRUNC('month', b.confirmation_date) = DATE_TRUNC('month', CURRENT_DATE)
  )
GROUP BY b.current_location_id, s.name, s.type, s.branch_id, b.asset_id, am.name, am.type;

-- ASSET REGISTRY
DROP VIEW IF EXISTS public.vw_asset_registry CASCADE;
CREATE OR REPLACE VIEW public.vw_asset_registry AS
SELECT 
    b.id as batch_id,
    b.asset_id,
    COALESCE(am.name, 'Unknown Asset') as asset_name,
    am.type as asset_type,
    am.ownership_type,
    b.quantity,
    b.current_location_id,
    COALESCE(s.name, 'Unknown Location') as location_name,
    b.status,
    b.transaction_date,
    b.created_at
FROM public.batches b
LEFT JOIN public.asset_master am ON b.asset_id = am.id
LEFT JOIN public.vw_all_sources s ON b.current_location_id = s.id;

-- GLOBAL INVENTORY TRACKER
DROP VIEW IF EXISTS public.vw_global_inventory_tracker CASCADE;
CREATE OR REPLACE VIEW public.vw_global_inventory_tracker AS
SELECT 
    b.id AS batch_id,
    b.asset_id,
    a.name AS asset_name,
    a.supplier_id,
    b.quantity,
    b.current_location_id,
    s.name AS current_location,
    s.branch_id,
    b.status AS batch_status,
    b.is_settled,
    b.transaction_date,
    public.calculate_batch_accrual(b.id) AS daily_accrued_liability,
    (CURRENT_DATE - b.transaction_date) AS days_in_circulation
FROM public.batches b
JOIN public.asset_master a ON b.asset_id = a.id
LEFT JOIN public.vw_all_sources s ON b.current_location_id = s.id;

-- ASSET INTELLIGENCE
DROP VIEW IF EXISTS public.vw_asset_intelligence CASCADE;
CREATE OR REPLACE VIEW public.vw_asset_intelligence AS
SELECT 
    b.id as asset_code,
    am.type as asset_type,
    am.ownership_type as ownership,
    b.status,
    'Good' as condition, 
    COALESCE(s.name, 'Unknown') as customer,
    am.billing_model as charge_type,
    public.calculate_batch_accrual(b.id) as accrued
FROM public.batches b
JOIN public.asset_master am ON b.asset_id = am.id
LEFT JOIN public.vw_all_sources s ON b.current_location_id = s.id;

-- MANAGEMENT KPIS
DROP VIEW IF EXISTS public.vw_management_kpis CASCADE;
CREATE OR REPLACE VIEW public.vw_management_kpis AS
SELECT 
    COALESCE((SELECT AVG(EXTRACT(DAY FROM (confirmation_date::timestamp - transaction_date::timestamp))) FILTER (WHERE transfer_confirmed_by_customer = true) FROM public.batches), 0) as crate_cycle_time,
    COALESCE((SELECT (SUM(ABS(variance))::float / NULLIF(SUM(system_quantity), 0)) * 100 FROM public.stock_take_items), 0) as shrinkage_rate,
    COALESCE((SELECT SUM(amount) FROM public.vw_branch_fleet_expenses WHERE expense_date >= date_trunc('month', current_date)), 0) as monthly_compliance_cost;

-- OPERATIONAL TRIP AUDIT
DROP VIEW IF EXISTS public.vw_operational_trip_audit CASCADE;
CREATE OR REPLACE VIEW public.vw_operational_trip_audit AS
SELECT 
    t.id as trip_id,
    t.scheduled_date,
    tr.plate_number as truck_plate,
    d.full_name as driver_name,
    t.status as trip_status,
    ts.sequence_number,
    s.name as stop_location,
    ts.status as stop_status,
    ts.planned_arrival,
    ts.actual_arrival,
    ts.actual_departure,
    CASE 
        WHEN ts.actual_arrival > ts.planned_arrival THEN 'Delayed'
        WHEN ts.actual_arrival IS NOT NULL THEN 'On Time'
        ELSE 'Pending'
    END as delay_status
FROM public.trips t
JOIN public.trucks tr ON t.truck_id = tr.id
JOIN public.drivers d ON t.driver_id = d.id
JOIN public.trip_stops ts ON t.id::text = ts.trip_id::text
LEFT JOIN public.vw_all_sources s ON ts.location_id::text = s.id::text;

-- TRIP AUDIT TRAIL (Logistics Movement Trace)
DROP VIEW IF EXISTS public.vw_trip_audit_trail CASCADE;
CREATE OR REPLACE VIEW public.vw_trip_audit_trail AS
SELECT 
    bm.id as movement_id,
    bm.timestamp as movement_time,
    bm.transaction_date,
    bm.batch_id,
    bm.quantity,
    bm.condition,
    bm.route_instructions,
    s_from.name as from_location,
    s_to.name as to_location,
    d.full_name as driver_name,
    d.id as driver_id,
    t.plate_number as truck_plate,
    t.id as truck_id,
    t.branch_id,
    ds.id as shift_id,
    ds.start_time as shift_start,
    ds.end_time as shift_end,
    ds.manual_end_time as shift_manual_end,
    ds.notes as shift_notes
FROM public.batch_movements bm
LEFT JOIN public.vw_all_sources s_from ON bm.from_location_id = s_from.id
LEFT JOIN public.vw_all_sources s_to ON bm.to_location_id = s_to.id
LEFT JOIN public.drivers d ON bm.driver_id = d.id
LEFT JOIN public.trucks t ON bm.truck_id = t.id
LEFT JOIN LATERAL (
    SELECT * FROM public.driver_shifts s
    WHERE s.driver_id = bm.driver_id
    AND s.truck_id = bm.truck_id
    AND s.start_time <= bm.timestamp
    ORDER BY s.start_time DESC
    LIMIT 1
) ds ON true;

-- STOCK TAKE HISTORY
CREATE OR REPLACE VIEW public.vw_stock_take_history AS
SELECT 
    st.id,
    st.location_id,
    s.name as location_name,
    st.take_date,
    st.counter_name,
    st.status,
    st.notes,
    COUNT(sti.id) as item_count,
    SUM(ABS(sti.variance)) as total_variance
FROM public.stock_takes st
JOIN public.vw_all_sources s ON st.location_id = s.id
LEFT JOIN public.stock_take_items sti ON st.id = sti.stock_take_id
GROUP BY st.id, st.location_id, s.name, st.take_date, st.counter_name, st.status, st.notes;

-- RECENT INTAKES
CREATE OR REPLACE VIEW public.vw_recent_intakes AS
SELECT 
    b.id as batch_id,
    b.asset_id,
    am.name as asset_name,
    b.quantity,
    b.current_location_id as to_location_id,
    s_to.name as to_location_name,
    bm.from_location_id as from_location_id,
    s_from.name as from_location_name,
    b.transaction_date,
    bm.notes,
    b.created_at
FROM public.batches b
JOIN public.asset_master am ON b.asset_id = am.id
JOIN public.batch_movements bm ON b.id = bm.batch_id AND bm.condition = 'New/Intake'
LEFT JOIN public.vw_all_sources s_to ON b.current_location_id = s_to.id
LEFT JOIN public.vw_all_sources s_from ON bm.from_location_id = s_from.id
ORDER BY b.created_at DESC;

-- BATCH SUMMARY REPORT VIEW
DROP VIEW IF EXISTS public.vw_intake_summary_report;
CREATE OR REPLACE VIEW public.vw_intake_summary_report AS
SELECT 
    date_trunc('week', bm.transaction_date)::date as week_starting,
    src.partner_type as source_type,
    src.name as source_name,
    SUM(bm.quantity) as total_quantity
FROM public.batch_movements bm
LEFT JOIN public.vw_all_sources src ON bm.from_location_id = src.id
LEFT JOIN public.vw_all_sources dest ON bm.to_location_id = dest.id
GROUP BY 1, 2, 3;

-- LOCATION UNCONFIRMED VALUE
DROP VIEW IF EXISTS public.vw_location_unconfirmed_value CASCADE;
CREATE OR REPLACE VIEW public.vw_location_unconfirmed_value AS
SELECT 
    s.id as location_id,
    s.name as location_name,
    s.branch_id,
    SUM(b.quantity) as unit_count,
    SUM(b.quantity * 450) as estimated_value_zar
FROM public.batches b
JOIN public.vw_all_sources s ON b.current_location_id = s.id
WHERE b.transfer_confirmed_by_customer = false
GROUP BY s.id, s.name, s.branch_id;

-- BATCH ACCRUALS
DROP VIEW IF EXISTS public.vw_batch_accruals CASCADE;
CREATE OR REPLACE VIEW public.vw_batch_accruals AS
SELECT 
    b.id as batch_id,
    b.asset_id,
    b.quantity,
    b.current_location_id,
    s.name as current_location,
    s.branch_id,
    b.transaction_date,
    b.transfer_confirmed_by_customer,
    public.calculate_batch_accrual(b.id) as accrued_amount
FROM public.batches b
LEFT JOIN public.vw_all_sources s ON b.current_location_id = s.id;

-- BUSINESS DIRECTORY
DROP VIEW IF EXISTS public.vw_business_directory CASCADE;
CREATE OR REPLACE VIEW public.vw_business_directory AS
SELECT 
    bp.id,
    bp.name,
    bp.party_type,
    bp.address,
    COALESCE(asset_counts.type_count, 0) as asset_types,
    COALESCE(stock_counts.total_stock, 0) as current_stock
FROM public.business_parties bp
LEFT JOIN (
    SELECT supplier_id, count(*) as type_count
    FROM public.asset_master
    GROUP BY supplier_id
) asset_counts ON bp.id = asset_counts.supplier_id
LEFT JOIN (
    SELECT am.supplier_id, sum(b.quantity) as total_stock
    FROM public.batches b
    JOIN public.asset_master am ON b.asset_id = am.id
    GROUP BY am.supplier_id
) stock_counts ON bp.id = stock_counts.supplier_id;

-- LOSS REPORT
CREATE OR REPLACE VIEW public.vw_loss_report AS
SELECT 
    al.id,
    al.batch_id,
    am.name as asset_name,
    al.loss_type,
    al.lost_quantity,
    al.location_id,
    s.name as location_name,
    al.notes,
    al.transaction_date,
    al.timestamp
FROM public.asset_losses al
JOIN public.batches b ON al.batch_id = b.id
JOIN public.asset_master am ON b.asset_id = am.id
LEFT JOIN public.vw_all_sources s ON al.location_id = s.id;

-- 6. SEED DATA
INSERT INTO public.branches (id, name) VALUES 
('BR-01', 'Kya Sands'), 
('BR-02', 'Durban') 
ON CONFLICT DO NOTHING;

INSERT INTO public.business_parties (id, name, party_type, address) VALUES
('BP-CUST-001', 'Shoprite Group', 'Customer', 'Cape Town HQ'),
('BP-CUST-002', 'Pick n Pay', 'Customer', 'Johannesburg HQ'),
('BP-SUP-001', 'Crate Manufacturers Ltd', 'Supplier', 'Pretoria Industrial')
ON CONFLICT DO NOTHING;

INSERT INTO public.locations (id, name, type, category, branch_id, partner_type, latitude, longitude) VALUES 
('WH-001', 'Central Warehouse', 'Warehouse', 'Home', 'BR-01', 'Internal', -26.0123, 27.9456),
('LOC-JHB-01', 'Lupo JHB Plant', 'Crates Dept', 'Home', 'BR-01', 'Internal', -26.0234, 27.9567),
('LOC-DBN-01', 'Lupo DBN Plant', 'Crates Dept', 'Home', 'BR-02', 'Internal', -29.8587, 31.0218),
('LOC-CUST-01', 'Checkers Sandton', 'At Customer', 'External', 'BR-01', 'Customer', -26.1076, 28.0567),
('LOC-CUST-02', 'Pick n Pay Woodmead', 'At Customer', 'External', 'BR-01', 'Customer', -26.0567, 28.0890),
('LOC-COLD-01', 'Cold Storage North', 'Cold Storage', 'Home', 'BR-01', 'Internal', -26.0345, 27.9678),
('LOC-TRANS-01', 'Truck JHB-01', 'In Transit', 'Home', 'BR-01', 'Internal', -26.0456, 27.9789),
('LOC-SUP-01', 'Crate Suppliers', 'Returning to Supplier', 'External', 'BR-01', 'Supplier', -26.1500, 28.2000)
ON CONFLICT DO NOTHING;

INSERT INTO public.asset_master (id, name, type, dimensions, material, supplier_id, ownership_type) VALUES 
('CRT-STD', 'Standard Bread Crate', 'Crate', '600x400x150mm', 'HDPE', 'BP-SUP-001', 'External'),
('PLT-STD', 'Standard Wood Pallet', 'Pallet', '1200x1000mm', 'Wood', 'BP-SUP-001', 'External'),
('SH-001', 'Lupo Premium Crate', 'Crate', '600x400x150mm', 'HDPE-Amber', 'LOC-SUP-01', 'External'),
('SH-002', 'Lupo Standard Crate', 'Crate', '600x400x150mm', 'HDPE-Blue', 'LOC-SUP-01', 'External'),
('SH-003', 'Lupo Economy Crate', 'Crate', '600x400x150mm', 'HDPE-Black', 'LOC-SUP-01', 'External'),
('SH-P01', 'Lupo Heavy Pallet', 'Pallet', '1200x1000mm', 'Plastic', 'BP-SUP-001', 'External'),
('SH-P02', 'Lupo Lite Pallet', 'Pallet', '1200x1000mm', 'Plastic', 'LOC-SUP-01', 'External')
ON CONFLICT DO NOTHING;

INSERT INTO public.branch_budgets (branch_id, budget_amount) VALUES
('BR-01', 250000),
('BR-02', 180000)
ON CONFLICT DO NOTHING;

INSERT INTO public.fee_schedule (asset_id, fee_type, amount_zar, effective_from) VALUES 
('CRT-STD', 'Replacement Fee (Lost Equipment)', 150.00, '2024-01-01'),
('CRT-STD', 'Daily Rental (Supermarket)', 4.50, '2024-01-01'),
('PLT-STD', 'Daily Rental (Supermarket)', 12.00, '2024-01-01'),
('SH-001', 'Daily Rental (Supermarket)', 5.25, '2024-01-01'),
('SH-002', 'Daily Rental (Supermarket)', 4.95, '2024-01-01'),
('SH-003', 'Daily Rental (Supermarket)', 4.25, '2024-01-01'),
('SH-P01', 'Daily Rental (Supermarket)', 15.00, '2024-01-01'),
('SH-P02', 'Daily Rental (Supermarket)', 10.50, '2024-01-01'),
('PLT-STD', 'Replacement Fee (Lost Equipment)', 450.00, '2024-01-01'),
('SH-001', 'Replacement Fee (Lost Equipment)', 180.00, '2024-01-01'),
('SH-002', 'Replacement Fee (Lost Equipment)', 170.00, '2024-01-01'),
('SH-003', 'Replacement Fee (Lost Equipment)', 140.00, '2024-01-01'),
('SH-P01', 'Replacement Fee (Lost Equipment)', 850.00, '2024-01-01'),
('SH-P02', 'Replacement Fee (Lost Equipment)', 650.00, '2024-01-01')
ON CONFLICT DO NOTHING;

-- INITIAL INVENTORY
INSERT INTO public.batches (id, asset_id, quantity, current_location_id, status, transaction_date) VALUES 
('BAT-INIT-001', 'CRT-STD', 5000, 'WH-001', 'Success', CURRENT_DATE - INTERVAL '45 days'),
('BAT-INIT-002', 'PLT-STD', 200, 'WH-001', 'Success', CURRENT_DATE - INTERVAL '30 days'),
('BAT-INIT-003', 'SH-001', 1000, 'LOC-JHB-01', 'Success', CURRENT_DATE - INTERVAL '15 days')
ON CONFLICT DO NOTHING;

-- 7. RLS POLICIES
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_takes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_take_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_losses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thaan_slips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.truck_roadworthy_history ENABLE ROW LEVEL SECURITY;

-- Authenticated Policies
CREATE POLICY "Allow all to authenticated" ON public.branches FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to authenticated" ON public.locations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to authenticated" ON public.business_parties FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to authenticated" ON public.asset_master FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to authenticated" ON public.batches FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to authenticated" ON public.batch_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to authenticated" ON public.stock_takes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to authenticated" ON public.stock_take_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to authenticated" ON public.asset_losses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to authenticated" ON public.batch_verifications FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to authenticated" ON public.trips FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to authenticated" ON public.trip_stops FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to authenticated" ON public.collection_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to authenticated" ON public.thaan_slips FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to authenticated" ON public.claims FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to authenticated" ON public.claim_audits FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to authenticated" ON public.audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to authenticated" ON public.vehicle_inspections FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to authenticated" ON public.branch_budgets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to authenticated" ON public.driver_shifts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to authenticated" ON public.truck_roadworthy_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Anon Policies (For Dev)
CREATE POLICY "Allow all to anon" ON public.branches FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to anon" ON public.locations FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to anon" ON public.business_parties FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to anon" ON public.asset_master FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to anon" ON public.batches FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to anon" ON public.batch_movements FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to anon" ON public.stock_takes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to anon" ON public.stock_take_items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to anon" ON public.asset_losses FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to anon" ON public.batch_verifications FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to anon" ON public.trips FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to anon" ON public.trip_stops FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to anon" ON public.collection_requests FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to anon" ON public.thaan_slips FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to anon" ON public.claims FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to anon" ON public.claim_audits FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to anon" ON public.audit_logs FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to anon" ON public.vehicle_inspections FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to anon" ON public.branch_budgets FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to anon" ON public.driver_shifts FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to anon" ON public.truck_roadworthy_history FOR ALL TO anon USING (true) WITH CHECK (true);

-- MOVEMENT HISTORY REPORT
DROP VIEW IF EXISTS public.vw_movement_history_report CASCADE;
CREATE OR REPLACE VIEW public.vw_movement_history_report AS
SELECT 
    bm.id as movement_id,
    bm.transaction_date,
    bm.timestamp,
    bm.batch_id,
    am.name as asset_name,
    bm.quantity,
    s_from.name as from_location,
    s_to.name as to_location,
    d.full_name as driver_name,
    t.plate_number as truck_plate,
    bm.condition,
    bm.notes
FROM public.batch_movements bm
JOIN public.batches b ON bm.batch_id = b.id
JOIN public.asset_master am ON b.asset_id = am.id
LEFT JOIN public.vw_all_sources s_from ON bm.from_location_id = s_from.id
LEFT JOIN public.vw_all_sources s_to ON bm.to_location_id = s_to.id
LEFT JOIN public.drivers d ON bm.driver_id = d.id
LEFT JOIN public.trucks t ON bm.truck_id = t.id;

-- REFRESH CACHE
NOTIFY pgrst, 'reload schema';

-- 23. Supplier Asset Audit View
DROP VIEW IF EXISTS public.vw_supplier_asset_audit CASCADE;
CREATE OR REPLACE VIEW public.vw_supplier_asset_audit AS
SELECT 
    b.id as batch_id,
    s.name as location_name,
    am.name as asset_name,
    am.supplier_id,
    b.quantity,
    (CURRENT_DATE - b.transaction_date)::INTEGER as days_aged,
    public.calculate_batch_accrual(b.id) as zar_liability
FROM public.batches b
JOIN public.vw_all_sources s ON b.current_location_id = s.id
JOIN public.asset_master am ON b.asset_id = am.id;
