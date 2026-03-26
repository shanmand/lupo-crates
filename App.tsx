
import React, { useState } from 'react';
import { 
  Package, 
  MapPin, 
  Truck, 
  History as HistoryIcon, 
  Search,
  ChevronRight,
  TrendingUp,
  LayoutDashboard,
  Globe,
  BarChart3,
  DollarSign,
  Skull,
  Receipt,
  UserCircle,
  ShieldCheck,
  Building2,
  Users as UsersIcon,
  LogOut,
  LogIn,
  Lock,
  ClipboardList,
  ClipboardCheck,
  AlertTriangle,
  Flame,
  Settings,
  Database,
  Gavel,
  Tags,
  ArrowDownToLine,
  Clock,
  Smartphone,
  FileText,
  Navigation
} from 'lucide-react';
import { UserProvider, useUser } from './UserContext';
import { MasterDataProvider } from './MasterDataContext';
import DashboardView from './components/DashboardView';
import SchemaView from './components/SchemaView';
import BatchTracker from './components/BatchTracker';
import AssetList from './components/AssetList';
import ClaimsManager from './components/ClaimsManager';
import LogisticsOps from './components/LogisticsOps';
import CollectionRequests from './components/CollectionRequests';
import InventoryDashboard from './components/InventoryDashboard';
import InventoryMap from './components/InventoryMap';
import FinancialReport from './components/FinancialReport';
import LossRecorder from './components/LossRecorder';
import SupplierSettlementReport from './components/SupplierSettlementReport';
import SupplierRecon from './components/SupplierRecon';
import ExecutiveReport from './components/ExecutiveReport';
import PaymentSettlement from './components/PaymentSettlement';
import UserManagement from './components/UserManagement';
import LocationManagement from './components/LocationManagement';
import SupabaseConnection from './components/SupabaseConnection';
import AdminPanel from './components/AdminPanel';
import LogisticsRegistry from './components/LogisticsRegistry';
import BatchManagement from './components/BatchManagement';
import ReportsView from './components/ReportsView';
import TaskManagement from './components/TaskManagement';
import StockTakeModule from './components/StockTakeModule';
import SettlementModule from './components/SettlementModule';
import LiabilityHeatmap from './components/LiabilityHeatmap';
import PersonnelManagement from './components/PersonnelManagement';
import BusinessDirectory from './components/BusinessDirectory';
import ShiftManagement from './components/ShiftManagement';
import TripAuditTrail from './components/TripAuditTrail';
import FleetCompliance from './components/FleetCompliance';
import FleetExpenseReport from './components/FleetExpenseReport';
import DriverPortal from './components/DriverPortal';
import ManagementReportPack from './components/ManagementReportPack';
import BatchSummaryReport from './components/BatchSummaryReport';
import TripManagement from './components/TripManagement';
import { useBranches } from './useBranches';
import { UserRole, Branch } from './types';
import { supabase } from './supabase';

enum NavItem {
  DASHBOARD = 'dashboard',
  EXECUTIVE_REPORT = 'executive-report',
  INVENTORY = 'inventory',
  INVENTORY_MAP = 'inventory-map',
  FINANCIALS = 'financials',
  SETTLEMENT = 'settlement',
  SUPPLIER_RECON = 'supplier-recon',
  PAYMENT_SETTLEMENT = 'payment-settlement',
  ASSETS = 'assets',
  TRACKER = 'tracker',
  LOGISTICS = 'logistics',
  COLLECTION_REQUESTS = 'collection-requests',
  LOSSES = 'losses',
  CLAIMS = 'claims',
  SCHEMA = 'schema',
  USERS = 'users',
  LOCATIONS = 'locations',
  CONNECT = 'connect',
  ADMIN = 'admin-panel',
  LOGISTICS_REGISTRY = 'logistics-registry',
  BATCH_MANAGEMENT = 'batch-management',
  REPORTS = 'reports',
  TASKS = 'tasks',
  STOCK_TAKE = 'stock-take',
  FINANCE_SETTLEMENT = 'finance-settlement',
  LIABILITY_HEATMAP = 'liability-heatmap',
  PERSONNEL = 'personnel',
  SHIFTS = 'shifts',
  COMPLIANCE = 'compliance',
  FLEET_REPORT = 'fleet-report',
  DRIVER_PORTAL = 'driver-portal',
  MANAGEMENT_REPORT = 'management-report',
  BUSINESS_DIRECTORY = 'business-directory',
  BATCH_SUMMARY_REPORT = 'batch-summary-report',
  TRIP_AUDIT = 'trip-audit',
  TRIP_MANAGEMENT = 'trip-management'
}

const AppContent: React.FC = () => {
  console.log('AppContent Rendering...');
  const { user, profile, isLoading: isUserLoading, logout, hasPermission } = useUser();
  const { branches: dbBranches, isLoading: isBranchesLoading } = useBranches();
  const [activeTab, setActiveTab] = useState<NavItem>(NavItem.DASHBOARD);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('Consolidated');
  const [preselectedStockTakeLocation, setPreselectedStockTakeLocation] = useState<string | undefined>(undefined);
  const [pendingAssignment, setPendingAssignment] = useState<{customerId: string, assetId: string, quantity: number, requestId: string} | null>(null);

  const currentBranchContext = profile?.role_name === UserRole.MANAGER 
    ? (profile.home_branch_name.includes('JHB') ? 'Kya Sands' : 'Durban') 
    : selectedBranchFilter;

  if (isUserLoading || isBranchesLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-amber-500 font-black uppercase tracking-widest text-xs">Syncing Developer Profile...</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    // Explicit module rendering
    switch (activeTab) {
      case NavItem.DASHBOARD: return <DashboardView currentUser={{id: profile?.id || 'dev', name: profile?.full_name || 'Dev', role: profile?.role_name || UserRole.ADMIN, branch_id: profile?.home_branch_name || 'Kya Sands'}} branchContext={currentBranchContext as any} onDrillDown={() => setActiveTab(NavItem.REPORTS)} onSchemaFix={() => setActiveTab(NavItem.SCHEMA)} />;
      case NavItem.EXECUTIVE_REPORT: return <ExecutiveReport onNavigate={(tab) => setActiveTab(tab as NavItem)} />;
      case NavItem.INVENTORY: return <InventoryDashboard currentUser={{id: profile?.id || 'dev', name: profile?.full_name || 'Dev', role: profile?.role_name || UserRole.ADMIN, branch_id: profile?.home_branch_name || 'Kya Sands'}} />;
      case NavItem.INVENTORY_MAP: return <InventoryMap />;
      case NavItem.FINANCIALS: return <FinancialReport branchContext={currentBranchContext as any} />;
      case NavItem.SETTLEMENT: return <SupplierSettlementReport isAdmin={profile?.role_name === UserRole.ADMIN} />;
      case NavItem.SUPPLIER_RECON: return <SupplierRecon />;
      case NavItem.PAYMENT_SETTLEMENT: return <PaymentSettlement currentUser={{id: profile?.id || 'dev', name: profile?.full_name || 'Dev', role: profile?.role_name || UserRole.ADMIN, branch_id: profile?.home_branch_name || 'Kya Sands'}} />;
      case NavItem.ASSETS: return <AssetList currentUser={{id: profile?.id || 'dev', name: profile?.full_name || 'Dev', role: profile?.role_name || UserRole.ADMIN, branch_id: profile?.home_branch_name || 'Kya Sands'}} isAdmin={profile?.role_name === UserRole.ADMIN} />;
      case NavItem.TRACKER: return <BatchTracker selectedBranchId={dbBranches.find(b => b.name === currentBranchContext)?.id} />;
      case NavItem.LOGISTICS: return <LogisticsOps currentUser={{id: profile?.id || 'dev', name: profile?.full_name || 'Dev', role: profile?.role_name || UserRole.ADMIN, branch_id: profile?.home_branch_name || 'Kya Sands'}} initialCollectionRequest={pendingAssignment || undefined} onNavigate={(tab) => setActiveTab(tab as NavItem)} />;
      case NavItem.COLLECTION_REQUESTS: return (
        <CollectionRequests 
          currentUser={{id: profile?.id || 'dev', name: profile?.full_name || 'Dev', role: profile?.role_name || UserRole.ADMIN, branch_id: profile?.home_branch_name || 'Kya Sands'}} 
          onAssign={(req) => {
            setPendingAssignment({
              customerId: req.customer_id,
              assetId: req.asset_id,
              quantity: req.estimated_quantity,
              requestId: req.id
            });
            setActiveTab(NavItem.LOGISTICS);
          }}
        />
      );
      case NavItem.LOSSES: return <LossRecorder currentUser={{id: profile?.id || 'dev', name: profile?.full_name || 'Dev', role: profile?.role_name || UserRole.ADMIN, branch_id: profile?.home_branch_name || 'Kya Sands'}} />;
      case NavItem.CLAIMS: return <ClaimsManager isManager={profile?.role_name === UserRole.MANAGER || profile?.role_name === UserRole.ADMIN} />;
      case NavItem.SCHEMA: return <SchemaView />;
      case NavItem.USERS: return <UserManagement />;
      case NavItem.LOCATIONS: return <LocationManagement />;
      case NavItem.CONNECT: return <SupabaseConnection />;
      case NavItem.ADMIN: return <AdminPanel currentRole={profile?.role_name || UserRole.ADMIN} />;
      case NavItem.LOGISTICS_REGISTRY: return <LogisticsRegistry />;
      case NavItem.BATCH_MANAGEMENT: return <BatchManagement />;
      case NavItem.REPORTS: return <ReportsView />;
      case NavItem.TASKS: return <TaskManagement onStartStockTake={(locId) => { setPreselectedStockTakeLocation(locId); setActiveTab(NavItem.STOCK_TAKE); }} />;
      case NavItem.STOCK_TAKE: return <StockTakeModule currentUser={{id: profile?.id || 'dev', name: profile?.full_name || 'Dev', role: profile?.role_name || UserRole.ADMIN, branch_id: profile?.home_branch_name || 'Kya Sands'}} initialLocationId={preselectedStockTakeLocation} />;
      case NavItem.FINANCE_SETTLEMENT: return <SettlementModule currentUser={{id: profile?.id || 'dev', name: profile?.full_name || 'Dev', role: profile?.role_name || UserRole.ADMIN, branch_id: profile?.home_branch_name || 'Kya Sands'}} />;
      case NavItem.LIABILITY_HEATMAP: return <LiabilityHeatmap />;
      case NavItem.PERSONNEL: return <PersonnelManagement />;
      case NavItem.SHIFTS: return <ShiftManagement />;
      case NavItem.COMPLIANCE: return <FleetCompliance />;
      case NavItem.FLEET_REPORT: return <FleetExpenseReport />;
      case NavItem.DRIVER_PORTAL: return <DriverPortal />;
      case NavItem.MANAGEMENT_REPORT: return <ManagementReportPack />;
      case NavItem.BUSINESS_DIRECTORY: return <BusinessDirectory />;
      case NavItem.BATCH_SUMMARY_REPORT: return <BatchSummaryReport />;
      case NavItem.TRIP_AUDIT: return <TripAuditTrail />;
      case NavItem.TRIP_MANAGEMENT: return <TripManagement />;
      default: return <DashboardView currentUser={{id: profile?.id || 'dev', name: profile?.full_name || 'Dev', role: profile?.role_name || UserRole.ADMIN, branch_id: profile?.home_branch_name || 'Kya Sands'}} branchContext={currentBranchContext as any} onDrillDown={() => setActiveTab(NavItem.REPORTS)} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col fixed h-full z-10 shadow-2xl print:hidden">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="bg-amber-500 p-2 rounded-lg shadow-lg"><Package className="text-white w-6 h-6" /></div>
          <div><h1 className="font-black text-xl leading-tight">SHUKU</h1><p className="text-[10px] text-amber-400 font-bold uppercase tracking-tighter">Lupo Bakery Pro</p></div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <div className="pb-2 px-4 font-black text-[10px] text-slate-500 uppercase tracking-widest">Overview</div>
          <SidebarButton active={activeTab === NavItem.DASHBOARD} onClick={() => setActiveTab(NavItem.DASHBOARD)} icon={<LayoutDashboard size={18} />} label="Dashboard" />
          <SidebarButton active={activeTab === NavItem.EXECUTIVE_REPORT} onClick={() => setActiveTab(NavItem.EXECUTIVE_REPORT)} icon={<BarChart3 size={18} />} label="Executive Report" />
          <SidebarButton active={activeTab === NavItem.FINANCIALS} onClick={() => setActiveTab(NavItem.FINANCIALS)} icon={<TrendingUp size={18} />} label="Branch Health" />
          <SidebarButton active={activeTab === NavItem.REPORTS} onClick={() => setActiveTab(NavItem.REPORTS)} icon={<BarChart3 size={18} />} label="Logistics Intelligence" />
          <SidebarButton active={activeTab === NavItem.MANAGEMENT_REPORT} onClick={() => setActiveTab(NavItem.MANAGEMENT_REPORT)} icon={<FileText size={18} />} label="Management Report Pack" />
          <SidebarButton active={activeTab === NavItem.BATCH_SUMMARY_REPORT} onClick={() => setActiveTab(NavItem.BATCH_SUMMARY_REPORT)} icon={<BarChart3 size={18} />} label="Batch Summary Report" />

          <div className="pt-4 pb-2 px-4 font-black text-[10px] text-slate-500 uppercase tracking-widest">Logistics & Ops</div>
          <SidebarButton active={activeTab === NavItem.LOGISTICS} onClick={() => { setPendingAssignment(null); setActiveTab(NavItem.LOGISTICS); }} icon={<ClipboardList size={18} />} label="Logistics Ops" />
          <SidebarButton active={activeTab === NavItem.TRIP_MANAGEMENT} onClick={() => setActiveTab(NavItem.TRIP_MANAGEMENT)} icon={<Navigation size={18} />} label="Trip Planning" />
          <SidebarButton active={activeTab === NavItem.TRACKER} onClick={() => setActiveTab(NavItem.TRACKER)} icon={<HistoryIcon size={18} />} label="Batch Forensic" />
          <SidebarButton active={activeTab === NavItem.TRIP_AUDIT} onClick={() => setActiveTab(NavItem.TRIP_AUDIT)} icon={<HistoryIcon size={18} />} label="Trip Audit Trail" />
          <SidebarButton active={activeTab === NavItem.COLLECTION_REQUESTS} onClick={() => setActiveTab(NavItem.COLLECTION_REQUESTS)} icon={<ArrowDownToLine size={18} />} label="Collection Requests" />
          <SidebarButton active={activeTab === NavItem.BATCH_MANAGEMENT} onClick={() => setActiveTab(NavItem.BATCH_MANAGEMENT)} icon={<ArrowDownToLine size={18} />} label="Inventory Intake" />
          <SidebarButton active={activeTab === NavItem.TASKS} onClick={() => setActiveTab(NavItem.TASKS)} icon={<ClipboardList size={18} />} label="Task Management" />
          <SidebarButton active={activeTab === NavItem.DRIVER_PORTAL} onClick={() => setActiveTab(NavItem.DRIVER_PORTAL)} icon={<Smartphone size={18} />} label="Driver Portal" />

          <div className="pt-4 pb-2 px-4 font-black text-[10px] text-slate-500 uppercase tracking-widest">Inventory & Assets</div>
          <SidebarButton active={activeTab === NavItem.INVENTORY} onClick={() => setActiveTab(NavItem.INVENTORY)} icon={<Globe size={18} />} label="Inventory" />
          <SidebarButton active={activeTab === NavItem.INVENTORY_MAP} onClick={() => setActiveTab(NavItem.INVENTORY_MAP)} icon={<MapPin size={18} />} label="Inventory Map" />
          <SidebarButton active={activeTab === NavItem.ASSETS} onClick={() => setActiveTab(NavItem.ASSETS)} icon={<Tags size={18} />} label="Asset Master" />
          <SidebarButton active={activeTab === NavItem.STOCK_TAKE} onClick={() => setActiveTab(NavItem.STOCK_TAKE)} icon={<ClipboardCheck size={18} />} label="Stock Take Recon" />
          <SidebarButton active={activeTab === NavItem.LOSSES} onClick={() => setActiveTab(NavItem.LOSSES)} icon={<Skull size={18} />} label="Record a Loss" />

          <div className="pt-4 pb-2 px-4 font-black text-[10px] text-slate-500 uppercase tracking-widest">Finance & Claims</div>
          <SidebarButton active={activeTab === NavItem.SETTLEMENT} onClick={() => setActiveTab(NavItem.SETTLEMENT)} icon={<Receipt size={18} />} label="Supplier Settlement" />
          <SidebarButton active={activeTab === NavItem.SUPPLIER_RECON} onClick={() => setActiveTab(NavItem.SUPPLIER_RECON)} icon={<Receipt size={18} />} label="Supplier Recon" />
          <SidebarButton active={activeTab === NavItem.FINANCE_SETTLEMENT} onClick={() => setActiveTab(NavItem.FINANCE_SETTLEMENT)} icon={<Receipt size={18} />} label="Finance Settlement" />
          <SidebarButton active={activeTab === NavItem.PAYMENT_SETTLEMENT} onClick={() => setActiveTab(NavItem.PAYMENT_SETTLEMENT)} icon={<DollarSign size={18} />} label="Payment Settlement" />
          <SidebarButton active={activeTab === NavItem.CLAIMS} onClick={() => setActiveTab(NavItem.CLAIMS)} icon={<Gavel size={18} />} label="Claims Centre" />
          <SidebarButton active={activeTab === NavItem.LIABILITY_HEATMAP} onClick={() => setActiveTab(NavItem.LIABILITY_HEATMAP)} icon={<Flame size={18} />} label="Liability Heatmap" />

          <div className="pt-4 pb-2 px-4 font-black text-[10px] text-slate-500 uppercase tracking-widest">Fleet & Personnel</div>
          <SidebarButton active={activeTab === NavItem.COMPLIANCE} onClick={() => setActiveTab(NavItem.COMPLIANCE)} icon={<ShieldCheck size={18} />} label="Fleet Readiness" />
          <SidebarButton active={activeTab === NavItem.FLEET_REPORT} onClick={() => setActiveTab(NavItem.FLEET_REPORT)} icon={<BarChart3 size={18} />} label="Fleet Expense Report" />
          <SidebarButton active={activeTab === NavItem.PERSONNEL} onClick={() => setActiveTab(NavItem.PERSONNEL)} icon={<UsersIcon size={18} />} label="Personnel Management" />
          <SidebarButton active={activeTab === NavItem.SHIFTS} onClick={() => setActiveTab(NavItem.SHIFTS)} icon={<Clock size={18} />} label="Shift Assignments" />

          <div className="pt-4 pb-2 px-4 font-black text-[10px] text-slate-500 uppercase tracking-widest">Configuration</div>
          <SidebarButton active={activeTab === NavItem.BUSINESS_DIRECTORY} onClick={() => setActiveTab(NavItem.BUSINESS_DIRECTORY)} icon={<Building2 size={18} />} label="Business Directory" />
          <SidebarButton active={activeTab === NavItem.USERS} onClick={() => setActiveTab(NavItem.USERS)} icon={<UsersIcon size={18} />} label="User Management" />
          <SidebarButton active={activeTab === NavItem.LOCATIONS} onClick={() => setActiveTab(NavItem.LOCATIONS)} icon={<MapPin size={18} />} label="Location Registry" />
          <SidebarButton active={activeTab === NavItem.LOGISTICS_REGISTRY} onClick={() => setActiveTab(NavItem.LOGISTICS_REGISTRY)} icon={<Truck size={18} />} label="Logistics Registry" />
          <SidebarButton active={activeTab === NavItem.ADMIN} onClick={() => setActiveTab(NavItem.ADMIN)} icon={<Settings size={18} />} label="Admin Panel" />
          <SidebarButton active={activeTab === NavItem.SCHEMA} onClick={() => setActiveTab(NavItem.SCHEMA)} icon={<Database size={18} />} label="Data Schema" />
          <SidebarButton active={activeTab === NavItem.CONNECT} onClick={() => setActiveTab(NavItem.CONNECT)} icon={<Globe size={18} />} label="Connectivity" />
        </nav>

        <div className="p-4 bg-slate-950/50 border-t border-slate-800">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-xs font-black text-slate-900 shadow-lg">{profile?.full_name?.charAt(0) || 'D'}</div>
              <div>
                <p className="text-xs font-bold truncate text-white">{profile?.full_name || 'Dev User'}</p>
                <p className="text-[9px] text-slate-500 uppercase font-black">{profile?.role_name || 'System Admin'}</p>
              </div>
            </div>
            <button onClick={logout} className="p-2 text-slate-500 hover:text-rose-500 transition-colors"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      <main className="ml-64 flex-1 flex flex-col min-h-screen print:ml-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-20 shadow-sm print:hidden">
          <h2 className="font-black text-sm text-slate-800 uppercase tracking-widest">{activeTab.replace('-', ' ')}</h2>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1 p-1 rounded-xl border bg-slate-100 border-slate-200">
              <div className="flex items-center gap-2 px-3 py-1 text-[10px] font-black uppercase text-slate-400 border-r border-slate-200">
                <Building2 size={14} /> Branch Context
              </div>
              {['Consolidated', ...dbBranches.map(b => b.name)].map(branch => (
                <button
                  key={branch}
                  onClick={() => setSelectedBranchFilter(branch)}
                  className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${currentBranchContext === branch ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {branch}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="p-8">{renderContent()}</div>
      </main>
    </div>
  );
};

const SidebarButton: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${active ? 'bg-amber-500 text-slate-900 shadow-lg font-bold' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
    {icon}
    <span className="text-sm tracking-tight">{label}</span>
    {active && <ChevronRight className="ml-auto" size={12} />}
  </button>
);

const App: React.FC = () => (
  <UserProvider>
    <MasterDataProvider>
      <AppContent />
    </MasterDataProvider>
  </UserProvider>
);

export default App;
