import { useState, useMemo, FormEvent } from 'react';
import { useStore } from '../store/useStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { NumberInput } from '../components/ui/NumberInput';
import { Label } from '../components/ui/Label';
import { formatCurrency, parseInputDateToISO } from '../lib/utils';
import { Plus, Tag, Edit2, Trash2, AlertTriangle, CheckCircle2, Calendar, LayoutGrid, ListFilter, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { Transaction } from '../types';
import { motion, AnimatePresence } from 'motion/react';

type ViewMode = 'CATEGORY' | 'DATE' | 'ALL';

export function Expenses() {
  const { auth, clients, clientOperations, expenseCategories, addExpenseCategory, deleteExpenseCategory, transactions, addTransaction, updateTransaction, deleteTransaction } = useStore();
  
  const [viewMode, setViewMode] = useState<ViewMode>('DATE');
  const [searchQuery, setSearchQuery] = useState('');

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [saveCatSuccessMsg, setSaveCatSuccessMsg] = useState('');
  const [isExpModalOpen, setIsExpModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Transaction | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'danger' } | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  
  const [catName, setCatName] = useState('');
  
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);

  const isRestricted = auth.role === 'RESTRICTED';
  const canManage = auth.role === 'ADMIN';

  const storeCategories = expenseCategories.filter(c => c.storeId === auth.currentStoreId);
  const storeExpenses = transactions.filter(t => t.storeId === auth.currentStoreId && t.type === 'EXPENSE');

  const showNotification = (message: string, type: 'success' | 'danger' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleAddCat = (e: FormEvent) => {
    e.preventDefault();
    if (!catName || !auth.currentStoreId) return;
    addExpenseCategory({ storeId: auth.currentStoreId, name: catName });
    setSaveCatSuccessMsg('تم حفظ التصنيف بنجاح!');
    setTimeout(() => setSaveCatSuccessMsg(''), 3000);
    setCatName('');
  };

  const handleOpenAddExp = () => {
    setEditingExpense(null);
    setAmount('');
    setCategoryId('');
    setNotes('');
    setDate(new Date().toISOString().split('T')[0]);
    setSaveSuccessMsg('');
    setIsExpModalOpen(true);
  };

  const handleOpenEditExp = (tx: Transaction) => {
    setEditingExpense(tx);
    setAmount(String(tx.amount));
    setCategoryId(tx.categoryId || '');
    setNotes(tx.notes || '');
    setDate(tx.date ? tx.date.split('T')[0] : new Date().toISOString().split('T')[0]);
    setIsExpModalOpen(true);
  };

  const handleSaveExp = (e: FormEvent) => {
    e.preventDefault();
    if (!amount || !categoryId || !auth.currentStoreId) return;
    const cat = storeCategories.find(c => c.id === categoryId);
    const expDate = parseInputDateToISO(date);
    
    if (editingExpense) {
      if (!window.confirm('هل أنت متأكد من حفظ التعديلات؟')) return;
      updateTransaction(editingExpense.id, {
        title: cat?.name || 'مصروف',
        amount: parseFloat(amount),
        categoryId,
        notes,
        date: expDate
      });
      showNotification('تم تعديل المصروف بنجاح');
      setIsExpModalOpen(false);
      setEditingExpense(null);
      setAmount('');
      setCategoryId('');
      setNotes('');
    } else {
      addTransaction({
        storeId: auth.currentStoreId,
        title: cat?.name || 'مصروف',
        amount: parseFloat(amount),
        type: 'EXPENSE',
        categoryId,
        notes,
        date: expDate
      });
      
      setSaveSuccessMsg('تم حفظ المصروف بنجاح!');
      setTimeout(() => setSaveSuccessMsg(''), 3000);
      
      setAmount('');
      setCategoryId('');
      setNotes('');
      // We do not close the modal here, keep it open.
    }
  };

  const handleDeleteExp = () => {
    if (!deletingExpenseId) return;
    deleteTransaction(deletingExpenseId);
    setDeletingExpenseId(null);
    showNotification('تم حذف المصروف بنجاح', 'danger');
  };

  // Filtered expenses based on search
  const filteredExpenses = useMemo(() => {
    if (!searchQuery.trim()) return storeExpenses;
    const q = searchQuery.toLowerCase();
    return storeExpenses.filter(tx => 
      tx.title.toLowerCase().includes(q) || 
      (tx.notes && tx.notes.toLowerCase().includes(q))
    );
  }, [storeExpenses, searchQuery]);

  // Grouped by Category
  const expensesGroupedByCategory = useMemo(() => {
    const map = new Map<string, { categoryId: string; categoryName: string; items: Transaction[]; total: number }>();
    
    // Initialize with all store categories so empty ones also show if desired or omit if no items
    storeCategories.forEach(cat => {
      map.set(cat.id, { categoryId: cat.id, categoryName: cat.name, items: [], total: 0 });
    });

    filteredExpenses.forEach(tx => {
      const catId = tx.categoryId || 'other';
      if (!map.has(catId)) {
        map.set(catId, { categoryId: catId, categoryName: tx.title || 'مصروف آخر', items: [], total: 0 });
      }
      const group = map.get(catId)!;
      group.items.push(tx);
      const isPayment = (clientOperations || []).some(op => op.expenseTransactionId === tx.id && op.type === 'PAYMENT');
      if (isPayment) {
        group.total -= tx.amount;
      } else {
        group.total += tx.amount;
      }
    });

    return Array.from(map.values()).filter(g => g.items.length > 0);
  }, [storeCategories, filteredExpenses, clientOperations]);

  // Grouped by Date
  const expensesGroupedByDate = useMemo(() => {
    const map = new Map<string, { dateKey: string; formattedDate: string; items: Transaction[]; total: number }>();

    filteredExpenses.forEach(tx => {
      const dateKey = tx.date ? tx.date.split('T')[0] : 'غير محدد';
      if (!map.has(dateKey)) {
        const formattedDate = dateKey !== 'غير محدد' 
          ? new Date(dateKey).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
          : 'غير محدد';
        map.set(dateKey, { dateKey, formattedDate, items: [], total: 0 });
      }
      const group = map.get(dateKey)!;
      group.items.push(tx);
      const isPayment = (clientOperations || []).some(op => op.expenseTransactionId === tx.id && op.type === 'PAYMENT');
      if (isPayment) {
        group.total -= tx.amount;
      } else {
        group.total += tx.amount;
      }
    });

    // Sort descending by dateKey
    return Array.from(map.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [filteredExpenses, clientOperations]);

  // Total expense sum
  const totalExpensesSum = useMemo(() => {
    return filteredExpenses.reduce((sum, tx) => {
      const isPayment = (clientOperations || []).some(op => op.expenseTransactionId === tx.id && op.type === 'PAYMENT');
      return sum + (isPayment ? -tx.amount : tx.amount);
    }, 0);
  }, [filteredExpenses, clientOperations]);

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

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">المصروفات</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            الإجمالي الكلي: <span className="font-bold text-red-600">{formatCurrency(totalExpensesSum, isRestricted)}</span>
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => {
              setCatName('');
              setSaveCatSuccessMsg('');
              setIsCatModalOpen(true);
            }}>
              <Tag className="w-4 h-4 me-2" />
              إدارة التصنيفات
            </Button>
            <Button onClick={handleOpenAddExp}>
              <Plus className="w-5 h-5 me-2" />
              إضافة مصروف
            </Button>
          </div>
        )}
      </div>

      {/* View Toggle Bar & Search */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* View Mode Selector Tabs */}
          <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 p-1 bg-slate-50 dark:bg-slate-800 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setViewMode('CATEGORY')}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex-1 sm:flex-none ${
                viewMode === 'CATEGORY' 
                  ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>حسب التصنيف</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('DATE')}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex-1 sm:flex-none ${
                viewMode === 'DATE' 
                  ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>حسب التاريخ</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('ALL')}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex-1 sm:flex-none ${
                viewMode === 'ALL' 
                  ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>جدول الكلي</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
            <Input
              type="text"
              placeholder="بحث بالمصروفات..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pe-9 h-10 text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* VIEW 1: Grouped By Category */}
      {viewMode === 'CATEGORY' && (
        <div className="space-y-4">
          {expensesGroupedByCategory.map((group, idx) => (
            <Card key={idx} className="overflow-hidden border border-slate-200 dark:border-slate-800">
              <CardHeader 
                className="bg-slate-50/80 dark:bg-slate-800/40 py-3 px-6 flex flex-row items-center justify-between border-b dark:border-slate-700/50 cursor-pointer select-none hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors"
                onClick={() => setExpandedCategories(prev => ({ ...prev, [group.categoryId]: !prev[group.categoryId] }))}
              >
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-primary-500" />
                  <CardTitle className="text-base font-bold flex flex-wrap items-center gap-2">
                    <span>{group.categoryName}</span>
                    {(() => {
                      const linkedSuppliers = clients.filter(cl => cl.storeId === auth.currentStoreId && cl.type === 'SUPPLIER' && cl.linkedExpenseCategoryId === group.categoryId);
                      if (linkedSuppliers.length > 0) {
                        return (
                          <span className="text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border border-purple-200/30 dark:border-purple-800/30 px-2 py-0.5 rounded-lg">
                            (الموردين: {linkedSuppliers.map(s => s.name).join('، ')})
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </CardTitle>
                  <span className="text-xs font-semibold text-slate-500 bg-slate-200/60 dark:bg-slate-700/60 px-2 py-0.5 rounded-full">
                    {group.items.length} معاملة
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm font-bold text-red-600 dark:text-red-400">
                  <span>إجمالي المصروف: {formatCurrency(group.total, isRestricted)}</span>
                  {expandedCategories[group.categoryId] ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </CardHeader>
              <AnimatePresence>
                {expandedCategories[group.categoryId] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <CardContent className="p-0 border-t dark:border-slate-700/50">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-right">
                          <thead className="text-xs text-slate-400 bg-slate-50/40 dark:bg-slate-900/30">
                            <tr>
                              <th className="px-6 py-2.5">التاريخ</th>
                              <th className="px-6 py-2.5">المبلغ</th>
                              <th className="px-6 py-2.5">الملاحظات</th>
                              {canManage && <th className="px-6 py-2.5 text-center">الإجراءات</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {group.items.map(tx => (
                              <tr key={tx.id} className="border-b dark:border-slate-800/40 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                                  {new Date(tx.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                                </td>
                                <td className="px-6 py-3 font-bold">
                                  {(() => {
                              const isPayment = (clientOperations || []).some(op => op.expenseTransactionId === tx.id && op.type === 'PAYMENT');
                              return isPayment ? (
                                <span className="text-emerald-600 dark:text-emerald-400">-{formatCurrency(tx.amount, isRestricted)}</span>
                              ) : (
                                <span className="text-red-600 dark:text-red-400">{formatCurrency(tx.amount, isRestricted)}</span>
                              );
                            })()}
                          </td>
                          <td className="px-6 py-3 text-slate-500">{tx.notes || '-'}</td>
                          {canManage && (
                            <td className="px-6 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                  onClick={() => handleOpenEditExp(tx)}
                                  title="تعديل"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                                  onClick={() => setDeletingExpenseId(tx.id)}
                                  title="حذف"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          ))}
          {expensesGroupedByCategory.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center text-slate-500">
                لا توجد مصروفات مسجلة
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* VIEW 2: Grouped By Date */}
      {viewMode === 'DATE' && (
        <div className="space-y-4">
          {expensesGroupedByDate.map((group, idx) => (
            <Card key={idx} className="overflow-hidden border border-slate-200 dark:border-slate-800">
              <CardHeader 
                className="bg-slate-50/80 dark:bg-slate-800/40 py-3 px-6 flex flex-row items-center justify-between border-b dark:border-slate-700/50 cursor-pointer select-none hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors"
                onClick={() => setExpandedDates(prev => ({ ...prev, [group.dateKey]: !prev[group.dateKey] }))}
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary-500" />
                  <CardTitle className="text-base font-bold">{group.formattedDate}</CardTitle>
                  <span className="text-xs font-medium text-slate-400 font-mono">({group.dateKey})</span>
                </div>
                <div className="flex items-center gap-3 text-sm font-bold text-red-600 dark:text-red-400">
                  <span>مجموع اليوم: {formatCurrency(group.total, isRestricted)}</span>
                  {expandedDates[group.dateKey] ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </CardHeader>
              <AnimatePresence>
                {expandedDates[group.dateKey] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <CardContent className="p-0 border-t dark:border-slate-700/50">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-right">
                    <thead className="text-xs text-slate-400 bg-slate-50/40 dark:bg-slate-900/30">
                      <tr>
                        <th className="px-6 py-2.5">التصنيف</th>
                        <th className="px-6 py-2.5">المبلغ</th>
                        <th className="px-6 py-2.5">الملاحظات</th>
                        {canManage && <th className="px-6 py-2.5 text-center">الإجراءات</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map(tx => (
                        <tr key={tx.id} className="border-b dark:border-slate-800/40 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="px-6 py-3 font-medium">{tx.title}</td>
                          <td className="px-6 py-3 font-bold">
                            {(() => {
                              const isPayment = (clientOperations || []).some(op => op.expenseTransactionId === tx.id && op.type === 'PAYMENT');
                              return isPayment ? (
                                <span className="text-emerald-600 dark:text-emerald-400">-{formatCurrency(tx.amount, isRestricted)}</span>
                              ) : (
                                <span className="text-red-600 dark:text-red-400">{formatCurrency(tx.amount, isRestricted)}</span>
                              );
                            })()}
                          </td>
                          <td className="px-6 py-3 text-slate-500">{tx.notes || '-'}</td>
                          {canManage && (
                            <td className="px-6 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                  onClick={() => handleOpenEditExp(tx)}
                                  title="تعديل"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                                  onClick={() => setDeletingExpenseId(tx.id)}
                                  title="حذف"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          ))}

          {expensesGroupedByDate.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center text-slate-500">
                لا توجد مصروفات مسجلة
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* VIEW 3: All Transactions Table */}
      {viewMode === 'ALL' && (
        <Card>
          <CardHeader>
            <CardTitle>سجل المصروفات الكلي</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            
            {/* Mobile Cards View */}
            <div className="md:hidden flex flex-col gap-3 p-4">
              {filteredExpenses.map((tx) => {
                const catName = tx.categoryId ? (storeCategories.find(c => c.id === tx.categoryId)?.name || 'غير مصنف') : tx.title;
                const isPayment = (clientOperations || []).some(op => op.expenseTransactionId === tx.id && op.type === 'PAYMENT');
                return (
                  <div key={tx.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-slate-500">{new Date(tx.date).toLocaleDateString('ar-EG')}</span>
                      {canManage && (
                        <div className="flex items-center gap-1">
                          {!isPayment && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:hover:bg-blue-900/50" onClick={() => handleOpenEditExp(tx)}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 bg-rose-50 dark:bg-rose-900/30 dark:hover:bg-rose-900/50" onClick={() => setDeletingExpenseId(tx.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <div className="text-sm text-slate-500 mb-1">المبلغ</div>
                        <div className="text-lg font-bold text-rose-600">{formatCurrency(tx.amount, isRestricted)}</div>
                        {isPayment && <span className="text-xs text-rose-500 ms-2 font-bold">(سداد مورد)</span>}
                      </div>
                      <div className="text-left">
                        <div className="text-sm text-slate-500 mb-1">التصنيف</div>
                        <div className="font-bold">{catName}</div>
                      </div>
                    </div>
                    {tx.notes && (
                      <div className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg mt-1">
                        {tx.notes}
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredExpenses.length === 0 && (
                <div className="text-center p-6 text-slate-500">لا توجد مصروفات مسجلة</div>
              )}
            </div>
            
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-3 rounded-s-xl">التاريخ</th>
                    <th className="px-6 py-3">التصنيف</th>
                    <th className="px-6 py-3">المبلغ</th>
                    <th className="px-6 py-3">الملاحظات</th>
                    {canManage && <th className="px-6 py-3 rounded-e-xl text-center">الإجراءات</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((tx) => (
                    <tr key={tx.id} className="border-b dark:border-slate-700/50 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">{new Date(tx.date).toLocaleDateString('ar-EG')}</td>
                      <td className="px-6 py-4 font-medium">{tx.title}</td>
                      <td className="px-6 py-4 font-bold">
                            {(() => {
                              const isPayment = (clientOperations || []).some(op => op.expenseTransactionId === tx.id && op.type === 'PAYMENT');
                              return isPayment ? (
                                <span className="text-emerald-600 dark:text-emerald-400">-{formatCurrency(tx.amount, isRestricted)}</span>
                              ) : (
                                <span className="text-red-600 dark:text-red-400">{formatCurrency(tx.amount, isRestricted)}</span>
                              );
                            })()}
                          </td>
                      <td className="px-6 py-4 text-slate-500">{tx.notes || '-'}</td>
                      {canManage && (
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                              onClick={() => handleOpenEditExp(tx)}
                              title="تعديل المصروف"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                              onClick={() => setDeletingExpenseId(tx.id)}
                              title="حذف المصروف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {filteredExpenses.length === 0 && (
                    <tr>
                      <td colSpan={canManage ? 5 : 4} className="px-6 py-8 text-center text-slate-500">لا توجد مصروفات مسجلة</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal Manage Categories */}
      <Modal isOpen={isCatModalOpen} onClose={() => setIsCatModalOpen(false)} title="إدارة التصنيفات">
        <form onSubmit={handleAddCat} className="space-y-4 mb-6">
          {saveCatSuccessMsg && (
            <div className="p-3 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 border border-green-200 dark:border-green-800/50 rounded-xl flex items-center gap-2 text-sm font-medium animate-in fade-in zoom-in duration-200">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>{saveCatSuccessMsg}</span>
            </div>
          )}
          <div className="space-y-2">
            <Label>اسم التصنيف</Label>
            <Input required value={catName} onChange={e => setCatName(e.target.value)} />
          </div>
          <Button type="submit" className="w-full mt-4">حفظ التصنيف</Button>
        </form>

        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          <Label className="text-sm font-bold text-slate-700 dark:text-slate-300">التصنيفات الحالية</Label>
          {storeCategories.map(cat => {
            const isUsedInTransactions = transactions.some(t => t.categoryId === cat.id);
            const isUsedInClients = clients.some(c => c.linkedExpenseCategoryId === cat.id);
            const isUsed = isUsedInTransactions || isUsedInClients;

            return (
              <div key={cat.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="font-medium text-sm">{cat.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 ${isUsed ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40'}`}
                  disabled={isUsed}
                  title={isUsed ? 'لا يمكن حذف هذا التصنيف لوجود بيانات مرتبطة به' : 'حذف التصنيف'}
                  onClick={() => {
                    if (!isUsed && window.confirm('هل أنت متأكد من حذف هذا التصنيف؟')) {
                      deleteExpenseCategory(cat.id);
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
          {storeCategories.length === 0 && (
            <p className="text-sm text-center text-slate-500 py-4">لا توجد تصنيفات بعد.</p>
          )}
        </div>
      </Modal>

      {/* Modal Add/Edit Expense */}
      <Modal isOpen={isExpModalOpen} onClose={() => setIsExpModalOpen(false)} title={editingExpense ? "تعديل بيانات المصروف" : "إضافة مصروف جديد"}>
        <form onSubmit={handleSaveExp} className="space-y-4">
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
            <Label>التصنيف</Label>
            <select 
              required
              className="flex h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              value={categoryId} 
              onChange={e => setCategoryId(e.target.value)}
            >
              <option value="" disabled>اختر التصنيف</option>
              {storeCategories.map(c => {
                const linkedSuppliers = clients.filter(cl => cl.storeId === auth.currentStoreId && cl.type === 'SUPPLIER' && cl.linkedExpenseCategoryId === c.id);
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} {linkedSuppliers.length > 0 ? `(موردين: ${linkedSuppliers.map(s => s.name).join('، ')})` : ''}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="space-y-2">
            <Label>المبلغ (₪)</Label>
            <NumberInput required value={amount} onChange={val => setAmount(val)} placeholder="0.00" />
          </div>
          <div className="space-y-2">
            <Label>ملاحظات</Label>
            <Input type="text" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <Button type="submit" className="w-full mt-4">
            {editingExpense ? "حفظ التعديلات" : "حفظ المصروف"}
          </Button>
        </form>
      </Modal>

      {/* Modal Delete Confirmation */}
      <Modal isOpen={Boolean(deletingExpenseId)} onClose={() => setDeletingExpenseId(null)} title="تأكيد الحذف">
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-4 rounded-xl">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <p className="text-sm font-medium">
              هل أنت تأكد من رغبتك في حذف هذا المصروف؟ لا يمكن التراجع عن هذا الإجراء بعد تنفيذه.
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="destructive" className="flex-1" onClick={handleDeleteExp}>
              تأكيد الحذف
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setDeletingExpenseId(null)}>
              إلغاء
            </Button>
          </div>
        </div>
      </Modal>

      {/* Mobile FAB */}
      <div className="md:hidden fixed bottom-20 left-4 z-40">
        <Button 
          className="h-14 w-14 rounded-full shadow-lg bg-rose-600 hover:bg-rose-700 flex items-center justify-center p-0"
          onClick={handleOpenAddExp}
        >
          <Plus className="w-6 h-6 text-white" />
        </Button>
      </div>

    </div>
  );
}

