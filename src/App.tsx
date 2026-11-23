import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { LogDrawer, Sidebar, TitleBar, Toasts } from './components/Shell';
import { useStore } from './lib/store';
import { Dashboard } from './pages/Dashboard';
import { Scanner } from './pages/Scanner';
import { Tweaks } from './pages/Tweaks';
import { Nvidia } from './pages/Nvidia';
import { Power } from './pages/Power';
import { Debloat } from './pages/Debloat';
import { Cleanup } from './pages/Cleanup';
import { Tools } from './pages/Tools';
import { Restore } from './pages/Restore';
import { Guide } from './pages/Guide';
import type { PageId } from './lib/types';
import type { ComponentType } from 'react';

const PAGES: Record<PageId, ComponentType> = {
  dashboard: Dashboard, scan: Scanner, tweaks: Tweaks, nvidia: Nvidia, power: Power,
  debloat: Debloat, cleanup: Cleanup, tools: Tools, restore: Restore, guide: Guide,
};

export function App() {
  const { page } = useStore();
  const [logOpen, setLogOpen] = useState(false);
  const Page = PAGES[page];
  return (
    <div className="grain flex h-full flex-col">
      <TitleBar />
      <div className="relative flex min-h-0 flex-1">
        <Sidebar onToggleLog={() => setLogOpen((v) => !v)} logOpen={logOpen} />
        <main className="relative min-w-0 flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div key={page} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }} className="h-full overflow-y-auto">
              <div className="mx-auto max-w-[1180px] px-10 pb-24 pt-9"><Page /></div>
            </motion.div>
          </AnimatePresence>
          <LogDrawer open={logOpen} onClose={() => setLogOpen(false)} />
          <Toasts />
        </main>
      </div>
    </div>
  );
}
