
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

DROP TABLE IF EXISTS public.stock_take_items CASCADE;
DROP TABLE IF EXISTS public.stock_takes CASCADE;
DROP TABLE IF EXISTS public.asset_losses CASCADE;
DROP TABLE IF EXISTS public.batch_movements CASCADE;
DROP TABLE IF EXISTS public.batches CASCADE;
DROP TABLE IF EXISTS public.fee_schedule CASCADE;
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

DROP FUNCTION IF EXISTS public.process_inventory_intake CASCADE;
DROP FUNCTION IF EXISTS public.process_stock_take CASCADE;
DROP FUNCTION IF EXISTS public.approve_stock_take CASCADE;
DROP FUNCTION IF EXISTS public.process_asset_loss CASCADE;
DROP FUNCTION IF EXISTS public.calculate_batch_accrual CASCADE;
DROP FUNCTION IF EXISTS public.calculate_location_liability CASCADE;
DROP FUNCTION IF EXISTS public.split_batch CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
DROP FUNCTION IF EXISTS public.is_admin CASCADE;

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
    supplier_id TEXT REFERENCES public.locations(id),
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
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.batch_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id TEXT REFERENCES public.batches(id),
    from_location_id TEXT, -- Can be from locations or business_parties
    to_location_id TEXT, -- Can be from locations or business_parties
    truck_id TEXT,
    driver_id TEXT,
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
    transaction_date DATE DEFAULT CURRENT_DATE,
    timestamp TIMESTAMPTZ DEFAULT NOW()
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

CREATE TABLE public.trucks (
    id TEXT PRIMARY KEY,
    plate_number TEXT NOT NULL UNIQUE,
    branch_id TEXT REFERENCES public.branches(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.drivers (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    branch_id TEXT REFERENCES public.branches(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. FUNCTIONS & RPCs

-- INTAKE FUNCTION
CREATE OR REPLACE FUNCTION process_inventory_intake(
    p_asset_id TEXT,
    p_quantity INTEGER,
    p_location_id TEXT,
    p_notes TEXT,
    p_user_id UUID
) RETURNS TEXT AS $$
DECLARE
    v_batch_id TEXT;
BEGIN
    v_batch_id := 'BAT-' || to_char(now(), 'YYYYMMDD') || '-' || floor(random() * 10000)::text;
    
    INSERT INTO public.batches (id, asset_id, quantity, current_location_id, status, transaction_date)
    VALUES (v_batch_id, p_asset_id, p_quantity, p_location_id, 'Success', CURRENT_DATE);
    
    INSERT INTO public.batch_movements (batch_id, to_location_id, origin_user_id, quantity, condition, notes)
    VALUES (v_batch_id, p_location_id, p_user_id, p_quantity, 'New/Intake', p_notes);
    
    RETURN v_batch_id;
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
    name || ' (' || partner_type || ')' as display_name,
    'Location' as source_table
FROM public.locations
UNION ALL
SELECT 
    id,
    name,
    party_type as partner_type,
    NULL as branch_id,
    party_type as type,
    'External' as category,
    address,
    name || ' (' || party_type || ')' as display_name,
    'BusinessParty' as source_table
FROM public.business_parties;

-- INVENTORY SUMMARY
CREATE OR REPLACE VIEW public.vw_inventory_summary AS
SELECT 
    s.id as location_id,
    s.name as location_name,
    s.type as location_type,
    s.branch_id,
    b.asset_id,
    am.name as asset_name,
    am.type as asset_type,
    SUM(b.quantity) as total_quantity,
    COUNT(b.id) as batch_count
FROM public.vw_all_sources s
JOIN public.batches b ON s.id = b.current_location_id
JOIN public.asset_master am ON b.asset_id = am.id
WHERE b.status = 'Success' AND b.quantity > 0
GROUP BY s.id, s.name, s.type, s.branch_id, b.asset_id, am.name, am.type;

-- ASSET REGISTRY
CREATE OR REPLACE VIEW public.vw_asset_registry AS
SELECT 
    b.id as batch_id,
    b.asset_id,
    am.name as asset_name,
    am.type as asset_type,
    am.ownership_type,
    b.quantity,
    b.current_location_id,
    s.name as location_name,
    b.status,
    b.transaction_date,
    b.created_at
FROM public.batches b
JOIN public.asset_master am ON b.asset_id = am.id
LEFT JOIN public.vw_all_sources s ON b.current_location_id = s.id;

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
('LOC-SUP-01', 'Crate Suppliers', 'Supplier', 'External', 'BR-01', 'Supplier', -26.1500, 28.2000)
ON CONFLICT DO NOTHING;

INSERT INTO public.asset_master (id, name, type, dimensions, material) VALUES 
('CRT-STD', 'Standard Bread Crate', 'Crate', '600x400x150mm', 'HDPE'),
('PLT-STD', 'Standard Wood Pallet', 'Pallet', '1200x1000mm', 'Wood'),
('SH-001', 'Lupo Premium Crate', 'Crate', '600x400x150mm', 'HDPE-Amber')
ON CONFLICT DO NOTHING;

INSERT INTO public.fee_schedule (asset_id, fee_type, amount_zar, effective_from) VALUES 
('CRT-STD', 'Replacement Fee', 150.00, '2024-01-01'),
('PLT-STD', 'Replacement Fee', 450.00, '2024-01-01'),
('SH-001', 'Replacement Fee', 180.00, '2024-01-01')
ON CONFLICT DO NOTHING;

-- INITIAL INVENTORY
INSERT INTO public.batches (id, asset_id, quantity, current_location_id, status) VALUES 
('BAT-INIT-001', 'CRT-STD', 5000, 'WH-001', 'Success'),
('BAT-INIT-002', 'PLT-STD', 200, 'WH-001', 'Success'),
('BAT-INIT-003', 'SH-001', 1000, 'LOC-JHB-01', 'Success')
ON CONFLICT DO NOTHING;

-- 7. RLS POLICIES (BASIC)
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_takes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_take_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_losses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all to authenticated" ON public.branches FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to authenticated" ON public.locations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to authenticated" ON public.asset_master FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to authenticated" ON public.batches FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to authenticated" ON public.batch_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to authenticated" ON public.stock_takes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to authenticated" ON public.stock_take_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to authenticated" ON public.asset_losses FOR ALL TO authenticated USING (true) WITH CHECK (true);
