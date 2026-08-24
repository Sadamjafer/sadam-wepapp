import { useState, useEffect } from 'react';
import { useStore } from './store/useStore';
import { Login } from './screens/Login';
import { Layout } from './components/Layout';
import { Dashboard } from './screens/Dashboard';
import { Income } from './screens/Income';
import { Expenses } from './screens/Expenses';
import { Clients } from './screens/Clients';
import { Profit } from './screens/Profit';
import { Reports } from './screens/Reports';
import { Settings } from './screens/Settings';
import { initAuthListener, getCachedToken, findBackupFile, saveBackupToDrive, clearCachedToken } from './lib/driveBackup';
import { AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

export default function App() {
  const { auth } = useStore();
  const [activeScreen, setActiveScreen] = useState('dashboard');
  const [newerBackupAvailable, setNewerBackupAvailable] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);

  // Auto Logout Logic
  useEffect(() => {
    if (!auth.isLoggedIn) return;

    let timeoutId: any;
    const logout = useStore.getState().logout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      // 15 minutes of inactivity = 900000 ms
      timeoutId = setTimeout(() => {
        logout();
      }, 900000); 
    };

    // Track user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(name => document.addEventListener(name, resetTimer, true));
    resetTimer(); // Start timer initially

    // Logout when exiting the app (closing tab/window)
    const handleUnload = () => logout();
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      events.forEach(name => document.removeEventListener(name, resetTimer, true));
      window.removeEventListener('beforeunload', handleUnload);
      clearTimeout(timeoutId);
    };
  }, [auth.isLoggedIn]);

  useEffect(() => {
    let unsubscribeStore: () => void;
    let authUnsubscribe: () => void;
    let saveTimeout: any;

    authUnsubscribe = initAuthListener(async (user, token) => {
      // 1. Check for newer backup on drive
      try {
        const fileInfo = await findBackupFile(token);
        if (fileInfo && fileInfo.modifiedTime) {
          const state = useStore.getState();
          const localTime = state.lastUpdated;
          if (!localTime || new Date(fileInfo.modifiedTime) > new Date(localTime)) {
            setNewerBackupAvailable(true);
          }
        }
      } catch (err: any) {
        console.error("Failed to check backup on startup", err);
        if (err.message && err.message.includes('401')) {
          clearCachedToken();
        }
      } finally {
        setIsVerifying(false);
      }

      // 2. Setup auto-backup on state changes
      unsubscribeStore = useStore.subscribe((state, prevState) => {
        if (
          state.lastUpdated === prevState.lastUpdated &&
          (
            state.stores !== prevState.stores ||
            state.transactions !== prevState.transactions ||
            state.incomeRecords !== prevState.incomeRecords ||
            state.expenseCategories !== prevState.expenseCategories ||
            state.clients !== prevState.clients ||
            state.clientOperations !== prevState.clientOperations ||
            state.profitDeductions !== prevState.profitDeductions ||
            state.passcodes !== prevState.passcodes
          )
        ) {
          clearTimeout(saveTimeout);
          saveTimeout = setTimeout(async () => {
            const currentToken = getCachedToken();
            if (currentToken) {
              try {
                const currentState = useStore.getState();
                const backupData = {
                  passcodes: currentState.passcodes,
                  stores: currentState.stores,
                  transactions: currentState.transactions,
                  incomeRecords: currentState.incomeRecords,
                  expenseCategories: currentState.expenseCategories,
                  clients: currentState.clients,
                  clientOperations: currentState.clientOperations,
                  profitDeductions: currentState.profitDeductions,
                  lastUpdated: new Date().toISOString()
                };
                
                const file = await saveBackupToDrive(currentToken, backupData);
                // Update local lastUpdated so we don't think it's newer when we fetch again
                useStore.getState().setLastUpdated(file.modifiedTime);
              } catch (e: any) {
                console.error("Auto backup failed", e);
                if (e.message && e.message.includes('401')) {
                  clearCachedToken();
                }
              }
            }
          }, 4000); // Wait 4 seconds of inactivity before uploading
        }
      });
    }, () => {
      // Clean up if user logs out of Google Drive
      setIsVerifying(false);
      if (unsubscribeStore) {
        unsubscribeStore();
      }
      clearTimeout(saveTimeout);
    });

    return () => {
      if (unsubscribeStore) unsubscribeStore();
      if (authUnsubscribe) authUnsubscribe();
      clearTimeout(saveTimeout);
    };
  }, []);

  if (!auth.isLoggedIn) {
    return <Login />;
  }

  if (isVerifying) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4 text-primary-600 dark:text-primary-400"
        >
          <Loader2 className="w-12 h-12 animate-spin" />
          <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200">جاري التحقق من البيانات...</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">يرجى الانتظار بينما نقوم بمزامنة آخر التحديثات</p>
        </motion.div>
      </div>
    );
  }

  const renderScreen = () => {
    switch (activeScreen) {
      case 'dashboard':
        return <Dashboard />;
      case 'income':
        return <Income />;
      case 'expenses':
        return <Expenses />;
      case 'clients':
        return <Clients />;
      case 'profit':
        return <Profit />;
      case 'reports':
        return <Reports />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout activeScreen={activeScreen} onNavigate={setActiveScreen}>
      {newerBackupAvailable && (
        <div className="bg-amber-100 text-amber-800 p-3 flex flex-col sm:flex-row justify-between items-center rounded-xl mb-4 border border-amber-200 gap-3 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span className="font-semibold text-sm">توجد بيانات أحدث على Google Drive. يرجى التوجه للإعدادات وجلب النسخة الاحتياطية.</span>
          </div>
          <button 
            onClick={() => { setActiveScreen('settings'); setNewerBackupAvailable(false); }}
            className="px-4 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors shadow-sm whitespace-nowrap"
          >
            الذهاب للإعدادات
          </button>
        </div>
      )}
      {renderScreen()}
    </Layout>
  );
}
