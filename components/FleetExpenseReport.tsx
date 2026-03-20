import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  BarChart3, 
  Table as TableIcon, 
  Calendar, 
  MapPin, 
  Search, 
  Filter, 
  ChevronRight, 
  Truck as TruckIcon, 
  DollarSign, 
  History as HistoryIcon,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Paperclip
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import { format, isWithinInterval, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, isSupabaseConfigured, getSignedFleetDocumentUrl } from '../supabase';
import { FleetExpense, TruckRoadworthyHistory, Branch, FleetReadiness } from '../types';

const FleetExpenseReport: React.FC = () => {
  const [expenses, setExpenses] = useState<FleetExpense[]>([]);
  const [roadworthyHistory, setRoadworthyHistory] = useState<TruckRoadworthyHistory[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [readiness, setReadiness] = useState<FleetReadiness[]>([]);
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Filters
  const [branchFilter, setBranchFilter] = useState('All');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    if (!isSupabaseConfigured) return;
    setIsLoading(true);
    try {
      const [expensesRes, historyRes, branchesRes, readinessRes] = await Promise.all([
        supabase.from('vw_branch_fleet_expenses').select('*'),
        supabase.from('truck_roadworthy_history').select('*').order('test_date', { ascending: false }),
        supabase.from('branches').select('*').order('name'),
        supabase.from('vw_fleet_readiness').select('*')
      ]);

      if (expensesRes.data) setExpenses(expensesRes.data);
      if (historyRes.data) setRoadworthyHistory(historyRes.data);
      if (branchesRes.data) setBranches(branchesRes.data);
      if (readinessRes.data) setReadiness(readinessRes.data);
    } catch (err) {
      console.error("Error fetching report data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const dateMatch = isWithinInterval(parseISO(exp.expense_date), {
        start: parseISO(startDate),
        end: parseISO(endDate)
      });
      const branchMatch = branchFilter === 'All' || exp.branch_id === branchFilter;
      const searchMatch = exp.plate_number.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          exp.branch_name.toLowerCase().includes(searchQuery.toLowerCase());
      return dateMatch && branchMatch && searchMatch;
    });
  }, [expenses, branchFilter, startDate, endDate, searchQuery]);

  const stats = useMemo(() => {
    const totalSpend = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    
    const branchTotals: Record<string, { name: string, total: number }> = {};
    filteredExpenses.forEach(exp => {
      if (!branchTotals[exp.branch_id]) {
        branchTotals[exp.branch_id] = { name: exp.branch_name, total: 0 };
      }
      branchTotals[exp.branch_id].total += exp.amount;
    });

    let highestBranch = { name: 'N/A', total: 0 };
    Object.values(branchTotals).forEach(b => {
      if (b.total > highestBranch.total) {
        highestBranch = b;
      }
    });

    const chartData = Object.values(branchTotals).sort((a, b) => b.total - a.total);

    return { totalSpend, highestBranch, chartData };
  }, [filteredExpenses]);

  const truckSummary = useMemo(() => {
    const summary: Record<string, { 
      plate_number: string, 
      branch_name: string, 
      license_cost: number, 
      cof_cost: number,
      total: number,
      license_doc_url?: string,
      license_status?: string,
      ytd_roadworthy_costs?: number
    }> = {};

    filteredExpenses.forEach(exp => {
      if (!summary[exp.truck_id]) {
        const truckReadiness = readiness.find(r => r.truck_id === exp.truck_id);
        summary[exp.truck_id] = { 
          plate_number: exp.plate_number, 
          branch_name: exp.branch_name, 
          license_cost: 0, 
          cof_cost: 0,
          total: 0,
          license_doc_url: exp.license_doc_url,
          license_status: truckReadiness?.license_status || 'Unknown',
          ytd_roadworthy_costs: truckReadiness?.ytd_roadworthy_costs || 0
        };
      }
      if (exp.expense_type === 'License Renewal') {
        summary[exp.truck_id].license_cost += exp.amount;
      } else {
        summary[exp.truck_id].cof_cost += exp.amount;
      }
      summary[exp.truck_id].total += exp.amount;
    });

    return Object.entries(summary).map(([id, data]) => ({ id, ...data }));
  }, [filteredExpenses, readiness]);

  const selectedTruckHistory = useMemo(() => {
    if (!selectedTruckId) return [];
    return roadworthyHistory.filter(h => h.truck_id === selectedTruckId);
  }, [selectedTruckId, roadworthyHistory]);

  const handleViewDocument = async (path: string) => {
    try {
      const url = await getSignedFleetDocumentUrl(path);
      window.open(url, '_blank');
    } catch (err: any) {
      alert("Error generating document link: " + err.message);
    }
  };

  const exportToCSV = () => {
    const headers = ['Plate Number', 'Branch', 'License Cost (ZAR)', 'COF/Repair Cost (ZAR)', 'Total (ZAR)'];
    const rows = truckSummary.map(t => [
      t.plate_number,
      t.branch_name,
      t.license_cost.toFixed(2),
      t.cof_cost.toFixed(2),
      t.total.toFixed(2)
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + 
      [headers, ...rows].map(e => e.join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `fleet_expense_report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase italic">Fleet Expense & Compliance</h2>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
            <TrendingUp size={14} className="text-emerald-500" /> Financial Performance & Maintenance Audit
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
            <Calendar size={16} className="text-slate-400" />
            <input 
              type="date" 
              className="bg-transparent text-xs font-black outline-none w-32"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
            <span className="text-slate-300 text-xs font-black">TO</span>
            <input 
              type="date" 
              className="bg-transparent text-xs font-black outline-none w-32"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
            <MapPin size={16} className="text-slate-400" />
            <select 
              className="bg-transparent text-xs font-black outline-none min-w-[120px]"
              value={branchFilter}
              onChange={e => setBranchFilter(e.target.value)}
            >
              <option value="All">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <button 
            onClick={exportToCSV}
            className="p-2 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-colors shadow-lg"
            title="Export to CSV"
          >
            <Download size={18} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
            <DollarSign size={80} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Total Fleet Spend</p>
          <h3 className="text-4xl font-black tracking-tight">R {stats.totalSpend.toLocaleString()}</h3>
          <div className="mt-6 flex items-center gap-2 text-emerald-400 text-xs font-black">
            <ArrowUpRight size={14} />
            <span>PERIOD TOTAL</span>
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-8 text-slate-50 group-hover:scale-110 transition-transform">
            <MapPin size={80} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Highest Spending Branch</p>
          <h3 className="text-3xl font-black text-slate-900 tracking-tight uppercase">{stats.highestBranch.name}</h3>
          <p className="mt-2 text-slate-400 font-bold text-sm">R {stats.highestBranch.total.toLocaleString()}</p>
          <div className="mt-4 flex items-center gap-2 text-rose-500 text-xs font-black">
            <TrendingUp size={14} />
            <span>COST CENTER PEAK</span>
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-8 text-slate-50 group-hover:scale-110 transition-transform">
            <TruckIcon size={80} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Active Fleet Units</p>
          <h3 className="text-4xl font-black text-slate-900 tracking-tight">{truckSummary.length}</h3>
          <p className="mt-2 text-slate-400 font-bold text-sm">TRUCKS IN REPORT</p>
          <div className="mt-4 flex items-center gap-2 text-slate-400 text-xs font-black">
            <TableIcon size={14} />
            <span>AUDITED ENTITIES</span>
          </div>
        </motion.div>
      </div>

      {/* Chart & Table Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Chart */}
        <div className="xl:col-span-1 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h4 className="font-black text-sm uppercase tracking-widest text-slate-900">Branch Comparison</h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Total Expenses by Location</p>
            </div>
            <BarChart3 size={20} className="text-slate-300" />
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }}
                  width={80}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                />
                <Bar dataKey="total" radius={[0, 8, 8, 0]} barSize={32}>
                  {stats.chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#0f172a' : '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="xl:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h4 className="font-black text-sm uppercase tracking-widest text-slate-900">Detailed Fleet Breakdown</h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">License vs Maintenance Costs</p>
            </div>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <input 
                placeholder="Search plate or branch..."
                className="bg-slate-50 border border-slate-100 rounded-2xl py-3 pl-12 pr-6 text-xs font-bold outline-none focus:ring-2 focus:ring-slate-900 w-full md:w-64"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Truck</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Branch</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">License</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">COF/Repairs</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {truckSummary.map((truck) => (
                  <tr key={truck.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                          <TruckIcon size={14} />
                        </div>
                        <span className="font-black text-slate-900 text-sm">{truck.plate_number}</span>
                      </div>
                    </td>
                    <td className="px-8 py-4">
                      <span className="text-xs font-bold text-slate-500 uppercase">{truck.branch_name}</span>
                    </td>
                    <td className="px-8 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                        truck.license_status === 'Compliant' ? 'bg-emerald-100 text-emerald-600' :
                        truck.license_status === 'Warning' ? 'bg-amber-100 text-amber-600' :
                        truck.license_status === 'Critical' ? 'bg-orange-100 text-orange-600' :
                        'bg-rose-100 text-rose-600'
                      }`}>
                        {truck.license_status}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <span className="text-xs font-black text-slate-900">R {truck.license_cost.toLocaleString()}</span>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <span className="text-xs font-black text-slate-900">R {truck.cof_cost.toLocaleString()}</span>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <span className="text-sm font-black text-slate-900">R {truck.total.toLocaleString()}</span>
                    </td>
                    <td className="px-8 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {truck.license_doc_url && (
                          <button 
                            onClick={() => handleViewDocument(truck.license_doc_url!)}
                            className="p-2 text-slate-300 hover:text-slate-900 hover:bg-white rounded-xl transition-all"
                            title="View License Disc"
                          >
                            <Paperclip size={18} />
                          </button>
                        )}
                        <button 
                          onClick={() => {
                            setSelectedTruckId(truck.id);
                            setIsHistoryModalOpen(true);
                          }}
                          className="p-2 text-slate-300 hover:text-slate-900 hover:bg-white rounded-xl transition-all"
                          title="View History"
                        >
                          <HistoryIcon size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {truckSummary.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-8 py-12 text-center text-slate-300 italic text-sm">No expense data found for selected filters</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* History Modal */}
      <AnimatePresence>
        {isHistoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                  <h4 className="font-black text-xl text-slate-900 uppercase tracking-tight">
                    Expense History: {truckSummary.find(t => t.id === selectedTruckId)?.plate_number}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Detailed Maintenance & COF Log</p>
                </div>
                <button 
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 shadow-sm transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 max-h-[60vh] overflow-y-auto">
                {selectedTruckHistory.length > 0 ? (
                  <div className="space-y-4">
                    {selectedTruckHistory.map((history) => (
                      <div key={history.id} className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100 group hover:border-slate-200 transition-all">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${history.result === 'Pass' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                            <Calendar size={20} />
                          </div>
                          <div>
                            <p className="font-black text-slate-900">{format(parseISO(history.test_date), 'dd MMM yyyy')}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                              Cert: {history.certificate_number || 'N/A'} • Result: {history.result}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-slate-900">R {( (history.test_fee_zar || 0) + (history.repair_costs_zar || 0) ).toLocaleString()}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            Fee: R {history.test_fee_zar?.toLocaleString()} • Repairs: R {history.repair_costs_zar?.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <HistoryIcon size={48} className="mx-auto text-slate-100 mb-4" />
                    <p className="text-slate-400 font-bold text-sm">No historical COF records found for this truck.</p>
                  </div>
                )}
              </div>
              
              <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs hover:bg-slate-800 transition-all shadow-xl"
                >
                  CLOSE REPORT
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FleetExpenseReport;
