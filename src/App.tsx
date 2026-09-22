import { useState } from 'react';
import { AppProvider, useApp } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import { LandingPage } from '@/components/LandingPage';
import { Sidebar } from '@/components/Sidebar';
import { ChatPage } from '@/components/ChatPage';
import { AssistantPage } from '@/components/AssistantPage';
import { MemoryPage } from '@/components/MemoryPage';
import { KnowledgePage } from '@/components/KnowledgePage';
import { ResearchPage } from '@/components/ResearchPage';
import { ProfilePage } from '@/components/ProfilePage';
import { SettingsPage } from '@/components/SettingsPage';
import type { Page } from '@/lib/types';

function AppContent() {
  const { page, setPage } = useApp();
  useTheme();

  if (page === 'landing') {
    return <LandingPage onLaunch={setPage} />;
  }

  return (
    <div className="flex h-screen bg-[var(--bg-deepest)] overflow-hidden">
      <Sidebar onNavigate={setPage} activePage={page} />
      <main className="flex-1 overflow-hidden relative">
        <div className="ambient-glow w-[400px] h-[400px] bg-[var(--accent-primary)] opacity-5 top-[-100px] right-[-100px]" />
        <div className="h-full relative z-10">
          {page === 'chat' && <ChatPage />}
          {page === 'assistant' && <AssistantPage />}
          {page === 'memory' && <MemoryPage />}
          {page === 'knowledge' && <KnowledgePage />}
          {page === 'research' && <ResearchPage />}
          {page === 'profile' && <ProfilePage />}
          {page === 'settings' && <SettingsPage />}
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
