
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
import { MOCK_BATCHES, MOCK_LOCATIONS, MOCK_ASSETS, MOCK_MOVEMENTS, MOCK_TRUCKS, MOCK_DRIVERS } from '../constants';
import { Batch, Location, AssetMaster, Branch, PartnerType, LocationType, LogisticsTrace, Trip, TripStop, Driver, Truck as TruckType } from '../types';

const ReportsView: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [assets, setAssets] = useState<AssetMaster[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [traces, setTraces] = useState<LogisticsTrace[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripStops, setTripStops] = useState<TripStop[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trucks, setTrucks] = useState<TruckType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'inventory' | 'trace' | 'trips'>('inventory');

  // Filters
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedPartnerType, setSelectedPartnerType] = useState<string>('all');
  const [selectedAssetType, setSelectedAssetType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [tripReportLevel, setTripReportLevel] = useState<'driver' | 'location'>('driver');

  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured) {
        setBatches(MOCK_BATCHES);
        setLocations(MOCK_LOCATIONS);
        setAssets(MOCK_ASSETS);
        setTraces(MOCK_MOVEMENTS.map(m => ({
          id: m.id,
          batch_id: m.batch_id,
          from_location: MOCK_LOCATIONS.find(l => l.id === m.from_location_id)?.name || 'Unknown',
          to_location: MOCK_LOCATIONS.find(l => l.id === m.to_location_id)?.name || 'Unknown',
          quantity: m.quantity,
          transaction_date: m.transaction_date,
          condition: m.condition,
          driver_name: MOCK_DRIVERS.find(d => d.id === m.driver_id)?.full_name || 'Unknown',
          truck_plate: MOCK_TRUCKS.find(t => t.id === m.truck_id)?.plate_number || 'Unknown'
        })));
        setTrips([
          {
            id: 'TRIP-001',
            route_name: 'JHB-DBN Express',
            driver_id: 'DRV-001',
            truck_id: 'TRK-001',
            scheduled_date: new Date().toISOString().split('T')[0],
            status: 'In Progress',
            created_at: new Date().toISOString()
          }
        ]);
        setDrivers(MOCK_DRIVERS);
        setTrucks(MOCK_TRUCKS);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const [bRes, lRes, aRes, brRes, tRes, tripsRes, stopsRes, driversRes, trucksRes] = await Promise.all([
          supabase.from('vw_global_inventory_tracker').select('*'),
          supabase.from('vw_all_sources').select('*'),
          supabase.from('asset_master').select('*'),
          supabase.from('branches').select('*'),
          supabase.from('vw_master_logistics_trace')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(1000),
          supabase.from('trips').select('*').order('scheduled_date', { ascending: false }),
          supabase.from('trip_stops').select('*'),
          supabase.from('drivers').select('*'),
          supabase.from('trucks').select('*')
        ]);

        if (bRes.data) {
          const mapped = bRes.data.map((b: any) => ({
            ...b,
            id: b.batch_id,
            status: b.batch_status
          }));
          setBatches(mapped);
        }
        if (lRes.data) setLocations(lRes.data);
        if (aRes.data) setAssets(aRes.data);
        
        if (tRes.data) setTraces(tRes.data);
        if (tripsRes.data) setTrips(tripsRes.data);
        if (stopsRes.data) setTripStops(stopsRes.data);
        if (driversRes.data) setDrivers(driversRes.data);
        if (trucksRes.data) setTrucks(trucksRes.data);
        
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
    const locationMap = new Map<string, Location>(locations.map(l => [l.id, l]));
    const assetMap = new Map<string, AssetMaster>(assets.map(a => [a.id, a]));

    return batches.filter(batch => {
      const loc = locationMap.get(batch.current_location_id);
      const asset = assetMap.get(batch.asset_id);
      const assetName = asset?.name || batch.asset_name || 'Unknown Asset';
      
      const matchesBranch = selectedBranch === 'all' || loc?.branch_id === selectedBranch;
      const matchesPartner = selectedPartnerType === 'all' || loc?.partner_type === selectedPartnerType;
      const matchesAsset = selectedAssetType === 'all' || batch.asset_id === selectedAssetType;
      
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = (batch.id || '').toLowerCase().includes(searchLower) || 
                           (assetName || '').toLowerCase().includes(searchLower) ||
                           (loc?.name || '').toLowerCase().includes(searchLower);

      // "Our Account" Logic: External Assets at External Locations are removed from our account
      const isOurAccount = !(asset?.ownership_type === 'External' && loc?.category === 'External');

      return matchesBranch && matchesPartner && matchesAsset && matchesSearch && isOurAccount;
    });
  }, [batches, locations, assets, selectedBranch, selectedPartnerType, selectedAssetType, searchQuery]);

  const stats = useMemo<{
    totalUnits: number;
    byLocation: Record<string, number>;
    byAsset: Record<string, number>;
    conditionSummary: Record<string, { clean: number, dirty: number, damaged: number }>;
    filteredTrips: Trip[];
    tripsByDriver: Record<string, Trip[]>;
    tripsByLocation: Record<string, (Trip & { stopStatus: string })[]>;
  }>(() => {
    const locationMap = new Map<string, Location>(locations.map(l => [l.id, l]));
    const assetMap = new Map<string, AssetMaster>(assets.map(a => [a.id, a]));
    const driverMap = new Map<string, Driver>(drivers.map(d => [d.id, d]));
    const truckMap = new Map<string, TruckType>(trucks.map(t => [t.id, t]));
    const tripMap = new Map<string, Trip>(trips.map(t => [t.id, t]));

    const totalUnits = filteredData.reduce((acc, b) => acc + b.quantity, 0);
    const byLocation = filteredData.reduce<Record<string, number>>((acc, b) => {
      const loc = locationMap.get(b.current_location_id)?.name || 'Unknown';
      acc[loc] = (acc[loc] || 0) + b.quantity;
      return acc;
    }, {});

    const byAsset = filteredData.reduce<Record<string, number>>((acc, b) => {
      const asset = assetMap.get(b.asset_id)?.name || 'Unknown';
      acc[asset] = (acc[asset] || 0) + b.quantity;
      return acc;
    }, {});

    // Trace Stats
    const searchLower = searchQuery.toLowerCase();
    const traceData = traces.filter(t => {
      const matchesBranch = selectedBranch === 'all' || t.custodian_branch_id === selectedBranch;
      const matchesSearch = !searchQuery || 
                           String(t.batch_id || '').toLowerCase().includes(searchLower) || 
                           (t.driver_name || '').toLowerCase().includes(searchLower) ||
                           (t.to_location_name || '').toLowerCase().includes(searchLower) ||
                           (t.truck_plate || '').toLowerCase().includes(searchLower);
      return matchesBranch && matchesSearch;
    });
    
    // Get latest condition for each batch at each location - Optimized
    const latestTraceByBatch: Record<string, LogisticsTrace> = {};
    for (const t of traceData) {
      const bId = String(t.batch_id);
      const currentLatest = latestTraceByBatch[bId];
      if (!currentLatest || new Date(t.timestamp).getTime() > new Date(currentLatest.timestamp).getTime()) {
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

    // Trip Stats
    const filteredTrips = trips.filter(trip => {
      const tripDate = trip.scheduled_date || '';
      const inRange = tripDate >= startDate && tripDate <= endDate;
      const driver = driverMap.get(trip.driver_id);
      const truck = truckMap.get(trip.truck_id);
      const matchesDriver = searchQuery === '' || (driver?.full_name || '').toLowerCase().includes(searchLower);
      const matchesTruck = searchQuery === '' || (truck?.plate_number || '').toLowerCase().includes(searchLower);
      return inRange && (matchesDriver || matchesTruck);
    });

    const tripsByDriver = filteredTrips.reduce<Record<string, Trip[]>>((acc, trip) => {
      const driverName = driverMap.get(trip.driver_id)?.full_name || 'Unknown Driver';
      if (!acc[driverName]) acc[driverName] = [];
      acc[driverName].push(trip);
      return acc;
    }, {});

    const filteredTripIds = new Set(filteredTrips.map(t => t.id));
    const tripsByLocation = tripStops.reduce<Record<string, (Trip & { stopStatus: string })[]>>((acc, stop) => {
      if (filteredTripIds.has(stop.trip_id)) {
        const trip = tripMap.get(stop.trip_id);
        if (trip) {
          const locName = locationMap.get(stop.location_id)?.name || 'Unknown Location';
          if (!acc[locName]) acc[locName] = [];
          acc[locName].push({ ...trip, stopStatus: stop.status });
        }
      }
      return acc;
    }, {});

    return { totalUnits, byLocation, byAsset, conditionSummary, filteredTrips, tripsByDriver, tripsByLocation };
  }, [filteredData, locations, assets, traces, selectedBranch, trips, tripStops, startDate, endDate, searchQuery, drivers, trucks]);

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
    if (activeTab === 'trips') {
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      const title = `Trip Audit Report (${startDate} to ${endDate})`;
      const levelTitle = tripReportLevel === 'driver' ? 'Driver Level' : 'Location Level';

      let contentHtml = '';

      if (tripReportLevel === 'driver') {
        Object.keys(stats.tripsByDriver).forEach((driverName) => {
          const driverTrips = stats.tripsByDriver[driverName];
          contentHtml += `
            <div class="report-section">
              <h2 class="section-title">Driver: ${driverName}</h2>
              <table>
                <thead>
                  <tr>
                    <th>Trip ID</th>
                    <th>Date</th>
                    <th>Truck</th>
                    <th>Route</th>
                    <th>Status</th>
                    <th>Stops</th>
                  </tr>
                </thead>
                <tbody>
                  ${driverTrips.map(trip => {
                    const truck = trucks.find(t => t.id === trip.truck_id)?.plate_number || 'N/A';
                    const stopsCount = tripStops.filter(s => s.trip_id === trip.id).length;
                    return `
                      <tr>
                        <td>${trip.id}</td>
                        <td>${trip.scheduled_date}</td>
                        <td>${truck}</td>
                        <td>${trip.route_name || 'N/A'}</td>
                        <td>${trip.status}</td>
                        <td>${stopsCount}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `;
        });
      } else {
        Object.keys(stats.tripsByLocation).forEach((locName) => {
          const locTrips = stats.tripsByLocation[locName];
          contentHtml += `
            <div class="report-section">
              <h2 class="section-title">Location: ${locName}</h2>
              <table>
                <thead>
                  <tr>
                    <th>Trip ID</th>
                    <th>Date</th>
                    <th>Driver</th>
                    <th>Truck</th>
                    <th>Stop Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${locTrips.map(trip => {
                    const driver = drivers.find(d => d.id === trip.driver_id)?.full_name || 'N/A';
                    const truck = trucks.find(t => t.id === trip.truck_id)?.plate_number || 'N/A';
                    return `
                      <tr>
                        <td>${trip.id}</td>
                        <td>${trip.scheduled_date}</td>
                        <td>${driver}</td>
                        <td>${truck}</td>
                        <td>${trip.stopStatus}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `;
        });
      }

      printWindow.document.write(`
        <html>
          <head>
            <title>${title}</title>
            <style>
              body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; }
              .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; }
              .header h1 { margin: 0; font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
              .header p { margin: 5px 0 0; color: #64748b; font-size: 12px; font-weight: 600; }
              .report-section { margin-bottom: 40px; page-break-inside: avoid; }
              .section-title { font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #0f172a; margin-bottom: 15px; border-left: 4px solid #0f172a; padding-left: 10px; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th { background: #f8fafc; text-align: left; padding: 10px; border-bottom: 2px solid #e2e8f0; font-size: 10px; text-transform: uppercase; font-weight: 800; color: #64748b; }
              td { padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; font-weight: 500; }
              @media print {
                @page { margin: 2cm; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${title}</h1>
              <p>${levelTitle} - Generated on ${new Date().toLocaleString()}</p>
            </div>
            ${contentHtml || '<p style="text-align: center; color: #64748b; margin-top: 40px;">No trip data found for the selected period.</p>'}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    } else {
      window.print();
    }
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
          <button 
            onClick={() => setActiveTab('trips')}
            className={`px-6 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'trips' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400'}`}
          >
            Trip Audit Report
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder={activeTab === 'trips' ? "Search drivers or trucks..." : "Search batches, assets, or locations..."}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-slate-900 transition-all"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          
          {activeTab === 'trips' ? (
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1">
                <Calendar size={14} className="text-slate-400" />
                <input 
                  type="date" 
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="bg-transparent border-none text-xs font-bold outline-none"
                />
                <span className="text-slate-300">to</span>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="bg-transparent border-none text-xs font-bold outline-none"
                />
              </div>
              <select 
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                value={tripReportLevel}
                onChange={e => setTripReportLevel(e.target.value as 'driver' | 'location')}
              >
                <option value="driver">Driver Level</option>
                <option value="location">Location Level</option>
              </select>
            </div>
          ) : (
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
          )}
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
                  {filteredData.slice(0, 50).map((batch, idx) => {
                    const loc = locations.find(l => l.id === batch.current_location_id);
                    const asset = assets.find(a => a.id === batch.asset_id);
                    const assetName = asset?.name || batch.asset_name || 'Unknown Asset';
                    return (
                      <tr key={batch.id || `batch-${idx}`} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-xs font-black text-slate-900">{batch.id}</td>
                        <td className="px-6 py-4">
                          <p className="text-xs font-bold text-slate-700">{assetName}</p>
                          <p className="text-[9px] text-slate-400 uppercase font-black tracking-tighter">{asset?.type || 'Asset'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs font-bold text-slate-700">{loc?.name}</p>
                          <p className="text-[9px] text-slate-400 uppercase font-black tracking-tighter">{loc?.partner_type}</p>
                        </td>
                        <td className="px-6 py-4 text-right text-xs font-black text-slate-900">{(batch.quantity || 0).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  {filteredData.length === 0 && (
                    <tr key="empty-inventory">
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
      ) : activeTab === 'trace' ? (
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
                    <tr key={`trace-${locName}`} className="hover:bg-slate-50 transition-colors">
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
                  <tr key="empty-trace">
                    <td colSpan={5} className="py-20 text-center text-slate-400 italic text-sm">No trace data found for this branch.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck size={18} className="text-amber-500" />
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-widest">Trip Audit Report</h3>
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stats.filteredTrips.length} Trips Found</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/30">
                  <th className="px-6 py-4">Trip ID</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Driver</th>
                  <th className="px-6 py-4">Truck</th>
                  <th className="px-6 py-4">Route</th>
                  <th className="px-6 py-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stats.filteredTrips.map((trip, idx) => {
                  const driver = drivers.find(d => d.id === trip.driver_id);
                  const truck = trucks.find(t => t.id === trip.truck_id);
                  return (
                    <tr key={trip.id || `trip-${idx}`} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-xs font-black text-slate-900">{trip.id}</td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-700">{trip.scheduled_date}</td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-700">{driver?.full_name}</td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-700">{truck?.plate_number}</td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-700">{trip.route_name}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                          trip.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                          trip.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                          trip.status === 'Cancelled' ? 'bg-rose-100 text-rose-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {trip.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {stats.filteredTrips.length === 0 && (
                  <tr key="empty-trips">
                    <td colSpan={6} className="py-20 text-center text-slate-400 italic text-sm">No trips found for the selected period.</td>
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
