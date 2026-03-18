
import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  MapPin, 
  Package, 
  Truck, 
  Search, 
  Filter, 
  Download, 
  Calendar,
  Building2,
  Users,
  Database,
  Loader2,
  ArrowRight,
  History as HistoryIcon
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { Batch, Location, AssetMaster, Branch, PartnerType, LocationType, LogisticsTrace } from '../types';

const ReportsView: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [assets, setAssets] = useState<AssetMaster[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [traces, setTraces] = useState<LogisticsTrace[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'inventory' | 'trace'>('inventory');

  // Filters
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedPartnerType, setSelectedPartnerType] = useState<string>('all');
  const [selectedAssetType, setSelectedAssetType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const [bRes, lRes, aRes, brRes, tRes] = await Promise.all([
          supabase.from('batches').select('*'),
          supabase.from('vw_all_sources').select('*'),
          supabase.from('asset_master').select('*'),
          supabase.from('branches').select('*'),
          supabase.from('vw_master_logistics_trace')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(1000)
        ]);

        if (bRes.data) setBatches(bRes.data);
        if (lRes.data) setLocations(lRes.data);
        if (aRes.data) setAssets(aRes.data);
        if (tRes.data) setTraces(tRes.data);
        
        if (brRes.data) {
          setBranches(brRes.data);
        } else {
          setBranches([]);
        }
      } catch (err) {
        console.error("Reports Fetch Error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredData = useMemo(() => {
    return batches.filter(batch => {
      const loc = locations.find(l => l.id === batch.current_location_id);
      const asset = assets.find(a => a.id === batch.asset_id);
      
      const matchesBranch = selectedBranch === 'all' || loc?.branch_id === selectedBranch;
      const matchesPartner = selectedPartnerType === 'all' || loc?.partner_type === selectedPartnerType;
      const matchesAsset = selectedAssetType === 'all' || batch.asset_id === selectedAssetType;
      const matchesSearch = batch.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           asset?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           loc?.name.toLowerCase().includes(searchQuery.toLowerCase());

      // "Our Account" Logic: External Assets at External Locations are removed from our account
      const isOurAccount = !(asset?.ownership_type === 'External' && loc?.category === 'External');

      return matchesBranch && matchesPartner && matchesAsset && matchesSearch && isOurAccount;
    });
  }, [batches, locations, assets, selectedBranch, selectedPartnerType, selectedAssetType, searchQuery]);

  const stats = useMemo(() => {
    const totalUnits = filteredData.reduce((acc, b) => acc + b.quantity, 0);
    const byLocation = filteredData.reduce((acc: Record<string, number>, b) => {
      const loc = locations.find(l => l.id === b.current_location_id)?.name || 'Unknown';
      acc[loc] = (acc[loc] || 0) + b.quantity;
      return acc;
    }, {});

    const byAsset = filteredData.reduce((acc: Record<string, number>, b) => {
      const asset = assets.find(a => a.id === b.asset_id)?.name || 'Unknown';
      acc[asset] = (acc[asset] || 0) + b.quantity;
      return acc;
    }, {});

    // Trace Stats
    const traceData = traces.filter(t => {
      const matchesBranch = selectedBranch === 'all' || t.custodian_branch_id === selectedBranch;
      const matchesSearch = !searchQuery || 
                           String(t.batch_id).toLowerCase().includes(searchQuery.toLowerCase()) || 
                           t.driver_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           t.to_location_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           t.truck_plate?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesBranch && matchesSearch;
    });
    
    // Get latest condition for each batch at each location - Optimized
    const latestTraceByBatch: Record<string, LogisticsTrace> = {};
    for (const t of traceData) {
      const bId = String(t.batch_id);
      if (!latestTraceByBatch[bId] || new Date(t.timestamp).getTime() > new Date(latestTraceByBatch[bId].timestamp).getTime()) {
        latestTraceByBatch[bId] = t;
      }
    }

    const conditionSummary: Record<string, { clean: number, dirty: number, damaged: number }> = {};
    for (const t of Object.values(latestTraceByBatch)) {
      if (!conditionSummary[t.to_location_name]) {
        conditionSummary[t.to_location_name] = { clean: 0, dirty: 0, damaged: 0 };
      }
      if (t.condition === 'Clean') conditionSummary[t.to_location_name].clean += t.quantity;
      else if (t.condition === 'Dirty') conditionSummary[t.to_location_name].dirty += t.quantity;
      else if (t.condition === 'Damaged') conditionSummary[t.to_location_name].damaged += t.quantity;
    }

    return { totalUnits, byLocation, byAsset, conditionSummary };
  }, [filteredData, locations, assets, traces, selectedBranch]);

  const handleExportCSV = () => {
    const headers = ['Batch ID', 'Asset', 'Asset Type', 'Location', 'Partner Type', 'Quantity'];
    const csvContent = [
      headers.join(','),
      ...filteredData.map(batch => {
        const loc = locations.find(l => l.id === batch.current_location_id);
        const asset = assets.find(a => a.id === batch.asset_id);
        return [
          batch.id,
          asset?.name || 'Unknown',
          asset?.type || 'Unknown',
          loc?.name || 'Unknown',
          loc?.partner_type || 'Unknown',
          batch.quantity
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `logistics_intelligence_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGeneratePDF = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="animate-spin text-slate-900" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20">
      {/* Header */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Logistics Intelligence</h3>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Real-time Inventory & Asset Distribution</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={handleExportCSV}
            className="flex-1 md:flex-none px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-slate-200 transition-all"
          >
            <Download size={16} /> EXPORT CSV
          </button>
          <button 
            onClick={handleGeneratePDF}
            className="flex-1 md:flex-none px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
          >
            <TrendingUp size={16} /> GENERATE PDF
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Package size={20} /></div>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Assets Tracked</h4>
          </div>
          <p className="text-3xl font-black text-slate-900">{stats.totalUnits.toLocaleString()}</p>
          <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">Across {new Set(filteredData.map(b => b.current_location_id)).size} Locations</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Building2 size={20} /></div>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Active Branches</h4>
          </div>
          <p className="text-3xl font-black text-slate-900">{branches.length}</p>
          <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">Operational Hubs</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Users size={20} /></div>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Partner Network</h4>
          </div>
          <p className="text-3xl font-black text-slate-900">{new Set(locations.filter(l => l.partner_type !== PartnerType.INTERNAL).map(l => l.id)).size}</p>
          <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">Customers & Suppliers</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex border-b border-slate-100 mb-4">
          <button 
            onClick={() => setActiveTab('inventory')}
            className={`px-6 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'inventory' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400'}`}
          >
            Inventory Manifest
          </button>
          <button 
            onClick={() => setActiveTab('trace')}
            className={`px-6 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'trace' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400'}`}
          >
            Logistics Trace Report
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search batches, assets, or locations..." 
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-slate-900 transition-all"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-4">
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
              value={selectedPartnerType}
              onChange={e => setSelectedPartnerType(e.target.value)}
            >
              <option value="all">All Partner Types</option>
              {Object.values(PartnerType).map(pt => <option key={pt} value={pt}>{pt}</option>)}
            </select>
            <select 
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
              value={selectedAssetType}
              onChange={e => setSelectedAssetType(e.target.value)}
            >
              <option value="all">All Asset Types</option>
              {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      {activeTab === 'inventory' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Distribution by Location */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <MapPin size={18} className="text-rose-500" />
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-widest">Distribution by Location</h3>
            </div>
            <div className="p-6 space-y-4 flex-1 overflow-y-auto max-h-[400px]">
              {Object.entries(stats.byLocation).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([loc, qty]) => (
                <div key={loc} className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-600">{loc}</span>
                    <span className="text-slate-900">{(qty as number).toLocaleString()} Units</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-slate-900 h-full rounded-full transition-all duration-1000" 
                      style={{ width: `${((qty as number) / (stats.totalUnits || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              {Object.keys(stats.byLocation).length === 0 && (
                <div className="py-20 text-center text-slate-400 italic text-sm">No data for current filters.</div>
              )}
            </div>
          </div>

          {/* Detailed Data Table */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database size={18} className="text-blue-500" />
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-widest">Inventory Manifest</h3>
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{filteredData.length} Batches Found</span>
            </div>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/30">
                    <th className="px-6 py-4">Batch ID</th>
                    <th className="px-6 py-4">Asset</th>
                    <th className="px-6 py-4">Location</th>
                    <th className="px-6 py-4 text-right">Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredData.slice(0, 50).map(batch => {
                    const loc = locations.find(l => l.id === batch.current_location_id);
                    const asset = assets.find(a => a.id === batch.asset_id);
                    return (
                      <tr key={batch.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-xs font-black text-slate-900">{batch.id}</td>
                        <td className="px-6 py-4">
                          <p className="text-xs font-bold text-slate-700">{asset?.name}</p>
                          <p className="text-[9px] text-slate-400 uppercase font-black tracking-tighter">{asset?.type}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs font-bold text-slate-700">{loc?.name}</p>
                          <p className="text-[9px] text-slate-400 uppercase font-black tracking-tighter">{loc?.partner_type}</p>
                        </td>
                        <td className="px-6 py-4 text-right text-xs font-black text-slate-900">{batch.quantity.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  {filteredData.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-20 text-center text-slate-400 italic text-sm">No inventory records match your criteria.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {filteredData.length > 50 && (
              <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Showing first 50 of {filteredData.length} records</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <HistoryIcon size={18} className="text-emerald-500" />
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-widest">Custodian Branch Condition Report</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/30">
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4 text-center">Clean</th>
                  <th className="px-6 py-4 text-center">Dirty</th>
                  <th className="px-6 py-4 text-center">Damaged</th>
                  <th className="px-6 py-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {Object.entries(stats.conditionSummary).map(([locName, counts]) => {
                  const c = counts as { clean: number, dirty: number, damaged: number };
                  return (
                    <tr key={locName} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-xs font-bold text-slate-900">{locName}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black">{c.clean.toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-black">{c.dirty.toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded-lg text-[10px] font-black">{c.damaged.toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-4 text-right text-xs font-black text-slate-900">
                        {(c.clean + c.dirty + c.damaged).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
                {Object.keys(stats.conditionSummary).length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-20 text-center text-slate-400 italic text-sm">No trace data found for this branch.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsView;
