
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  ShieldAlert, 
  Search, 
  Filter, 
  Download, 
  Truck as TruckIcon, 
  User as UserIcon, 
  Calendar,
  Plus,
  History as HistoryIcon,
  CheckCircle2,
  X,
  Loader2,
  FileText,
  ChevronRight,
  ArrowRight,
  Eye,
  Paperclip
} from 'lucide-react';
import { supabase, isSupabaseConfigured, getSignedFleetDocumentUrl } from '../supabase';
import { Truck, Driver, Branch, TruckRoadworthyHistory, UserRole, FleetReadiness } from '../types';
import BranchSelector from './BranchSelector';
import { useUser } from '../UserContext';

const FleetCompliance: React.FC = () => {
  const { profile } = useUser();
  const [trucks, setTrucks] = useState<FleetReadiness[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [roadworthyHistory, setRoadworthyHistory] = useState<TruckRoadworthyHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState('All');
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State for New Roadworthy Test
  const [newTest, setNewTest] = useState({
    truck_id: '',
    test_date: new Date().toISOString().split('T')[0],
    expiry_date: '',
    certificate_number: '',
    test_fee_zar: 0,
    repair_costs_zar: 0,
    result: 'Pass',
    notes: ''
  });

  const fetchData = async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [trucksRes, driversRes, branchesRes, historyRes] = await Promise.all([
        supabase.from('trucks').select('*'),
        supabase.from('drivers').select('*').eq('is_active', true),
        supabase.from('branches').select('*').order('name'),
        supabase.from('truck_roadworthy_history').select('*').order('test_date', { ascending: false })
      ]);

      if (trucksRes.data && branchesRes.data && historyRes.data) {
        const trucksData = trucksRes.data;
        const branchesData = branchesRes.data;
        const historyData = historyRes.data;

        // Reconstruct fleet readiness client-side
        const reconstructed = trucksData.map(t => {
          const branch = branchesData.find(b => b.id === t.branch_id);
          const truckHistory = historyData.filter(h => h.truck_id === t.id).sort((a, b) => new Date(b.test_date).getTime() - new Date(a.test_date).getTime());
          const lastRoadworthy = truckHistory[0];
          const ytdCosts = truckHistory
            .filter(h => new Date(h.test_date).getFullYear() === new Date().getFullYear())
            .reduce((sum, h) => sum + (h.test_fee_zar || 0) + (h.repair_costs_zar || 0), 0);

          const now = new Date();
          const expiry = t.license_disc_expiry ? new Date(t.license_disc_expiry) : null;
          let licenseStatus = 'Compliant';
          if (expiry) {
            const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) licenseStatus = 'Expired';
            else if (diffDays <= 30) licenseStatus = 'Critical';
            else if (diffDays <= 90) licenseStatus = 'Warning';
          }

          return {
            truck_id: t.id,
            plate_number: t.plate_number,
            branch_id: t.branch_id,
            branch_name: branch?.name || 'Unknown',
            license_disc_expiry: t.license_disc_expiry,
            license_status: licenseStatus,
            last_renewal_cost: t.last_renewal_cost_zar || 0,
            ytd_roadworthy_costs: ytdCosts,
            last_roadworthy_result: lastRoadworthy?.result,
            roadworthy_expiry: lastRoadworthy?.expiry_date
          };
        });
        setTrucks(reconstructed as any);
      }
      if (driversRes.data) setDrivers(driversRes.data);
      if (branchesRes.data) setBranches(branchesRes.data);
      if (historyRes.data) setRoadworthyHistory(historyRes.data);
    } catch (err) {
      console.error("Compliance Fetch Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getStatusColor = (expiryDate?: string) => {
    if (!expiryDate) return 'text-slate-400';
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'text-rose-600 bg-rose-50 border-rose-100';
    if (diffDays <= 90) return 'text-amber-600 bg-amber-50 border-amber-100';
    return 'text-emerald-600 bg-emerald-50 border-emerald-100';
  };

  const getComplianceStats = useMemo(() => {
    const filteredTrucks = trucks.filter(t => branchFilter === 'All' || t.branch_id === branchFilter);
    const filteredDrivers = drivers.filter(d => branchFilter === 'All' || d.branch_id === branchFilter);

    let critical = 0;
    let warning = 0;
    let compliant = 0;

    const checkCompliance = (date?: string) => {
      if (!date) return;
      const now = new Date();
      const expiry = new Date(date);
      const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays < 0) critical++;
      else if (diffDays <= 90) warning++;
      else compliant++;
    };

    filteredTrucks.forEach(t => checkCompliance(t.license_disc_expiry));
    filteredDrivers.forEach(d => {
      checkCompliance(d.license_expiry);
      checkCompliance(d.prdp_expiry);
    });

    return { critical, warning, compliant };
  }, [trucks, drivers, branchFilter]);

  const handleAddTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('truck_roadworthy_history')
        .insert([newTest]);
      if (error) throw error;
      
      // Update truck's license disc expiry if this is the latest test? 
      // Actually roadworthy is different from license disc, but often linked.
      // User didn't specify updating truck table, but it's good practice.

      await fetchData();
      setIsModalOpen(false);
      setNewTest({
        truck_id: '',
        test_date: new Date().toISOString().split('T')[0],
        expiry_date: '',
        certificate_number: '',
        test_fee_zar: 0,
        repair_costs_zar: 0,
        result: 'Pass',
        notes: ''
      });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const exportComplianceReport = () => {
    const now = new Date();
    const warningThreshold = new Date();
    warningThreshold.setDate(now.getDate() + 90);

    const reportData = [
      ['Type', 'Entity', 'Branch', 'Expiry Date', 'Status'],
      ...trucks.filter(t => t.license_disc_expiry && new Date(t.license_disc_expiry) <= warningThreshold).map(t => [
        'Truck License', 
        t.plate_number, 
        branches.find(b => b.id === t.branch_id)?.name || 'N/A', 
        t.license_disc_expiry,
        new Date(t.license_disc_expiry!) < now ? 'EXPIRED' : 'DUE SOON'
      ]),
      ...drivers.filter(d => d.license_expiry && new Date(d.license_expiry) <= warningThreshold).map(d => [
        'Driver License', 
        d.full_name, 
        branches.find(b => b.id === d.branch_id)?.name || 'N/A', 
        d.license_expiry,
        new Date(d.license_expiry!) < now ? 'EXPIRED' : 'DUE SOON'
      ])
    ];

    const csvContent = "data:text/csv;charset=utf-8," + reportData.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `fleet_compliance_report_${now.toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getTotalComplianceCost = useMemo(() => {
    if (!selectedTruckId) return 0;
    const truck = trucks.find(t => t.id === selectedTruckId);
    if (!truck) return 0;

    const currentYear = new Date().getFullYear();
    
    // License renewal cost (if renewed this year)
    const licenseCost = truck.last_renewal_cost_zar || 0;

    // Roadworthy costs for this year
    const roadworthyCosts = roadworthyHistory
      .filter(h => h.truck_id === selectedTruckId && new Date(h.test_date).getFullYear() === currentYear)
      .reduce((sum, h) => sum + (h.test_fee_zar || 0) + (h.repair_costs_zar || 0), 0);

    return licenseCost + roadworthyCosts;
  }, [selectedTruckId, trucks, roadworthyHistory]);

  const handleViewDocument = async (path: string, type: 'truck' | 'driver') => {
    if (type === 'driver') {
      const isAuthorized = profile?.role_name === UserRole.ADMIN || profile?.role_name === UserRole.MANAGER;
      if (!isAuthorized) {
        alert("POPIA Compliance: Only Managers and Admins can view driver license documents.");
        return;
      }
    }

    try {
      const url = await getSignedFleetDocumentUrl(path);
      window.open(url, '_blank');
    } catch (err: any) {
      alert("Error generating document link: " + err.message);
    }
  };

  const filteredDrivers = drivers.filter(d => branchFilter === 'All' || d.branch_id === branchFilter);
  const filteredTrucks = trucks.filter(t => branchFilter === 'All' || t.branch_id === branchFilter);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20">
      {/* Header */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Fleet Compliance & Expiry</h3>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Regulatory Monitoring Dashboard</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={exportComplianceReport}
            className="px-6 py-3 bg-slate-100 text-slate-900 rounded-xl font-black text-xs flex items-center justify-center gap-2 hover:bg-slate-200 transition-all"
          >
            <Download size={18} /> EXPORT REPORT
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-3xl border border-rose-100 shadow-sm flex items-center gap-6">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center">
            <ShieldAlert size={32} />
          </div>
          <div>
            <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Critical / Expired</p>
            <p className="text-4xl font-black text-rose-600">{getComplianceStats.critical}</p>
          </div>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-amber-100 shadow-sm flex items-center gap-6">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
            <AlertTriangle size={32} />
          </div>
          <div>
            <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Warning (90 Days)</p>
            <p className="text-4xl font-black text-amber-600">{getComplianceStats.warning}</p>
          </div>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-emerald-100 shadow-sm flex items-center gap-6">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
            <ShieldCheck size={32} />
          </div>
          <div>
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Compliant</p>
            <p className="text-4xl font-black text-emerald-600">{getComplianceStats.compliant}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-4">
        <div className="w-full lg:w-64">
          <select 
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
            value={branchFilter}
            onChange={e => setBranchFilter(e.target.value)}
          >
            <option value="All">All Branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Driver Compliance Table */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-8 py-5 bg-slate-900 text-white flex justify-between items-center">
            <div className="flex items-center gap-2">
              <UserIcon size={18} className="text-blue-400" />
              <h4 className="font-black text-xs uppercase tracking-widest">Driver License Compliance</h4>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Driver</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">License #</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Expiries</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredDrivers.map(driver => (
                  <tr key={driver.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-black text-slate-900 text-sm">{driver.full_name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{branches.find(b => b.id === driver.branch_id)?.name || 'N/A'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-slate-600">{driver.license_number || 'NOT RECORDED'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] font-black text-slate-400 uppercase w-12">License:</span>
                          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${getStatusColor(driver.license_expiry)}`}>
                            <Calendar size={12} />
                            {driver.license_expiry || 'NO DATE'}
                          </div>
                          {driver.license_doc_url && (
                            <button 
                              onClick={() => handleViewDocument(driver.license_doc_url!, 'driver')}
                              className="p-1.5 text-slate-400 hover:text-slate-900 transition-colors"
                              title="View License Document"
                            >
                              <Paperclip size={14} />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] font-black text-slate-400 uppercase w-12">PrDP:</span>
                          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${getStatusColor(driver.prdp_expiry)}`}>
                            <ShieldCheck size={12} />
                            {driver.prdp_expiry || 'NO DATE'}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Truck Compliance Table */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-8 py-5 bg-slate-900 text-white flex justify-between items-center">
            <div className="flex items-center gap-2">
              <TruckIcon size={18} className="text-amber-400" />
              <h4 className="font-black text-xs uppercase tracking-widest">Truck License Disc Compliance</h4>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Truck</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">License Expiry</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Roadworthy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredTrucks.map(truck => (
                  <tr key={truck.truck_id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-black text-slate-900 text-sm">{truck.plate_number}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{truck.branch_name || 'N/A'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${getStatusColor(truck.license_disc_expiry)}`}>
                          <Calendar size={12} />
                          {truck.license_disc_expiry || 'NO DATE'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${getStatusColor(truck.roadworthy_expiry || undefined)}`}>
                          <ShieldCheck size={12} />
                          {truck.roadworthy_expiry ? new Date(truck.roadworthy_expiry).toLocaleDateString() : 'No Record'}
                        </div>
                        <button 
                          onClick={() => setSelectedTruckId(truck.truck_id)}
                          className={`p-2 rounded-lg transition-all ${selectedTruckId === truck.truck_id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400 hover:text-slate-600'}`}
                        >
                          <HistoryIcon size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Roadworthy History Section */}
      {selectedTruckId && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4">
          <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center">
                <FileText size={24} />
              </div>
              <div>
                <h4 className="font-black text-lg text-slate-900 uppercase tracking-tight">Roadworthy History: {trucks.find(t => t.truck_id === selectedTruckId)?.plate_number}</h4>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Historical Certificates & Test Results</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">YTD Compliance Cost</p>
                <p className="text-xl font-black text-slate-900">R {trucks.find(t => t.truck_id === selectedTruckId)?.ytd_roadworthy_costs.toLocaleString() || '0'}</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setNewTest({...newTest, truck_id: selectedTruckId});
                    setIsModalOpen(true);
                  }}
                  className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-xs flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg"
                >
                  <Plus size={18} /> ADD NEW TEST
                </button>
                <button onClick={() => setSelectedTruckId(null)} className="p-3 text-slate-400 hover:text-slate-600"><X size={20} /></button>
              </div>
            </div>
          </div>
          
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {roadworthyHistory.filter(h => h.truck_id === selectedTruckId).map(history => (
                <div key={history.id} className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${history.result === 'Pass' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                      {history.result}
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">{new Date(history.test_date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Certificate #</p>
                    <p className="font-black text-slate-900">{history.certificate_number || 'N/A'}</p>
                  </div>
                  <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Expiry Date</p>
                      <p className={`text-xs font-black ${getStatusColor(history.expiry_date)}`}>{history.expiry_date}</p>
                    </div>
                    {history.notes && (
                      <div className="group relative">
                        <AlertTriangle size={16} className="text-amber-400 cursor-help" />
                        <div className="absolute bottom-full right-0 mb-2 w-48 p-3 bg-slate-900 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                          {history.notes}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {roadworthyHistory.filter(h => h.truck_id === selectedTruckId).length === 0 && (
                <div className="col-span-full py-12 text-center">
                  <p className="text-slate-400 font-bold text-sm uppercase tracking-widest italic">No historical tests recorded for this unit</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal for New Test */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h4 className="font-black text-xl text-slate-900 uppercase tracking-tight">New Roadworthy Test</h4>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Update Truck Compliance</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleAddTest} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Test Date</label>
                  <input 
                    required
                    type="date"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                    value={newTest.test_date}
                    onChange={e => setNewTest({...newTest, test_date: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Expiry Date</label>
                  <input 
                    required
                    type="date"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                    value={newTest.expiry_date}
                    onChange={e => setNewTest({...newTest, expiry_date: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Certificate Number</label>
                <input 
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                  value={newTest.certificate_number}
                  onChange={e => setNewTest({...newTest, certificate_number: e.target.value})}
                  placeholder="e.g. RW-123456"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Test Fee (ZAR)</label>
                  <input 
                    type="number"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                    value={newTest.test_fee_zar}
                    onChange={e => setNewTest({...newTest, test_fee_zar: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Repair Costs (ZAR)</label>
                  <input 
                    type="number"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                    value={newTest.repair_costs_zar}
                    onChange={e => setNewTest({...newTest, repair_costs_zar: parseFloat(e.target.value) || 0})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Test Result</label>
                <div className="flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setNewTest({...newTest, result: 'Pass'})}
                    className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${newTest.result === 'Pass' ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg' : 'bg-white text-slate-400 border-slate-200'}`}
                  >
                    Pass
                  </button>
                  <button 
                    type="button"
                    onClick={() => setNewTest({...newTest, result: 'Fail'})}
                    className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${newTest.result === 'Fail' ? 'bg-rose-600 text-white border-rose-600 shadow-lg' : 'bg-white text-slate-400 border-slate-200'}`}
                  >
                    Fail
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Notes / Observations</label>
                <textarea 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900 min-h-[100px]"
                  value={newTest.notes}
                  onChange={e => setNewTest({...newTest, notes: e.target.value})}
                  placeholder="Any mechanical issues or warnings..."
                />
              </div>
              
              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 mt-4 flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'SAVE TEST RECORD'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FleetCompliance;
