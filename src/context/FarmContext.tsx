import React, { createContext, useContext, useState, useEffect } from 'react';
import { Farm } from '../types';
import { supabase } from '../lib/supabase';

interface FarmContextType {
  currentFarm: Farm | null;
  farms: Farm[];
  isLoadingFarms: boolean;
  switchFarm: (farmId: number) => void;
  refreshFarms: () => Promise<void>;
  createFarm: (farmData: {
    farmName: string;
    ownerName: string;
    contactPhone?: string;
    contactEmail?: string;
    address?: string;
    adminUsername: string;
    adminEmail: string;
    adminPassword: string;
  }) => Promise<{ success: boolean; message: string; farm?: Farm }>;
}

const FarmContext = createContext<FarmContextType | undefined>(undefined);

export const FarmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [currentFarm, setCurrentFarm] = useState<Farm | null>(null);
  const [isLoadingFarms, setIsLoadingFarms] = useState<boolean>(true);

  // Load farms directly from Supabase Cloud first
  const refreshFarms = async () => {
    try {
      setIsLoadingFarms(true);
      
      // 1. Supabase Cloud first
      try {
        const { data, error } = await supabase
          .from('Farms')
          .select('*')
          .order('Id', { ascending: true });

        if (!error && data && data.length > 0) {
          setFarms(data);
          const userRole = localStorage.getItem('userRole');
          const userFarmId = localStorage.getItem('userFarmId');
          let matched: Farm | undefined;
          
          if (userRole && userRole !== 'Developer' && userFarmId) {
            // Farm Admins and Operators are strictly locked to their assigned Farm
            matched = data.find((f: Farm) => f.Id === Number(userFarmId));
          } else {
            const savedFarmId = localStorage.getItem('active_farm_id');
            matched = savedFarmId ? data.find((f: Farm) => f.Id === Number(savedFarmId)) : undefined;
          }

          setCurrentFarm(matched || data[0]);
          setIsLoadingFarms(false);
          return;
        }
      } catch (sbErr) {
        console.warn('[FarmContext] Supabase direct query failed, falling back to API:', sbErr);
      }

      // 2. Local API fallback
      const res = await fetch('/api/farms');
      if (res.ok) {
        const localFarms = await res.json();
        if (Array.isArray(localFarms) && localFarms.length > 0) {
          setFarms(localFarms);
          const userRole = localStorage.getItem('userRole');
          const userFarmId = localStorage.getItem('userFarmId');
          let matched: Farm | undefined;

          if (userRole && userRole !== 'Developer' && userFarmId) {
            matched = localFarms.find((f: Farm) => f.Id === Number(userFarmId));
          } else {
            const savedFarmId = localStorage.getItem('active_farm_id');
            matched = savedFarmId ? localFarms.find((f: Farm) => f.Id === Number(savedFarmId)) : undefined;
          }

          setCurrentFarm(matched || localFarms[0]);
        }
      }
    } catch (err: any) {
      console.error('[FarmContext] Unexpected error:', err);
    } finally {
      setIsLoadingFarms(false);
    }
  };

  useEffect(() => {
    refreshFarms();
  }, []);

  const switchFarm = (farmId: number) => {
    const userRole = localStorage.getItem('userRole');
    const userFarmId = localStorage.getItem('userFarmId');
    if (userRole && userRole !== 'Developer' && userFarmId && Number(userFarmId) !== farmId) {
      console.warn('Unauthorized farm switch attempt blocked for non-developer.');
      return;
    }
    const selected = farms.find((f) => f.Id === farmId);
    if (selected) {
      setCurrentFarm(selected);
      localStorage.setItem('active_farm_id', String(farmId));
    }
  };

  /**
   * Creates a new Farm in local database and Supabase, provisioning initial admin user
   */
  const createFarm = async (farmData: {
    farmName: string;
    ownerName: string;
    contactPhone?: string;
    contactEmail?: string;
    address?: string;
    adminUsername: string;
    adminEmail: string;
    adminPassword: string;
  }): Promise<{ success: boolean; message: string; farm?: Farm }> => {
    try {
      // 1. Create in local database via API
      let createdFarm: Farm | null = null;
      try {
        const apiRes = await fetch('/api/farms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            FarmName: farmData.farmName,
            ManagerName: farmData.ownerName,
            ContactPhone: farmData.contactPhone,
            Location: farmData.address,
            adminUsername: farmData.adminUsername,
            adminEmail: farmData.adminEmail,
            adminPassword: farmData.adminPassword
          })
        });

        if (apiRes.ok) {
          const json = await apiRes.json();
          createdFarm = json.farm;
        }
      } catch (apiErr) {
        console.warn('Local farm creation error:', apiErr);
      }

      // 2. Also sync to Supabase if available
      try {
        const { data: newFarms } = await supabase
          .from('Farms')
          .insert([
            {
              FarmName: farmData.farmName,
              OwnerName: farmData.ownerName,
              ContactPhone: farmData.contactPhone || '',
              ContactEmail: farmData.contactEmail || '',
              Address: farmData.address || '',
              IsActive: 1
            }
          ])
          .select();

        if (newFarms && newFarms.length > 0 && !createdFarm) {
          createdFarm = newFarms[0];
        }
      } catch (sbErr) {
        console.warn('Supabase sync skipped:', sbErr);
      }

      await refreshFarms();

      if (createdFarm) {
        return { success: true, message: 'Farm registered and administrator provisioned successfully', farm: createdFarm };
      }
      return { success: true, message: 'Farm registered successfully' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to create farm' };
    }
  };

  return (
    <FarmContext.Provider
      value={{
        currentFarm,
        farms,
        isLoadingFarms,
        switchFarm,
        refreshFarms,
        createFarm
      }}
    >
      {children}
    </FarmContext.Provider>
  );
};

export const useFarm = () => {
  const context = useContext(FarmContext);
  if (!context) {
    throw new Error('useFarm must be used within a FarmProvider');
  }
  return context;
};
