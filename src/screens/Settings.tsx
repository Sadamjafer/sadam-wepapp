import { useState, FormEvent } from 'react';
import { useStore } from '../store/useStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Save, Plus, Trash2 } from 'lucide-react';
import { Modal } from '../components/ui/Modal';

export function Settings() {
  const { auth, passcodes, updatePasscodes, stores, addStore, updateStore, deleteStore, settings, updateSettings } = useStore();
  
  const [passForm, setPassForm] = useState(passcodes);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [storeName, setStoreName] = useState('');

  if (auth.role !== 'ADMIN') {
    return <div className="text-center p-8 text-slate-500">ليس لديك صلاحية للوصول إلى هذه الصفحة</div>;
  }

  const handleSavePasscodes = (e: FormEvent) => {
    e.preventDefault();
    updatePasscodes(passForm);
    alert('تم حفظ كلمات المرور بنجاح');
  };

  const handleAddStore = (e: FormEvent) => {
    e.preventDefault();
    if (!storeName) return;
    addStore(storeName);
    setIsStoreModalOpen(false);
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

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>إدارة المحلات</CardTitle>
            <Button size="sm" onClick={() => setIsStoreModalOpen(true)}>
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
                  <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => deleteStore(store.id)}>
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
