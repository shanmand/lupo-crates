
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { supabase } from './supabase';
import { Location, Truck, Driver, AssetMaster, Batch, BusinessParty, Trip, LocationType } from './types';

interface MasterDataContextType {
  locations: Location[];
  businessParties: BusinessParty[];
  trucks: Truck[];
  drivers: Driver[];
  assets: AssetMaster[];
  batches: Batch[];
  trips: Trip[];
  activeShifts: { driver_id: string; truck_id: string }[];
  isLoading: boolean;
  allSources: any[];
  refreshLocations: () => Promise<void>;
  refreshBusinessParties: () => Promise<void>;
  refreshTrucks: () => Promise<void>;
  refreshDrivers: () => Promise<void>;
  refreshAssets: () => Promise<void>;
  refreshBatches: () => Promise<void>;
  refreshTrips: () => Promise<void>;
  refreshShifts: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const MasterDataContext = createContext<MasterDataContextType | undefined>(undefined);

export const MasterDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [businessParties, setBusinessParties] = useState<BusinessParty[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [assets, setAssets] = useState<AssetMaster[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeShifts, setActiveShifts] = useState<{ driver_id: string; truck_id: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLocations = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('name');
      if (error) throw error;
      if (data) setLocations(data);
    } catch (err: any) {
      console.error('Error fetching locations:', err);
      setError(err.message);
    }
  }, []);

  const fetchBusinessParties = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('business_parties')
        .select('*')
        .order('name');
      if (error) throw error;
      if (data) setBusinessParties(data);
    } catch (err: any) {
      console.error('Error fetching business parties:', err);
      setError(err.message);
    }
  }, []);

  const fetchTrucks = useCallback(async () => {
    const { data, error } = await supabase
      .from('trucks')
      .select('*')
      .order('plate_number');
    if (!error && data) setTrucks(data);
  }, []);

  const fetchDrivers = useCallback(async () => {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('is_active', true)
      .order('full_name');
    if (!error && data) setDrivers(data);
  }, []);

  const fetchAssets = useCallback(async () => {
    const { data, error } = await supabase
      .from('asset_master')
      .select('*')
      .order('name');
    if (!error && data) setAssets(data);
  }, []);

  const fetchBatches = useCallback(async () => {
    const { data, error } = await supabase
      .from('batches')
      .select('*')
      .neq('status', 'Settled')
      .order('created_at', { ascending: false });
    if (!error && data) setBatches(data);
  }, []);

  const fetchTrips = useCallback(async () => {
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .in('status', ['Planned', 'In Progress'])
      .order('created_at', { ascending: false });
    if (!error && data) setTrips(data);
  }, []);

  const fetchShifts = useCallback(async () => {
    const { data, error } = await supabase
      .from('driver_shifts')
      .select('driver_id, truck_id')
      .is('end_time', null);
    if (!error && data) setActiveShifts(data);
  }, []);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await Promise.all([
        fetchLocations(),
        fetchBusinessParties(),
        fetchTrucks(),
        fetchDrivers(),
        fetchAssets(),
        fetchBatches(),
        fetchTrips(),
        fetchShifts()
      ]);
    } catch (err: any) {
      console.error('Error refreshing all master data:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [fetchLocations, fetchBusinessParties, fetchTrucks, fetchDrivers, fetchAssets, fetchBatches, fetchTrips, fetchShifts]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const allSources = useMemo(() => {
    const locSources = locations.map(l => ({
      id: l.id,
      name: l.name,
      partner_type: l.partner_type,
      branch_id: l.branch_id,
      type: l.type,
      category: l.category,
      address: l.address,
      display_name: `${l.name} (${l.partner_type})`,
      sort_group: (l.partner_type === 'Internal' || l.category === 'Home') && l.type !== LocationType.IN_TRANSIT ? 1 : (l.type === LocationType.IN_TRANSIT ? 3 : 2),
      source_table: 'Location'
    }));

    const partySources = businessParties.map(p => ({
      id: p.id,
      name: p.name,
      partner_type: p.party_type,
      branch_id: null,
      type: p.party_type,
      category: 'External',
      address: p.address,
      display_name: `${p.name} (${p.party_type})`,
      sort_group: 2,
      source_table: 'BusinessParty'
    }));

    return [...locSources, ...partySources].sort((a, b) => {
      if (a.sort_group !== b.sort_group) return a.sort_group - b.sort_group;
      return a.name.localeCompare(b.name);
    });
  }, [locations, businessParties]);

  const value = useMemo(() => ({
    locations,
    businessParties,
    trucks,
    drivers,
    assets,
    batches,
    trips,
    activeShifts,
    isLoading,
    allSources,
    refreshLocations: fetchLocations,
    refreshBusinessParties: fetchBusinessParties,
    refreshTrucks: fetchTrucks,
    refreshDrivers: fetchDrivers,
    refreshAssets: fetchAssets,
    refreshBatches: fetchBatches,
    refreshTrips: fetchTrips,
    refreshShifts: fetchShifts,
    refreshAll
  }), [
    locations, businessParties, trucks, drivers, assets, batches, trips, activeShifts, isLoading, allSources,
    fetchLocations, fetchBusinessParties, fetchTrucks, fetchDrivers, fetchAssets, fetchBatches, fetchTrips, fetchShifts, refreshAll
  ]);

  return (
    <MasterDataContext.Provider value={value}>
      {children}
    </MasterDataContext.Provider>
  );
};

export const useMasterData = () => {
  const context = useContext(MasterDataContext);
  if (context === undefined) {
    throw new Error('useMasterData must be used within a MasterDataProvider');
  }
  return context;
};
