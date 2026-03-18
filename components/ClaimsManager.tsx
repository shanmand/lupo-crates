
import React, { useState, useEffect } from 'react';
import { MOCK_CLAIMS, MOCK_BATCHES, MOCK_CLAIM_AUDITS } from '../constants';
import { AlertCircle, Clock, CheckCircle2, History as HistoryIcon, User as UserIcon, FileText, ChevronRight, XCircle, Search, ShieldAlert, Loader2, Truck as TruckIcon, Info } from 'lucide-react';
import { ClaimStatus, Claim, Batch, ClaimAudit, Truck, Driver } from '../types';
import { supabase, isSupabaseConfigured } from '../supabase';

interface ClaimsManagerProps {
  isManager: boolean;
}

const ClaimsManager: React.FC<ClaimsManagerProps> = ({ isManager }) => {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [disputedBatches, setDisputedBatches] = useState<any[]>([]);
  const [audits, setAudits] = useState<ClaimAudit[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClaimId, setSelectedClaimId] = useState<string>('');
  const [activeView, setActiveView] = useState<'claims' | 'disputed'>('claims');

  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured) {
        setClaims([]);
        setBatches([]);
        setDisputedBatches([]);
        setAudits([]);
        setTrucks([]);
        setDrivers([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const [cRes, bRes, aRes, tRes, dRes, dbRes] = await Promise.all([
          supabase.from('claims').select('*'),
          supabase.from('batches').select('*'),
          supabase.from('claim_audits').select('*'),
          supabase.from('trucks').select('*'),
          supabase.from('drivers').select('*'),
          supabase.from('vw_global_inventory_tracker').select('*').eq('batch_status', 'Disputed')
        ]);

        if (cRes.data) {
          setClaims(cRes.data);
          if (cRes.data.length > 0) setSelectedClaimId(cRes.data[0].id);
        }
        if (bRes.data) setBatches(bRes.data);
        if (aRes.data) setAudits(aRes.data);
        if (tRes.data) setTrucks(tRes.data);
        if (dRes.data) setDrivers(dRes.data);
        if (dbRes.data) setDisputedBatches(dbRes.data);
      } catch (err) {
        console.error("Claims Fetch Error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleResolveDispute = async (batchId: string) => {
    if (!isSupabaseConfigured) return;
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('batches')
        .update({ status: 'Confirmed' }) // Assuming 'Confirmed' resolves the dispute
        .eq('id', batchId);
      
      if (error) throw error;
      alert(`Batch #${batchId} dispute resolved.`);
      window.location.reload();
    } catch (err: any) {
      alert("Error resolving dispute: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedClaim = claims.find(c => c.id === selectedClaimId);
  const auditLogs = audits.filter(a => a.claim_id === selectedClaimId);
  const driver = selectedClaim ? drivers.find(d => d.id === selectedClaim.driver_id) : null;
  const truck = selectedClaim ? trucks.find(t => t.id === selectedClaim.truck_id) : null;

  const handlePauseRental = async () => {
    if (!selectedClaim || !isSupabaseConfigured) return;
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('batches')
        .update({ transfer_confirmed_by_customer: true, confirmation_date: new Date().toISOString() })
        .eq('id', selectedClaim.batch_id);
      
      if (error) throw error;

      // Add audit log for the pause
      await supabase.from('claim_audits').insert([{
        claim_id: selectedClaim.id,
        status_from: selectedClaim.status,
        status_to: 'Under Assessment',
        notes: 'Rental paused pending dispute investigation.',
        updated_by: 'System'
      }]);

      alert("Rental paused for Batch #" + selectedClaim.batch_id);
      // Refresh data
      window.location.reload();
    } catch (err: any) {
      alert("Error pausing rental: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveClaim = async () => {
    if (!selectedClaim || !isSupabaseConfigured) return;
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('claims')
        .update({ status: 'Accepted' })
        .eq('id', selectedClaim.id);
      
      if (error) throw error;

      await supabase.from('claim_audits').insert([{
        claim_id: selectedClaim.id,
        status_from: selectedClaim.status,
        status_to: 'Accepted',
        notes: 'Claim approved. Credit processed for supplier.',
        updated_by: 'Manager',
        timestamp: new Date().toISOString()
      }]);

      alert("Claim approved successfully.");
      window.location.reload();
    } catch (err: any) {
      alert("Error approving claim: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRejectClaim = async () => {
    if (!selectedClaim || !isSupabaseConfigured) return;
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('claims')
        .update({ status: 'Rejected' })
        .eq('id', selectedClaim.id);
      
      if (error) throw error;

      await supabase.from('claim_audits').insert([{
        claim_id: selectedClaim.id,
        status_from: selectedClaim.status,
        status_to: 'Rejected',
        notes: 'Claim rejected after assessment.',
        updated_by: 'Manager',
        timestamp: new Date().toISOString()
      }]);

      alert("Claim rejected.");
      window.location.reload();
    } catch (err: any) {
      alert("Error rejecting claim: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const workflow: ClaimStatus[] = ['Lodged', 'Under Assessment', 'Returned for Assessment', 'Accepted', 'Rejected'];

  const formatCurrency = (val: number) => val.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  if (claims.length === 0) {
    return (
      <div className="p-20 text-center bg-white rounded-2xl border border-slate-200 border-dashed">
        <FileText className="mx-auto text-slate-200 mb-4" size={48} />
        <h3 className="font-bold text-slate-800 uppercase tracking-widest">No Claims Found</h3>
        <p className="text-sm text-slate-500 mt-2">All system claims have been cleared or none have been lodged.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Disputed Liability</p>
            <p className="text-2xl font-bold text-amber-600">R {formatCurrency(claims.filter(c => c.status !== 'Accepted').reduce((acc, c) => acc + c.amount_claimed_zar, 0))}</p>
            <p className="text-[10px] text-slate-400 font-medium">Still accruing fees</p>
          </div>
          <div className="p-3 bg-amber-100 text-amber-600 rounded-full">
            <Clock size={24} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Approved Credits</p>
            <p className="text-2xl font-bold text-emerald-600">R {formatCurrency(claims.filter(c => c.status === 'Accepted').reduce((acc, c) => acc + c.amount_claimed_zar, 0))}</p>
            <p className="text-[10px] text-slate-400 font-medium">Claims accepted by Supplier</p>
          </div>
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full">
            <CheckCircle2 size={24} />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Net Supplier Balance</p>
            <p className="text-2xl font-bold text-slate-800">R {formatCurrency(321400.00)}</p>
            <p className="text-[10px] text-slate-400 font-medium">Final payable amount</p>
          </div>
          <div className="p-3 bg-slate-100 text-slate-600 rounded-full">
            <FileText size={24} />
          </div>
        </div>
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

      <div className="flex gap-4 border-b border-slate-200 mb-6">
        <button 
          onClick={() => setActiveView('claims')}
          className={`pb-4 px-2 text-sm font-black uppercase tracking-widest transition-all ${activeView === 'claims' ? 'text-amber-600 border-b-2 border-amber-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Active Claims ({claims.length})
        </button>
        <button 
          onClick={() => setActiveView('disputed')}
          className={`pb-4 px-2 text-sm font-black uppercase tracking-widest transition-all ${activeView === 'disputed' ? 'text-amber-600 border-b-2 border-amber-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Disputed Batches ({disputedBatches.length})
        </button>
      </div>

      {activeView === 'disputed' ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h3 className="font-black text-slate-800 uppercase tracking-tight">Disputed Inventory Batches</h3>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Batches flagged for variance or damage during intake</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Batch ID</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Liability (Daily)</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {disputedBatches.map(batch => (
                  <tr key={batch.batch_id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-4 font-black text-slate-800">#{batch.batch_id}</td>
                    <td className="px-8 py-4 text-xs text-slate-600">{batch.current_location}</td>
                    <td className="px-8 py-4 text-xs font-black text-slate-800">{batch.quantity} Units</td>
                    <td className="px-8 py-4 text-xs font-black text-amber-600">R {formatCurrency(batch.daily_accrued_liability)}</td>
                    <td className="px-8 py-4 text-right">
                      <button 
                        onClick={() => handleResolveDispute(batch.batch_id)}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-sm"
                      >
                        Resolve Dispute
                      </button>
                    </td>
                  </tr>
                ))}
                {disputedBatches.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center text-slate-400 italic">No disputed batches found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Claims List */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm h-fit">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-slate-800 text-sm">Active Claims</h3>
            <Search size={16} className="text-slate-400" />
          </div>
          <div className="divide-y divide-slate-50">
            {claims.map(claim => (
              <button 
                key={claim.id}
                onClick={() => setSelectedClaimId(claim.id)}
                className={`w-full p-4 text-left transition-colors flex items-center justify-between group ${selectedClaimId === claim.id ? 'bg-amber-50' : 'hover:bg-slate-50'}`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 text-sm">{claim.id}</span>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-widest ${claim.status === 'Accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {claim.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Batch {claim.batch_id} • {claim.type}</p>
                </div>
                <ChevronRight size={16} className={`text-slate-300 group-hover:text-amber-500 transition-colors ${selectedClaimId === claim.id ? 'text-amber-500' : ''}`} />
              </button>
            ))}
          </div>
        </div>

        {/* Workflow & Audit Detail */}
        <div className="lg:col-span-2 space-y-6">
          {selectedClaim ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Workflow: {selectedClaim.id}</h3>
                  <p className="text-sm text-slate-500">Lodged by Crates Dept on {new Date(selectedClaim.created_at).toLocaleString('en-ZA')}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-400 uppercase">Estimated Credit</p>
                  <p className="text-2xl font-bold text-emerald-600">R {formatCurrency(selectedClaim.amount_claimed_zar)}</p>
                </div>
              </div>

              {/* Stepper */}
              <div className="flex items-center justify-between mb-12 relative">
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -translate-y-1/2 z-0" />
                {workflow.map((step, i) => {
                  const isCompleted = workflow.indexOf(selectedClaim.status as any) >= i || selectedClaim.status === 'Accepted';
                  const isCurrent = selectedClaim.status === step;
                  return (
                    <div key={step} className="relative z-10 flex flex-col items-center gap-2">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                        isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-200 text-slate-300'
                      } ${isCurrent ? 'ring-4 ring-emerald-100' : ''}`}>
                        {isCompleted ? <CheckCircle2 size={18} /> : <span>{i + 1}</span>}
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-tighter text-center max-w-[80px] ${isCompleted ? 'text-slate-800' : 'text-slate-400'}`}>
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Audit Log */}
              <div className="border-t border-slate-100 pt-8">
                <h4 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <HistoryIcon size={18} className="text-slate-400" />
                  Workflow Audit Log
                </h4>
                <div className="space-y-6 relative pl-4 border-l border-slate-100">
                  {auditLogs.map(log => (
                    <div key={log.id} className="relative">
                      <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-slate-300 ring-4 ring-white" />
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{new Date(log.timestamp).toLocaleString('en-ZA')}</p>
                          <p className="text-sm font-bold text-slate-800">
                            {log.status_from} &rarr; <span className="text-emerald-600">{log.status_to}</span>
                          </p>
                          <p className="text-xs text-slate-500 mt-1">{log.notes}</p>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">
                          <UserIcon size={10} /> {log.updated_by}
                        </div>
                      </div>
                    </div>
                  ))}
                  {auditLogs.length === 0 && <p className="text-xs text-slate-400 italic">No audit history for this claim.</p>}
                </div>
              </div>
                           {/* Actions */}
              {isManager && selectedClaim.status !== 'Accepted' && selectedClaim.status !== 'Rejected' ? (
                <div className="mt-8 space-y-3">
                  <div className="flex gap-3">
                    <button 
                      onClick={handleApproveClaim}
                      className="flex-1 py-3 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                    >
                        <CheckCircle2 size={18} /> Approve Claim (Process Credit)
                    </button>
                    <button 
                      onClick={handleRejectClaim}
                      className="flex-1 py-3 border-2 border-rose-500 text-rose-500 rounded-lg font-bold text-sm hover:bg-rose-50 transition-all flex items-center justify-center gap-2"
                    >
                        <XCircle size={18} /> Reject Claim
                    </button>
                  </div>
                  <button 
                    onClick={handlePauseRental}
                    className="w-full py-3 bg-amber-500 text-white rounded-lg font-bold text-sm hover:bg-amber-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-100"
                  >
                    <Clock size={18} /> Pause Daily Rental (Dispute Investigation)
                  </button>
                </div>
              ) : (
                <div className="mt-8 bg-slate-50 p-6 rounded-xl border border-slate-100 flex items-center gap-4">
                  <ShieldAlert className="text-slate-400" size={24} />
                  <p className="text-sm text-slate-500 italic">
                    {selectedClaim.status === 'Accepted' ? 'This claim has been approved and finalized.' : 
                     selectedClaim.status === 'Rejected' ? 'This claim has been rejected.' :
                     'Claims must be approved by a Crates Manager before being finalized for the supplier.'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-20 text-center shadow-sm">
              <p className="text-slate-400 italic">Select a claim to view details.</p>
            </div>
          )}
        </div>
      </div>
    )}
  </div>
  );
};

export default ClaimsManager;
