import { useState, FormEvent } from 'react';
import { useStore } from '../store/useStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { NumberInput } from '../components/ui/NumberInput';
import { Label } from '../components/ui/Label';
import { formatCurrency, formatMoney, parseInputDateToISO } from '../lib/utils';
import { Plus, Edit2, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { IncomeRecord } from '../types';

export function Income() {
  const { auth, incomeRecords, addIncomeRecord, updateIncomeRecord, deleteIncomeRecord, addTransaction } = useStore();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<IncomeRecord | null>(null);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'danger' } | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  
  const [amount, setAmount] = useState('');
  const [units, setUnits] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);

  const isRestricted = auth.role === 'RESTRICTED';
  const canManage = auth.role === 'ADMIN';

  const storeRecords = incomeRecords.filter(r => r.storeId === auth.currentStoreId);

  const showNotification = (message: string, type: 'success' | 'danger' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleOpenAddModal = () => {
    setEditingRecord(null);
    setAmount('');
    setUnits('');
    setNotes('');
    setDate(new Date().toISOString().split('T')[0]);
    setSaveSuccessMsg('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (record: IncomeRecord) => {
    setEditingRecord(record);
    setAmount(String(record.amount));
    setUnits(record.units ? String(record.units) : '');
    setNotes(record.notes || '');
    setDate(record.date ? record.date.split('T')[0] : new Date().toISOString().split('T')[0]);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!amount || !auth.currentStoreId) return;

    const recordDate = parseInputDateToISO(date);

    if (editingRecord) {
      if (!window.confirm('هل أنت متأكد من حفظ التعديلات؟')) return;
      updateIncomeRecord(editingRecord.id, {
        amount: parseFloat(amount),
        units: parseFloat(units) || 0,
        notes,
        date: recordDate
      });
      showNotification('تم تعديل الإيراد بنجاح');
      setIsModalOpen(false);
      setEditingRecord(null);
      setAmount('');
      setUnits('');
      setNotes('');
    } else {
      const record = {
        storeId: auth.currentStoreId,
        date: recordDate,
        amount: parseFloat(amount),
        units: parseFloat(units) || 0,
        notes
      };

      const recordId = addIncomeRecord(record);
      addTransaction({
        storeId: auth.currentStoreId,
        title: 'إيراد يومية',
        amount: parseFloat(amount),
        type: 'INCOME',
        categoryId: 'direct',
        notes,
        date: recordDate,
        incomeRecordId: recordId
      });
      
      setSaveSuccessMsg('تم حفظ الإيراد بنجاح!');
      setTimeout(() => setSaveSuccessMsg(''), 3000);

      setAmount('');
      setUnits('');
      setNotes('');
    }
  };

  const handleDelete = () => {
    if (!deletingRecordId) return;
    deleteIncomeRecord(deletingRecordId);
    setDeletingRecordId(null);
    showNotification('تم حذف الإيراد بنجاح', 'danger');
  };

  return (
    <div className="space-y-6">
      {notification && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium animate-in fade-in duration-200 ${
          notification.type === 'success' 
            ? 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300 border border-green-200 dark:border-green-800' 
            : 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-800'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          <span>{notification.message}</span>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">إيرادات اليومية</h2>
        {canManage && (
          <Button onClick={handleOpenAddModal}>
            <Plus className="w-5 h-5 me-2" />
            إضافة إيراد
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>سجل الإيرادات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 rounded-s-xl">التاريخ</th>
                  <th className="px-6 py-3">المبلغ</th>
                  <th className="px-6 py-3">الوحدات</th>
                  <th className="px-6 py-3">الملاحظات</th>
                  {canManage && <th className="px-6 py-3 rounded-e-xl text-center">الإجراءات</th>}
                </tr>
              </thead>
              <tbody>
                {storeRecords.map((record) => (
                  <tr key={record.id} className="border-b dark:border-slate-700/50 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">{new Date(record.date).toLocaleDateString('ar-EG')}</td>
                    <td className="px-6 py-4 font-bold text-green-600">{formatCurrency(record.amount, isRestricted)}</td>
                    <td className="px-6 py-4">{formatMoney(record.units, isRestricted)}</td>
                    <td className="px-6 py-4 text-slate-500">{record.notes || '-'}</td>
                    {canManage && (
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                            onClick={() => handleOpenEditModal(record)}
                            title="تعديل الإيراد"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                            onClick={() => setDeletingRecordId(record.id)}
                            title="حذف الإيراد"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {storeRecords.length === 0 && (
                  <tr>
                    <td colSpan={canManage ? 5 : 4} className="px-6 py-8 text-center text-slate-500">لا توجد إيرادات مسجلة</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal for Add / Edit */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingRecord ? "تعديل بيانات الإيراد" : "إضافة إيراد جديد"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {saveSuccessMsg && (
            <div className="p-3 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 border border-green-200 dark:border-green-800/50 rounded-xl flex items-center gap-2 text-sm font-medium animate-in fade-in zoom-in duration-200">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}
          <div className="space-y-2">
            <Label>التاريخ</Label>
            <Input type="date" required value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>المبلغ (₪)</Label>
            <NumberInput required value={amount} onChange={val => setAmount(val)} placeholder="0.00" />
          </div>
          <div className="space-y-2">
            <Label>الوحدات (اختياري)</Label>
            <NumberInput value={units} onChange={val => setUnits(val)} placeholder="0.00" />
          </div>
          <div className="space-y-2">
            <Label>ملاحظات</Label>
            <Input type="text" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <Button type="submit" className="w-full mt-4">
            {editingRecord ? "حفظ التعديلات" : "حفظ الإيراد"}
          </Button>
        </form>
      </Modal>

      {/* Confirmation Modal for Delete */}
      <Modal isOpen={Boolean(deletingRecordId)} onClose={() => setDeletingRecordId(null)} title="تأكيد الحذف">
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-4 rounded-xl">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <p className="text-sm font-medium">
              هل أنت تأكد من رغبتك في حذف هذا الإيراد؟ لا يمكن التراجع عن هذا الإجراء بعد تنفيذه.
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="destructive" className="flex-1" onClick={handleDelete}>
              تأكيد الحذف
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setDeletingRecordId(null)}>
              إلغاء
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
