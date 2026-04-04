
import React, { useState, useEffect, useMemo } from 'react';
import { MapPin, Package, Building2, TrendingUp, Zap, Loader2, Search, Filter, ArrowRight, Layers, X } from 'lucide-react';
import { supabase, isSupabaseConfigured, fetchAllSources } from '../supabase';
import { formatNumber } from '../constants';

const InventoryMap: React.FC = () => {
  const [locations, setLocations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<any | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        // Fetch batches and locations to aggregate client-side
        const [batchesRes, allLocations] = await Promise.all([
          supabase.from('batches').select('asset_id, current_location_id, quantity'),
          fetchAllSources()
        ]);

        if (batchesRes.error) throw batchesRes.error;

        const batches = batchesRes.data || [];

        // Aggregate data by location (replicating vw_inventory_map_data)
        const aggregatedData = allLocations.map(loc => {
          const locationBatches = batches.filter(b => b.current_location_id === loc.id);
          const totalAssets = locationBatches.reduce((sum, b) => sum + (b.quantity || 0), 0);
          const assetTypes = new Set(locationBatches.map(b => b.asset_id)).size;

          return {
            ...loc,
            total_assets: totalAssets,
            asset_types: assetTypes
          };
        }).filter(loc => loc.total_assets > 0);

        setLocations(aggregatedData);
      } catch (err) {
        console.error("Inventory Map Fetch Error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredLocations = useMemo(() => {
    return locations.filter(l => 
      l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.type.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [locations, searchTerm]);

  const totalAssets = useMemo(() => {
    return locations.reduce((acc, l) => acc + (l.total_assets || 0), 0);
  }, [locations]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="animate-spin text-slate-900" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      {/* Header & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <TrendingUp size={120} />
          </div>
          <div className="relative z-10 space-y-2">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Global Asset Distribution</p>
            <p className="text-5xl font-black tracking-tighter">{formatNumber(totalAssets)}</p>
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
              <Zap size={12} /> Live Inventory Pulse
            </p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 border border-slate-200 flex items-center justify-between group hover:border-slate-300 transition-all">
          <div className="space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Nodes</p>
            <p className="text-4xl font-black text-slate-900">{locations.length}</p>
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-2">
              <Building2 size={12} /> Across all branches
            </p>
          </div>
          <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-600 group-hover:scale-110 transition-transform">
            <Layers size={32} />
          </div>
        </div>
      </div>

      {/* Map View Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[600px]">
        {/* Sidebar: Location List */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 space-y-4">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Location Registry</h4>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text"
                placeholder="Search nodes..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-slate-900"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
            {filteredLocations.map(loc => (
              <button 
                key={loc.id}
                onClick={() => setSelectedLocation(loc)}
                className={`w-full p-6 text-left hover:bg-slate-50 transition-all flex items-center justify-between group ${selectedLocation?.id === loc.id ? 'bg-slate-50 border-r-4 border-slate-900' : ''}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${loc.total_assets > 1000 ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    <MapPin size={18} />
                  </div>
                  <div>
                    <h5 className="text-sm font-black text-slate-900 uppercase tracking-tight">{loc.name}</h5>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{loc.type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-900">{formatNumber(loc.total_assets)}</p>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Units</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main: Visual Map Representation */}
        <div className="lg:col-span-2 bg-slate-50 rounded-3xl border border-slate-200 relative overflow-hidden flex items-center justify-center p-8">
          {/* Stylized Map Grid */}
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          
          {selectedLocation ? (
            <div className="relative z-10 w-full max-w-md animate-in zoom-in-95 duration-300">
              <div className="bg-white rounded-[32px] shadow-2xl border border-slate-100 overflow-hidden">
                <div className="p-8 bg-slate-900 text-white">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                      <MapPin size={32} />
                    </div>
                    <button onClick={() => setSelectedLocation(null)} className="text-slate-400 hover:text-white transition-colors">
                      <X size={24} />
                    </button>
                  </div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter mb-1">{selectedLocation.name}</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{selectedLocation.type} • {selectedLocation.branch_id}</p>
                </div>
                <div className="p-8 space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-4 bg-slate-50 rounded-2xl">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Stock</p>
                      <p className="text-2xl font-black text-slate-900">{formatNumber(selectedLocation.total_assets)}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Asset Types</p>
                      <p className="text-2xl font-black text-slate-900">{selectedLocation.asset_types}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Coordinates</p>
                    <p className="text-xs font-mono font-bold text-slate-600">
                      LAT: {selectedLocation.latitude || 'N/A'} | LNG: {selectedLocation.longitude || 'N/A'}
                    </p>
                  </div>
                  <button className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-3">
                    View Detailed Inventory <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-6 relative z-10">
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto shadow-xl border border-slate-100 text-slate-300">
                <Layers size={48} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Select a Node</h3>
                <p className="text-sm font-medium text-slate-400">Choose a location from the sidebar to view its distribution profile</p>
              </div>
            </div>
          )}

          {/* Floating Markers (Visual Only) */}
          {filteredLocations.slice(0, 10).map((loc, idx) => (
            <div 
              key={`marker-${loc.id}`}
              className="absolute w-3 h-3 bg-slate-900/20 rounded-full animate-pulse"
              style={{ 
                top: `${20 + (idx * 7) % 60}%`, 
                left: `${20 + (idx * 13) % 60}%` 
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default InventoryMap;
