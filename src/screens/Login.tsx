import { useState, FormEvent } from 'react';
import { useStore } from '../store/useStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Lock, Loader2 } from 'lucide-react';
import { signInWithGoogleDrive } from '../lib/driveBackup';

export function Login() {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const login = useStore(state => state.login);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    
    // Check if passcode is valid before doing anything
    const state = useStore.getState();
    const isValid = passcode === state.passcodes.admin || 
                    passcode === state.passcodes.supervisor || 
                    passcode === state.passcodes.restricted;

    if (!isValid) {
      setError(true);
      return;
    }

    try {
      setIsConnecting(true);
      // Attempt to connect to Google Drive automatically on login
      await signInWithGoogleDrive();
    } catch (err) {
      console.warn('Google Drive connection skipped or failed:', err);
    } finally {
      setIsConnecting(false);
      // Log into the system regardless of Google Drive success/failure
      login(passcode);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pt-8">
          <div className="mx-auto bg-primary-100 dark:bg-primary-900/30 w-16 h-16 rounded-full flex items-center justify-center mb-4 text-primary-600 dark:text-primary-400">
            <Lock className="w-8 h-8" />
          </div>
          <CardTitle className="text-2xl">تسجيل الدخول</CardTitle>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">أدخل رمز المرور للوصول إلى الحسابات</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Input 
                type="password" 
                placeholder="رمز المرور" 
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  setError(false);
                }}
                className={`text-center text-xl tracking-[0.5em] ${error ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                autoFocus
                disabled={isConnecting}
              />
              {error && <p className="text-red-500 text-sm mt-2 text-center">رمز المرور غير صحيح</p>}
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={isConnecting}>
              {isConnecting ? (
                <>
                  <Loader2 className="w-5 h-5 me-2 animate-spin" />
                  جاري الاتصال بـ Drive...
                </>
              ) : (
                'دخول'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
