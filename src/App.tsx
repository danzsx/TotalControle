import React from 'react';
import { AppProvider, useApp } from './application/AppContext';
import { Sidebar } from './ui/components/Sidebar';
import { ToastContainer } from './ui/components/ToastContainer';
import { CardsView } from './ui/views/CardsView';
import { CycleView } from './ui/views/CycleView';
import { DashboardView } from './ui/views/DashboardView';
import { ErrorsView } from './ui/views/ErrorsView';
import { HistoryView } from './ui/views/HistoryView';
import { SettingsView } from './ui/views/SettingsView';
import { StatsView } from './ui/views/StatsView';
import { TrailsView } from './ui/views/TrailsView';

const Shell: React.FC = () => {
  const { ready, loadError, activeTab } = useApp();

  if (loadError) {
    return (
      <div className="h-screen w-screen canvas-dots flex items-center justify-center p-6">
        <div className="max-w-md rounded-3xl bg-white border border-[#FECACA] p-6 text-center space-y-2 shadow-sm">
          <h1 className="font-display text-lg font-semibold text-[#B91C1C]">
            Erro ao inicializar banco de dados
          </h1>
          <p className="text-sm text-[#6B7280]">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="h-screen w-screen canvas-dots flex items-center justify-center">
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-white/90 border border-[#EAE9E4] shadow-[0_4px_20px_rgba(17,24,39,0.04)] text-sm text-[#6B7280]">
          <span className="w-2.5 h-2.5 rounded-full iridescent-orb animate-pulse" />
          Carregando espaço de aprendizagem...
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen canvas-dots flex gap-5 p-4 md:p-5 overflow-hidden">
      <Sidebar />
      <main className="flex-1 h-full overflow-y-auto pr-1 pb-6">
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'trails' && <TrailsView />}
        {activeTab === 'cycle' && <CycleView />}
        {activeTab === 'errors' && <ErrorsView />}
        {activeTab === 'cards' && <CardsView />}
        {activeTab === 'stats' && <StatsView />}
        {activeTab === 'history' && <HistoryView />}
        {activeTab === 'settings' && <SettingsView />}
      </main>
      <ToastContainer />
    </div>
  );
};

export function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}

export default App;

