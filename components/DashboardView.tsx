
import React, { useMemo, useState, useEffect } from 'react';
import { Truck, Package, AlertTriangle, TrendingUp, ArrowUpRight, ArrowDownRight, Clock, ShieldAlert, Calendar, User as UserIcon, History as HistoryIcon, UserCheck, Skull, MapPin, Loader2, Info, Zap } from 'lucide-react';
import { MOCK_BATCHES, MOCK_CLAIMS, MOCK_LOCATIONS, MOCK_MOVEMENTS, MOCK_ASSETS, MOCK_LOSSES, MOCK_USERS } from '../constants';
import { LocationType, UserRole, User as UserType, Batch, AssetLoss, Location, User as DBUser, AssetMaster, Claim } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';

interface DashboardViewProps {
  currentUser: UserType;
  branchContext?: 'Kya Sands' | 'Durban' | 'Consolidated';
  onDrillDown?: () => void;
  onSchemaFix?: () => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({ currentUser, branchContext = 'Consolidated', onDrillDown, onSchemaFix }) => {
  console.log('DashboardView Rendering...', { branchContext, currentUser: currentUser?.id });
  const [dbBatches, setDbBatches] = useState<Batch[]>([]);
  const [dbLosses, setDbLosses] = useState<AssetLoss[]>([]);
  const [dbLocations, setDbLocations] = useState<Location[]>([]);
  const [dbUsers, setDbUsers] = useState<DBUser[]>([]);
  const [dbAssets, setDbAssets] = useState<AssetMaster[]>([]);
  const [dbClaims, setDbClaims] = useState<Claim[]>([]);
  const [dbBranches, setDbBranches] = useState<{id: string, name: string}[]>([]);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Supabase Real-time Dashboard Fetch
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!isSupabaseConfigured) {
        setDbBatches(MOCK_BATCHES);
        setDbLosses(MOCK_LOSSES);
        setDbLocations(MOCK_LOCATIONS);
        setDbUsers(MOCK_USERS);
        setDbAssets(MOCK_ASSETS);
        setDbClaims(MOCK_CLAIMS);
        setDbBranches([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        console.log('Fetching Dashboard Data...');
        const [inventoryRes, lossesRes, locsRes, usersRes, assetsRes, claimsRes, branchesRes] = await Promise.all([
          supabase.from('batches').select('*'),
          supabase.from('asset_losses').select('*'),
          supabase.from('vw_all_sources').select('*'),
          supabase.from('users').select('*'),
          supabase.from('asset_master').select('*'),
          supabase.from('claims').select('*'),
          supabase.from('branches').select('*')
        ]);

        console.log('Dashboard Data Received:', {
          inventory: inventoryRes.data?.length,
          losses: lossesRes.data?.length,
          locations: locsRes.data?.length,
          branches: branchesRes.data?.length
        });

        if (inventoryRes.data) {
          const mappedBatches = inventoryRes.data.map((item: any) => {
            const asset = assetsRes.data?.find(a => a.id === item.asset_id);
            const location = locsRes.data?.find(l => l.id === item.current_location_id);
            
            const txDate = new Date(item.transaction_date || item.created_at);
            const now = new Date();
            const diffTime = Math.abs(now.getTime() - txDate.getTime());
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            return {
              ...item,
              asset_name: asset?.name || 'Unknown Asset',
              current_location: location?.name || 'Unknown Location',
              days_in_circulation: diffDays,
              daily_accrued_liability: 0,
              branch_id: location?.branch_id
            };
          });
          // De-duplicate batches
          const uniqueBatches = Array.from(new Map(mappedBatches.map((item: any) => [item.id, item])).values());
          setDbBatches(uniqueBatches as any);
        }
        if (lossesRes.data) setDbLosses(lossesRes.data);
        if (locsRes.data) {
          // De-duplicate locations
          const uniqueLocs = Array.from(new Map(locsRes.data.map((item: any) => [item.id, item])).values());
          setDbLocations(uniqueLocs);
        }
        if (usersRes.data) setDbUsers(usersRes.data);
        if (assetsRes.data) setDbAssets(assetsRes.data);
        if (claimsRes.data) setDbClaims(claimsRes.data);
        
        // Handle branches with fallback
        if (branchesRes.error) {
          setSchemaError("Missing 'branches' table or 'branch_id' column. Please run SQL migrations.");
          setDbBranches([]);
        } else if (branchesRes.data) {
          setDbBranches(branchesRes.data);
        }

      } catch (err) {
        console.error("Dashboard Sync Error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const displayBatches = dbBatches;
  const displayLosses = dbLosses;
  const displayLocations = dbLocations;
  const displayUsers = dbUsers;
  const displayAssets = dbAssets;
  const displayClaims = dbClaims;

  const currentBranchId = useMemo(() => {
    if (branchContext === 'Consolidated') return null;
    return dbBranches.find(b => b?.name?.includes(branchContext))?.id;
  }, [branchContext, dbBranches]);

  const filteredBatches = useMemo(() => {
    let base = displayBatches;
    
    // Apply Branch Filter
    if (currentBranchId) {
      base = base.filter(b => (b as any).branch_id === currentBranchId);
    }

    return base;
  }, [currentBranchId, displayBatches]);

  const filteredLosses = useMemo(() => {
    let base = displayLosses;
    if (currentBranchId) {
      base = base.filter(l => {
        const loc = displayLocations.find(loc => loc?.id === l?.last_known_location_id);
        return loc?.branch_id === currentBranchId;
      });
    }
    return base;
  }, [currentBranchId, displayLosses, displayLocations]);

  const avgTurnaround = useMemo(() => {
    if (filteredBatches.length === 0) return 0;
    const totalDays = filteredBatches.reduce((acc, b: any) => acc + (b?.days_in_circulation || 0), 0);
    return totalDays / filteredBatches.length;
  }, [filteredBatches]);

  const totalPallets = filteredBatches.reduce((acc, b) => {
    const asset = displayAssets.find(a => a?.id === b?.asset_id);
    return asset?.type === 'Pallet' ? acc + (b?.quantity || 0) : acc;
  }, 0);

  const estimatedUnbilledRental = useMemo(() => {
    // Use the daily_accrued_liability from the view
    return filteredBatches.reduce((acc, b: any) => acc + (b?.daily_accrued_liability || 0), 0);
  }, [filteredBatches]);

  const pendingClaimsValue = displayClaims.filter(c => c?.status === 'Lodged').reduce((acc, c) => acc + (c?.amount_claimed_zar || 0), 0);

  const formatCurrency = (val: number) => val.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-amber-500" size={32} />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Polling Supabase Clusters...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {schemaError && (
        <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-3xl flex items-center justify-between gap-6 shadow-xl shadow-amber-100/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Database Schema Out of Sync</h4>
              <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mt-1">{schemaError}</p>
            </div>
          </div>
          <button 
            onClick={onSchemaFix}
            className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
          >
            Go to SQL Migrations
          </button>
        </div>
      )}

      {/* Manager Oversight - Accountability for Losses */}
      {(currentUser.role === UserRole.MANAGER || currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.EXECUTIVE) && (
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200 border border-slate-200 overflow-hidden ring-4 ring-slate-50 transition-all">
          <div className="px-8 py-5 bg-slate-900 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-500 rounded-lg shadow-inner"><Skull size={18} className="text-white" /></div>
              <div>
                <h3 className="font-black text-xs uppercase tracking-[0.2em] text-white">Loss Accountability Matrix</h3>
                <p className="text-[10px] font-bold text-slate-400">Context: {branchContext} Branch Filter (Synced)</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-800 rounded-full border border-slate-700">
               <UserCheck size={14} className="text-emerald-400" />
               <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Supabase Live Query</span>
            </div>
          </div>
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredLosses.slice(0, 3).map(loss => {
                const batch = displayBatches.find(b => b?.id === loss?.batch_id);
                const riskLevel = (loss?.lost_quantity || 0) > 20 ? 'CRITICAL' : 'MODERATE';
                const location = displayLocations.find(l => l?.id === loss?.last_known_location_id);
                
                return (
                  <div key={`loss-${loss?.id}`} className={`p-6 rounded-2xl border-2 transition-all group relative overflow-hidden hover:shadow-lg ${riskLevel === 'CRITICAL' ? 'border-rose-100 bg-rose-50/30' : 'border-slate-100 bg-slate-50'}`}>
                    <div className="relative z-10">
                       <div className="flex justify-between items-start mb-4">
                         <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${riskLevel === 'CRITICAL' ? 'bg-rose-600 text-white shadow-sm' : 'bg-amber-500 text-white shadow-sm'}`}>
                            {riskLevel} RISK
                         </span>
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">REF: {loss?.id}</span>
                       </div>
                       
                       <p className="text-sm font-black text-slate-800 leading-tight mb-1">{loss?.lost_quantity}x {displayAssets.find(a => a.id === batch?.asset_id)?.name}</p>
                       <p className="text-[10px] text-slate-400 font-bold mb-4 flex items-center gap-1"><MapPin size={10} /> {location?.name}</p>
                       <p className="text-xs text-slate-500 line-clamp-2 italic mb-6">"{loss?.notes}"</p>

                       <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center border-4 border-white shadow-lg group-hover:scale-110 transition-transform">
                                <span className="text-xs font-black text-white">{(loss?.reported_by || 'U').charAt(0).toUpperCase()}</span>
                             </div>
                             <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Reporter</p>
                                <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{loss?.reported_by || 'System'}</p>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Reported</p>
                             <p className="text-[10px] font-bold text-slate-700">{loss?.timestamp ? new Date(loss.timestamp).toLocaleDateString() : 'N/A'}</p>
                          </div>
                       </div>
                    </div>
                  </div>
                );
              })}
              {filteredLosses.length === 0 && (
                <div className="col-span-3 py-12 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                  <p className="text-sm text-slate-400 italic">No reported losses found in this context.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Active Batches" 
          value={filteredBatches.length.toString()} 
          trend="0%" 
          trendUp={true} 
          icon={<Package className="text-blue-500" />} 
        />
        <StatCard 
          label="In Transit" 
          value={filteredBatches.filter(b => b.status === 'In-Transit' || displayLocations.find(l => l.id === b.current_location_id)?.type === LocationType.IN_TRANSIT).length.toString()} 
          trend="0%" 
          trendUp={false} 
          icon={<Truck className="text-amber-500" />} 
        />
        <StatCard 
          label="Pending Claims" 
          value={displayClaims.filter(c => c.status === 'Lodged').length.toString()} 
          trend="0" 
          trendUp={true} 
          icon={<AlertTriangle className="text-rose-500" />} 
        />
        <StatCard 
          label="Avg Turnaround" 
          value={`${avgTurnaround.toFixed(1)} Days`} 
          trend="0%" 
          trendUp={true} 
          icon={<TrendingUp className="text-emerald-500" />} 
        />
      </div>

      {/* Source Data Explanation */}
      <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl flex gap-4">
        <Info className="text-blue-500 shrink-0" size={20} />
        <div>
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Claims Source Data</h4>
          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
            Claims are automatically generated when a <strong>Quantity Variance</strong> is reported during the <strong>Inventory Intake</strong> process. 
            They can also be manually triggered from the <strong>Logistics Intelligence</strong> module when reconciling signed THAAN slips against dispatched quantities.
            Each claim tracks the liability of the transporter (Truck/Driver) for damaged or missing assets.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:border-emerald-200 transition-colors group">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center group-hover:bg-emerald-50 transition-colors">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-emerald-600" />
              <h3 className="font-bold text-slate-800">Branch Accrual Matrix</h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Real-time ZAR</span>
          </div>
          <div className="p-6 space-y-6 flex-1 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex justify-between items-end border-b border-slate-50 pb-4">
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-tighter">Pallets (Active)</p>
                  <p className="text-2xl font-bold text-slate-800">{totalPallets}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-tighter">Crates</p>
                  <p className="text-xl font-bold text-slate-800">{filteredBatches.length - totalPallets}</p>
                </div>
              </div>
              
              <div className="flex justify-between items-end border-b border-slate-50 pb-4">
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-tighter">Accrued Rental Liability</p>
                  <p className="text-2xl font-bold text-emerald-600">R {formatCurrency(estimatedUnbilledRental)}</p>
                </div>
                <div className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[9px] font-black rounded uppercase tracking-widest animate-pulse">Running</div>
              </div>

              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-tighter">Pending Claim Value</p>
                <p className="text-2xl font-bold text-rose-500">R {formatCurrency(pendingClaimsValue)}</p>
                <p className="text-[9px] text-slate-400 mt-1 italic leading-tight">* Offset potential from supplier recovery</p>
              </div>
            </div>
            
            <button 
              onClick={onDrillDown}
              className="w-full mt-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
            >
              <TrendingUp size={14} /> View Historical Drill-down
            </button>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:border-blue-100 transition-colors">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div className="flex items-center gap-2">
               <HistoryIcon size={16} className="text-blue-500" />
               <h3 className="font-bold text-slate-800 uppercase tracking-widest text-[11px]">Branch Operations Manifest</h3>
            </div>
            <button className="text-[10px] text-blue-600 font-black uppercase tracking-widest hover:underline">View All</button>
          </div>
          <div className="divide-y divide-slate-50 overflow-y-auto max-h-[420px]">
            {filteredBatches.map((batch, i) => {
              const loc = displayLocations.find(l => l?.id === batch?.current_location_id || l?.name === batch?.current_location_id);
              return (
                <div key={`batch-${batch?.id}`} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors group/row">
                  <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-xl shadow-sm group-hover/row:scale-110 transition-transform ${batch?.status === 'In-Transit' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                      {batch?.status === 'In-Transit' ? <Truck size={20} /> : <Package size={20} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-black text-slate-800 tracking-tight">#{batch?.id}</p>
                        {batch?.status === 'In-Transit' && <span className="text-[8px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded uppercase tracking-tighter animate-pulse shadow-sm shadow-amber-900/10">In-Transit</span>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                         <MapPin size={10} className="text-slate-300" />
                         <p className="text-[10px] text-slate-500 font-medium">{loc?.name}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-800">{batch?.quantity} Units</p>
                    <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest">{displayAssets.find(a => a?.id === batch?.asset_id)?.type}</p>
                  </div>
                </div>
              );
            })}
            {filteredBatches.length === 0 && (
              <div className="py-20 text-center flex flex-col items-center gap-2">
                <Package size={48} className="text-slate-100" />
                <p className="text-sm text-slate-400 italic">No batches found for this branch filter.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string, value: string, trend: string, trendUp: boolean, icon: React.ReactNode }> = ({ label, value, trend, trendUp, icon }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all group cursor-default">
    <div className="flex items-center justify-between mb-4">
      <div className="p-2.5 bg-slate-50 rounded-xl group-hover:bg-white transition-colors shadow-inner">
        {icon}
      </div>
      <div className={`flex items-center text-[10px] font-black px-2 py-0.5 rounded-full ${trendUp ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
        {trend} {trendUp ? <ArrowUpRight size={12} className="ml-0.5" /> : <ArrowDownRight size={12} className="ml-0.5" />}
      </div>
    </div>
    <div>
      <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{label}</h4>
      <p className="text-3xl font-black text-slate-800 mt-1 tracking-tighter">{value}</p>
    </div>
  </div>
);

export default DashboardView;
