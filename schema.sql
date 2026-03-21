
-- ==========================================
-- SHUKU CRATES & PALLETS TRACKING SCHEMA
-- FULL REBUILD SCRIPT
-- ==========================================

-- 1. CLEANUP (DROP EVERYTHING)
DROP VIEW IF EXISTS public.vw_executive_report CASCADE;
DROP VIEW IF EXISTS public.vw_daily_burn_rate CASCADE;
DROP TABLE IF EXISTS public.stock_take_items CASCADE;
DROP TABLE IF EXISTS public.stock_takes CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.discounts CASCADE;
DROP TABLE IF EXISTS public.settlements CASCADE;
DROP TABLE IF EXISTS public.business_parties CASCADE;
DROP TABLE IF EXISTS public.claims CASCADE;
DROP TABLE IF EXISTS public.asset_losses CASCADE;
DROP TABLE IF EXISTS public.thaan_slips CASCADE;
DROP TABLE IF EXISTS public.batch_movements CASCADE;
DROP TABLE IF EXISTS public.batches CASCADE;
DROP TABLE IF EXISTS public.fee_schedule CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.drivers CASCADE;
DROP TABLE IF EXISTS public.trucks CASCADE;
DROP TABLE IF EXISTS public.locations CASCADE;
DROP TABLE IF EXISTS public.asset_master CASCADE;
DROP TABLE IF EXISTS public.branches CASCADE;
DROP TABLE IF EXISTS public.claim_audits CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;

DROP FUNCTION IF EXISTS public.calculate_batch_accrual CASCADE;
DROP FUNCTION IF EXISTS public.calculate_location_liability CASCADE;
DROP FUNCTION IF EXISTS public.split_batch CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
DROP FUNCTION IF EXISTS public.is_admin CASCADE;
DROP FUNCTION IF EXISTS public.process_stock_take CASCADE;
DROP FUNCTION IF EXISTS public.get_supplier_liability CASCADE;
DROP FUNCTION IF EXISTS public.finalize_payment_settlement CASCADE;

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
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.asset_master (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- Crate, Pallet
    dimensions TEXT,
    material TEXT,
    billing_model TEXT DEFAULT 'Daily Rental (Supermarket)', -- Daily Rental, Issue Fee, None
    ownership_type TEXT DEFAULT 'External', -- Internal, External
    supplier_id TEXT REFERENCES public.locations(id),
    is_internal BOOLEAN DEFAULT FALSE,
    fee_type TEXT, -- Daily Rental, Issue Fee
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.trucks (
    id TEXT PRIMARY KEY,
    plate_number TEXT NOT NULL UNIQUE,
    license_disc_expiry DATE,
    last_renewal_cost_zar NUMERIC DEFAULT 0,
    license_doc_url TEXT,
    branch_id TEXT REFERENCES public.branches(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.truck_roadworthy_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id TEXT REFERENCES public.trucks(id),
    test_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    certificate_number TEXT,
    test_fee_zar NUMERIC DEFAULT 0,
    repair_costs_zar NUMERIC DEFAULT 0,
    result TEXT, -- Pass/Fail
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.drivers (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    contact_number TEXT,
    license_number TEXT,
    license_expiry DATE,
    prdp_expiry DATE,
    branch_id TEXT REFERENCES public.branches(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.vehicle_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    truck_id TEXT NOT NULL, -- References your 'trucks' table
    driver_id TEXT, -- References your 'drivers' table (custom IDs like DRV-7333)
    inspection_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    odometer_reading INT,
    
    -- South African Safety Checklist
    tyres_ok BOOLEAN DEFAULT TRUE,
    lights_ok BOOLEAN DEFAULT TRUE,
    brakes_ok BOOLEAN DEFAULT TRUE,
    fluids_ok BOOLEAN DEFAULT TRUE, -- Oil/Water
    license_disc_present BOOLEAN DEFAULT TRUE,
    
    -- Evidence & Faults
    odometer_photo_url TEXT,
    fault_description TEXT,
    fault_photo_url TEXT,
    is_grounded BOOLEAN DEFAULT FALSE, -- If TRUE, truck shows as 'Red' on Dashboard
    
    branch_id TEXT -- Tied to the branch performing the check
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.vehicle_inspections ENABLE ROW LEVEL SECURITY;

-- 3. Security Policy: Allow Drivers to submit (Insert)
CREATE POLICY "Allow drivers to submit inspections" 
ON public.vehicle_inspections 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- 4. Security Policy: Allow Managers to view (Select)
CREATE POLICY "Allow managers to view all inspections" 
ON public.vehicle_inspections 
FOR SELECT 
TO authenticated 
USING (true);

CREATE TABLE public.driver_shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id TEXT REFERENCES public.drivers(id),
    truck_id TEXT REFERENCES public.trucks(id),
    start_time TIMESTAMPTZ DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    manual_end_time TIMESTAMPTZ,
    notes TEXT,
    branch_id TEXT REFERENCES public.branches(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.users (
    id UUID PRIMARY KEY,
    full_name TEXT,
    email TEXT UNIQUE,
    role_name TEXT DEFAULT 'Operator', -- Admin, Manager, Operator
    branch_id TEXT REFERENCES public.branches(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.fee_schedule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id TEXT REFERENCES public.asset_master(id),
    fee_type TEXT NOT NULL,
    amount_zar NUMERIC(12, 2) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.batches (
    id TEXT PRIMARY KEY,
    asset_id TEXT REFERENCES public.asset_master(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    current_location_id TEXT, -- Relaxed to accept both locations and business parties
    status TEXT DEFAULT 'Pending', -- Pending, Success, Lost, In-Transit, Settled
    is_settled BOOLEAN DEFAULT FALSE,
    settled_at TIMESTAMPTZ,
    transaction_date DATE DEFAULT CURRENT_DATE,
    transfer_confirmed_by_customer BOOLEAN DEFAULT FALSE,
    confirmation_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.trips (
    id TEXT PRIMARY KEY, -- e.g. TRIP-20240319-001
    driver_id TEXT REFERENCES public.drivers(id),
    truck_id TEXT REFERENCES public.trucks(id),
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
    location_id TEXT, -- FK to locations or business_parties
    sequence_number INTEGER NOT NULL,
    planned_arrival TIMESTAMPTZ,
    actual_arrival TIMESTAMPTZ,
    actual_departure TIMESTAMPTZ,
    status TEXT DEFAULT 'Pending', -- Pending, Arrived, Departed, Skipped
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.batch_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id TEXT REFERENCES public.batches(id),
    from_location_id TEXT, -- Relaxed to accept both locations and business parties
    to_location_id TEXT,   -- Relaxed to accept both locations and business parties
    truck_id TEXT REFERENCES public.trucks(id),
    driver_id TEXT REFERENCES public.drivers(id),
    trip_id TEXT REFERENCES public.trips(id), -- Link movement to a trip
    trip_stop_id UUID REFERENCES public.trip_stops(id), -- Link movement to a specific stop
    condition TEXT DEFAULT 'Clean',
    route_instructions TEXT,
    origin_user_id UUID REFERENCES public.users(id),
    quantity INTEGER,
    transaction_date DATE DEFAULT CURRENT_DATE,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.thaan_slips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id TEXT REFERENCES public.batches(id),
    doc_url TEXT NOT NULL,
    is_signed BOOLEAN DEFAULT FALSE,
    signed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.asset_losses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id TEXT REFERENCES public.batches(id),
    loss_type TEXT NOT NULL,
    lost_quantity INTEGER NOT NULL,
    last_known_location_id TEXT REFERENCES public.locations(id),
    reported_by UUID REFERENCES public.users(id),
    notes TEXT,
    is_rechargeable BOOLEAN DEFAULT FALSE,
    supplier_notified BOOLEAN DEFAULT FALSE,
    is_settled BOOLEAN DEFAULT FALSE,
    settled_at TIMESTAMPTZ,
    transaction_date DATE DEFAULT CURRENT_DATE,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.claims (
    id TEXT PRIMARY KEY,
    batch_id TEXT REFERENCES public.batches(id),
    truck_id TEXT REFERENCES public.trucks(id),
    driver_id TEXT REFERENCES public.drivers(id),
    thaan_slip_id UUID REFERENCES public.thaan_slips(id),
    type TEXT NOT NULL, -- Damaged, Dirty
    amount_claimed_zar NUMERIC(12, 2),
    status TEXT DEFAULT 'Lodged',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    settled_at TIMESTAMPTZ
);

CREATE TABLE public.business_parties (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    party_type TEXT NOT NULL, -- Customer, Supplier
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id TEXT REFERENCES public.locations(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    gross_liability NUMERIC(12, 2) NOT NULL,
    discount_amount NUMERIC(12, 2) DEFAULT 0,
    net_payable NUMERIC(12, 2) NOT NULL,
    cash_paid NUMERIC(12, 2),
    payment_reference TEXT,
    settled_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.discounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    settlement_id UUID REFERENCES public.settlements(id),
    amount NUMERIC(12, 2) NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'Pending',
    priority TEXT DEFAULT 'Medium',
    due_date TIMESTAMPTZ,
    assigned_to TEXT, -- Can be User UUID or Driver ID (Note: foreign key dropped to support polymorphic assignment)
    branch_id TEXT REFERENCES public.branches(id),
    location_id TEXT REFERENCES public.locations(id),
    created_by UUID REFERENCES public.users(id) DEFAULT auth.uid(),
    task_type TEXT DEFAULT 'General', -- General, Stock Take
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.collection_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id TEXT NOT NULL,
    asset_id TEXT REFERENCES public.asset_master(id),
    estimated_quantity INTEGER NOT NULL,
    preferred_pickup_date DATE NOT NULL,
    contact_person TEXT,
    contact_number TEXT,
    status TEXT DEFAULT 'Pending', -- Pending, Assigned, Completed, Cancelled
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE VIEW public.vw_pending_collections AS
SELECT 
    cr.id,
    cr.customer_id,
    COALESCE(l.name, bp.name) as customer_name,
    cr.asset_id,
    am.name as asset_name,
    cr.estimated_quantity,
    cr.preferred_pickup_date,
    cr.contact_person,
    cr.contact_number,
    cr.status,
    cr.created_at
FROM public.collection_requests cr
LEFT JOIN public.locations l ON cr.customer_id = l.id
LEFT JOIN public.business_parties bp ON cr.customer_id = bp.id::text
JOIN public.asset_master am ON cr.asset_id = am.id
WHERE cr.status = 'Pending';

CREATE TABLE public.stock_takes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id TEXT REFERENCES public.locations(id),
    take_date DATE NOT NULL,
    performed_by UUID REFERENCES public.users(id),
    counter_name TEXT,
    status TEXT DEFAULT 'Pending Approval', -- Pending Approval, Approved, Rejected
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.stock_take_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stock_take_id UUID REFERENCES public.stock_takes(id),
    asset_id TEXT REFERENCES public.asset_master(id),
    batch_id TEXT REFERENCES public.batches(id),
    system_quantity INTEGER NOT NULL,
    physical_count INTEGER NOT NULL,
    variance INTEGER NOT NULL,
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.claim_audits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id TEXT REFERENCES public.claims(id),
    action TEXT NOT NULL,
    performed_by UUID REFERENCES public.users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.branch_budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id TEXT REFERENCES public.branches(id),
    asset_type TEXT, -- Supermarket, QSR
    month DATE NOT NULL,
    budget_revenue_zar NUMERIC(12, 2) DEFAULT 0,
    budget_maintenance_zar NUMERIC(12, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION calculate_batch_accrual(batch_id_input TEXT)
RETURNS NUMERIC AS $$
DECLARE
    v_asset_id TEXT;
    v_ownership TEXT;
    v_billing_model TEXT;
    v_created_at DATE;
    v_confirmed BOOLEAN;
    v_confirmed_at DATE;
    v_returned_to_supplier BOOLEAN;
    v_is_faulty BOOLEAN;
    v_rental_total NUMERIC := 0;
    v_issue_fee NUMERIC := 0;
    v_quantity INTEGER;
BEGIN
    SELECT b.asset_id, a.ownership_type, a.billing_model, b.transaction_date, b.quantity, b.transfer_confirmed_by_customer, b.confirmation_date
    INTO v_asset_id, v_ownership, v_billing_model, v_created_at, v_quantity, v_confirmed, v_confirmed_at
    FROM public.batches b
    JOIN public.asset_master a ON b.asset_id = a.id
    WHERE b.id = batch_id_input;

    IF v_ownership = 'Internal' OR COALESCE(v_asset_id, '') = '' THEN
        RETURN 0;
    END IF;

    v_confirmed := COALESCE(v_confirmed, FALSE);

    IF v_billing_model = 'Daily Rental (Supermarket)' THEN
        DECLARE
            v_end_date DATE;
            v_rate NUMERIC;
        BEGIN
            v_end_date := CASE WHEN v_confirmed THEN v_confirmed_at ELSE CURRENT_DATE END;
            SELECT amount_zar INTO v_rate FROM public.fee_schedule WHERE asset_id = v_asset_id AND fee_type = 'Daily Rental (Supermarket)' AND effective_to IS NULL;
            v_rental_total := GREATEST(0, (v_end_date - v_created_at)) * COALESCE(v_rate, 0) * v_quantity;
        END;
    END IF;

    IF v_billing_model = 'Issue Fee (QSR)' THEN
        DECLARE
            v_rate NUMERIC;
        BEGIN
            SELECT amount_zar INTO v_rate FROM public.fee_schedule WHERE asset_id = v_asset_id AND fee_type = 'Issue Fee (QSR)' AND effective_to IS NULL;
            SELECT EXISTS (SELECT 1 FROM public.batch_movements bm JOIN public.locations l ON bm.to_location_id = l.id WHERE bm.batch_id = batch_id_input AND l.type = 'Returning to Supplier') INTO v_returned_to_supplier;
            SELECT EXISTS (SELECT 1 FROM public.claims WHERE batch_id = batch_id_input AND type = 'Damaged' AND status = 'Accepted') INTO v_is_faulty;
            IF v_confirmed THEN v_issue_fee := 0; ELSIF v_returned_to_supplier AND NOT v_is_faulty THEN v_issue_fee := COALESCE(v_rate, 0) * v_quantity; ELSE v_issue_fee := COALESCE(v_rate, 0) * v_quantity; END IF;
        END;
    END IF;

    RETURN COALESCE(v_rental_total, 0) + COALESCE(v_issue_fee, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION calculate_location_liability(location_id_input TEXT, start_date DATE, end_date DATE)
RETURNS NUMERIC AS $$
DECLARE
    total_liability NUMERIC := 0;
    v_batch RECORD;
BEGIN
    FOR v_batch IN 
        SELECT b.id, b.asset_id, b.quantity, b.transaction_date, a.ownership_type, a.billing_model, b.transfer_confirmed_by_customer, b.confirmation_date
        FROM public.batches b
        JOIN public.asset_master a ON b.asset_id = a.id
        WHERE a.ownership_type = 'External' AND a.billing_model = 'Daily Rental (Supermarket)'
    LOOP
        DECLARE
            v_stop_date DATE;
            v_rate NUMERIC;
            v_current_loc TEXT;
            v_last_date DATE;
            v_move RECORD;
        BEGIN
            v_stop_date := CASE WHEN v_batch.transfer_confirmed_by_customer THEN v_batch.confirmation_date ELSE CURRENT_DATE END;
            SELECT amount_zar INTO v_rate FROM public.fee_schedule WHERE asset_id = v_batch.asset_id AND fee_type = 'Daily Rental (Supermarket)' AND effective_to IS NULL;
            v_rate := COALESCE(v_rate, 0);
            SELECT from_location_id INTO v_current_loc FROM public.batch_movements WHERE batch_id = v_batch.id ORDER BY transaction_date ASC, timestamp ASC LIMIT 1;
            IF v_current_loc IS NULL THEN SELECT current_location_id INTO v_current_loc FROM public.batches WHERE id = v_batch.id; END IF;
            v_last_date := v_batch.transaction_date;
            FOR v_move IN SELECT transaction_date, to_location_id FROM public.batch_movements WHERE batch_id = v_batch.id ORDER BY transaction_date ASC, timestamp ASC
            LOOP
                IF v_current_loc = location_id_input THEN
                    total_liability := total_liability + (GREATEST(0, (LEAST(v_move.transaction_date, end_date, v_stop_date) - GREATEST(v_last_date, start_date, v_batch.transaction_date))) * v_rate * v_batch.quantity);
                END IF;
                v_current_loc := v_move.to_location_id;
                v_last_date := v_move.transaction_date;
            END LOOP;
            IF v_current_loc = location_id_input THEN
                total_liability := total_liability + (GREATEST(0, (LEAST(v_stop_date, end_date) - GREATEST(v_last_date, start_date, v_batch.transaction_date))) * v_rate * v_batch.quantity);
            END IF;
        END;
    END LOOP;
    RETURN total_liability;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION split_batch(original_batch_id TEXT, move_qty INTEGER, new_location_id TEXT, move_date DATE)
RETURNS TEXT AS $$
DECLARE
    v_new_batch_id TEXT;
    v_asset_id TEXT;
    v_status TEXT;
    v_orig_qty INTEGER;
BEGIN
    SELECT asset_id, status, quantity INTO v_asset_id, v_status, v_orig_qty FROM public.batches WHERE id = original_batch_id;
    IF v_orig_qty < move_qty THEN RAISE EXCEPTION 'Insufficient quantity in original batch'; END IF;
    v_new_batch_id := original_batch_id || '-S' || floor(random() * 1000)::text;
    UPDATE public.batches SET quantity = quantity - move_qty WHERE id = original_batch_id;
    INSERT INTO public.batches (id, asset_id, quantity, current_location_id, status, transaction_date)
    VALUES (v_new_batch_id, v_asset_id, move_qty, new_location_id, v_status, move_date);

    -- Inherit Forensic History: Copy movements from parent to child
    INSERT INTO public.batch_movements (batch_id, from_location_id, to_location_id, truck_id, driver_id, condition, origin_user_id, quantity, transaction_date, timestamp)
    SELECT v_new_batch_id, from_location_id, to_location_id, truck_id, driver_id, condition, origin_user_id, quantity, transaction_date, timestamp
    FROM public.batch_movements
    WHERE batch_id = original_batch_id;

    RETURN v_new_batch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  user_count int;
  existing_user_id uuid;
BEGIN
  SELECT count(*) INTO user_count FROM public.users;
  SELECT id INTO existing_user_id FROM public.users WHERE email = NEW.email;
  IF existing_user_id IS NOT NULL THEN
    UPDATE public.users SET id = NEW.id, full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', full_name), role_name = COALESCE(NEW.raw_user_meta_data->>'role_name', role_name), home_branch_name = COALESCE(NEW.raw_user_meta_data->>'home_branch_name', home_branch_name) WHERE email = NEW.email;
  ELSE
    INSERT INTO public.users (id, full_name, email, role_name, home_branch_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email, COALESCE(NEW.raw_user_meta_data->>'role_name', CASE WHEN user_count = 0 THEN 'System Administrator' ELSE 'Staff' END), COALESCE(NEW.raw_user_meta_data->>'home_branch_name', 'Kya Sands'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  u_role text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users) THEN RETURN TRUE; END IF;
  SELECT role_name INTO u_role FROM public.users WHERE id = auth.uid();
  IF u_role = 'System Administrator' THEN RETURN TRUE; END IF;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION process_stock_take(p_location_id TEXT, p_performed_by UUID, p_take_date DATE, p_counter_name TEXT, p_notes TEXT, p_status TEXT, p_items JSONB)
RETURNS UUID AS $$
DECLARE
    v_stock_take_id UUID;
    v_item JSONB;
    v_batch_id TEXT;
    v_physical_count INTEGER;
    v_system_qty INTEGER;
    v_asset_id TEXT;
    v_variance INTEGER;
    v_replacement_fee NUMERIC;
    v_item_comments TEXT;
BEGIN
    INSERT INTO public.stock_takes (location_id, take_date, performed_by, counter_name, status, notes) 
    VALUES (p_location_id, p_take_date, p_performed_by, p_counter_name, p_status, p_notes) 
    RETURNING id INTO v_stock_take_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_batch_id := v_item->>'batch_id';
        v_physical_count := (v_item->>'physical_count')::INTEGER;
        v_item_comments := v_item->>'comments';
        
        SELECT quantity, asset_id INTO v_system_qty, v_asset_id FROM public.batches WHERE id = v_batch_id;
        v_variance := v_system_qty - v_physical_count;
        
        INSERT INTO public.stock_take_items (stock_take_id, asset_id, batch_id, system_quantity, physical_count, variance, comments) 
        VALUES (v_stock_take_id, v_asset_id, v_batch_id, v_system_qty, v_physical_count, v_variance, v_item_comments);
        
        -- Only apply adjustments if status is 'Approved'
        IF p_status = 'Approved' AND v_variance > 0 THEN
            SELECT amount_zar INTO v_replacement_fee FROM public.fee_schedule WHERE asset_id = v_asset_id AND fee_type = 'Replacement Fee (Lost Equipment)' AND (effective_to IS NULL OR effective_to >= CURRENT_DATE) ORDER BY effective_from DESC LIMIT 1;
            UPDATE public.batches SET quantity = v_physical_count WHERE id = v_batch_id;
            INSERT INTO public.asset_losses (batch_id, loss_type, lost_quantity, last_known_location_id, reported_by, notes, transaction_date)
            VALUES (v_batch_id, 'Stock Take Variance', v_variance, p_location_id, p_performed_by, 'Stock Take ID: ' || v_stock_take_id::text || ' | Replacement Fee: R' || COALESCE(v_replacement_fee::text, '0.00'), CURRENT_DATE);
        ELSIF p_status = 'Approved' AND v_variance < 0 THEN
            -- Surplus adjustment
            UPDATE public.batches SET quantity = v_physical_count WHERE id = v_batch_id;
        END IF;
    END LOOP;
    RETURN v_stock_take_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION approve_stock_take(p_stock_take_id UUID, p_approved_by UUID)
RETURNS VOID AS $$
DECLARE
    v_item RECORD;
    v_location_id TEXT;
    v_replacement_fee NUMERIC;
BEGIN
    -- Update status
    UPDATE public.stock_takes SET status = 'Approved' WHERE id = p_stock_take_id;
    
    SELECT location_id INTO v_location_id FROM public.stock_takes WHERE id = p_stock_take_id;

    -- Apply adjustments
    FOR v_item IN SELECT * FROM public.stock_take_items WHERE stock_take_id = p_stock_take_id
    LOOP
        IF v_item.variance > 0 THEN
            SELECT amount_zar INTO v_replacement_fee FROM public.fee_schedule WHERE asset_id = v_item.asset_id AND fee_type = 'Replacement Fee (Lost Equipment)' AND (effective_to IS NULL OR effective_to >= CURRENT_DATE) ORDER BY effective_from DESC LIMIT 1;
            UPDATE public.batches SET quantity = v_item.physical_count WHERE id = v_item.batch_id;
            INSERT INTO public.asset_losses (batch_id, loss_type, lost_quantity, last_known_location_id, reported_by, notes, transaction_date)
            VALUES (v_item.batch_id, 'Stock Take Variance', v_item.variance, v_location_id, p_approved_by, 'Approved Stock Take ID: ' || p_stock_take_id::text || ' | Replacement Fee: R' || COALESCE(v_replacement_fee::text, '0.00'), CURRENT_DATE);
        ELSIF v_item.variance < 0 THEN
            UPDATE public.batches SET quantity = v_item.physical_count WHERE id = v_item.batch_id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reject_stock_take(p_stock_take_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.stock_takes SET status = 'Rejected' WHERE id = p_stock_take_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_supplier_liability(p_supplier_id TEXT, p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
    batch_id TEXT,
    asset_name TEXT,
    days INTEGER,
    amount_zar NUMERIC,
    liability_type TEXT
) AS $$
BEGIN
    -- Rental Accruals
    RETURN QUERY
    SELECT 
        b.id,
        a.name,
        GREATEST(0, (CASE WHEN b.transfer_confirmed_by_customer THEN b.confirmation_date ELSE CURRENT_DATE END - b.transaction_date))::INTEGER,
        public.calculate_batch_accrual(b.id),
        'Rental'::TEXT
    FROM public.batches b
    JOIN public.asset_master a ON b.asset_id = a.id
    WHERE a.supplier_id = p_supplier_id 
      AND b.is_settled = FALSE 
      AND b.transaction_date <= p_end_date;

    -- Losses
    RETURN QUERY
    SELECT 
        al.batch_id,
        a.name,
        0, -- Days not applicable for loss
        al.lost_quantity * fs.amount_zar,
        'Loss'::TEXT
    FROM public.asset_losses al
    JOIN public.batches b ON al.batch_id = b.id
    JOIN public.asset_master a ON b.asset_id = a.id
    JOIN public.fee_schedule fs ON a.id = fs.asset_id
    WHERE a.supplier_id = p_supplier_id 
      AND al.is_settled = FALSE 
      AND al.transaction_date <= p_end_date 
      AND fs.fee_type = 'Replacement Fee (Lost Equipment)' 
      AND fs.effective_to IS NULL;

    -- Credits
    RETURN QUERY
    SELECT 
        c.batch_id,
        a.name,
        0,
        -c.amount_claimed_zar,
        'Credit'::TEXT
    FROM public.claims c
    JOIN public.batches b ON c.batch_id = b.id
    JOIN public.asset_master a ON b.asset_id = a.id
    WHERE a.supplier_id = p_supplier_id 
      AND c.status = 'Accepted' 
      AND c.type = 'Damaged' 
      AND c.created_at::date <= p_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION finalize_payment_settlement(p_supplier_id TEXT, p_start_date DATE, p_end_date DATE, p_gross_liability NUMERIC, p_discount_amount NUMERIC, p_net_payable NUMERIC, p_cash_paid NUMERIC, p_payment_ref TEXT, p_settled_by UUID)
RETURNS UUID AS $$
DECLARE
    v_settlement_id UUID;
BEGIN
    INSERT INTO public.settlements (supplier_id, start_date, end_date, gross_liability, discount_amount, net_payable, cash_paid, payment_reference, settled_by)
    VALUES (p_supplier_id, p_start_date, p_end_date, p_gross_liability, p_discount_amount, p_net_payable, p_cash_paid, p_payment_ref, p_settled_by)
    RETURNING id INTO v_settlement_id;
    UPDATE public.batches b SET is_settled = TRUE, settled_at = NOW() FROM public.asset_master a WHERE b.asset_id = a.id AND a.supplier_id = p_supplier_id AND b.is_settled = FALSE AND b.transaction_date <= p_end_date;
    UPDATE public.asset_losses al SET is_settled = TRUE, settled_at = NOW() FROM public.batches b JOIN public.asset_master a ON b.asset_id = a.id WHERE al.batch_id = b.id AND a.supplier_id = p_supplier_id AND al.is_settled = FALSE AND al.transaction_date <= p_end_date;
    RETURN v_settlement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. VIEWS
DROP VIEW IF EXISTS public.vw_master_logistics_trace;
CREATE OR REPLACE VIEW public.vw_master_logistics_trace AS
SELECT 
    bm.id AS movement_id,
    bm.batch_id,
    bm.transaction_date,
    bm.timestamp,
    d.full_name AS driver_name,
    COALESCE(bm.quantity, b.quantity) AS quantity,
    l_to.name AS to_location_name,
    l_to.id AS to_location_id,
    l_from.name AS from_location_name,
    t.plate_number AS truck_plate,
    bm.condition,
    l_to.branch_id AS custodian_branch_id
FROM public.batch_movements bm
JOIN public.batches b ON bm.batch_id = b.id
JOIN public.locations l_to ON bm.to_location_id = l_to.id
JOIN public.locations l_from ON bm.from_location_id = l_from.id
LEFT JOIN public.drivers d ON bm.driver_id = d.id
LEFT JOIN public.trucks t ON bm.truck_id = t.id;

DROP VIEW IF EXISTS public.vw_daily_burn_rate;
CREATE OR REPLACE VIEW public.vw_daily_burn_rate AS
SELECT 
    br.name AS branch_name, 
    l.name AS location_name, 
    l.id AS location_id, 
    br.id AS branch_id, 
    SUM(bt.quantity * fs.amount_zar) AS daily_burn_rate, 
    COUNT(bt.id) AS batch_count, 
    AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - bt.transaction_date))/86400) AS avg_duration_days
FROM public.batches bt 
JOIN public.locations l ON bt.current_location_id = l.id 
JOIN public.branches br ON l.branch_id = br.id 
JOIN public.fee_schedule fs ON bt.asset_id = fs.asset_id
WHERE bt.transfer_confirmed_by_customer = FALSE 
  AND fs.effective_to IS NULL
GROUP BY br.name, l.name, l.id, br.id;

-- 6. RLS POLICIES
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thaan_slips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_losses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_takes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_take_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branches_select" ON public.branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "branches_manage" ON public.branches FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "locations_select" ON public.locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "locations_manage" ON public.locations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "assets_select" ON public.asset_master FOR SELECT TO authenticated USING (true);
CREATE POLICY "assets_manage" ON public.asset_master FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "trucks_select" ON public.trucks FOR SELECT TO authenticated USING (true);
CREATE POLICY "trucks_manage" ON public.trucks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "drivers_select" ON public.drivers FOR SELECT TO authenticated USING (true);
CREATE POLICY "drivers_manage" ON public.drivers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "users_select" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "users_self_insert" ON public.users FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "users_self_update" ON public.users FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "users_admin" ON public.users FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "fees_select" ON public.fee_schedule FOR SELECT TO authenticated USING (true);
CREATE POLICY "fees_admin" ON public.fee_schedule FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "batches_select" ON public.batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "batches_staff" ON public.batches FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "movements_select" ON public.batch_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "movements_staff" ON public.batch_movements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "losses_select" ON public.asset_losses FOR SELECT TO authenticated USING (true);
CREATE POLICY "losses_staff" ON public.asset_losses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "claims_select" ON public.claims FOR SELECT TO authenticated USING (true);
CREATE POLICY "claims_staff" ON public.claims FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "business_parties_select" ON public.business_parties FOR SELECT TO authenticated USING (true);
CREATE POLICY "business_parties_manage" ON public.business_parties FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "settlements_select" ON public.settlements FOR SELECT TO authenticated USING (true);
CREATE POLICY "settlements_manage" ON public.settlements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "discounts_select" ON public.discounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "discounts_manage" ON public.discounts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "tasks_manage" ON public.tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "stock_takes_select" ON public.stock_takes FOR SELECT TO authenticated USING (true);
CREATE POLICY "stock_takes_manage" ON public.stock_takes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "stock_take_items_select" ON public.stock_take_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "stock_take_items_manage" ON public.stock_take_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "claim_audits_select" ON public.claim_audits FOR SELECT TO authenticated USING (true);
CREATE POLICY "claim_audits_manage" ON public.claim_audits FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "audit_logs_select" ON public.audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "audit_logs_manage" ON public.audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "trips_select" ON public.trips FOR SELECT TO authenticated USING (true);
CREATE POLICY "trips_manage" ON public.trips FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "trip_stops_select" ON public.trip_stops FOR SELECT TO authenticated USING (true);
CREATE POLICY "trip_stops_manage" ON public.trip_stops FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. SEED DATA
INSERT INTO public.branches (id, name) VALUES ('BR-01', 'Kya Sands'), ('BR-02', 'Durban') ON CONFLICT DO NOTHING;

INSERT INTO public.locations (id, name, type, category, branch_id, partner_type) VALUES 
('LOC-JHB-01', 'Lupo JHB Main Plant (Kya Sands)', 'Crates Dept', 'Home', 'BR-01', 'Internal'),
('LOC-DBN-01', 'Lupo Durban Plant', 'Crates Dept', 'Home', 'BR-02', 'Internal'),
('LOC-JHB-WH1', 'Kya Sands Warehouse 1', 'Warehouse', 'Internal', 'BR-01', 'Internal'),
('LOC-JHB-WH2', 'Kya Sands Warehouse 2', 'Warehouse', 'Internal', 'BR-01', 'Internal'),
('LOC-SUP-01', 'Crate Suppliers JHB', 'Supplier', 'External', 'BR-01', 'Supplier'),
('LOC-CUST-01', 'Checkers Hyper Sandton', 'At Customer', 'External', 'BR-01', 'Customer'),
('LOC-TRANSIT-01', 'Truck GP 123 SH (JHB)', 'In Transit', 'Internal', 'BR-01', 'Internal'),
('LOC-TRANSIT-02', 'Truck GP 456 SH (JHB)', 'In Transit', 'Internal', 'BR-01', 'Internal'),
('LOC-TRANSIT-03', 'Truck ND 789 DBN (DBN)', 'In Transit', 'Internal', 'BR-02', 'Internal')
ON CONFLICT DO NOTHING;

INSERT INTO public.trucks (id, plate_number, branch_id) VALUES 
('TRK-001', 'GP 123 SH', 'BR-01'),
('TRK-002', 'GP 456 SH', 'BR-01'),
('TRK-003', 'ND 789 DBN', 'BR-02')
ON CONFLICT DO NOTHING;

INSERT INTO public.drivers (id, full_name, branch_id) VALUES 
('DRV-001', 'John Doe', 'BR-01'),
('DRV-002', 'Jane Smith', 'BR-01'),
('DRV-003', 'Sipho Zulu', 'BR-02')
ON CONFLICT DO NOTHING;

INSERT INTO public.asset_master (id, name, type, dimensions, material, supplier_id) VALUES 
('SH-001', 'Lupo Standard Bread Crate', 'Crate', '600x400x150mm', 'HDPE-Amber', 'LOC-SUP-01'),
('SH-P01', 'Heavy Duty Flour Pallet', 'Pallet', '1200x1000mm', 'Reinforced Pine', 'LOC-SUP-01')
ON CONFLICT DO NOTHING;

-- 16. Personnel View
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

-- 17. Fleet Expenses View
CREATE OR REPLACE VIEW public.vw_branch_fleet_expenses AS
-- License Renewal Expenses
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

-- Roadworthy/COF Expenses
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

-- Fleet Compliance Alerts View
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
LEFT JOIN public.drivers d ON t.branch_id = d.branch_id;

-- Fleet Readiness View
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

CREATE OR REPLACE VIEW public.vw_all_origins AS
SELECT * FROM public.vw_all_sources
ORDER BY sort_group, name;

CREATE OR REPLACE VIEW public.vw_movement_destinations AS
SELECT * FROM public.vw_all_sources
ORDER BY sort_group, name;

INSERT INTO public.business_parties (name, party_type) VALUES 
('CHEP South Africa', 'Supplier'),
('Pick n Pay Distribution', 'Customer')
ON CONFLICT DO NOTHING;

INSERT INTO public.collection_requests (customer_id, asset_id, estimated_quantity, preferred_pickup_date, contact_person, contact_number) VALUES 
('LOC-CUST-01', 'SH-001', 150, CURRENT_DATE + INTERVAL '1 day', 'John Doe', '011-555-0123'),
('Pick n Pay Distribution', 'SH-001', 300, CURRENT_DATE + INTERVAL '2 days', 'Jane Smith', '011-555-0456')
ON CONFLICT DO NOTHING;

-- 18. Management Reporting Views
DROP VIEW IF EXISTS public.vw_all_sources CASCADE;
CREATE OR REPLACE VIEW public.vw_all_sources AS
SELECT 
    id,
    name,
    partner_type,
    branch_id,
    type,
    category,
    address,
    name || ' (' || partner_type || ')' as display_name,
    CASE 
        WHEN partner_type = 'Internal' AND type != 'In Transit' THEN 1 
        WHEN type = 'In Transit' THEN 3
        ELSE 2 
    END as sort_group
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
    name || ' (' || party_type || ')' as display_name,
    2 as sort_group
FROM public.business_parties;

-- Update vw_all_origins to be consistent
DROP VIEW IF EXISTS public.vw_all_origins CASCADE;
CREATE OR REPLACE VIEW public.vw_all_origins AS
SELECT * FROM public.vw_all_sources
ORDER BY sort_group, name;

-- Update vw_movement_destinations to be consistent
DROP VIEW IF EXISTS public.vw_movement_destinations CASCADE;
CREATE OR REPLACE VIEW public.vw_movement_destinations AS
SELECT * FROM public.vw_all_sources
ORDER BY sort_group, name;

-- Module 1: Executive Dashboard Overhaul Views
CREATE OR REPLACE VIEW public.vw_dashboard_stats AS
SELECT
    br.name as branch_name,
    COALESCE(SUM(CASE WHEN s.category = 'Home' AND s.type != 'In Transit' THEN b.quantity ELSE 0 END), 0) as available,
    COALESCE(SUM(CASE WHEN s.partner_type = 'Customer' THEN b.quantity ELSE 0 END), 0) as at_customers,
    COALESCE(SUM(CASE WHEN s.type = 'In Transit' THEN b.quantity ELSE 0 END), 0) as in_transit,
    COALESCE(SUM(CASE WHEN b.status = 'Maintenance' THEN b.quantity ELSE 0 END), 0) as maintenance,
    COALESCE(SUM(b.quantity), 0) as total_fleet,
    -- Financial Alerts
    COALESCE(SUM(CASE WHEN b.status = 'Lost' THEN b.quantity ELSE 0 END), 0) as lost_missing,
    COALESCE(SUM(CASE WHEN b.status = 'Damaged' THEN b.quantity ELSE 0 END), 0) as damaged,
    COALESCE(SUM(public.calculate_batch_accrual(b.id)), 0) as pending_charges,
    (SELECT COUNT(*) FROM public.asset_losses al JOIN public.locations l ON al.last_known_location_id = l.id WHERE al.is_settled = FALSE AND l.branch_id = br.id) as open_loss_cases,
    -- Liability
    COALESCE(SUM(public.calculate_batch_accrual(b.id)), 0) as accrued_rental,
    (SELECT COALESCE(SUM(net_payable), 0) FROM public.settlements st WHERE st.supplier_id IN (SELECT id FROM public.locations WHERE branch_id = br.id)) as settlement_liability,
    (SELECT COUNT(DISTINCT id) FROM public.locations WHERE partner_type = 'Customer' AND branch_id = br.id) as active_customers,
    (SELECT COALESCE(SUM(quantity), 0) FROM public.batch_movements bm JOIN public.locations l ON bm.to_location_id = l.id WHERE bm.transaction_date = CURRENT_DATE AND l.branch_id = br.id) as movements_today
FROM public.branches br
LEFT JOIN public.locations s ON s.branch_id = br.id
LEFT JOIN public.batches b ON b.current_location_id = s.id
GROUP BY br.id, br.name;

CREATE OR REPLACE VIEW public.vw_batch_forensics AS
SELECT 
    bm.transaction_date as date,
    COALESCE(bm.condition, 'unknown') as type,
    bm.batch_id,
    s_from.name as from_location,
    s_to.name as to_location,
    d.full_name as driver_name,
    bm.quantity,
    br.name as branch_name,
    bm.timestamp
FROM public.batch_movements bm
LEFT JOIN public.vw_all_sources s_from ON bm.from_location_id = s_from.id
LEFT JOIN public.vw_all_sources s_to ON bm.to_location_id = s_to.id
LEFT JOIN public.drivers d ON bm.driver_id = d.id
LEFT JOIN public.branches br ON s_to.branch_id = br.id
ORDER BY bm.timestamp DESC;

-- Module 2: Crates & Pallets Management Views
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

-- Relax foreign key on batches to allow business party IDs
ALTER TABLE public.batches DROP CONSTRAINT IF EXISTS batches_current_location_id_fkey;

CREATE OR REPLACE VIEW public.vw_global_inventory_tracker AS
SELECT 
    b.id AS batch_id,
    b.asset_id,
    a.name AS asset_name,
    b.quantity,
    b.current_location_id,
    s.name AS current_location,
    s.branch_id,
    b.status AS batch_status,
    b.transaction_date,
    public.calculate_batch_accrual(b.id) AS daily_accrued_liability,
    (CURRENT_DATE - b.transaction_date) AS days_in_circulation
FROM public.batches b
JOIN public.asset_master a ON b.asset_id = a.id
LEFT JOIN public.vw_all_sources s ON b.current_location_id = s.id;

CREATE OR REPLACE FUNCTION approve_reconciliation(p_stock_take_id UUID, p_approved_by UUID)
RETURNS VOID AS $$
BEGIN
    PERFORM public.approve_stock_take(p_stock_take_id, p_approved_by);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE OR REPLACE VIEW public.vw_management_kpis AS
WITH batch_stats AS (
    SELECT 
        AVG(EXTRACT(DAY FROM (confirmation_date::timestamp - transaction_date::timestamp))) FILTER (WHERE transfer_confirmed_by_customer = true) as avg_cycle_time,
        COUNT(*) as total_batches,
        SUM(quantity) as total_units
    FROM public.batches
),
shrinkage_stats AS (
    SELECT 
        (SUM(ABS(variance))::float / NULLIF(SUM(system_quantity), 0)) * 100 as shrinkage_rate
    FROM public.stock_take_items
),
financial_stats AS (
    SELECT 
        SUM(amount) as total_compliance_cost
    FROM public.vw_branch_fleet_expenses
    WHERE expense_date >= date_trunc('month', current_date)
)
SELECT 
    COALESCE(bs.avg_cycle_time, 0) as crate_cycle_time,
    COALESCE(ss.shrinkage_rate, 0) as shrinkage_rate,
    COALESCE(fs.total_compliance_cost, 0) as monthly_compliance_cost
FROM batch_stats bs, shrinkage_stats ss, financial_stats fs;

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
INSERT INTO public.fee_schedule (asset_id, fee_type, amount_zar, effective_from) VALUES 
('SH-001', 'Daily Rental (Supermarket)', 5.50, '2026-01-01'),
('SH-P01', 'Replacement Fee (Lost Equipment)', 1200.00, '2026-01-01')
ON CONFLICT DO NOTHING;

-- Seed Disputed Batches & Claims
INSERT INTO public.batches (id, asset_id, quantity, current_location_id, status, transaction_date) VALUES 
('B-DISP-001', 'SH-001', 50, 'LOC-CUST-01', 'Disputed', '2026-03-01'),
('B-DISP-002', 'SH-P01', 10, 'LOC-CUST-01', 'Disputed', '2026-03-05'),
('B-STAG-001', 'SH-001', 120, 'LOC-JHB-01', 'Success', CURRENT_DATE - INTERVAL '25 days'),
('B-STAG-002', 'SH-P01', 45, 'LOC-DBN-01', 'Success', CURRENT_DATE - INTERVAL '30 days'),
('B-STAG-003', 'SH-001', 85, 'LOC-JHB-WH1', 'Success', CURRENT_DATE - INTERVAL '18 days')
ON CONFLICT DO NOTHING;

INSERT INTO public.batch_movements (batch_id, from_location_id, to_location_id, truck_id, driver_id, condition, origin_user_id, quantity, transaction_date) VALUES 
('B-STAG-001', 'LOC-SUP-01', 'LOC-JHB-01', 'TRK-001', 'DRV-001', 'Clean', NULL, 120, CURRENT_DATE - INTERVAL '25 days'),
('B-STAG-002', 'LOC-SUP-01', 'LOC-DBN-01', 'TRK-003', 'DRV-003', 'Clean', NULL, 45, CURRENT_DATE - INTERVAL '30 days'),
('B-STAG-003', 'LOC-SUP-01', 'LOC-JHB-WH1', 'TRK-002', 'DRV-002', 'Clean', NULL, 85, CURRENT_DATE - INTERVAL '18 days')
ON CONFLICT DO NOTHING;

INSERT INTO public.asset_losses (batch_id, loss_type, lost_quantity, last_known_location_id, transaction_date) VALUES 
('B-STAG-001', 'Shrinkage', 5, 'LOC-JHB-01', CURRENT_DATE - INTERVAL '5 days'),
('B-STAG-002', 'Damaged', 2, 'LOC-DBN-01', CURRENT_DATE - INTERVAL '10 days')
ON CONFLICT DO NOTHING;

INSERT INTO public.claims (id, batch_id, type, amount_claimed_zar, status) VALUES 
('CLM-001', 'B-DISP-001', 'Damaged', 2500.00, 'Lodged'),
('CLM-002', 'B-DISP-002', 'Dirty', 1200.00, 'Under Assessment')
ON CONFLICT DO NOTHING;

-- Drop the view first to avoid column mismatch errors
DROP VIEW IF EXISTS public.vw_trip_audit_trail;

-- Create/Update the Trip Audit Trail View (Optimized with Lateral Join and All Sources)
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

-- Executive Report View
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
            JOIN public.locations l ON al.last_known_location_id = l.id
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

-- Business Directory View
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
