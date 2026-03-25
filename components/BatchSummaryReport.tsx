
import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  Legend
} from 'recharts';
import { 
  Download, 
  Calendar, 
  ArrowUpRight, 
  Users, 
  Package, 
  TrendingUp,
  Filter,
  ChevronDown,
  Loader2,
  FileText
} from 'lucide-react';
import { supabase } from '../supabase';
import { format, startOfWeek, subDays, isWithinInterval } from 'date-fns';

interface IntakeSummary {
  week_starting: string;
  source_type: string;
  source_name: string;
  total_quantity: number;
}

const BatchSummaryReport: React.FC = () => {
  const [data, setData] = useState<IntakeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<'this-week' | 'last-30-days' | 'all'>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: summaryData, error } = await supabase
        .from('vw_intake_summary_report')
        .select('*');

      if (error) throw error;
      setData(summaryData || []);
    } catch (error) {
      console.error('Error fetching intake summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    const now = new Date();
    let start: Date | null = null;
    
    if (dateFilter === 'this-week') {
      start = startOfWeek(now, { weekStartsOn: 1 });
    } else if (dateFilter === 'last-30-days') {
      start = subDays(now, 30);
    }

    if (!start) return data;

    return data.filter(item => {
      const itemDate = new Date(item.week_starting);
      return itemDate >= start!;
    });
  }, [data, dateFilter]);

  const stats = useMemo(() => {
    const totalIntakes = filteredData.reduce((acc, curr) => acc + curr.total_quantity, 0);
    
    const sourceTotals: Record<string, number> = {};
    filteredData.forEach(item => {
      sourceTotals[item.source_name] = (sourceTotals[item.source_name] || 0) + item.total_quantity;
    });

    const topSource = Object.entries(sourceTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    const customerIntakes = filteredData
      .filter(item => item.source_type === 'Customer')
      .reduce((acc, curr) => acc + curr.total_quantity, 0);

    const returnRate = totalIntakes > 0 ? (customerIntakes / totalIntakes) * 100 : 0;

    return { totalIntakes, topSource, returnRate };
  }, [filteredData]);

  const chartData = useMemo(() => {
    const typeTotals: Record<string, number> = {
      'Internal': 0,
      'Supplier': 0,
      'Customer': 0
    };

    filteredData.forEach(item => {
      if (typeTotals[item.source_type] !== undefined) {
        typeTotals[item.source_type] += item.total_quantity;
      }
    });

    return Object.entries(typeTotals).map(([name, value]) => ({ name, value }));
  }, [filteredData]);

  const handleDownloadCSV = () => {
    const headers = ['Week Starting', 'Source Type', 'Source Name', 'Total Quantity'];
    const csvContent = [
      headers.join(','),
      ...filteredData.map(item => [
        item.week_starting,
        item.source_type,
        item.source_name,
        item.total_quantity
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `batch_summary_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Batch Summary Report</h1>
          <p className="text-slate-500 text-sm font-medium">Weekly intake analysis and source distribution</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <select 
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="pl-10 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 appearance-none focus:ring-2 focus:ring-amber-500 outline-none shadow-sm"
            >
              <option value="all">All Time</option>
              <option value="this-week">This Week</option>
              <option value="last-30-days">Last 30 Days</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
          </div>

          <button 
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
          >
            <Download size={14} />
            Download CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-50 rounded-xl">
              <Package className="text-blue-600 w-5 h-5" />
            </div>
            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-full uppercase tracking-widest">Total Volume</span>
          </div>
          <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Total Intakes</h4>
          <p className="text-3xl font-black text-slate-900 mt-1">{stats.totalIntakes.toLocaleString()}</p>
          <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-tighter">Crates received in period</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-emerald-50 rounded-xl">
              <Users className="text-emerald-600 w-5 h-5" />
            </div>
            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full uppercase tracking-widest">Top Contributor</span>
          </div>
          <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Top Source</h4>
          <p className="text-xl font-black text-slate-900 mt-1 truncate">{stats.topSource}</p>
          <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-tighter">Highest volume provider</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-amber-50 rounded-xl">
              <TrendingUp className="text-amber-600 w-5 h-5" />
            </div>
            <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-full uppercase tracking-widest">Efficiency</span>
          </div>
          <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Return Rate</h4>
          <p className="text-3xl font-black text-slate-900 mt-1">{stats.returnRate.toFixed(1)}%</p>
          <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-tighter">Customer vs Total Intakes</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Chart */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-black text-xs uppercase tracking-[0.2em] text-slate-800">Total Quantity by Source Type</h3>
            <div className="flex items-center gap-4">
              {chartData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index] }}></div>
                  <span className="text-[9px] font-black text-slate-400 uppercase">{entry.name}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    padding: '12px'
                  }}
                  itemStyle={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase' }}
                  labelStyle={{ fontSize: '10px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h3 className="font-black text-xs uppercase tracking-[0.2em] text-slate-800">Intake Summary Details</h3>
            <FileText size={16} className="text-slate-400" />
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Week Starting</th>
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Source</th>
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Type</th>
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredData.slice(0, 10).map((item, i) => (
                  <tr key={`${item.week_starting}-${item.source_name}-${i}`} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 text-xs font-bold text-slate-600">{item.week_starting ? format(new Date(item.week_starting), 'MMM dd, yyyy') : 'N/A'}</td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{item.source_name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                        item.source_type === 'Internal' ? 'bg-blue-50 text-blue-600' :
                        item.source_type === 'Supplier' ? 'bg-emerald-50 text-emerald-600' :
                        'bg-amber-50 text-amber-600'
                      }`}>
                        {item.source_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-xs font-black text-slate-900">{(item.total_quantity || 0).toLocaleString()}</td>
                  </tr>
                ))}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic text-sm">No intake data found for the selected period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredData.length > 10 && (
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Showing top 10 records. Download CSV for full report.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BatchSummaryReport;
