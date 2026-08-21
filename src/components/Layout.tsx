import { ReactNode, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Button } from './ui/Button';
import { Moon, Sun, LogOut, LayoutDashboard, Wallet, ReceiptText, Users, LineChart, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LayoutProps {
  children: ReactNode;
  activeScreen: string;
  onNavigate: (screen: string) => void;
}

export function Layout({ children, activeScreen, onNavigate }: LayoutProps) {
  const { settings, updateSettings, logout, auth, stores, setStoreId } = useStore();

  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.darkMode]);

  const navItems = [
    { id: 'dashboard', label: 'اللوحة الرئيسية', icon: LayoutDashboard },
    { id: 'income', label: 'الإيرادات', icon: Wallet },
    { id: 'expenses', label: 'المصروفات', icon: ReceiptText },
    { id: 'clients', label: 'العملاء والديون', icon: Users },
    { id: 'profit', label: 'الأرباح', icon: LineChart },
    { id: 'reports', label: 'التقارير', icon: LineChart },
    ...(auth.role === 'ADMIN' ? [{ id: 'settings', label: 'الإعدادات', icon: Settings }] : []),
  ];

  const fontSizeClass = settings.fontSize === 'large' ? 'text-lg' : settings.fontSize === 'small' ? 'text-sm' : 'text-base';

  return (
    <div className={`min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-900 ${fontSizeClass}`}>
      
      <aside className="w-full md:w-64 bg-white dark:bg-slate-800 border-b md:border-b-0 md:border-l border-slate-200 dark:border-slate-700 p-4 flex flex-col shrink-0 z-10 shadow-sm md:shadow-xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">دفتر الحسابات</h1>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => updateSettings({ darkMode: !settings.darkMode })}
            className="rounded-full hover:rotate-12 transition-transform duration-300"
          >
            {settings.darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
          </Button>
        </div>

        {auth.role === 'ADMIN' && (
          <div className="mb-6">
            <select 
              className="w-full bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary-500 transition-all hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              value={auth.currentStoreId || ''}
              onChange={(e) => setStoreId(e.target.value)}
            >
              {stores.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        <nav className="flex-1 overflow-x-auto md:overflow-visible flex md:flex-col gap-2 pb-2 md:pb-0 hide-scrollbar scroll-smooth">
          {navItems.map((item) => (
            <Button
              key={item.id}
              variant={activeScreen === item.id ? 'default' : 'ghost'}
              className={`justify-start w-auto md:w-full shrink-0 relative overflow-hidden transition-all duration-300 ${activeScreen === item.id ? 'bg-primary-600 shadow-md shadow-primary-500/30 font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
              onClick={() => onNavigate(item.id)}
            >
              {activeScreen === item.id && (
                <motion.div 
                  layoutId="activeNavIndicator"
                  className="absolute inset-0 bg-primary-600 rounded-xl"
                  initial={false}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center">
                <item.icon className={`w-5 h-5 me-3 transition-transform duration-300 ${activeScreen === item.id ? 'scale-110' : ''}`} />
                {item.label}
              </span>
            </Button>
          ))}
        </nav>

        <div className="mt-auto hidden md:block pt-4 border-t border-slate-200 dark:border-slate-700">
          <Button variant="ghost" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors rounded-xl" onClick={logout}>
            <LogOut className="w-5 h-5 me-3" />
            تسجيل الخروج
          </Button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeScreen}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="h-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <div className="md:hidden p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
         <Button variant="ghost" className="w-full justify-center text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20" onClick={logout}>
            <LogOut className="w-5 h-5 me-2" />
            تسجيل الخروج
          </Button>
      </div>
    </div>
  );
}
