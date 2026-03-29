
import React, { useState } from 'react';
import { Database, Table as TableIcon, Calculator, ShieldCheck, Zap, Receipt, Lock, Globe, History as HistoryIcon, MapPin, Truck, FileText, AlertTriangle, TrendingUp, Info, CheckCircle2, Terminal } from 'lucide-react';

const SchemaView: React.FC = () => {
  const [activeView, setActiveView] = useState<'visual' | 'sql' | 'python' | 'simulator' | 'postgres' | 'rbac' | 'backend' | 'scenario' | 'migrations'>('scenario');
  
  // Simulator State
  const [simCondition, setSimCondition] = useState<'Clean' | 'Damaged'>('Clean');
  const [simThaan, setSimThaan] = useState(false);
  const [simClaimReceived, setSimClaimReceived] = useState(false);
  const [simDays, setSimDays] = useState(10);
  const [simAssetType, setSimAssetType] = useState<'Supermarket' | 'QSR'>('Supermarket');
  const [simSupplier, setSimSupplier] = useState<'Lupo JHB' | 'Durban Crates' | 'Cape Logistics'>('Lupo JHB');
  const [simIsSettled, setSimIsSettled] = useState(false);
  const [simDiscount, setSimDiscount] = useState(0);

  const supplierRates = {
    'Lupo JHB': 5.50,
    'Durban Crates': 6.25,
    'Cape Logistics': 4.80
  };

  const entities = [
    { name: 'asset_master', fields: ['id', 'name', 'type', 'billing_model', 'ownership_type', 'supplier_id (FK)'] },
    { name: 'fee_schedule', fields: ['id', 'asset_id (FK)', 'fee_type', 'amount_zar', 'effective_from', 'effective_to'] },
    { name: 'locations', fields: ['id', 'name', 'type', 'category', 'branch_id (FK)', 'partner_type'] },
    { name: 'business_parties', fields: ['id', 'name', 'party_type (Customer/Supplier)', 'branch_id (FK)'] },
    { name: 'batches', fields: ['id', 'asset_id (FK)', 'quantity', 'current_location_id (FK)', 'status', 'is_settled'] },
    { name: 'batch_movements', fields: ['id', 'batch_id (FK)', 'from_location_id (FK)', 'to_location_id (FK)', 'driver_id (FK)', 'moved_by_id', 'truck_id (FK)', 'transaction_date'] },
    { name: 'claims', fields: ['id', 'batch_id (FK)', 'type', 'status', 'amount_claimed_zar'] },
    { name: 'settlements', fields: ['id', 'supplier_id (FK)', 'gross_liability', 'cash_paid', 'discount_amount', 'start_date', 'end_date'] },
    { name: 'trucks', fields: ['id', 'plate_number'] },
    { name: 'drivers', fields: ['id', 'full_name', 'contact_number'] },
    { name: 'thaan_slips', fields: ['id', 'batch_id (FK)', 'doc_url', 'is_signed', 'signed_at'] },
    { name: 'asset_losses', fields: ['id', 'batch_id (FK)', 'loss_type', 'lost_quantity', 'is_settled'] }
  ];

  const calculateSimLiability = () => {
    if (simIsSettled) return 0;
    
    let base = simAssetType === 'Supermarket' ? supplierRates[simSupplier] : 120.00;
    let quantity = 100;
    let total = 0;

    if (simAssetType === 'Supermarket') {
      let activeDays = simDays;
      if (simCondition === 'Clean' && simThaan) activeDays = Math.min(simDays, 5);
      else if (simCondition === 'Damaged' && simClaimReceived) activeDays = Math.min(simDays, 8);
      total = activeDays * base * quantity;
    } else {
      let fee = base * quantity;
      if (simThaan) fee = 0;
      total = fee;
    }

    return Math.max(0, total - simDiscount);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between overflow-x-auto pb-2">
        <div className="flex bg-slate-200 p-1 rounded-xl">
          <TabButton active={activeView === 'scenario'} onClick={() => setActiveView('scenario')} label="Lifecycle Walkthrough" />
          <TabButton active={activeView === 'visual'} onClick={() => setActiveView('visual')} label="Visual Diagram" />
          <TabButton active={activeView === 'postgres'} onClick={() => setActiveView('postgres')} label="Postgres Workflow" />
          <TabButton active={activeView === 'migrations'} onClick={() => setActiveView('migrations')} label="SQL Migrations" />
          <TabButton active={activeView === 'backend'} onClick={() => setActiveView('backend')} label="Backend Logic" />
          <TabButton active={activeView === 'simulator'} onClick={() => setActiveView('simulator')} label="Accrual Simulator" />
        </div>
      </div>

      {activeView === 'visual' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-8 bg-slate-900 rounded-3xl border border-slate-800 overflow-auto max-h-[700px]">
          {entities.map(entity => (
            <div key={entity.name} className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden h-fit shadow-2xl">
              <div className="px-4 py-3 bg-slate-700/50 border-b border-slate-600 flex items-center gap-2">
                <TableIcon size={14} className="text-emerald-400" />
                <span className="text-[10px] font-black text-white tracking-widest uppercase">{entity.name}</span>
              </div>
              <div className="p-4 space-y-2">
                {entity.fields.map(field => (
                  <div key={field} className="text-xs text-slate-400 flex items-center gap-2 py-1 border-b border-slate-700/30 last:border-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                    {field}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeView === 'scenario' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
                <TrendingUp size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">The 3-Month Supermarket Journey</h3>
                <p className="text-sm text-slate-500 uppercase tracking-widest font-bold text-[10px]">End-to-End Operational & Financial Verification</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-12">
              <ScenarioStep 
                num="1" title="Month 1 (Day 1): Intake & 2026 Rate Lock" desc="100 Supermarket Pallets (Asset: SH-P01) received at Kya Sands (LOC-JHB-01)."
                icon={<MapPin className="text-emerald-500" />}
                sql={`INSERT INTO Batches (id, asset_id, quantity, current_location_id, created_at, status)\nVALUES ('B-SM-001', 'SH-P01', 100, 'LOC-JHB-01', '2026-01-01', 'Success');`}
                verify="Rental timer starts immediately. Logic pulls 'Daily Rental' where effective_from <= '2026-01-01'."
              />
              <ScenarioStep 
                num="2" title="Month 1 (Day 15): Batch Splitting" desc="50 pallets are moved from Kya Sands to Cold Storage (LOC-COLD-01)."
                icon={<HistoryIcon className="text-blue-400" />}
                sql={`UPDATE Batches SET quantity = 50 WHERE id = 'B-SM-001';\nINSERT INTO Batches (id, asset_id, quantity, current_location_id, created_at, status)\nVALUES ('B-SM-001-B', 'SH-P01', 50, 'LOC-COLD-01', '2026-01-01', 'Success');`}
                verify="Location updates but rental continues (Category is External)."
              />
              <ScenarioStep 
                num="3" title="Month 2 (Day 10): Logistics Trace" desc="50 pallets from Cold Storage loaded onto Truck GP 22 SH."
                icon={<Truck className="text-amber-500" />}
                sql={`UPDATE Batches SET current_location_id = 'LOC-TRANS-01', status = 'In-Transit' WHERE id = 'B-SM-001-B';`}
                verify="System logs the LogisticsUnit. Rental continues during transit."
              />
            </div>
          </div>
        </div>
      )}

      {activeView === 'postgres' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <div className="bg-slate-900 rounded-3xl p-10 border border-slate-800 font-mono text-xs overflow-x-auto space-y-8">
            <div className="text-emerald-400 flex items-center gap-3 border-b border-slate-800 pb-4">
              <Terminal size={20} />
              <span className="font-black tracking-widest uppercase">RPC: calculate_batch_accrual</span>
            </div>
            <pre className="text-slate-300 leading-relaxed">
{`-- PL/pgSQL Function for Real-time Accrual Calculation
DROP FUNCTION IF EXISTS calculate_batch_accrual(TEXT) CASCADE;
CREATE OR REPLACE FUNCTION calculate_batch_accrual(batch_id_input TEXT)
RETURNS NUMERIC AS $$
DECLARE
    total_accrual NUMERIC := 0;
BEGIN
    -- Calculate liability across all rate periods (Month 1, 2, 3 logic)
    WITH AccrualPhases AS (
        SELECT 
            b.id,
            b.quantity,
            fs.amount_zar,
            -- Accrual starts at batch creation or fee effect
            GREATEST(b.created_at, fs.effective_from) as phase_start,
            -- Accrual ends at (Loss, Thaan, or Now) or fee expiration
            LEAST(
                COALESCE(al.timestamp, ts.signed_at, NOW()), 
                COALESCE(fs.effective_to, '9999-12-31'::timestamp)
            ) as phase_end
        FROM batches b
        JOIN asset_master fs ON b.asset_id = fs.id -- Note: Logic simplified for demo
        LEFT JOIN asset_losses al ON b.id = al.batch_id
        LEFT JOIN thaan_slips ts ON b.id = ts.batch_id
        WHERE b.id = batch_id_input
    )
    SELECT COALESCE(SUM(
        EXTRACT(DAY FROM (phase_end - phase_start)) * 5.50 * quantity -- Mock rate
    ), 0)
    INTO total_accrual
    FROM AccrualPhases
    WHERE phase_end > phase_start;

    RETURN total_accrual;
END;
$$ LANGUAGE plpgsql;`}
            </pre>
          </div>

          <div className="bg-slate-900 rounded-3xl p-10 border border-slate-800 font-mono text-xs overflow-x-auto space-y-8">
            <div className="text-blue-400 flex items-center gap-3 border-b border-slate-800 pb-4">
              <Calculator size={20} />
              <span className="font-black tracking-widest uppercase">Verification Triggers</span>
            </div>
            <pre className="text-slate-300 leading-relaxed">
{`-- Trigger: Variance to Loss Record
DROP FUNCTION IF EXISTS fn_on_verification_variance();
CREATE OR REPLACE FUNCTION fn_on_verification_variance() 
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.variance < 0 THEN
        INSERT INTO asset_losses (batch_id, loss_type, lost_quantity, timestamp, reported_by) 
        VALUES (NEW.batch_id, 'Missing/Lost', ABS(NEW.variance), NOW(), NEW.verified_by);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;`}
            </pre>
          </div>
        </div>
      )}

      {activeView === 'migrations' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="bg-slate-900 rounded-3xl p-10 border border-slate-800 font-mono text-xs overflow-x-auto space-y-8">
            <div className="text-amber-400 flex items-center gap-3 border-b border-slate-800 pb-4">
              <Terminal size={20} />
              <span className="font-black tracking-widest uppercase">Required Schema Updates (Run in Supabase SQL Editor)</span>
            </div>
            <pre className="text-slate-300 leading-relaxed">
{`-- 1. Create Branches Table
CREATE TABLE IF NOT EXISTS public.branches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add branch_id to Locations
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='locations' AND column_name='branch_id') THEN
        ALTER TABLE public.locations ADD COLUMN branch_id TEXT REFERENCES public.branches(id);
    END IF;
END $$;

-- 3. Add partner_type to Locations
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='locations' AND column_name='partner_type') THEN
        ALTER TABLE public.locations ADD COLUMN partner_type TEXT DEFAULT 'Internal';
    END IF;
END $$;

-- 4. Enable RLS for Branches
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policy for Branches
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'branches' AND policyname = 'Allow public read access') THEN
        CREATE POLICY "Allow public read access" ON public.branches FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'branches' AND policyname = 'Allow admin insert') THEN
        CREATE POLICY "Allow admin insert" ON public.branches FOR INSERT WITH CHECK (true);
    END IF;
END $$;

-- 6. Create THAAN Slips Table
CREATE TABLE IF NOT EXISTS public.thaan_slips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id TEXT REFERENCES public.batches(id),
    doc_url TEXT NOT NULL,
    is_signed BOOLEAN DEFAULT FALSE,
    signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Accrual Engine RPC
DROP FUNCTION IF EXISTS calculate_batch_accrual(TEXT) CASCADE;
CREATE OR REPLACE FUNCTION calculate_batch_accrual(batch_id_input TEXT)
RETURNS NUMERIC AS $$
DECLARE
    v_batch_qty INT;
    v_asset_id TEXT;
    v_created_at TIMESTAMP;
    v_daily_rate NUMERIC;
    v_days INT;
BEGIN
    -- Get batch details
    SELECT quantity, asset_id, created_at 
    INTO v_batch_qty, v_asset_id, v_created_at
    FROM batches WHERE id = batch_id_input;

    -- Get current daily rental rate
    SELECT amount_zar INTO v_daily_rate
    FROM fee_schedule 
    WHERE asset_id = v_asset_id 
    AND fee_type = 'Daily Rental (Supermarket)'
    AND effective_to IS NULL
    LIMIT 1;

    -- Calculate days (minimum 1)
    v_days := GREATEST(1, EXTRACT(DAY FROM (NOW() - v_created_at))::INT);

    RETURN COALESCE(v_batch_qty * v_daily_rate * v_days, 0);
END;
$$ LANGUAGE plpgsql;

-- 8. Create Asset Losses Table
CREATE TABLE IF NOT EXISTS public.asset_losses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id TEXT REFERENCES public.batches(id),
    loss_type TEXT NOT NULL,
    lost_quantity INT NOT NULL,
    last_known_location_id TEXT REFERENCES public.locations(id),
    reported_by TEXT,
    notes TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    supplier_notified BOOLEAN DEFAULT FALSE,
    is_rechargeable BOOLEAN DEFAULT FALSE
);

-- 9. Create Batch Verifications Table
CREATE TABLE IF NOT EXISTS public.batch_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id TEXT REFERENCES public.batches(id),
    verified_by TEXT,
    received_quantity INT NOT NULL,
    expected_quantity INT NOT NULL,
    variance INT NOT NULL,
    notes TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Verification Trigger Function
DROP FUNCTION IF EXISTS fn_on_verification_variance();
CREATE OR REPLACE FUNCTION fn_on_verification_variance() 
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.variance < 0 THEN
        INSERT INTO public.asset_losses (batch_id, loss_type, lost_quantity, timestamp, reported_by) 
        VALUES (NEW.batch_id, 'Missing/Lost', ABS(NEW.variance), NOW(), NEW.verified_by);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Verification Trigger
DROP TRIGGER IF EXISTS tr_on_verification_variance ON public.batch_verifications;
CREATE TRIGGER tr_on_verification_variance
AFTER INSERT ON public.batch_verifications
FOR EACH ROW
EXECUTE FUNCTION fn_on_verification_variance();

-- 12. Create Business Parties Table
CREATE TABLE IF NOT EXISTS public.business_parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    party_type TEXT NOT NULL, -- Customer, Supplier
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. Create Storage Bucket for THAAN Slips
-- Note: This must be run in the SQL Editor. 
-- It ensures the 'thaan-slips' bucket exists and is public.
INSERT INTO storage.buckets (id, name, public)
VALUES ('thaan-slips', 'thaan-slips', true)
ON CONFLICT (id) DO NOTHING;

-- 13. Storage Policies
-- Allow public read access to thaan-slips
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public Read Access') THEN
        CREATE POLICY "Public Read Access" ON storage.objects FOR SELECT USING (bucket_id = 'thaan-slips');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Authenticated Upload Access') THEN
        CREATE POLICY "Authenticated Upload Access" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'thaan-slips');
    END IF;
END $$;

-- 14. Create Tasks Table
-- Drop old constraint if it exists from previous schema version
ALTER TABLE IF EXISTS public.tasks DROP CONSTRAINT IF EXISTS tasks_assigned_to_fkey;

CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'Pending',
    priority TEXT DEFAULT 'Medium',
    due_date TIMESTAMPTZ,
    assigned_to TEXT,
    branch_id TEXT REFERENCES public.branches(id),
    location_id TEXT REFERENCES public.locations(id),
    created_by UUID REFERENCES public.users(id) DEFAULT auth.uid(),
    task_type TEXT DEFAULT 'General',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure existing table is updated if it already exists
ALTER TABLE IF EXISTS public.tasks 
    ALTER COLUMN due_date TYPE TIMESTAMPTZ,
    ALTER COLUMN assigned_to TYPE TEXT;

-- 14. Enable RLS for Tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 15. Create RLS Policy for Tasks
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'Allow public read access') THEN
        CREATE POLICY "Allow public read access" ON public.tasks FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'Allow all access') THEN
        CREATE POLICY "Allow all access" ON public.tasks FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 17. All Sources View (Unifies Locations and Business Parties)
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

-- 17b. All Origins View
DROP VIEW IF EXISTS public.vw_all_origins CASCADE;
CREATE OR REPLACE VIEW public.vw_all_origins AS
SELECT * FROM public.vw_all_sources
ORDER BY sort_group, name;

-- 17c. Movement Destinations View
DROP VIEW IF EXISTS public.vw_movement_destinations CASCADE;
CREATE OR REPLACE VIEW public.vw_movement_destinations AS
SELECT * FROM public.vw_all_sources
ORDER BY sort_group, name;

-- 18. Global Inventory Tracker View
DROP VIEW IF EXISTS public.vw_global_inventory_tracker;
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

-- 19. Batch Accruals View
DROP VIEW IF EXISTS public.vw_batch_accruals;
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

-- 20. Personnel View
DROP VIEW IF EXISTS public.vw_assignable_personnel;
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

-- 17. Update Personnel Tables (Run if tables already exist)
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS branch_id TEXT REFERENCES public.branches(id);
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE IF EXISTS public.drivers ADD COLUMN IF NOT EXISTS contact_number TEXT;
ALTER TABLE IF EXISTS public.drivers ADD COLUMN IF NOT EXISTS license_number TEXT;
ALTER TABLE IF EXISTS public.drivers ADD COLUMN IF NOT EXISTS branch_id TEXT REFERENCES public.branches(id);
ALTER TABLE IF EXISTS public.drivers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 18. Trip Audit Trail View & Sample Data
-- Run this to fix empty Audit Trail
-- First, ensure all tables have the required columns
ALTER TABLE public.batch_movements ADD COLUMN IF NOT EXISTS route_instructions TEXT;
ALTER TABLE public.batch_movements ADD COLUMN IF NOT EXISTS transaction_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.batch_movements ADD COLUMN IF NOT EXISTS quantity INTEGER;

ALTER TABLE public.driver_shifts ADD COLUMN IF NOT EXISTS manual_end_time TIMESTAMPTZ;
ALTER TABLE public.driver_shifts ADD COLUMN IF NOT EXISTS notes TEXT;

-- Relax foreign key constraints to allow both locations and business parties
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    -- Drop all foreign key constraints on batches(current_location_id)
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.key_column_usage 
        WHERE table_name = 'batches' AND column_name = 'current_location_id'
    ) LOOP
        EXECUTE 'ALTER TABLE public.batches DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ' CASCADE';
    END LOOP;

    -- Drop all foreign key constraints on batch_movements(from_location_id)
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.key_column_usage 
        WHERE table_name = 'batch_movements' AND column_name = 'from_location_id'
    ) LOOP
        EXECUTE 'ALTER TABLE public.batch_movements DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ' CASCADE';
    END LOOP;

    -- Drop all foreign key constraints on batch_movements(to_location_id)
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.key_column_usage 
        WHERE table_name = 'batch_movements' AND column_name = 'to_location_id'
    ) LOOP
        EXECUTE 'ALTER TABLE public.batch_movements DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ' CASCADE';
    END LOOP;
END $$;

-- Create/Update the split_batch RPC
DROP FUNCTION IF EXISTS public.split_batch(TEXT, INTEGER, TEXT, DATE);
CREATE OR REPLACE FUNCTION public.split_batch(original_batch_id TEXT, move_qty INTEGER, new_location_id TEXT, move_date DATE)
RETURNS TEXT AS $$
DECLARE
    v_new_batch_id TEXT;
    v_asset_id TEXT;
    v_status TEXT;
    v_orig_qty INTEGER;
BEGIN
    SELECT asset_id, status, quantity INTO v_asset_id, v_status, v_orig_qty FROM public.batches WHERE id = original_batch_id;
    IF v_orig_qty < move_qty THEN RAISE EXCEPTION 'Insufficient quantity in original batch'; END IF;
    
    LOOP
        v_new_batch_id := original_batch_id || '-S' || floor(random() * 1000000)::text;
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.batches WHERE id = v_new_batch_id);
    END LOOP;

    UPDATE public.batches SET quantity = quantity - move_qty WHERE id = original_batch_id;
    INSERT INTO public.batches (id, asset_id, quantity, current_location_id, status, transaction_date)
    VALUES (v_new_batch_id, v_asset_id, move_qty, new_location_id, v_status, move_date);

    -- Inherit Forensic History: Copy movements from parent to child, but with the split quantity
    INSERT INTO public.batch_movements (batch_id, from_location_id, to_location_id, truck_id, driver_id, condition, origin_user_id, quantity, transaction_date, timestamp)
    SELECT v_new_batch_id, from_location_id, to_location_id, truck_id, driver_id, condition, origin_user_id, move_qty, transaction_date, timestamp
    FROM public.batch_movements
    WHERE batch_id = original_batch_id;

    RETURN v_new_batch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
) ds ON TRUE;

-- Add missing columns to batches table
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS transfer_confirmed_by_customer BOOLEAN DEFAULT FALSE;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS confirmation_date TIMESTAMPTZ;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS is_settled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

-- Create/Update the Dashboard Stats View
DROP VIEW IF EXISTS public.vw_dashboard_stats;
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
GROUP BY br.name;

-- Create/Update the Batch Forensics View
DROP VIEW IF EXISTS public.vw_batch_forensics;
CREATE OR REPLACE VIEW public.vw_batch_forensics AS
SELECT 
    bm.transaction_date as date,
    COALESCE(bm.condition, 'unknown') as type,
    bm.batch_id,
    COALESCE(s_from.name, bm.from_location_id, 'N/A') as from_location,
    COALESCE(s_to.name, bm.to_location_id, 'N/A') as to_location,
    d.full_name as driver_name,
    bm.quantity,
    COALESCE(br.name, 'N/A') as branch_name,
    bm.timestamp
FROM public.batch_movements bm
LEFT JOIN public.vw_all_sources s_from ON bm.from_location_id = s_from.id
LEFT JOIN public.vw_all_sources s_to ON bm.to_location_id = s_to.id
LEFT JOIN public.drivers d ON bm.driver_id = d.id
LEFT JOIN public.branches br ON s_to.branch_id = br.id
ORDER BY bm.timestamp DESC;

-- Sample Data for Audit Trail
INSERT INTO public.branches (id, name) VALUES ('BR-001', 'Johannesburg Central') ON CONFLICT DO NOTHING;
INSERT INTO public.locations (id, name, type, category, branch_id) VALUES ('LOC-WH-01', 'Main Warehouse', 'Warehouse', 'Home', 'BR-001') ON CONFLICT DO NOTHING;
INSERT INTO public.locations (id, name, type, category, branch_id) VALUES ('LOC-ST-01', 'Retail Store A', 'Store', 'External', 'BR-001') ON CONFLICT DO NOTHING;
INSERT INTO public.locations (id, name, type, category, branch_id) VALUES ('LOC-TRANS-01', 'Truck GP 22 SH (Lupo)', 'In Transit', 'External', 'BR-001') ON CONFLICT DO NOTHING;
INSERT INTO public.locations (id, name, type, category, branch_id) VALUES ('LOC-TRANS-02', 'Truck CA 99 LU (Lupo)', 'In Transit', 'External', 'BR-001') ON CONFLICT DO NOTHING;
INSERT INTO public.asset_master (id, name, type) VALUES ('SH-P01', 'Standard Pallet', 'Pallet') ON CONFLICT DO NOTHING;
INSERT INTO public.trucks (id, plate_number, branch_id) VALUES ('TRK-001', 'GP 123 SH', 'BR-001') ON CONFLICT DO NOTHING;
INSERT INTO public.drivers (id, full_name, branch_id) VALUES ('DRV-001', 'John Doe', 'BR-001') ON CONFLICT DO NOTHING;
INSERT INTO public.batches (id, asset_id, quantity, current_location_id) VALUES ('B-TEST-001', 'SH-P01', 50, 'LOC-WH-01') ON CONFLICT DO NOTHING;

INSERT INTO public.batch_movements (batch_id, from_location_id, to_location_id, truck_id, driver_id, quantity, route_instructions, transaction_date)
VALUES ('B-TEST-001', 'LOC-WH-01', 'LOC-ST-01', 'TRK-001', 'DRV-001', 50, 'Deliver to back entrance. Contact manager on arrival.', CURRENT_DATE)
ON CONFLICT DO NOTHING;

-- Test Data: Create a Shift that definitely overlaps the Trip
INSERT INTO public.driver_shifts (driver_id, truck_id, start_time, notes, branch_id)
VALUES (
  'DRV-001', 
  'TRK-001', 
  '2026-01-01 00:00:00+00', 
  'Master Shift Assignment - Audit Verified.', 
  'BR-001'
) ON CONFLICT DO NOTHING;
`}
            </pre>
            <div className="p-4 bg-amber-900/20 border border-amber-900/50 rounded-xl flex gap-4">
              <AlertTriangle className="text-amber-500 shrink-0" size={24} />
              <p className="text-xs text-amber-200 font-medium leading-relaxed">
                <strong>Deployment Note:</strong> Copy and paste the SQL above into your Supabase SQL Editor to fix the "table not found" and "column not found" errors. After running, refresh your browser.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeView === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-sm space-y-8">
            <h3 className="font-black text-slate-800 text-xs uppercase tracking-[0.2em] flex items-center gap-3">
              <ShieldCheck className="text-emerald-500" size={20} />
              Liability Engine Simulator
            </h3>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Supplier (Business Party)</label>
                  <select 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    value={simSupplier}
                    onChange={(e) => setSimSupplier(e.target.value as any)}
                  >
                    <option value="Lupo JHB">Lupo JHB (R 5.50/day)</option>
                    <option value="Durban Crates">Durban Crates (R 6.25/day)</option>
                    <option value="Cape Logistics">Cape Logistics (R 4.80/day)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Category</label>
                  <select 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    value={simAssetType}
                    onChange={(e) => setSimAssetType(e.target.value as any)}
                  >
                    <option value="Supermarket">Supermarket (Rental)</option>
                    <option value="QSR">QSR (Issue Fee)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Days Elapsed</label>
                  <input 
                    type="range" min="1" max="90" 
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    value={simDays}
                    onChange={(e) => setSimDays(parseInt(e.target.value))}
                  />
                  <div className="text-[10px] font-bold text-slate-500 text-right">{simDays} Days</div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Settlement Status</label>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button 
                      onClick={() => setSimIsSettled(false)}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${!simIsSettled ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                    >
                      Accruing
                    </button>
                    <button 
                      onClick={() => setSimIsSettled(true)}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${simIsSettled ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                    >
                      Settled
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Negotiated Discount (from Settlements)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">R</span>
                  <input 
                    type="number" 
                    className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    value={simDiscount}
                    onChange={(e) => setSimDiscount(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Liability</p>
                    <div className="text-5xl font-black text-slate-900 tracking-tighter">R {calculateSimLiability().toLocaleString()}</div>
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-600">
                    <TrendingUp size={32} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 p-10 rounded-3xl border border-slate-800 space-y-6 text-white">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Zap size={16} className="text-amber-400" />
              Simulator Logic Notes
            </h4>
            <div className="space-y-4">
              <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2">Business Party Integration</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Unlike the previous hard-coded model, the simulator now mimics a join between <code>batches</code> and <code>business_parties</code>. Each supplier has a unique rate stored in the <code>fee_schedule</code>.
                </p>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">Settlement Close-out</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  When a batch is marked <code>is_settled = TRUE</code> via the <code>settlements</code> table, the accrual engine stops the clock. The simulator reflects this by zeroing out liability when 'Settled' is selected.
                </p>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2">Discount Application</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  The final Net Liability is calculated as: <code>(Accrued Rental + Replacement Fees) - (Credits + Settlement Discounts)</code>.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface ScenarioStepProps {
  num: string; title: string; desc: string; icon: React.ReactNode; sql: string; verify: string;
}

const ScenarioStep: React.FC<ScenarioStepProps> = ({ num, title, desc, icon, sql, verify }) => (
  <div className="flex gap-6 group">
    <div className="flex flex-col items-center">
       <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-400 border border-slate-200 group-hover:bg-slate-900 group-hover:text-white transition-all shadow-sm">{num}</div>
       <div className="flex-1 w-px bg-slate-100" />
    </div>
    <div className="flex-1 pb-10 space-y-4">
       <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-slate-50 rounded-lg group-hover:scale-110 transition-transform">{icon}</div>
             <h4 className="font-bold text-slate-800 text-sm">{title}</h4>
          </div>
       </div>
       <p className="text-xs text-slate-500 font-medium italic leading-relaxed">{desc}</p>
       <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 font-mono text-[10px] text-slate-600 leading-relaxed shadow-inner whitespace-pre-wrap">{sql}</div>
       <div className="p-3 bg-blue-50 text-blue-800 rounded-lg text-[10px] font-bold border border-blue-100 flex items-center gap-2">
          <Info size={14} className="shrink-0 text-blue-400" />
          <span className="uppercase tracking-tighter">Forensic Verification:</span> {verify}
       </div>
    </div>
  </div>
);

const TabButton: React.FC<{ active: boolean, onClick: () => void, label: string }> = ({ active, onClick, label }) => (
  <button onClick={onClick} className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${active ? 'bg-white shadow-lg text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>{label}</button>
);

export default SchemaView;
