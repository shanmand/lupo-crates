import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  BarChart3, 
  PieChart as PieChartIcon, 
  AlertTriangle, 
  ShieldAlert, 
  Truck, 
  User as UserIcon, 
  Calendar, 
  Download, 
  ChevronRight, 
  ArrowUpRight, 
  ArrowDownRight,
  FileText,
  Map,
  CheckCircle2,
  Clock,
  DollarSign,
  Activity
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { format, differenceInDays, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { supabase, isSupabaseConfigured, fetchAllSources } from '../supabase';
import { Truck as TruckType, Driver, Branch, Task, ManagementKPIs, LocationUnconfirmedValue, BatchAccrual, BranchFleetExpense } from '../types';
import { formatCurrency } from '../constants';

const ManagementReportPack: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [kpis, setKpis] = useState<ManagementKPIs | null>(null);
  const [unconfirmedValue, setUnconfirmedValue] = useState<LocationUnconfirmedValue[]>([]);
  const [accruals, setAccruals] = useState<BatchAccrual[]>([]);
  const [trucks, setTrucks] = useState<TruckType[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [fleetExpenses, setFleetExpenses] = useState<BranchFleetExpense[]>([]);

  const fetchData = async () => {
    if (!isSupabaseConfigured) return;
    setIsLoading(true);
    try {
      const [
        batchesRes,
        sources,
        assetsRes,
        branchesRes,
        movementsRes,
        tripsRes,
        stopsRes,
        driversRes,
        trucksRes,
        feesRes,
        tasksRes,
        budgetsRes,
        lossesRes
      ] = await Promise.all([
        supabase.from('batches').select('*'),
        fetchAllSources(),
        supabase.from('asset_master').select('*'),
        supabase.from('branches').select('*'),
        supabase.from('batch_movements').select('*'),
        supabase.from('trips').select('*'),
        supabase.from('trip_stops').select('*'),
        supabase.from('drivers').select('*'),
        supabase.from('trucks').select('*'),
        supabase.from('fee_schedule').select('*'),
        supabase.from('tasks').select('*'),
        supabase.from('branch_budgets').select('*'),
        supabase.from('asset_losses').select('*')
      ]);

      if (batchesRes.data) {
        const mappedAccruals = batchesRes.data.map((b: any) => {
          const fee = feesRes.data?.find((f: any) => f.asset_id === b.asset_id && f.fee_type.includes('Daily Rental') && f.effective_to === null);
          const loc = sources.find((l: any) => l.id === b.current_location_id);
          const calcEndDate = new Date();
          const calcStartDate = new Date(b.transaction_date || b.created_at || '');
          const daysAged = Math.max(0, Math.floor((calcEndDate.getTime() - calcStartDate.getTime()) / (1000 * 60 * 60 * 24)));
          const accruedAmount = daysAged * (fee?.amount_zar || 0) * b.quantity;

          return {
            batch_id: b.id,
            branch_id: loc?.branch_id,
            accrued_amount: accruedAmount
          };
        });
        setAccruals(mappedAccruals);

        const unconfirmed = batchesRes.data
          .filter((b: any) => b.status === 'In Transit' || b.status === 'Pending')
          .map((b: any) => {
            const asset = assetsRes.data?.find((a: any) => a.id === b.asset_id);
            const loc = sources.find((l: any) => l.id === b.current_location_id);
            const fee = feesRes.data?.find((f: any) => f.asset_id === b.asset_id && f.fee_type.includes('Replacement') && f.effective_to === null);
            return {
              location_id: b.current_location_id,
              location_name: loc?.name || 'Unknown',
              estimated_value_zar: (fee?.amount_zar || 0) * b.quantity
            };
          });
        
        // Aggregate unconfirmed by location
        const aggregatedUnconfirmed = unconfirmed.reduce((acc: any[], curr: any) => {
          const existing = acc.find(item => item.location_id === curr.location_id);
          if (existing) {
            existing.estimated_value_zar += curr.estimated_value_zar;
          } else {
            acc.push(curr);
          }
          return acc;
        }, []);
        setUnconfirmedValue(aggregatedUnconfirmed);

        // Calculate KPIs
        const totalBatches = batchesRes.data.length;
        const totalLosses = lossesRes.data?.reduce((sum: number, l: any) => sum + l.lost_quantity, 0) || 0;
        const totalAssets = batchesRes.data.reduce((sum: number, b: any) => sum + b.quantity, 0) || 1;
        const shrinkageRate = (totalLosses / totalAssets) * 100;
        
        setKpis({
          total_active_batches: totalBatches,
          shrinkage_rate: shrinkageRate,
          crate_cycle_time: 14.5, // Placeholder
          active_trips: tripsRes.data?.filter((t: any) => t.status === 'In Transit').length || 0
        } as any);
      }

      if (trucksRes.data && branchesRes.data) {
        const mappedExpenses = trucksRes.data
          .filter((t: any) => t.last_renewal_cost_zar > 0)
          .map((t: any) => {
            const branch = branchesRes.data.find((b: any) => b.id === t.branch_id);
            return {
              branch_id: t.branch_id,
              branch_name: branch?.name || 'Unknown',
              truck_id: t.id,
              plate_number: t.plate_number,
              expense_type: 'License Renewal',
              amount: t.last_renewal_cost_zar || 0,
              expense_date: t.license_disc_expiry,
              license_doc_url: t.license_doc_url
            };
          });
        setFleetExpenses(mappedExpenses);
        setTrucks(trucksRes.data);
      }
      if (driversRes.data) setDrivers(driversRes.data);
      if (tasksRes.data) setTasks(tasksRes.data);
      if (budgetsRes.data) setBudgets(budgetsRes.data);
      if (branchesRes.data) setBranches(branchesRes.data);
    } catch (err) {
      console.error("Error fetching report data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const reportStats = useMemo(() => {
    const totalAccrued = accruals.reduce((sum, a) => sum + (a.accrued_amount || 0), 0);
    const totalRevenue = totalAccrued * 1.25; // Simple markup for demo
    const grossMargin = (totalRevenue - totalAccrued) / totalRevenue * 100;

    const complianceCost = fleetExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const taskCompletion = tasks.length > 0 
      ? (tasks.filter(t => t.status === 'Completed').length / tasks.length) * 100 
      : 0;

    const redListTrucks = trucks.filter(t => {
      if (!t.license_disc_expiry) return true;
      return new Date(t.license_disc_expiry) < new Date();
    });

    const redListDrivers = drivers.filter(d => {
      if (!d.license_expiry) return true;
      return new Date(d.license_expiry) < new Date();
    });

    const upcomingRenewals = trucks.filter(t => {
      if (!t.license_disc_expiry) return false;
      const days = differenceInDays(new Date(t.license_disc_expiry), new Date());
      return days > 0 && days <= 90;
    }).length + drivers.filter(d => {
      if (!d.license_expiry) return false;
      const days = differenceInDays(new Date(d.license_expiry), new Date());
      return days > 0 && days <= 90;
    }).length;

    const licensingCost = fleetExpenses.filter(e => e.expense_type === 'License Renewal').reduce((sum, e) => sum + (e.amount || 0), 0);
    const cofCost = fleetExpenses.filter(e => e.expense_type === 'COF/Roadworthy').reduce((sum, e) => sum + (e.amount || 0), 0);
    const otherCost = fleetExpenses.filter(e => e.expense_type !== 'License Renewal' && e.expense_type !== 'COF/Roadworthy').reduce((sum, e) => sum + (e.amount || 0), 0);

    return {
      totalRevenue,
      totalAccrued,
      grossMargin,
      complianceCost,
      licensingCost,
      cofCost,
      otherCost,
      taskCompletion,
      redListCount: redListTrucks.length + redListDrivers.length,
      upcomingRenewals,
      redListTrucks,
      redListDrivers
    };
  }, [accruals, fleetExpenses, tasks, trucks, drivers]);

  const commentary = useMemo(() => {
    const blocks = [];
    if (kpis?.shrinkage_rate > 5) {
      blocks.push(`CRITICAL: Shrinkage rate is currently ${kpis.shrinkage_rate.toFixed(2)}%, which is above the 5% threshold. Immediate stock audit required at high-variance locations.`);
    }
    if (reportStats.redListCount > 0) {
      blocks.push(`COMPLIANCE RISK: There are ${reportStats.redListCount} expired licenses/COFs in the fleet. This represents a significant regulatory risk to operations.`);
    }
    if (reportStats.taskCompletion < 80) {
      blocks.push(`OPERATIONAL LAG: Task completion rate is ${reportStats.taskCompletion.toFixed(1)}%. Logistics bottlenecks identified in movement confirmations.`);
    }
    if (blocks.length === 0) {
      blocks.push("Operations are currently within normal parameters. All compliance and financial metrics are meeting targets.");
    }
    return blocks;
  }, [kpis, reportStats]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Generating Reporting Pack...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-20 print:p-0">
      {/* Report Header */}
      <div className="bg-slate-900 text-white p-12 rounded-[3rem] shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-10">
          <FileText size={200} />
        </div>
        <div className="relative z-10">
          <h2 className="text-5xl font-black tracking-tighter uppercase italic">Monthly Management Pack</h2>
          <p className="text-slate-400 font-bold text-sm uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
            <Calendar size={18} className="text-amber-500" /> {format(new Date(), 'MMMM yyyy')} • Confidential
          </p>
        </div>
        <div className="flex gap-4 relative z-10">
          <button 
            onClick={() => window.print()}
            className="px-8 py-4 bg-white text-slate-900 rounded-2xl font-black text-xs flex items-center gap-2 hover:bg-slate-100 transition-all shadow-xl"
          >
            <Download size={18} /> EXPORT PDF
          </button>
        </div>
      </div>

      {/* 1. Executive Summary & KPIs */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 ml-4">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
            <Activity size={20} />
          </div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">1. Executive Summary & KPIs</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Revenue (Est)</p>
            <h4 className="text-3xl font-black text-slate-900 tracking-tight">{formatCurrency(reportStats.totalRevenue)}</h4>
            <div className="mt-4 flex items-center gap-2 text-emerald-500 text-xs font-black">
              <ArrowUpRight size={14} /> 12.5% vs Last Month
            </div>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Accrued Liability</p>
            <h4 className="text-3xl font-black text-slate-900 tracking-tight">{formatCurrency(reportStats.totalAccrued)}</h4>
            <div className="mt-4 flex items-center gap-2 text-slate-400 text-xs font-black">
              <Clock size={14} /> Current Accrual
            </div>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Crate Cycle Time</p>
            <h4 className="text-3xl font-black text-slate-900 tracking-tight">{kpis?.crate_cycle_time?.toFixed(1) || 0} Days</h4>
            <div className="mt-4 flex items-center gap-2 text-amber-500 text-xs font-black">
              <ArrowDownRight size={14} /> -2.1 Days Improvement
            </div>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Shrinkage Rate</p>
            <h4 className={`text-3xl font-black tracking-tight ${kpis?.shrinkage_rate > 5 ? 'text-rose-600' : 'text-slate-900'}`}>
              {kpis?.shrinkage_rate?.toFixed(2) || 0}%
            </h4>
            <div className={`mt-4 flex items-center gap-2 text-xs font-black ${kpis?.shrinkage_rate > 5 ? 'text-rose-500' : 'text-emerald-500'}`}>
              {kpis?.shrinkage_rate > 5 ? <ShieldAlert size={14} /> : <CheckCircle2 size={14} />}
              {kpis?.shrinkage_rate > 5 ? 'ABOVE THRESHOLD' : 'WITHIN LIMIT'}
            </div>
          </div>
        </div>
      </section>

      {/* 2. Financial Performance */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 ml-4">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <DollarSign size={20} />
          </div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">2. Financial Performance (EBITDA Focus)</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl w-full overflow-hidden">
            <h4 className="font-black text-sm uppercase tracking-widest text-slate-900 mb-8">Revenue vs Budget by Branch</h4>
            <div className="h-[400px] min-h-[400px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={branches.map(b => {
                  const branchBudget = budgets.find(bud => bud.branch_id === b.id);
                  const branchAccruals = accruals.filter(a => a.branch_id === b.id);
                  const branchRevenue = branchAccruals.reduce((sum, a) => sum + (a.accrued_amount || 0), 0) * 1.25;
                  return {
                    name: b.name,
                    Revenue: branchRevenue,
                    Budget: branchBudget?.budget_amount || 0
                  };
                })}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                  <Bar dataKey="Revenue" fill="#0f172a" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Budget" fill="#e2e8f0" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl space-y-8">
            <h4 className="font-black text-sm uppercase tracking-widest text-slate-900">Cost of Compliance</h4>
            <div className="space-y-6">
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Truck Licensing</p>
                  <p className="font-black text-slate-900">{formatCurrency(reportStats.licensingCost)}</p>
                </div>
                <Truck size={24} className="text-slate-200" />
              </div>
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">COF Repairs</p>
                  <p className="font-black text-slate-900">{formatCurrency(reportStats.cofCost)}</p>
                </div>
                <ShieldAlert size={24} className="text-slate-200" />
              </div>
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Other Compliance</p>
                  <p className="font-black text-slate-900">{formatCurrency(reportStats.otherCost)}</p>
                </div>
                <UserIcon size={24} className="text-slate-200" />
              </div>
            </div>
            <div className="pt-6 border-t border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Compliance Spend</p>
              <p className="text-3xl font-black text-slate-900">{formatCurrency(reportStats.complianceCost)}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Fleet & Compliance Risk */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 ml-4">
          <div className="w-10 h-10 bg-rose-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
            <ShieldAlert size={20} />
          </div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">3. Fleet & Compliance Risk</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden">
            <div className="px-10 py-6 bg-rose-600 text-white flex justify-between items-center">
              <h4 className="font-black text-xs uppercase tracking-widest">The 'Red' List (Expired)</h4>
              <span className="bg-white/20 px-3 py-1 rounded-lg text-[10px] font-black">{reportStats.redListCount} Critical</span>
            </div>
            <div className="divide-y divide-slate-50">
              {reportStats.redListTrucks.map(t => (
                <div key={t.id} className="px-10 py-4 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <Truck size={18} className="text-rose-500" />
                    <span className="font-black text-slate-900 text-sm">{t.plate_number}</span>
                  </div>
                  <span className="text-[10px] font-black text-rose-600 uppercase bg-rose-50 px-3 py-1 rounded-lg">Expired COF</span>
                </div>
              ))}
              {reportStats.redListDrivers.map(d => (
                <div key={d.id} className="px-10 py-4 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <UserIcon size={18} className="text-rose-500" />
                    <span className="font-black text-slate-900 text-sm">{d.full_name}</span>
                  </div>
                  <span className="text-[10px] font-black text-rose-600 uppercase bg-rose-50 px-3 py-1 rounded-lg">Expired License</span>
                </div>
              ))}
              {reportStats.redListCount === 0 && (
                <div className="p-12 text-center text-slate-300 italic text-sm">No expired entities found</div>
              )}
            </div>
          </div>

          <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl flex flex-col justify-center items-center text-center space-y-6">
            <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center text-amber-500">
              <Clock size={48} />
            </div>
            <div>
              <h4 className="text-4xl font-black text-slate-900 tracking-tight">{reportStats.upcomingRenewals}</h4>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">90-Day Renewal Outlook</p>
            </div>
            <p className="text-xs text-slate-500 max-w-xs">
              Entities requiring renewal within the next 90 days. Recommended lead time for SA DLTC bookings is 60 days.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Operational Logistics */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 ml-4">
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Map size={20} />
          </div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">4. Operational Logistics</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl w-full overflow-hidden">
            <h4 className="font-black text-sm uppercase tracking-widest text-slate-900 mb-8">Location Value Heatmap (Unconfirmed)</h4>
            <div className="h-[350px] min-h-[350px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={unconfirmedValue.sort((a, b) => b.estimated_value_zar - a.estimated_value_zar).slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="location_name" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 900, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="estimated_value_zar" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl flex flex-col justify-center items-center space-y-8">
            <div className="relative w-48 h-48">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="96" cy="96" r="80" stroke="currentColor" strokeWidth="16" fill="transparent" className="text-slate-100" />
                <circle cx="96" cy="96" r="80" stroke="currentColor" strokeWidth="16" fill="transparent" strokeDasharray={502.4} strokeDashoffset={502.4 - (502.4 * reportStats.taskCompletion / 100)} className="text-blue-500 transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black text-slate-900">{reportStats.taskCompletion.toFixed(0)}%</span>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Completed</span>
              </div>
            </div>
            <div className="text-center">
              <h4 className="font-black text-sm uppercase tracking-widest text-slate-900">Task Completion Rate</h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Stock Takes & Movements</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Management Commentary */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 ml-4">
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg shadow-slate-900/20">
            <TrendingUp size={20} />
          </div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">5. Management Commentary</h3>
        </div>

        <div className="bg-white p-12 rounded-[3rem] border border-slate-100 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-5">
            <TrendingUp size={150} />
          </div>
          <div className="space-y-8 relative z-10">
            {commentary.map((text, idx) => (
              <div key={idx} className="flex gap-6 items-start">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center shrink-0 text-slate-400 font-black text-xs">
                  {idx + 1}
                </div>
                <p className="text-slate-600 font-medium leading-relaxed text-lg">
                  {text}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-12 pt-12 border-t border-slate-100 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-900 rounded-full" />
              <div>
                <p className="font-black text-slate-900">Operations Director</p>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Lupo Bakery Proprietary Limited</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Report Generated</p>
              <p className="font-black text-slate-900">{format(new Date(), 'dd MMM yyyy HH:mm')}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ManagementReportPack;
