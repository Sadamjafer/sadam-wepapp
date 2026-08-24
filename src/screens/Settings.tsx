import { useState, FormEvent, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Save, Plus, Trash2, Cloud, UploadCloud, DownloadCloud, LogOut, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { 
  initAuthListener, 
  signInWithGoogleDrive, 
  signOutGoogleDrive, 
  findBackupFile, 
  saveBackupToDrive,
  downloadBackupFromDrive,
  getCachedToken,
  clearCachedToken,
  BackupFileInfo 
} from '../lib/driveBackup';

export function Settings() {
  const { 
    auth, passcodes, updatePasscodes, stores, addStore, updateStore, deleteStore, settings, updateSettings, importBackupData,
    expenseCategories, deleteExpenseCategory, transactions, clients
  } = useStore();
  
  const [passForm, setPassForm] = useState(passcodes);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [storeName, setStoreName] = useState('');

  // Google Drive backup states
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [backupInfo, setBackupInfo] = useState<BackupFileInfo | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [backupStatus, setBackupStatus] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Check for existing backup file
  const checkExistingBackup = async (token: string) => {
    try {
      const file = await findBackupFile(token);
      setBackupInfo(file);
    } catch (err: any) {
      console.error('Error checking existing backup:', err);
      if (err.message && err.message.includes('401')) {
        setGoogleUser(null);
        setDriveToken(null);
        clearCachedToken();
      }
    }
  };

  // Auth listener for Google Drive
  useEffect(() => {
    const unsubscribe = initAuthListener(
      (user, token) => {
        setGoogleUser(user);
        setDriveToken(token);
        setAuthChecking(false);
        checkExistingBackup(token);
      },
      () => {
        setGoogleUser(null);
        setDriveToken(null);
        setAuthChecking(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleConnectDrive = async () => {
    setActionLoading(true);
    setBackupStatus(null);
    try {
      const result = await signInWithGoogleDrive();
      if (result) {
        setGoogleUser(result.user);
        setDriveToken(result.accessToken);
        setBackupStatus({ type: 'success', text: 'تم الاتصال بحساب Google Drive بنجاح!' });
        await checkExistingBackup(result.accessToken);
      }
    } catch (err: any) {
      console.error('Connection failed:', err);
      setBackupStatus({ type: 'error', text: 'فشل الاتصال بحساب Google Drive: ' + (err.message || 'خطأ غير معروف') });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnectDrive = async () => {
    setActionLoading(true);
    try {
      await signOutGoogleDrive();
      setGoogleUser(null);
      setDriveToken(null);
      setBackupInfo(null);
      setBackupStatus({ type: 'info', text: 'تم تسجيل الخروج وفصل حساب Google Drive.' });
    } catch (err: any) {
      console.error('Disconnect failed:', err);
      setBackupStatus({ type: 'error', text: 'فشل تسجيل الخروج: ' + (err.message || 'خطأ غير معروف') });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    const token = driveToken || getCachedToken();
    if (!token) {
      setBackupStatus({ type: 'error', text: 'الرجاء الاتصال بـ Google Drive أولاً.' });
      return;
    }

    setActionLoading(true);
    setBackupStatus(null);
    try {
      const state = useStore.getState();
      const backupData = {
        passcodes: state.passcodes,
        stores: state.stores,
        transactions: state.transactions,
        incomeRecords: state.incomeRecords,
        expenseCategories: state.expenseCategories,
        clients: state.clients,
        clientOperations: state.clientOperations,
        profitDeductions: state.profitDeductions,
        backupVersion: '1.0',
        backupDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };

      const file = await saveBackupToDrive(token, backupData);
      setBackupInfo(file);
      state.setLastUpdated(file.modifiedTime);
      setBackupStatus({ type: 'success', text: 'تم إنشاء النسخة الاحتياطية وحفظها بنجاح!' });
    } catch (err: any) {
      console.error('Backup creation failed:', err);
      setBackupStatus({ type: 'error', text: 'فشل إنشاء النسخة الاحتياطية: ' + (err.message || 'خطأ غير معروف') });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestoreBackup = async () => {
    const token = driveToken || getCachedToken();
    if (!token) {
      setBackupStatus({ type: 'error', text: 'الرجاء الاتصال بـ Google Drive أولاً.' });
      return;
    }
    if (!backupInfo) {
      setBackupStatus({ type: 'error', text: 'لا توجد نسخة احتياطية محفوظة على هذا الحساب.' });
      return;
    }

    const confirmed = window.confirm(
      'تنبيه هام جداً:\n\nهل أنت متأكد من رغبتك في استرجاع النسخة الاحتياطية؟\n\nسيؤدي هذا الإجراء إلى حذف جميع البيانات الحالية تماماً واستبدالها بالكامل ببيانات النسخة الاحتياطية المسترجعة. لا يمكن التراجع عن هذا الإجراء!'
    );
    if (!confirmed) return;

    setActionLoading(true);
    setBackupStatus(null);
    try {
      const data = await downloadBackupFromDrive(token, backupInfo.id);
      if (!data || (!data.transactions && !data.stores)) {
        throw new Error('ملف النسخة الاحتياطية غير صالح أو تالف.');
      }
      data.lastUpdated = backupInfo.modifiedTime;

      importBackupData(data);
      setBackupStatus({ type: 'success', text: 'تم استرجاع النسخة الاحتياطية وتحديث جميع البيانات بنجاح!' });
    } catch (err: any) {
      console.error('Backup restore failed:', err);
      setBackupStatus({ type: 'error', text: 'فشل استرجاع النسخة الاحتياطية: ' + (err.message || 'خطأ غير معروف') });
    } finally {
      setActionLoading(false);
    }
  };

  if (auth.role !== 'ADMIN') {
    return <div className="text-center p-8 text-slate-500">ليس لديك صلاحية للوصول إلى هذه الصفحة</div>;
  }

  const handleSavePasscodes = (e: FormEvent) => {
    e.preventDefault();
    if (!window.confirm('هل أنت متأكد من رغبتك في تعديل كلمات المرور والصلاحيات؟')) return;
    updatePasscodes(passForm);
    alert('تم حفظ كلمات المرور بنجاح');
  };

  const handleAddStore = (e: FormEvent) => {
    e.preventDefault();
    if (!storeName) return;
    addStore(storeName);
    setSaveSuccessMsg('تم إضافة المحل بنجاح!');
    setTimeout(() => setSaveSuccessMsg(''), 3000);
    setStoreName('');
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold">الإعدادات</h2>

      <Card>
        <CardHeader>
          <CardTitle>تفضيلات العرض</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">الوضع الليلي</p>
              <p className="text-sm text-slate-500">تفعيل أو تعطيل المظهر الداكن</p>
            </div>
            <button 
              className={`w-12 h-6 rounded-full transition-colors ${settings.darkMode ? 'bg-primary-600' : 'bg-slate-300'} relative`}
              onClick={() => updateSettings({ darkMode: !settings.darkMode })}
            >
              <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${settings.darkMode ? 'left-1' : 'right-1'}`} />
            </button>
          </div>
          
          <div className="pt-4 border-t border-slate-100 dark:border-slate-700/50">
            <Label className="mb-2 block">حجم الخط</Label>
            <div className="flex gap-2">
              <Button variant={settings.fontSize === 'small' ? 'default' : 'outline'} onClick={() => updateSettings({ fontSize: 'small' })}>صغير</Button>
              <Button variant={settings.fontSize === 'medium' ? 'default' : 'outline'} onClick={() => updateSettings({ fontSize: 'medium' })}>متوسط</Button>
              <Button variant={settings.fontSize === 'large' ? 'default' : 'outline'} onClick={() => updateSettings({ fontSize: 'large' })}>كبير</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Google Drive Cloud Backup */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Cloud className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            النسخ الاحتياطي السحابي (Google Drive)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            احفظ بيانات معاملاتك المالية، المحلات، العملاء، ومصروفاتك بأمان على حسابك الشخصي في Google Drive، واسترجعها في أي وقت عند الحاجة أو عند استخدام جهاز آخر.
          </p>

          {backupStatus && (
            <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs font-medium leading-relaxed ${
              backupStatus.type === 'success' 
                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800/50'
                : backupStatus.type === 'error'
                  ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border-rose-100 dark:border-rose-800/50'
                  : 'bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 border-blue-100 dark:border-blue-800/50'
            }`}>
              {backupStatus.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              )}
              <span>{backupStatus.text}</span>
            </div>
          )}

          {authChecking ? (
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 py-3 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin text-primary-600" />
              <span>جاري التحقق من حالة الاتصال...</span>
            </div>
          ) : !googleUser ? (
            <div className="pt-2 flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50 rounded-2xl">
              <Cloud className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-2" />
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-4 text-center">
                لم يتم ربط حساب Google Drive بعد. يرجى تسجيل الدخول للبدء.
              </p>
              
              <Button 
                onClick={handleConnectDrive} 
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 shadow-sm"
              >
                {actionLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5.04c1.78 0 3.37.61 4.63 1.8l3.47-3.47C18.01 1.42 15.23 0 12 0 7.31 0 3.25 2.69 1.28 6.63l4 3.1C6.22 7.15 8.91 5.04 12 5.04z" />
                    <path fill="#4285F4" d="M23.49 12.27c0-.82-.07-1.6-.21-2.36H12v4.51h6.45c-.28 1.48-1.11 2.73-2.36 3.58l3.66 2.84c2.14-1.97 3.74-4.87 3.74-8.57z" />
                    <path fill="#FBBC05" d="M5.28 14.13c-.24-.73-.38-1.5-.38-2.31s.14-1.58.38-2.31l-4-3.1C.48 8.09 0 9.99 0 12s.48 3.91 1.28 5.58l4-3.1z" />
                    <path fill="#34A853" d="M12 24c3.24 0 5.97-1.07 7.96-2.91l-3.66-2.84c-1.01.68-2.31 1.09-4.3 1.09-3.09 0-5.78-2.11-6.72-4.94l-4 3.1C3.25 21.31 7.31 24 12 24z" />
                  </svg>
                )}
                <span>ربط حساب Google Drive</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Account info and last backup */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50 rounded-2xl space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/50">
                  <div className="flex items-center gap-3">
                    {googleUser.photoURL ? (
                      <img src={googleUser.photoURL} referrerPolicy="no-referrer" alt="Avatar" className="w-9 h-9 rounded-full border border-slate-200" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-sm">
                        {googleUser.displayName ? googleUser.displayName[0] : 'U'}
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-semibold">{googleUser.displayName || 'مستخدم جوجل'}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">{googleUser.email}</p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleDisconnectDrive}
                    disabled={actionLoading}
                    className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>فصل الحساب</span>
                  </Button>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">حالة ملف النسخة الاحتياطية:</span>
                  <span className="font-bold">
                    {backupInfo ? (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        موجود (آخر تحديث: {new Date(backupInfo.modifiedTime).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })})
                      </span>
                    ) : (
                      <span className="text-slate-400 font-medium">لا توجد نسخة احتياطية سحابية حالياً</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <Button 
                  onClick={handleCreateBackup} 
                  disabled={actionLoading}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm"
                >
                  {actionLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <UploadCloud className="w-4 h-4" />
                  )}
                  <span>حفظ نسخة احتياطية سحابية</span>
                </Button>

                <Button 
                  onClick={handleRestoreBackup} 
                  disabled={actionLoading || !backupInfo}
                  variant={backupInfo ? "outline" : "ghost"}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-xl ${
                    backupInfo 
                      ? 'border-blue-200 dark:border-blue-900/50 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20' 
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {actionLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <DownloadCloud className="w-4 h-4" />
                  )}
                  <span>استرجاع البيانات السحابية</span>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>إدارة المحلات</CardTitle>
            <Button size="sm" onClick={() => {
              setStoreName('');
              setSaveSuccessMsg('');
              setIsStoreModalOpen(true);
            }}>
              <Plus className="w-4 h-4 me-1" /> إضافة محل
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stores.map(store => (
              <div key={store.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <span className="font-medium">{store.name}</span>
                {stores.length > 1 && (
                  <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => { if(window.confirm('هل أنت متأكد من رغبتك في حذف هذا المحل؟ لا يمكن التراجع عن هذا الإجراء.')) deleteStore(store.id); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>إدارة أصناف المصروفات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {expenseCategories.filter(c => c.storeId === auth.currentStoreId).map(cat => {
              const isUsed = 
                transactions.some(tx => tx.categoryId === cat.id && tx.storeId === auth.currentStoreId) ||
                clients.some(cl => cl.linkedExpenseCategoryId === cat.id && cl.storeId === auth.currentStoreId);
              
              return (
                <div key={cat.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <span className="font-medium">{cat.name}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={`text-red-500 ${isUsed ? 'opacity-50 cursor-not-allowed' : 'hover:text-red-600 hover:bg-red-50'}`} 
                    onClick={() => { 
                      if (isUsed) {
                        alert('لا يمكن حذف هذا الصنف لأنه مرتبط بمعاملات أو موردين.');
                        return;
                      }
                      if(window.confirm('هل أنت متأكد من رغبتك في حذف هذا الصنف؟')) {
                        deleteExpenseCategory(cat.id);
                      }
                    }}
                    title={isUsed ? 'لا يمكن الحذف لارتباطه ببيانات' : 'حذف الصنف'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
            {expenseCategories.filter(c => c.storeId === auth.currentStoreId).length === 0 && (
              <p className="text-slate-500 text-sm text-center py-4">لا توجد أصناف مصروفات مسجلة.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>كلمات المرور والصلاحيات</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSavePasscodes} className="space-y-4">
            <div className="space-y-2">
              <Label>رمز المدير (صلاحيات كاملة)</Label>
              <Input required value={passForm.admin} onChange={e => setPassForm({...passForm, admin: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>رمز المشرف (مشاهدة فقط)</Label>
              <Input required value={passForm.supervisor} onChange={e => setPassForm({...passForm, supervisor: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>رمز مراقب مقيد (إخفاء الأرقام)</Label>
              <Input required value={passForm.restricted} onChange={e => setPassForm({...passForm, restricted: e.target.value})} />
            </div>
            <Button type="submit" className="w-full">
              <Save className="w-4 h-4 me-2" />
              حفظ التغييرات
            </Button>
          </form>
        </CardContent>
      </Card>

      <Modal isOpen={isStoreModalOpen} onClose={() => setIsStoreModalOpen(false)} title="إضافة محل جديد">
        <form onSubmit={handleAddStore} className="space-y-4">
          {saveSuccessMsg && (
            <div className="p-3 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 border border-green-200 dark:border-green-800/50 rounded-xl flex items-center gap-2 text-sm font-medium animate-in fade-in zoom-in duration-200">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}
          <div className="space-y-2">
            <Label>اسم المحل</Label>
            <Input required value={storeName} onChange={e => setStoreName(e.target.value)} />
          </div>
          <Button type="submit" className="w-full mt-4">حفظ</Button>
        </form>
      </Modal>
    </div>
  );
}
