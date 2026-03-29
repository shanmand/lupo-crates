
import React, { useState, useEffect, useRef } from 'react';
import { 
  DollarSign, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Upload, 
  X, 
  Loader2, 
  TrendingUp, 
  Building2,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { supabase, isSupabaseConfigured, fetchAllSources } from '../supabase';
import { Batch, AssetMaster, FeeSchedule, Location, Branch, User, AllSource } from '../types';

interface BatchFinancialDetailCardProps {
  batchId: string;
  onUpdate?: () => void;
}

const BatchFinancialDetailCard: React.FC<BatchFinancialDetailCardProps> = ({ batchId, onUpdate }) => {
  const [batch, setBatch] = useState<(Batch & { asset?: AssetMaster, location?: AllSource }) | null>(null);
  const [accrual, setAccrual] = useState<number>(0);
  const [dailyRate, setDailyRate] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmDate, setConfirmDate] = useState(new Date().toISOString().split('T')[0]);
  const [thaanFile, setThaanFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFinancialData = async (silent = false) => {
    if (!isSupabaseConfigured) return;
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      // 1. Fetch Batch
      const { data: batchData, error: batchError } = await supabase
        .from('batches')
        .select('*')
        .eq('id', batchId)
        .single();

      if (batchError) throw batchError;

      // 2. Fetch Asset and Sources
      const [assetRes, sources, branchesRes] = await Promise.all([
        supabase.from('asset_master').select('*').eq('id', batchData.asset_id).single(),
        fetchAllSources(),
        supabase.from('branches').select('*')
      ]);

      const source = sources.find(s => s.id === batchData.current_location_id);
      const branch = branchesRes.data?.find(b => b.id === source?.branch_id);

      setBatch({
        ...batchData,
        asset: assetRes.data || undefined,
        location: source ? { ...source, branch_name: branch?.name } : undefined
      } as any);

      // 3. Fetch Accrual via RPC
      const { data: accrualData, error: accrualError } = await supabase.rpc('calculate_batch_accrual', {
        batch_id_input: batchId
      });
      if (accrualError) throw accrualError;
      setAccrual(accrualData || 0);

      // 3. Fetch Daily Rate
      const { data: feeData } = await supabase
        .from('fee_schedule')
        .select('amount_zar')
        .eq('asset_id', batchData.asset_id)
        .eq('fee_type', 'Daily Rental (Supermarket)')
        .is('effective_to', null)
        .single();
      
      setDailyRate(feeData?.amount_zar || 0);

    } catch (err) {
      console.error("Error fetching financial detail:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFinancialData();
  }, [batchId]);

  const handleConfirmReceipt = async () => {
    if (!batch || !isSupabaseConfigured) return;
    setIsSubmitting(true);

    try {
      // 1. Upload THAAN Slip if provided
      let thaanUrl = '';
      if (thaanFile) {
        const fileExt = thaanFile.name.split('.').pop();
        const fileName = `${batch.id}-final-${Math.random()}.${fileExt}`;
        const filePath = `thaan-slips/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('thaan-slips')
          .upload(filePath, thaanFile);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('thaan-slips')
          .getPublicUrl(filePath);
        
        thaanUrl = publicUrlData.publicUrl;
      }

      // 2. Update Batch Status
      const { error: updateError } = await supabase
        .from('batches')
        .update({
          transfer_confirmed_by_customer: true,
          confirmation_date: confirmDate,
          status: 'Success'
        })
        .eq('id', batch.id);

      if (updateError) throw updateError;

      // 3. Create Thaan Slip Record
      if (thaanUrl) {
        await supabase
          .from('thaan_slips')
          .insert([{
            batch_id: batch.id,
            doc_url: thaanUrl,
            is_signed: true,
            signed_at: new Date(confirmDate).toISOString()
          }]);
      }

      setShowConfirmModal(false);
      await fetchFinancialData(true);
      if (onUpdate) onUpdate();

    } catch (err) {
      console.error("Confirmation error:", err);
      alert("Failed to confirm receipt. Check console for details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-12 flex flex-col items-center justify-center space-y-4 shadow-sm">
        <Loader2 className="animate-spin text-slate-400" size={32} />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Calculating Accruals...</p>
      </div>
    );
  }

  if (!batch) return null;

  const isInternal = batch.asset?.ownership_type === 'Internal';
  const isConfirmed = batch.transfer_confirmed_by_customer;
  const isRental = batch.asset?.billing_model === 'Daily Rental (Supermarket)';

  const getStatus = () => {
    if (isInternal) return { label: 'Non-Billable', color: 'bg-slate-100 text-slate-500', icon: <ShieldCheck size={12} /> };
    if (isConfirmed) return { label: 'Settled/Stopped', color: 'bg-emerald-100 text-emerald-600', icon: <CheckCircle2 size={12} /> };
    if (isRental) return { label: 'Accruing', color: 'bg-amber-100 text-amber-600', icon: <TrendingUp size={12} /> };
    return { label: 'Pending', color: 'bg-blue-100 text-blue-600', icon: <Clock size={12} /> };
  };

  const status = getStatus();
  const startDate = new Date(batch.transaction_date || batch.created_at);
  const endDate = isConfirmed ? new Date(batch.confirmation_date!) : new Date();
  const durationDays = Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

  const formatCurrency = (val: number | string | undefined | null) => {
    const num = Number(val);
    if (isNaN(num)) return '0.00';
    return num.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden group transition-all hover:border-slate-300">
      {/* Header Section */}
      <div className="px-8 py-6 bg-slate-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-slate-800 rounded-2xl border border-slate-700">
            <DollarSign className="text-emerald-400" size={24} />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase tracking-widest">Financial Detail</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Batch #{batch.id}</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${status.color}`}>
          {status.icon}
          {status.label}
        </div>
      </div>

      <div className="p-8 space-y-8">
        {/* Main Liability Display */}
        <div className="flex flex-col md:flex-row items-end justify-between gap-6">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Accrued Liability</p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black text-slate-900 tracking-tighter">R {formatCurrency(accrual)}</span>
              {isRefreshing && <Loader2 className="animate-spin text-slate-300" size={20} />}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2 text-slate-500">
              <Building2 size={14} />
              <span className="text-xs font-bold uppercase tracking-widest">Custodian Branch</span>
            </div>
            <p className="text-sm font-black text-slate-900 uppercase">{batch.location?.branch_name || 'Unknown Branch'}</p>
          </div>
        </div>

        {/* Cost Breakdown Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <BreakdownItem 
            icon={<Calendar size={14} className="text-blue-500" />} 
            label="Start Date" 
            value={startDate.toISOString().split('T')[0]} 
          />
          <BreakdownItem 
            icon={<CheckCircle2 size={14} className={`${isConfirmed ? 'text-emerald-500' : 'text-slate-300'}`} />} 
            label="End Date" 
            value={isConfirmed ? batch.confirmation_date! : 'Ongoing'} 
          />
          <BreakdownItem 
            icon={<Clock size={14} className="text-amber-500" />} 
            label="Duration" 
            value={`${durationDays} Days`} 
          />
          <BreakdownItem 
            icon={<Zap size={14} className="text-emerald-500" />} 
            label="Daily Rate" 
            value={`R ${dailyRate.toFixed(2)}`} 
          />
        </div>

        {/* Actions Section */}
        {!isInternal && !isConfirmed && (
          <div className="pt-6 border-t border-slate-100">
            <button 
              onClick={() => setShowConfirmModal(true)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-3 group"
            >
              <CheckCircle2 size={18} className="group-hover:scale-110 transition-transform" />
              CONFIRM CUSTOMER RECEIPT
            </button>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center mt-4 flex items-center justify-center gap-2">
              <AlertCircle size={12} /> This will stop the daily rental accrual
            </p>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 bg-slate-900 text-white flex items-center justify-between">
              <h4 className="font-black text-xs uppercase tracking-widest">Confirm Receipt</h4>
              <button onClick={() => setShowConfirmModal(false)} className="text-slate-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Confirmation Date</label>
                <input 
                  type="date" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900"
                  value={confirmDate}
                  onChange={e => setConfirmDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Final Signed THAAN Slip</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-slate-900 hover:bg-slate-50 transition-all group"
                >
                  <div className="p-3 bg-slate-100 rounded-xl group-hover:bg-slate-900 group-hover:text-white transition-all">
                    <Upload size={20} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {thaanFile ? thaanFile.name : 'Click to upload POD'}
                  </p>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*,.pdf"
                    onChange={e => setThaanFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>

              <button 
                onClick={handleConfirmReceipt}
                disabled={isSubmitting}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-black py-4 rounded-2xl shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
                FINALIZE & STOP ACCRUAL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const BreakdownItem: React.FC<{ icon: React.ReactNode, label: string, value: string }> = ({ icon, label, value }) => (
  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
      {icon}
      {label}
    </div>
    <p className="text-sm font-black text-slate-800">{value}</p>
  </div>
);

export default BatchFinancialDetailCard;
