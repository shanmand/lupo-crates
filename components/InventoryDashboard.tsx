
import React, { useState, useEffect, useMemo } from 'react';
import { MOCK_LOCATIONS, MOCK_BATCHES, MOCK_ASSETS, MOCK_FEES } from '../constants';
import { MapPin, ThermometerSnowflake, Truck, ShoppingCart, Home, Building2, TrendingUp, Info, Loader2, Filter, Search, Calendar } from 'lucide-react';
import { LocationType, LocationCategory, Location, Batch, AssetMaster, FeeSchedule, Branch, ThaanSlip } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';

interface InventoryDashboardProps {
  branchContext?: string;
}

const InventoryDashboard: React.FC<InventoryDashboardProps> = ({ branchContext = 'Consolidated' }) => {
  console.log('InventoryDashboard Rendering...', { branchContext });
  const [locations, setLocations] = useState<Location[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [assets, setAssets] = useState<AssetMaster[]>([]);
  const [fees, setFees] = useState<FeeSchedule[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [thaanSlips, setThaanSlips] = useState<ThaanSlip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedBranch, setSelectedBranch] = useState<string>('all');

  useEffect(() => {
    if (branches.length > 0 && branchContext !== 'Consolidated') {
      const branch = branches.find(b => b.name === branchContext);
      if (branch) setSelectedBranch(branch.id);
    } else if (branchContext === 'Consolidated') {
      setSelectedBranch('all');
    }
  }, [branchContext, branches]);

  const [selectedAsset, setSelectedAsset] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      console.log('InventoryDashboard: Fetching data... Configured:', isSupabaseConfigured);
      if (!isSupabaseConfigured) {
        setLocations([]);
        setBatches([]);
        setAssets([]);
        setFees([]);
        setBranches([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // Use the view for accurate liability calculation and to include all sources (locations + business parties)
        const [locsRes, batchesRes, assetsRes, feesRes, branchesRes, thaansRes] = await Promise.all([
          supabase.from('vw_all_sources').select('*'),
          supabase.from('vw_batch_accruals').select('*'),
          supabase.from('asset_master').select('*'),
          supabase.from('fee_schedule').select('*'),
          supabase.from('branches').select('*'),
          supabase.from('thaan_slips').select('*')
        ]);

        console.log('InventoryDashboard Data Received:', {
          locations: locsRes.data?.length,
          batches: batchesRes.data?.length,
          assets: assetsRes.data?.length,
          branches: branchesRes.data?.length
        });

        if (locsRes.data) {
          // De-duplicate locations by ID to prevent React key errors
          const uniqueLocs = Array.from(new Map(locsRes.data.map(item => [item.id, item])).values());
          setLocations(uniqueLocs);
        }
        if (batchesRes.data) {
          // Map view data back to Batch type or handle it specifically
          const mapped = batchesRes.data.map((b: any) => ({
            ...b,
            id: b.batch_id,
            // Ensure we have the accrued_amount available
            accrued_amount: b.accrued_amount
          }));
          // De-duplicate batches
          const uniqueBatches = Array.from(new Map(mapped.map((b: any) => [b.id, b])).values());
          setBatches(uniqueBatches);
        }
        if (assetsRes.data) setAssets(assetsRes.data);
        if (feesRes.data) setFees(feesRes.data);
        if (branchesRes.data) setBranches(branchesRes.data);
        if (thaansRes.data) setThaanSlips(thaansRes.data);
      } catch (err) {
        console.error("Inventory Fetch Error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredLocations = useMemo(() => {
    return locations.filter(loc => {
      const matchesBranch = selectedBranch === 'all' || loc.branch_id === selectedBranch;
      const matchesSearch = loc.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      const inventory = batches.filter(b => b.current_location_id === loc.id);
      const matchesAsset = selectedAsset === 'all' || inventory.some(b => b.asset_id === selectedAsset);
      
      const matchesDate = inventory.some(b => {
        const created = new Date(b.transaction_date || b.created_at);
        return (!startDate || created >= new Date(startDate)) &&
               (!endDate || created <= new Date(endDate));
      }) || (inventory.length === 0 && !startDate && !endDate);

      return matchesBranch && matchesSearch && matchesAsset && matchesDate;
    });
  }, [locations, batches, selectedBranch, selectedAsset, searchQuery, startDate, endDate]);

  // Logic: Use the pre-calculated accrued amount from the view
  const calculateAccruedCost = (batchId: string) => {
    const batch = batches.find(b => b.id === batchId);
    return (batch as any)?.accrued_amount || 0;
  };

  const getInventoryAtLocation = (locationId: string) => {
    return batches.filter(b => b.current_location_id === locationId);
  };

  const getLocationIcon = (type: LocationType) => {
    switch (type) {
      case LocationType.COLD_STORAGE: return <ThermometerSnowflake className="text-blue-500" />;
      case LocationType.IN_TRANSIT: return <Truck className="text-amber-500" />;
      case LocationType.AT_CUSTOMER: return <ShoppingCart className="text-rose-500" />;
      case LocationType.CRATES_DEPT: return <Home className="text-emerald-500" />;
      default: return <Building2 className="text-slate-400" />;
    }
  };

  const formatCurrency = (val: number) => val.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const totalGlobalLiability = batches.reduce((acc, b) => acc + calculateAccruedCost(b.id), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl shadow-slate-200">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Global Possessive Liability</p>
          <p className="text-3xl font-bold">R {formatCurrency(totalGlobalLiability)}</p>
          <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold mt-2 uppercase">
            <TrendingUp size={12} /> Accruing in real-time
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Home Locations</p>
            <p className="text-2xl font-bold text-slate-800">
              {locations.filter(l => l.category === LocationCategory.HOME).length} Sites
            </p>
          </div>
          <Home className="text-emerald-500 opacity-20" size={40} />
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">External Storage</p>
            <p className="text-2xl font-bold text-slate-800">
              {locations.filter(l => l.type === LocationType.COLD_STORAGE).length} Sites
            </p>
          </div>
          <ThermometerSnowflake className="text-blue-500 opacity-20" size={40} />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search locations..." 
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-slate-900 transition-all"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <select 
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
            >
              <option value="all">All Branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select 
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
              value={selectedAsset}
              onChange={e => setSelectedAsset(e.target.value)}
            >
              <option value="all">All Assets</option>
              {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <Calendar size={16} className="text-slate-400" />
              <input 
                type="date" 
                className="bg-transparent text-xs font-bold outline-none"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
              <span className="text-slate-300">-</span>
              <input 
                type="date" 
                className="bg-transparent text-xs font-bold outline-none"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Location Map View */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
           <h3 className="font-bold text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2">
             <MapPin size={16} className="text-rose-500" /> Multi-Site Live Map Summary
           </h3>
           <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Home</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /> Cold Storage</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500" /> In Transit</span>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 divide-x divide-y divide-slate-100">
          {filteredLocations.map(loc => {
            const inventory = getInventoryAtLocation(loc.id);
            const locationCost = inventory.reduce((acc, b) => acc + calculateAccruedCost(b.id), 0);
            const totalUnits = inventory.reduce((acc, b) => acc + b.quantity, 0);

            return (
              <div key={loc.id} className="p-6 hover:bg-slate-50/50 transition-colors space-y-4">
                <div className="flex items-start justify-between">
                   <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-white border border-slate-100 shadow-sm`}>
                        {getLocationIcon(loc.type)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 leading-tight">{loc.name}</p>
                        <p className={`text-[10px] font-bold uppercase ${loc.category === LocationCategory.HOME ? 'text-emerald-500' : 'text-slate-400'}`}>
                          {loc.category} • {loc.type}
                        </p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-lg font-bold text-slate-800">{totalUnits}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Total Units</p>
                   </div>
                </div>

                <div className="space-y-2">
                   {inventory.length > 0 ? inventory.map(batch => (
                     <div key={batch.id} className="flex justify-between items-center bg-white p-2 rounded border border-slate-100 text-[11px]">
                        <span className="font-bold text-slate-600">Batch #{batch.id}</span>
                        <span className="text-slate-400">{assets.find(a => a.id === batch.asset_id)?.name}</span>
                        <span className="font-bold text-slate-800">{batch.quantity}</span>
                     </div>
                   )) : (
                     <div className="text-center py-2 text-[10px] text-slate-300 italic">No Active Load</div>
                   )}
                </div>

                <div className="pt-4 border-t border-slate-50 flex justify-between items-end">
                   <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Accrued Cost</p>
                      <p className={`font-bold ${locationCost > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        R {formatCurrency(locationCost)}
                      </p>
                   </div>
                   <button className="text-[10px] font-bold text-blue-600 hover:underline">Audits (v2.1)</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Possession Logic Notice */}
      <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl flex gap-4">
         <Info className="text-blue-500 shrink-0" size={24} />
         <div>
            <h4 className="font-bold text-blue-900 text-sm">Cold Storage Possession Policy</h4>
            <p className="text-xs text-blue-800 mt-1 leading-relaxed">
              Assets located at <strong>External Cold Storage</strong> sites are considered 'In Possession'. 
              Daily rental fees continue to accrue as these locations are managed as high-possession vaults. 
              Only successful transfers to <strong>'At Customer'</strong> or <strong>'Returning to Supplier'</strong> locations (with signed THAAN slips) pause the possession timer.
            </p>
         </div>
      </div>
    </div>
  );
};

export default InventoryDashboard;
