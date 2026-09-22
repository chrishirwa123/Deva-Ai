import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { AppSettings, OllamaStatus, Page } from './types';
import { getSettings, updateSettings as updateSettingsDb } from './db';
import { checkOllamaStatus } from './ollama';

interface AppState {
  page: Page;
  setPage: (p: Page) => void;
  settings: AppSettings | null;
  refreshSettings: () => Promise<void>;
  saveSettings: (updates: Partial<AppSettings>) => Promise<void>;
  ollamaStatus: OllamaStatus;
  refreshOllamaStatus: () => Promise<void>;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<Page>('landing');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>({ connected: false, models: [] });
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const refreshSettings = useCallback(async () => {
    const s = await getSettings();
    setSettings(s);
  }, []);

  const saveSettings = useCallback(async (updates: Partial<AppSettings>) => {
    const updated = await updateSettingsDb(updates);
    if (updated) setSettings(updated);
  }, []);

  const refreshOllamaStatus = useCallback(async () => {
    if (!settings) return;
    const status = await checkOllamaStatus(settings.ollama_url);
    setOllamaStatus(status);
  }, [settings]);

  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  useEffect(() => {
    if (settings) {
      refreshOllamaStatus();
      const interval = setInterval(refreshOllamaStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [settings, refreshOllamaStatus]);

  const value: AppState = {
    page,
    setPage,
    settings,
    refreshSettings,
    saveSettings,
    ollamaStatus,
    refreshOllamaStatus,
    sidebarOpen,
    toggleSidebar,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
