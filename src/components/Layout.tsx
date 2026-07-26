import { ReactNode, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Button } from './ui/Button';
import { Moon, Sun, LogOut, LayoutDashboard, Wallet, ReceiptText, Users, LineChart, Settings } from 'lucide-react';

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
      
      <aside className="w-full md:w-64 bg-white dark:bg-slate-800 border-b md:border-b-0 md:border-l border-slate-200 dark:border-slate-700 p-4 flex flex-col shrink-0">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-bold text-primary-600 dark:text-primary-400">دفتر الحسابات الذكي</h1>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => updateSettings({ darkMode: !settings.darkMode })}
          >
            {settings.darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
        </div>

        {auth.role === 'ADMIN' && (
          <div className="mb-6">
            <select 
              className="w-full bg-slate-100 dark:bg-slate-700 border-none rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500"
              value={auth.currentStoreId || ''}
              onChange={(e) => setStoreId(e.target.value)}
            >
              {stores.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        <nav className="flex-1 overflow-x-auto md:overflow-visible flex md:flex-col gap-2 pb-2 md:pb-0 hide-scrollbar">
          {navItems.map((item) => (
            <Button
              key={item.id}
              variant={activeScreen === item.id ? 'default' : 'ghost'}
              className={`justify-start w-auto md:w-full shrink-0 ${activeScreen === item.id ? 'bg-primary-600' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}
              onClick={() => onNavigate(item.id)}
            >
              <item.icon className="w-5 h-5 me-3" />
              {item.label}
            </Button>
          ))}
        </nav>

        <div className="mt-auto hidden md:block pt-4 border-t border-slate-200 dark:border-slate-700">
          <Button variant="ghost" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={logout}>
            <LogOut className="w-5 h-5 me-3" />
            تسجيل الخروج
          </Button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
        {children}
      </main>

      <div className="md:hidden p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
         <Button variant="ghost" className="w-full justify-center text-red-500" onClick={logout}>
            <LogOut className="w-5 h-5 me-2" />
            تسجيل الخروج
          </Button>
      </div>
    </div>
  );
}
