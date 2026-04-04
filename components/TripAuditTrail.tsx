
import React, { useState, useEffect } from 'react';
import { Search, Calendar, User, Truck, FileText, Printer, Loader2, Filter, ArrowRight, MapPin, Clock, Building2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { Branch, TripAuditTrail as TripAuditRecord } from '../types';
import { formatDateTime } from '../constants';

const TripAuditTrail: React.FC = () => {
  const [records, setRecords] = useState<TripAuditRecord[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    driverName: '',
    truckPlate: '',
    branchId: ''
  });

  const fetchData = async () => {
    if (!isSupabaseConfigured) {
      // Mock data for demonstration
      let mockRecords: TripAuditRecord[] = [
        {
          movement_id: 'MOV-001',
          batch_id: 'B-STAG-001',
          movement_time: new Date().toISOString(),
          transaction_date: new Date().toISOString().split('T')[0],
          quantity: 120,
          condition: 'Clean',
          route_instructions: 'Direct delivery to main plant',
          from_location: 'Crate Suppliers JHB',
          to_location: 'Lupo JHB Main Plant (Kya Sands)',
          driver_name: 'John Doe',
          driver_id: 'D-001',
          truck_plate: 'GP 123 SH',
          truck_id: 'T-001',
          branch_id: 'BR-01',
          shift_id: 'S-001',
          shift_start: new Date().toISOString(),
          shift_end: '',
          manual_end_time: '',
          shift_notes: 'Morning shift'
        },
        {
          movement_id: 'MOV-002',
          batch_id: 'B-STAG-002',
          movement_time: new Date(Date.now() - 86400000).toISOString(),
          transaction_date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
          quantity: 45,
          condition: 'Clean',
          route_instructions: 'Inter-branch transfer',
          from_location: 'Lupo JHB Main Plant (Kya Sands)',
          to_location: 'Lupo Durban Plant',
          driver_name: 'Jane Smith',
          driver_id: 'D-002',
          truck_plate: 'GP 456 SH',
          truck_id: 'T-002',
          branch_id: 'BR-01',
          shift_id: 'S-002',
          shift_start: new Date(Date.now() - 86400000).toISOString(),
          shift_end: new Date(Date.now() - 86400000 + 28800000).toISOString(),
          manual_end_time: '',
          shift_notes: 'Long haul'
        }
      ];

      // Apply filters to mock data
      mockRecords = mockRecords.filter(r => {
        const dateMatch = r.transaction_date >= filters.startDate && r.transaction_date <= filters.endDate;
        const driverMatch = !filters.driverName || r.driver_name.toLowerCase().includes(filters.driverName.toLowerCase());
        const truckMatch = !filters.truckPlate || r.truck_plate.toLowerCase().includes(filters.truckPlate.toLowerCase());
        const branchMatch = !filters.branchId || filters.branchId === 'Consolidated' || r.branch_id === filters.branchId;
        return dateMatch && driverMatch && truckMatch && branchMatch;
      });

      setRecords(mockRecords);
      setBranches([{ id: 'BR-01', name: 'Kya Sands' }, { id: 'BR-02', name: 'Durban' }]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Fetch all necessary data in parallel
      const [
        branchData,
        movementsRes,
        locationsRes,
        partiesRes,
        driversRes,
        trucksRes,
        shiftsRes
      ] = await Promise.all([
        supabase.from('branches').select('id, name').order('name'),
        supabase.from('batch_movements').select('id, batch_id, from_location_id, to_location_id, truck_id, driver_id, quantity, condition, notes, transaction_date, timestamp')
          .gte('transaction_date', filters.startDate)
          .lte('transaction_date', filters.endDate),
        supabase.from('locations').select('id, name'),
        supabase.from('business_parties').select('id, name'),
        supabase.from('drivers').select('id, full_name'),
        supabase.from('trucks').select('id, plate_number, branch_id'),
        supabase.from('driver_shifts').select('id, driver_id, truck_id, start_time, end_time, manual_end_time, notes')
          .gte('start_time', new Date(new Date(filters.startDate).getTime() - 86400000).toISOString())
          .order('start_time', { ascending: false })
      ]);

      if (branchData.data) setBranches(branchData.data);

      if (movementsRes.error) throw movementsRes.error;
      
      const allSources = [
        ...(locationsRes.data || []),
        ...(partiesRes.data || [])
      ];

      let filteredMovements = movementsRes.data || [];

      // Apply client-side filters
      const auditRecords: TripAuditRecord[] = filteredMovements.map(bm => {
        const truck = trucksRes.data?.find(t => t.id === bm.truck_id);
        const driver = driversRes.data?.find(d => d.id === bm.driver_id);
        const fromLoc = allSources.find(s => s.id === bm.from_location_id);
        const toLoc = allSources.find(s => s.id === bm.to_location_id);
        
        // Find the most recent shift for this driver and truck that started before the movement
        const shift = shiftsRes.data?.find(s => 
          s.driver_id === bm.driver_id && 
          s.truck_id === bm.truck_id && 
          new Date(s.start_time) <= new Date(bm.timestamp)
        );

        return {
          movement_id: bm.id,
          movement_time: bm.timestamp,
          transaction_date: bm.transaction_date,
          batch_id: bm.batch_id,
          quantity: bm.quantity,
          condition: bm.condition,
          route_instructions: bm.notes, // Using notes as route_instructions if not present
          from_location: fromLoc?.name || bm.from_location_id || 'Unknown',
          to_location: toLoc?.name || bm.to_location_id || 'Unknown',
          driver_name: driver?.full_name || 'Unknown',
          driver_id: bm.driver_id,
          truck_plate: truck?.plate_number || 'Unknown',
          truck_id: bm.truck_id,
          branch_id: truck?.branch_id || 'Unknown',
          shift_id: shift?.id || '',
          shift_start: shift?.start_time || '',
          shift_end: shift?.end_time || '',
          manual_end_time: shift?.manual_end_time || '',
          shift_notes: shift?.notes || ''
        };
      });

      // Apply remaining filters
      const finalRecords = auditRecords.filter(r => {
        const driverMatch = !filters.driverName || r.driver_name.toLowerCase().includes(filters.driverName.toLowerCase());
        const truckMatch = !filters.truckPlate || r.truck_plate.toLowerCase().includes(filters.truckPlate.toLowerCase());
        const branchMatch = !filters.branchId || filters.branchId === 'Consolidated' || r.branch_id === filters.branchId;
        return driverMatch && truckMatch && branchMatch;
      });

      setRecords(finalRecords);
    } catch (err) {
      console.error("Error fetching trip audit trail:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Filters Section */}
      <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-6 print:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 text-white rounded-xl shadow-lg">
              <Filter size={20} />
            </div>
            <div>
              <h3 className="font-black text-xl text-slate-900 uppercase tracking-tight">Audit Filters</h3>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">High-Volume Trip Auditing</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={fetchData}
              className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 flex items-center gap-2"
            >
              <Search size={16} /> Apply Filters
            </button>
            <button 
              onClick={handlePrint}
              className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 flex items-center gap-2"
            >
              <Printer size={16} /> Print Audit Report
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Calendar size={12} /> From Date
            </label>
            <input 
              type="date"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
              value={filters.startDate}
              onChange={e => setFilters({...filters, startDate: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Calendar size={12} /> To Date
            </label>
            <input 
              type="date"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
              value={filters.endDate}
              onChange={e => setFilters({...filters, endDate: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Building2 size={12} /> Branch
            </label>
            <select 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
              value={filters.branchId}
              onChange={e => setFilters({...filters, branchId: e.target.value})}
            >
              <option value="Consolidated">Consolidated (All Branches)</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <User size={12} /> Driver
            </label>
            <input 
              type="text"
              placeholder="Search driver..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
              value={filters.driverName}
              onChange={e => setFilters({...filters, driverName: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Truck size={12} /> Truck
            </label>
            <input 
              type="text"
              placeholder="Search truck..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
              value={filters.truckPlate}
              onChange={e => setFilters({...filters, truckPlate: e.target.value})}
            />
          </div>
        </div>
      </div>

      {/* Report Header for Print */}
      <div className="hidden print:block mb-8 border-b-4 border-slate-900 pb-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">THE SHUKU FAMILY: TRIP AUDIT LOG</h1>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Logistics Intelligence & Forensic Audit</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Printed On</p>
            <p className="text-sm font-bold text-slate-900">{formatDateTime(new Date())}</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-8">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selected Date Range</p>
            <p className="text-sm font-bold text-slate-900">{filters.startDate} to {filters.endDate}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Records</p>
            <p className="text-sm font-bold text-slate-900">{records.length} Trips</p>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
            <Loader2 className="animate-spin text-slate-300 mb-4" size={48} />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Compiling Audit Trail...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
            <FileText className="text-slate-200 mb-4" size={48} />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No trips found for selected criteria</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden print:border-none print:shadow-none">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-900 text-white print:bg-slate-100 print:text-slate-900">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Date</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Driver</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Truck</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Origin</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Destination</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Qty</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Route/Instructions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((record) => (
                  <tr key={record.movement_id} className="hover:bg-slate-50 transition-colors break-inside-avoid">
                    <td className="px-6 py-4 text-xs font-bold text-slate-900 whitespace-nowrap">
                      {new Date(record.transaction_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-900">
                      {record.driver_name}
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-900">
                      {record.truck_plate}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-600">
                      {record.from_location}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-600">
                      {record.to_location}
                    </td>
                    <td className="px-6 py-4 text-xs font-black text-emerald-600">
                      {record.quantity}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-500 italic leading-relaxed min-w-[200px]">
                      <div className="whitespace-normal break-words">
                        {record.route_instructions || '-'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TripAuditTrail;
