import { ReactNode, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Button } from './ui/Button';
import { Moon, Sun, LogOut, LayoutDashboard, Wallet, ReceiptText, Users, LineChart, Settings, FileText, MoreHorizontal } from 'lucide-react';
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
    { id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard },
    { id: 'income', label: 'الإيرادات', icon: Wallet },
    { id: 'expenses', label: 'المصروفات', icon: ReceiptText },
    { id: 'clients', label: 'العملاء', icon: Users },
    { id: 'profit', label: 'الأرباح', icon: LineChart },
    { id: 'reports', label: 'التقارير', icon: FileText },
    ...(auth.role === 'ADMIN' ? [{ id: 'settings', label: 'الإعدادات', icon: Settings }] : []),
  ];

  const fontSizeClass = settings.fontSize === 'large' ? 'text-lg' : settings.fontSize === 'small' ? 'text-sm' : 'text-base';

  return (
    <div className={`min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-900 ${fontSizeClass}`}>
      
      {/* Desktop Sidebar / Mobile Top Header */}
      <aside className="w-full md:w-64 bg-white dark:bg-slate-800 border-b md:border-b-0 md:border-l border-slate-200 dark:border-slate-700 p-4 flex flex-col shrink-0 z-20 shadow-sm md:shadow-xl sticky top-0 md:h-screen">
        <div className="flex items-center justify-between md:mb-8">
          <h1 className="text-xl md:text-2xl font-black bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent tracking-tight">دفتر الحسابات</h1>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => updateSettings({ darkMode: !settings.darkMode })}
              className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              {settings.darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
            </Button>
            <Button variant="ghost" size="icon" className="md:hidden text-red-500 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20" onClick={logout}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {auth.role === 'ADMIN' && (
          <div className="mt-4 md:mt-0 mb-2 md:mb-6">
            <select 
              className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-500 transition-all hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer"
              value={auth.currentStoreId || ''}
              onChange={(e) => setStoreId(e.target.value)}
            >
              {stores.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Desktop Navigation */}
        <nav className="hidden md:flex flex-1 flex-col gap-1.5 overflow-y-auto hide-scrollbar">
          {navItems.map((item) => (
            <Button
              key={item.id}
              variant={activeScreen === item.id ? 'default' : 'ghost'}
              className={`justify-start w-full relative overflow-hidden transition-all duration-200 rounded-xl ${activeScreen === item.id ? 'bg-primary-600 shadow-sm font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'}`}
              onClick={() => onNavigate(item.id)}
            >
              {activeScreen === item.id && (
                <motion.div 
                  layoutId="activeNavIndicatorDesktop"
                  className="absolute inset-0 bg-primary-600 rounded-xl"
                  initial={false}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center">
                <item.icon className={`w-5 h-5 me-3 transition-transform duration-300 ${activeScreen === item.id ? 'scale-110 text-white' : ''}`} />
                <span className={activeScreen === item.id ? 'text-white' : ''}>{item.label}</span>
              </span>
            </Button>
          ))}
        </nav>

        <div className="mt-auto hidden md:block pt-4 border-t border-slate-100 dark:border-slate-700/50">
          <Button variant="ghost" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors rounded-xl font-medium" onClick={logout}>
            <LogOut className="w-5 h-5 me-3" />
            تسجيل الخروج
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto relative pb-28 md:pb-8">
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

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe z-50 shadow-[0_-5px_20px_-15px_rgba(0,0,0,0.1)]">
        <nav className="flex items-center overflow-x-auto hide-scrollbar px-2 py-2 gap-1" style={{ scrollSnapType: 'x mandatory' }}>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="relative flex flex-col items-center justify-center p-2 w-16 h-14 rounded-2xl transition-all outline-none shrink-0 scroll-snap-align-start"
            >
              {activeScreen === item.id && (
                <motion.div 
                  layoutId="activeNavIndicatorMobile"
                  className="absolute inset-0 bg-primary-50 dark:bg-primary-900/20 rounded-2xl -z-10"
                  initial={false}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <item.icon className={`w-6 h-6 mb-1 transition-all duration-300 ${activeScreen === item.id ? 'text-primary-600 dark:text-primary-400 scale-110' : 'text-slate-400 dark:text-slate-500 scale-95'}`} />
              <span className={`text-[10px] font-bold transition-colors ${activeScreen === item.id ? 'text-primary-700 dark:text-primary-300' : 'text-slate-500 dark:text-slate-400'}`}>
                {item.label}
              </span>
            </button>
          ))}
        </nav>
      </div>

    </div>
  );
}
