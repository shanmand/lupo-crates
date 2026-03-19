
-- Consolidated SQL for Reporting Views & RPC Fixes

-- 0. Add missing quantity column to batch_movements
ALTER TABLE public.batch_movements ADD COLUMN IF NOT EXISTS quantity INTEGER;

-- 1. Master Logistics Trace View
DROP VIEW IF EXISTS public.vw_master_logistics_trace;
CREATE OR REPLACE VIEW public.vw_master_logistics_trace AS
SELECT 
    bm.id as movement_id,
    bm.batch_id,
    bm.timestamp,
    bm.transaction_date,
    d.full_name as driver_name,
    t.plate_number as truck_plate,
    COALESCE(bm.quantity, b.quantity) as quantity,
    fl.name as from_location_name,
    tl.name as to_location_name,
    tl.id as to_location_id,
    bm.condition,
    tl.branch_id as custodian_branch_id
FROM public.batch_movements bm
LEFT JOIN public.batches b ON bm.batch_id = b.id
LEFT JOIN public.drivers d ON bm.driver_id = d.id
LEFT JOIN public.trucks t ON bm.truck_id = t.id
LEFT JOIN public.locations fl ON bm.from_location_id = fl.id
LEFT JOIN public.locations tl ON bm.to_location_id = tl.id;

-- 2. Fleet Compliance Alerts View
DROP VIEW IF EXISTS public.vw_fleet_compliance_alerts;
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

-- 3. Management KPIs View
DROP VIEW IF EXISTS public.vw_management_kpis;
-- Update vw_management_kpis to support the Management Report Pack UI
DROP VIEW IF EXISTS public.vw_management_kpis CASCADE;
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

-- 4. Ensure RPCs handle TEXT IDs correctly
-- (The existing split_batch and process_stock_take already use TEXT/UUID correctly in schema.sql)

-- 5. Loss Module: Process Partial Loss RPC
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
        last_known_location_id, 
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

        v_new_batch_id := p_batch_id || '-LOST-' || floor(random() * 1000)::text;
        
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

-- 6. Fleet Expenses View: Cast truck_id to text
DROP VIEW IF EXISTS public.vw_branch_fleet_expenses;
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

-- 7. Liability Heatmap View
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

-- 8. Vehicle Inspections Table
CREATE TABLE IF NOT EXISTS public.vehicle_inspections (
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

-- Enable Row Level Security (RLS)
ALTER TABLE public.vehicle_inspections ENABLE ROW LEVEL SECURITY;

-- Security Policy: Allow Drivers to submit (Insert)
DROP POLICY IF EXISTS "Allow drivers to submit inspections" ON public.vehicle_inspections;
CREATE POLICY "Allow drivers to submit inspections" 
ON public.vehicle_inspections 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Security Policy: Allow Managers to view (Select)
DROP POLICY IF EXISTS "Allow managers to view all inspections" ON public.vehicle_inspections;
CREATE POLICY "Allow managers to view all inspections" 
ON public.vehicle_inspections 
FOR SELECT 
TO authenticated 
USING (true);

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

-- 9. Auto-Supplier Logic: Quick-Register RPC
CREATE OR REPLACE FUNCTION public.check_and_create_supplier(p_supplier_id TEXT)
RETURNS VOID AS $$
BEGIN
    -- 1. Ensure it exists in locations (since asset_master references it)
    IF NOT EXISTS (SELECT 1 FROM public.locations WHERE id = p_supplier_id) THEN
        INSERT INTO public.locations (id, name, type, category, partner_type)
        VALUES (p_supplier_id, 'Auto-Registered: ' || p_supplier_id, 'Supplier', 'External', 'Supplier');
    END IF;

    -- 2. Ensure it exists in business_parties (as requested)
    -- Update: business_parties now uses TEXT ID to match locations
    IF NOT EXISTS (SELECT 1 FROM public.business_parties WHERE id = p_supplier_id) THEN
        INSERT INTO public.business_parties (id, name, party_type)
        VALUES (p_supplier_id, p_supplier_id, 'Supplier');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Business Directory View & Schema Update
-- Change business_parties ID to TEXT to support human-readable IDs
ALTER TABLE public.business_parties ALTER COLUMN id TYPE TEXT;
ALTER TABLE public.business_parties ALTER COLUMN id DROP DEFAULT;

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

-- 11. Inventory Intake Management RPCs
CREATE OR REPLACE FUNCTION public.delete_inventory_batch(p_batch_id TEXT)
RETURNS VOID AS $$
BEGIN
    -- Delete movements first due to FK
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

-- 12. Batch Summary Report View
DROP VIEW IF EXISTS public.vw_intake_summary_report;
CREATE OR REPLACE VIEW public.vw_intake_summary_report AS
SELECT 
    date_trunc('week', bm.transaction_date)::date as week_starting,
    COALESCE(l.partner_type, bp.party_type) as source_type,
    COALESCE(l.name, bp.name) as source_name,
    SUM(bm.quantity) as total_quantity
FROM public.batch_movements bm
JOIN public.locations tl ON bm.to_location_id = tl.id
LEFT JOIN public.locations l ON bm.from_location_id = l.id
LEFT JOIN public.business_parties bp ON bm.from_location_id = bp.id::text
WHERE tl.partner_type = 'Internal' -- Destination is us
GROUP BY 1, 2, 3;

-- ==========================================
-- 14. Synchronize Views for Business Parties
-- ==========================================

-- Update vw_all_sources to include branch_id, type, category and In Transit locations
DROP VIEW IF EXISTS public.vw_all_sources CASCADE;
CREATE OR REPLACE VIEW public.vw_all_sources AS
SELECT 
    id,
    name,
    partner_type,
    branch_id,
    type,
    category,
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
WITH stats AS (
    SELECT
        SUM(CASE WHEN s.category = 'Home' AND s.type != 'In Transit' THEN b.quantity ELSE 0 END) as available,
        SUM(CASE WHEN s.partner_type = 'Customer' THEN b.quantity ELSE 0 END) as at_customers,
        SUM(CASE WHEN s.type = 'In Transit' THEN b.quantity ELSE 0 END) as in_transit,
        SUM(CASE WHEN b.status = 'Maintenance' THEN b.quantity ELSE 0 END) as maintenance,
        SUM(b.quantity) as total_fleet,
        -- Financial Alerts
        SUM(CASE WHEN b.status = 'Lost' THEN b.quantity ELSE 0 END) as lost_missing,
        SUM(CASE WHEN b.status = 'Damaged' THEN b.quantity ELSE 0 END) as damaged,
        SUM(public.calculate_batch_accrual(b.id)) as pending_charges,
        (SELECT COUNT(*) FROM public.asset_losses WHERE is_settled = FALSE) as open_loss_cases,
        -- Liability
        SUM(public.calculate_batch_accrual(b.id)) as accrued_rental,
        (SELECT COALESCE(SUM(net_payable), 0) FROM public.settlements) as settlement_liability,
        (SELECT COUNT(DISTINCT id) FROM public.locations WHERE partner_type = 'Customer') as active_customers,
        (SELECT COALESCE(SUM(quantity), 0) FROM public.batch_movements WHERE transaction_date = CURRENT_DATE) as movements_today
    FROM public.batches b
    JOIN public.vw_all_sources s ON b.current_location_id = s.id
)
SELECT * FROM stats;

CREATE OR REPLACE VIEW public.vw_batch_forensics AS
SELECT 
    bm.transaction_date as date,
    bm.condition as type,
    s_from.name as from_location,
    s_to.name as to_location,
    bm.quantity
FROM public.batch_movements bm
LEFT JOIN public.vw_all_sources s_from ON bm.from_location_id = s_from.id
LEFT JOIN public.vw_all_sources s_to ON bm.to_location_id = s_to.id
ORDER BY bm.timestamp DESC
LIMIT 20;

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

-- Update vw_master_logistics_trace to support business parties
DROP VIEW IF EXISTS public.vw_master_logistics_trace CASCADE;
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

-- Update vw_daily_burn_rate to support business parties
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

-- Update vw_location_unconfirmed_value to support business parties
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

-- Update vw_global_inventory_tracker to include branch_id
DROP VIEW IF EXISTS public.vw_global_inventory_tracker CASCADE;
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

-- Update vw_pending_collections to support business parties
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

-- Trip Audit Trail View (Optimized with Lateral Join and All Sources)
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

-- Update vw_batch_accruals to include branch_id and current_location name
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

-- ==========================================
-- 16. Executive Report View
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

-- 19. Trip Planning Enhancements
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS scheduled_departure_time TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS start_odometer INTEGER;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS end_odometer INTEGER;

-- 20. Address Support
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.business_parties ADD COLUMN IF NOT EXISTS address TEXT;

-- Update vw_all_sources to include address
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
