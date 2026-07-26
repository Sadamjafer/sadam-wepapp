import { useState } from 'react';
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

export default function App() {
  const { auth } = useStore();
  const [activeScreen, setActiveScreen] = useState('dashboard');

  if (!auth.isLoggedIn) {
    return <Login />;
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
      {renderScreen()}
    </Layout>
  );
}
