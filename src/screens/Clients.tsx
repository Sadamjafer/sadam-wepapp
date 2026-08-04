import { useState, useMemo, FormEvent } from 'react';
import { useStore } from '../store/useStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { NumberInput } from '../components/ui/NumberInput';
import { Label } from '../components/ui/Label';
import { formatCurrency, parseInputDateToISO } from '../lib/utils';
import { 
  Plus, UserPlus, Calendar, Search, Edit2, Trash2, 
  ArrowUpRight, ArrowDownLeft, Wallet, Users, 
  FileText, CheckCircle2, AlertTriangle, RefreshCw, Tag, Link2, Truck, Layers, ArrowRight
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { ClientOpType, ClientOperation, ClientType } from '../types';

type ViewTab = 'STATEMENT' | 'SUMMARY' | 'SUPPLIER_EXPENSES';
type EntityFilter = 'CLIENT' | 'SUPPLIER' | 'ALL';

export function Clients() {
  const { 
    auth, clients, clientOperations, expenseCategories, addExpenseCategory, transactions,
    addTransaction, updateTransaction, deleteTransaction,
    addClient, updateClient, deleteClient, 
    addClientOperation, updateClientOperation, deleteClientOperation 
  } = useStore();

  const [entityFilter, setEntityFilter] = useState<EntityFilter>('CLIENT');
  const [activeTab, setActiveTab] = useState<ViewTab>('STATEMENT');
  const [selectedClientId, setSelectedClientId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [supplierDetailTab, setSupplierDetailTab] = useState<'STATEMENT' | 'EXPENSES'>('STATEMENT');

  // Notification state
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'danger' } | null>(null);
  const showNotification = (message: string, type: 'success' | 'danger' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Modals state
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientType, setClientType] = useState<ClientType>('CLIENT');
  const [linkedExpenseCategoryId, setLinkedExpenseCategoryId] = useState<string>('');
  const [saveClientSuccessMsg, setSaveClientSuccessMsg] = useState('');

  const [isOpModalOpen, setIsOpModalOpen] = useState(false);
  const [editingOp, setEditingOp] = useState<ClientOperation | null>(null);
  const [opClientId, setOpClientId] = useState('');
  const [opType, setOpType] = useState<ClientOpType>('DEBT');
  const [opAmount, setOpAmount] = useState('');
  const [opDesc, setOpDesc] = useState('');
  const [opDate, setOpDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [saveOpSuccessMsg, setSaveOpSuccessMsg] = useState('');

  // Delete confirmations
  const [deletingOpId, setDeletingOpId] = useState<string | null>(null);
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);

  const isRestricted = auth.role === 'RESTRICTED';
  const canManage = auth.role === 'ADMIN';

  // Filter clients belonging to current store
  const storeClients = useMemo(() => {
    return clients.filter(c => c.storeId === auth.currentStoreId);
  }, [clients, auth.currentStoreId]);

  // Clients filtered by active Entity Tab (CLIENT, SUPPLIER, or ALL)
  const filteredStoreClients = useMemo(() => {
    if (entityFilter === 'ALL') return storeClients;
    return storeClients.filter(c => (c.type || 'CLIENT') === entityFilter);
  }, [storeClients, entityFilter]);

  const filteredStoreClientIds = useMemo(() => new Set(filteredStoreClients.map(c => c.id)), [filteredStoreClients]);

  // Filter expense categories for current store
  const storeExpenseCategories = useMemo(() => {
    return expenseCategories.filter(c => c.storeId === auth.currentStoreId);
  }, [expenseCategories, auth.currentStoreId]);

  // Filter client operations belonging to current store & current entity filter
  const storeOperations = useMemo(() => {
    return clientOperations.filter(op => {
      const clientObj = storeClients.find(c => c.id === op.clientId);
      if (!clientObj) return false;
      if (entityFilter === 'ALL') return true;
      return (clientObj.type || 'CLIENT') === entityFilter;
    });
  }, [clientOperations, storeClients, entityFilter]);

  // Overall statistics for active entity filter
  const stats = useMemo(() => {
    let totalDebts = 0;
    let totalPayments = 0;

    storeOperations.forEach(op => {
      if (op.type === 'DEBT') totalDebts += op.amount;
      if (op.type === 'PAYMENT') totalPayments += op.amount;
    });

    const netOutstanding = totalDebts - totalPayments;
    return {
      count: filteredStoreClients.length,
      totalDebts,
      totalPayments,
      netOutstanding
    };
  }, [storeOperations, filteredStoreClients]);

  // Handler: Add / Edit Client
  const handleOpenAddClient = (typeOverride?: ClientType) => {
    setEditingClientId(null);
    setClientName('');
    const defaultType = typeOverride || (entityFilter === 'SUPPLIER' ? 'SUPPLIER' : 'CLIENT');
    setClientType(defaultType);
    setLinkedExpenseCategoryId('');
    setSaveClientSuccessMsg('');
    setIsClientModalOpen(true);
  };

  const handleOpenEditClient = (c: { id: string; name: string; type?: ClientType; linkedExpenseCategoryId?: string }) => {
    setEditingClientId(c.id);
    setClientName(c.name);
    setClientType(c.type || 'CLIENT');
    setLinkedExpenseCategoryId(c.linkedExpenseCategoryId || '');
    setIsClientModalOpen(true);
  };

  const handleAutoCreateExpenseCategory = () => {
    if (!clientName.trim() || !auth.currentStoreId) return;
    const nameToUse = clientName.trim();
    const existing = storeExpenseCategories.find(c => c.name.trim().toLowerCase() === nameToUse.toLowerCase());
    
    if (existing) {
      setLinkedExpenseCategoryId(existing.id);
      showNotification(`تم تحديد بند المصروفات الموجود: "${existing.name}"`);
    } else {
      const newId = addExpenseCategory({
        storeId: auth.currentStoreId,
        name: nameToUse
      });
      setLinkedExpenseCategoryId(newId);
      showNotification(`تم إنشاء بند مصروفات جديد باسم "${nameToUse}" وربطه بالمورد`);
    }
  };

  const handleSaveClient = (e: FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !auth.currentStoreId) return;

    const finalLinkedCatId = clientType === 'SUPPLIER' ? (linkedExpenseCategoryId || undefined) : undefined;

    if (editingClientId) {
      if (!window.confirm('هل أنت متأكد من حفظ التعديلات؟')) return;
      updateClient(editingClientId, { 
        name: clientName.trim(), 
        type: clientType,
        linkedExpenseCategoryId: finalLinkedCatId
      });
      showNotification('تم تعديل البيانات بنجاح');
      setIsClientModalOpen(false);
      setClientName('');
      setLinkedExpenseCategoryId('');
    } else {
      addClient({ 
        storeId: auth.currentStoreId, 
        name: clientName.trim(), 
        type: clientType,
        linkedExpenseCategoryId: finalLinkedCatId
      });
      
      setSaveClientSuccessMsg('تم حفظ الحساب بنجاح!');
      setTimeout(() => setSaveClientSuccessMsg(''), 3000);
      
      setClientName('');
      setLinkedExpenseCategoryId('');
    }
  };

  const handleConfirmDeleteClient = () => {
    if (!deletingClientId) return;
    deleteClient(deletingClientId);
    if (selectedClientId === deletingClientId) setSelectedClientId('ALL');
    setDeletingClientId(null);
    showNotification('تم حذف العميل وجميع حركاته', 'danger');
  };

  // Handler: Add / Edit Operation
  const handleOpenAddOp = (clientIdDefault?: string) => {
    setEditingOp(null);
    setOpClientId(clientIdDefault || (filteredStoreClients[0]?.id || storeClients[0]?.id || ''));
    setOpType('DEBT');
    setOpAmount('');
    setOpDesc('');
    setOpDate(new Date().toISOString().split('T')[0]);
    setSaveOpSuccessMsg('');
    setIsOpModalOpen(true);
  };

  const handleOpenEditOp = (op: ClientOperation) => {
    setEditingOp(op);
    setOpClientId(op.clientId);
    setOpType(op.type);
    setOpAmount(String(op.amount));
    setOpDesc(op.description || '');
    setOpDate(op.date ? op.date.split('T')[0] : new Date().toISOString().split('T')[0]);
    setIsOpModalOpen(true);
  };

  const handleSaveOp = (e: FormEvent) => {
    e.preventDefault();
    if (!opAmount || !opClientId) return;

    const formattedDate = parseInputDateToISO(opDate);
    const numAmount = parseFloat(opAmount);

    const targetClient = storeClients.find(c => c.id === opClientId);
    const isSupplier = targetClient?.type === 'SUPPLIER';

    let linkedTxId = editingOp?.expenseTransactionId;

    // Handle linked Expense Transaction for Supplier PAYMENT
    if (isSupplier && opType === 'PAYMENT' && targetClient?.linkedExpenseCategoryId && auth.currentStoreId) {
      if (editingOp && linkedTxId) {
        updateTransaction(linkedTxId, {
          title: `سداد للمورد: ${targetClient.name}${opDesc ? ` (${opDesc})` : ''}`,
          amount: numAmount,
          type: 'EXPENSE',
          categoryId: targetClient.linkedExpenseCategoryId,
          notes: opDesc || `سداد لحساب المورد: ${targetClient.name}`,
          date: formattedDate
        });
      } else {
        linkedTxId = addTransaction({
          storeId: auth.currentStoreId,
          title: `سداد للمورد: ${targetClient.name}${opDesc ? ` (${opDesc})` : ''}`,
          amount: numAmount,
          type: 'EXPENSE',
          categoryId: targetClient.linkedExpenseCategoryId,
          notes: opDesc || `سداد لحساب المورد: ${targetClient.name}`,
          date: formattedDate
        });
      }
    } else if (editingOp && linkedTxId && (opType !== 'PAYMENT' || !isSupplier)) {
      // If switched from PAYMENT to DEBT or from supplier to client, remove unneeded expense transaction
      deleteTransaction(linkedTxId);
      linkedTxId = undefined;
    }

    if (editingOp) {
      if (!window.confirm('هل أنت متأكد من حفظ التعديلات؟')) return;
      updateClientOperation(editingOp.id, {
        clientId: opClientId,
        type: opType,
        amount: numAmount,
        description: opDesc,
        date: formattedDate,
        expenseTransactionId: linkedTxId
      });
      showNotification('تم تعديل الحركة بنجاح');
      setIsOpModalOpen(false);
    } else {
      addClientOperation({
        clientId: opClientId,
        type: opType,
        amount: numAmount,
        description: opDesc,
        date: formattedDate,
        expenseTransactionId: linkedTxId
      });
      setSaveOpSuccessMsg('تم حفظ الحركة بنجاح!');
      setTimeout(() => setSaveOpSuccessMsg(''), 3000);
      
      setOpAmount('');
      setOpDesc('');
    }
  };

  const handleConfirmDeleteOp = () => {
    if (!deletingOpId) return;
    const opToDelete = storeOperations.find(op => op.id === deletingOpId);
    if (opToDelete?.expenseTransactionId) {
      deleteTransaction(opToDelete.expenseTransactionId);
    }
    deleteClientOperation(deletingOpId);
    setDeletingOpId(null);
    showNotification('تم حذف الحركة بنجاح', 'danger');
  };

  // Client / Supplier Summary Data Table
  const clientsSummaryList = useMemo(() => {
    const searchLower = searchQuery.toLowerCase().trim();

    return filteredStoreClients
      .map(c => {
        const ops = clientOperations.filter(op => op.clientId === c.id);
        const totalDebt = ops.filter(op => op.type === 'DEBT').reduce((acc, b) => acc + b.amount, 0);
        const totalPayment = ops.filter(op => op.type === 'PAYMENT').reduce((acc, b) => acc + b.amount, 0);
        const netBalance = totalDebt - totalPayment; // positive = owes store / supplier balance, negative = credit balance

        // find latest operation date
        let lastOpDate = '-';
        if (ops.length > 0) {
          const sortedOps = [...ops].sort((a, b) => b.date.localeCompare(a.date));
          lastOpDate = sortedOps[0].date ? sortedOps[0].date.split('T')[0] : '-';
        }

        return {
          id: c.id,
          name: c.name,
          type: c.type || 'CLIENT',
          linkedExpenseCategoryId: c.linkedExpenseCategoryId,
          totalDebt,
          totalPayment,
          netBalance,
          opsCount: ops.length,
          lastOpDate
        };
      })
      .filter(c => !searchLower || c.name.toLowerCase().includes(searchLower));
  }, [filteredStoreClients, clientOperations, searchQuery]);

  // Detailed Cumulative Balance Statement Table
  const cumulativeOperationsList = useMemo(() => {
    let filtered = [...storeOperations];

    if (selectedClientId !== 'ALL') {
      filtered = filtered.filter(op => op.clientId === selectedClientId);
    }

    const searchLower = searchQuery.toLowerCase().trim();
    if (searchLower) {
      filtered = filtered.filter(op => {
        const clientObj = clients.find(c => c.id === op.clientId);
        const cName = clientObj ? clientObj.name.toLowerCase() : '';
        const desc = op.description ? op.description.toLowerCase() : '';
        const dateStr = op.date ? op.date.split('T')[0] : '';
        return cName.includes(searchLower) || desc.includes(searchLower) || dateStr.includes(searchLower);
      });
    }

    // Map clients dictionary for quick lookup
    const clientMap = new Map<string, string>();
    const clientTypeMap = new Map<string, ClientType>();
    storeClients.forEach(c => {
      clientMap.set(c.id, c.name);
      clientTypeMap.set(c.id, c.type || 'CLIENT');
    });

    if (selectedClientId !== 'ALL') {
      const sortedChronological = [...filtered].sort((a, b) => {
        const dDiff = a.date.localeCompare(b.date);
        return dDiff !== 0 ? dDiff : a.id.localeCompare(b.id);
      });

      let running = 0;
      const itemsWithCumulative = sortedChronological.map(op => {
        if (op.type === 'DEBT') running += op.amount;
        if (op.type === 'PAYMENT') running -= op.amount;

        return {
          ...op,
          clientName: clientMap.get(op.clientId) || 'حساب غير معروف',
          clientType: clientTypeMap.get(op.clientId) || 'CLIENT',
          cumulativeBalance: running
        };
      });

      return itemsWithCumulative.reverse();
    } else {
      const clientRunners = new Map<string, number>();

      const allSortedChronological = [...filtered].sort((a, b) => {
        const dDiff = a.date.localeCompare(b.date);
        return dDiff !== 0 ? dDiff : a.id.localeCompare(b.id);
      });

      const itemsWithCumulative = allSortedChronological.map(op => {
        let running = clientRunners.get(op.clientId) || 0;
        if (op.type === 'DEBT') running += op.amount;
        if (op.type === 'PAYMENT') running -= op.amount;
        clientRunners.set(op.clientId, running);

        return {
          ...op,
          clientName: clientMap.get(op.clientId) || 'حساب غير معروف',
          clientType: clientTypeMap.get(op.clientId) || 'CLIENT',
          cumulativeBalance: running
        };
      });

      return itemsWithCumulative.reverse();
    }
  }, [storeOperations, selectedClientId, searchQuery, storeClients, clients]);

  // Supplier Linked Expenses Table computation (Date, Amount, Cumulative Balance)
  const supplierExpenseList = useMemo(() => {
    const categoryToSupplierMap = new Map<string, string[]>();
    const supplierCategoryIds = new Set<string>();

    storeClients.forEach(c => {
      if (c.type === 'SUPPLIER' && c.linkedExpenseCategoryId) {
        if (selectedClientId === 'ALL' || selectedClientId === c.id) {
          supplierCategoryIds.add(c.linkedExpenseCategoryId);
          const current = categoryToSupplierMap.get(c.linkedExpenseCategoryId) || [];
          if (!current.includes(c.name)) {
            categoryToSupplierMap.set(c.linkedExpenseCategoryId, [...current, c.name]);
          }
        }
      }
    });

    if (supplierCategoryIds.size === 0) return [];

    const searchLower = searchQuery.toLowerCase().trim();
    const filteredTx = transactions.filter(tx => {
      if (tx.storeId !== auth.currentStoreId) return false;
      if (tx.type !== 'EXPENSE') return false;
      if (!tx.categoryId || !supplierCategoryIds.has(tx.categoryId)) return false;

      if (searchLower) {
        const titleMatch = tx.title.toLowerCase().includes(searchLower);
        const notesMatch = tx.notes ? tx.notes.toLowerCase().includes(searchLower) : false;
        const linkedSuppliers = categoryToSupplierMap.get(tx.categoryId) || [];
        const suppMatch = linkedSuppliers.some(name => name.toLowerCase().includes(searchLower));
        return titleMatch || notesMatch || suppMatch;
      }
      return true;
    });

    const sortedChronological = [...filteredTx].sort((a, b) => {
      const dDiff = a.date.localeCompare(b.date);
      return dDiff !== 0 ? dDiff : a.id.localeCompare(b.id);
    });

    const categoryRunners = new Map<string, number>();

    const itemsWithCumulative = sortedChronological.map(tx => {
      const catId = tx.categoryId!;
      let running = categoryRunners.get(catId) || 0;
      
      const isPayment = clientOperations.some(op => op.expenseTransactionId === tx.id && op.type === 'PAYMENT');
      if (isPayment) {
        running -= tx.amount;
      } else {
        running += tx.amount;
      }
      categoryRunners.set(catId, running);

      const suppliers = categoryToSupplierMap.get(catId) || [];

      return {
        ...tx,
        supplierName: suppliers.join('، ') || 'مورد',
        cumulativeBalance: running,
        isSupplierPayment: isPayment
      };
    });

    return itemsWithCumulative.reverse();
  }, [storeClients, selectedClientId, transactions, auth.currentStoreId, searchQuery]);

  const renderStatementTable = (opsList: typeof cumulativeOperationsList) => {
    if (opsList.length === 0) {
      return (
        <div className="p-12 text-center text-slate-500">
          <p className="font-bold">لا توجد حركات مالية مسجلة لهذا الحساب</p>
          <p className="text-xs mt-1">اضغط على "تسجيل حركة جديدة" للبدء.</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-right">
          <thead className="text-xs font-semibold text-slate-500 bg-slate-100/70 dark:bg-slate-800/70 border-b dark:border-slate-700">
            <tr>
              <th className="px-5 py-3 w-12 text-center">م</th>
              <th className="px-5 py-3">التاريخ</th>
              <th className="px-5 py-3">الحساب</th>
              <th className="px-5 py-3">نوع الحركة</th>
              <th className="px-5 py-3">البيان / ملاحظات</th>
              <th className="px-5 py-3">المبلغ</th>
              <th className="px-5 py-3">الرصيد التراكمي</th>
              {canManage && <th className="px-5 py-3 text-center">الإجراءات</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {opsList.map((op, idx) => {
              const isDebt = op.type === 'DEBT';
              const cumBal = op.cumulativeBalance;
              const isSupp = op.clientType === 'SUPPLIER';

              return (
                <tr key={op.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3 text-center text-xs text-slate-400 font-mono">
                    {opsList.length - idx}
                  </td>
                  <td className="px-5 py-3 text-xs font-medium whitespace-nowrap text-slate-600 dark:text-slate-400">
                    {op.date ? op.date.split('T')[0] : '-'}
                  </td>
                  <td className="px-5 py-3 font-semibold text-slate-900 dark:text-slate-100">
                    {op.clientName}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      isDebt 
                        ? (isSupp
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300')
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                    }`}>
                      {isDebt ? (isSupp ? 'وارد جديد (+)' : 'دين عليه (+)') : 'سداد (-)'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">
                    {op.description || '-'}
                  </td>
                  <td className={`px-5 py-3 font-bold ${isDebt ? (isSupp ? 'text-purple-600 dark:text-purple-400' : 'text-rose-600 dark:text-rose-400') : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {formatCurrency(op.amount, isRestricted)}
                  </td>
                  <td className="px-5 py-3 font-bold whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                      cumBal > 0 
                        ? (isSupp ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300') 
                        : cumBal < 0 
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' 
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      {cumBal > 0 ? (isSupp ? 'له: ' : 'عليه: ') : cumBal < 0 ? (isSupp ? 'عليه: ' : 'له: ') : ''}
                      {formatCurrency(Math.abs(cumBal), isRestricted)}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-5 py-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                          onClick={() => handleOpenEditOp(op)}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          onClick={() => setDeletingOpId(op.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderLinkedExpensesTable = (expenseList: typeof supplierExpenseList) => {
    if (expenseList.length === 0) {
      return (
        <div className="p-12 text-center text-slate-500">
          <p className="font-bold">لا توجد مصروفات مرتبطة مسجلة حالياً</p>
          <p className="text-xs mt-1">عند صرف دفعات أو فواتير لهذا البند في المصروفات، ستظهر هنا تلقائياً.</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-right">
          <thead className="text-xs font-semibold text-slate-500 bg-slate-100/70 dark:bg-slate-800/70 border-b dark:border-slate-700">
            <tr>
              <th className="px-5 py-3 w-12 text-center">م</th>
              <th className="px-5 py-3">التاريخ</th>
              <th className="px-5 py-3">البيان / ملاحظات المصروف</th>
              <th className="px-5 py-3">المبلغ</th>
              <th className="px-5 py-3">الرصيد التراكمي للمصروف</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {expenseList.map((tx, idx) => (
              <tr key={tx.id} className="hover:bg-purple-50/30 dark:hover:bg-purple-950/20 transition-colors">
                <td className="px-5 py-3 text-center text-xs text-slate-400 font-mono">
                  {expenseList.length - idx}
                </td>
                <td className="px-5 py-3 text-xs text-slate-600 dark:text-slate-400 font-medium">
                  {tx.date}
                </td>
                <td className="px-5 py-3 text-xs text-slate-700 dark:text-slate-300 max-w-xs">
                  <p className="font-semibold">{tx.title}</p>
                  {tx.notes && <p className="text-[10px] text-slate-400 mt-0.5">{tx.notes}</p>}
                </td>
                <td className={`px-5 py-3 font-bold ${tx.isSupplierPayment ? 'text-emerald-600 dark:text-emerald-400' : 'text-purple-700 dark:text-purple-400'}`}>
                  {tx.isSupplierPayment ? '-' : ''}{formatCurrency(tx.amount, isRestricted)}
                </td>
                <td className="px-5 py-3 font-bold whitespace-nowrap">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    tx.cumulativeBalance < 0 
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border border-emerald-100 dark:border-emerald-800/60'
                      : 'bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 border border-purple-100 dark:border-purple-800/60'
                  }`}>
                    {formatCurrency(tx.cumulativeBalance, isRestricted)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderListView = () => {
    return (
      <div className="space-y-6">
        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-2 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
            {[
              { filter: 'CLIENT', label: 'حسابات العملاء', count: storeClients.filter(c => (c.type || 'CLIENT') === 'CLIENT').length, icon: Users, color: 'bg-blue-600' },
              { filter: 'SUPPLIER', label: 'حسابات الموردين', count: storeClients.filter(c => c.type === 'SUPPLIER').length, icon: Truck, color: 'bg-purple-600' },
              { filter: 'ALL', label: 'جميع الحسابات', count: storeClients.length, icon: Layers, color: 'bg-slate-900' }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = entityFilter === tab.filter;
              return (
                <button
                  key={tab.filter}
                  type="button"
                  onClick={() => { setEntityFilter(tab.filter as EntityFilter); setSelectedClientId('ALL'); }}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                    isActive ? `${tab.color} text-white shadow-md` : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-black/25 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700'}`}>{tab.count}</span>
                </button>
              );
            })}
          </div>

          {canManage && (
            <div className="flex items-center gap-2 justify-end">
              <Button variant="outline" onClick={() => handleOpenAddClient()} className="gap-1.5 text-xs font-bold">
                <UserPlus className="w-4 h-4" />
                <span>إضافة حساب جديد</span>
              </Button>
              <Button onClick={() => handleOpenAddOp()} className="gap-1.5 text-xs font-bold">
                <Plus className="w-4 h-4" />
                <span>تسجيل حركة جديدة</span>
              </Button>
            </div>
          )}
        </div>

        {/* Title Header */}
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            {entityFilter === 'CLIENT' ? <Users className="w-6 h-6 text-blue-600" /> : entityFilter === 'SUPPLIER' ? <Truck className="w-6 h-6 text-purple-600" /> : <Layers className="w-6 h-6 text-slate-700" />}
            <span>{entityFilter === 'CLIENT' ? 'حسابات العملاء والديون' : entityFilter === 'SUPPLIER' ? 'حسابات الموردين والتوريدات' : 'سجل العملاء والموردين الشامل'}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">اضغط على أي حساب للانتقال لصفحة البيانات وكشف الحساب التفصيلي الخاص به.</p>
        </div>

        {/* Search Box */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
          <Input
            type="text"
            placeholder="بحث بالاسم..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pe-9 h-10 text-xs"
          />
        </div>

        {/* Accounts Grid */}
        {clientsSummaryList.length === 0 ? (
          <div className="p-12 text-center text-slate-500 bg-white dark:bg-slate-900 border rounded-2xl">
            <p className="font-bold">لا يوجد نتائج تطابق البحث</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clientsSummaryList.map(c => (
              <Card 
                key={c.id} 
                className="group cursor-pointer hover:border-primary-400 dark:hover:border-primary-800 transition-all duration-300 hover:shadow-md border-slate-200/80 dark:border-slate-700/80"
                onClick={() => { setSelectedClientId(c.id); setSupplierDetailTab('STATEMENT'); }}
              >
                <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-2xl ${c.type === 'SUPPLIER' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'}`}>
                        {c.type === 'SUPPLIER' ? <Truck className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors text-sm sm:text-base">{c.name}</h3>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.type === 'SUPPLIER' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'}`}>{c.type === 'SUPPLIER' ? 'مورد' : 'عميل'}</span>
                          {c.type === 'SUPPLIER' && c.linkedExpenseCategoryId && (() => {
                            const linkedCat = storeExpenseCategories.find(cat => cat.id === c.linkedExpenseCategoryId);
                            return (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-100/60" title={linkedCat ? `مرتبط ببند: ${linkedCat.name}` : ''}>
                                <Link2 className="w-3 h-3 text-amber-500" />
                                <span>بند: {linkedCat ? linkedCat.name : 'بند غير موجود'}</span>
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                    <div className="text-slate-400 group-hover:text-primary-500 transition-all transform group-hover:translate-x-1">
                      <ArrowRight className="w-4 h-4 transform rotate-180" />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                    <span>الرصيد المتبقي:</span>
                    <span className={`font-bold ${c.netBalance > 0 ? (c.type === 'SUPPLIER' ? 'text-purple-700 dark:text-purple-400' : 'text-rose-600 dark:text-rose-400') : c.netBalance < 0 ? (c.type === 'SUPPLIER' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400') : 'text-slate-500'}`}>
                      {c.netBalance > 0 ? (c.type === 'SUPPLIER' ? 'له للمورد: ' : 'عليه: ') : c.netBalance < 0 ? (c.type === 'SUPPLIER' ? 'عليه للمورد: ' : 'له: ') : 'متزن '}
                      {c.netBalance !== 0 && formatCurrency(Math.abs(c.netBalance), isRestricted)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderDetailView = () => {
    const selectedClientObj = storeClients.find(c => c.id === selectedClientId);
    if (!selectedClientObj) {
      setTimeout(() => setSelectedClientId('ALL'), 0);
      return null;
    }

    const clientSummaryObj = clientsSummaryList.find(c => c.id === selectedClientId) || { totalDebt: 0, totalPayment: 0, netBalance: 0, opsCount: 0, lastOpDate: '-' };
    const isSupplierDetail = selectedClientObj.type === 'SUPPLIER';

    return (
      <div className="space-y-6">
        {/* Back Button & Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setSelectedClientId('ALL')}
              className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 font-bold self-start bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border dark:border-slate-700"
            >
              <ArrowRight className="w-4 h-4" />
              <span>العودة لجميع الحسابات</span>
            </button>
            
            <div className="flex items-center gap-2.5 mt-2">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{selectedClientObj.name}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${isSupplierDetail ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'}`}>{isSupplierDetail ? 'مورد' : 'عميل'}</span>
            </div>
            
            {isSupplierDetail && (
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                {selectedClientObj.linkedExpenseCategoryId ? (() => {
                  const linkedCat = storeExpenseCategories.find(cat => cat.id === selectedClientObj.linkedExpenseCategoryId);
                  const otherSuppliers = storeClients.filter(c => c.type === 'SUPPLIER' && c.linkedExpenseCategoryId === selectedClientObj.linkedExpenseCategoryId && c.id !== selectedClientObj.id);
                  const otherSuppliersText = otherSuppliers.length > 0 ? ` (مشترك مع: ${otherSuppliers.map(s => s.name).join('، ')})` : '';
                  return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/50">
                      <Link2 className="w-3.5 h-3.5 text-amber-500" />
                      <span>مرتبط ببند المصروفات: <strong>{linkedCat ? linkedCat.name : 'بند غير موجود'}</strong>{otherSuppliersText}</span>
                    </span>
                  );
                })() : (
                  <span className="text-rose-600 dark:text-rose-400 font-semibold">غير مرتبط ببند مصروفات</span>
                )}
              </div>
            )}
          </div>

          {canManage && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => handleOpenEditClient(selectedClientObj)} className="gap-1.5 text-xs font-bold">
                <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                <span>تعديل الحساب</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleOpenAddOp(selectedClientObj.id)} className="gap-1.5 text-xs font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-slate-700">
                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                <span>تسجيل حركة جديدة</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDeletingClientId(selectedClientObj.id)} className="gap-1.5 text-xs font-bold text-rose-600 border-rose-200 hover:bg-rose-50">
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف الحساب</span>
              </Button>
            </div>
          )}
        </div>

        {/* Individual KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border border-slate-100 dark:border-slate-800">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${isSupplierDetail ? 'bg-purple-100 text-purple-600' : 'bg-rose-100 text-rose-600'}`}>
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">{isSupplierDetail ? 'إجمالي التوريدات (وارد جديد)' : 'إجمالي الديون (دين عليه)'}</p>
                <p className={`text-lg font-bold mt-0.5 ${isSupplierDetail ? 'text-purple-700 dark:text-purple-400' : 'text-rose-600 dark:text-rose-400'}`}>{formatCurrency(clientSummaryObj.totalDebt, isRestricted)}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-100 dark:border-slate-800">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-600">
                <ArrowDownLeft className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">إجمالي المسدد</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{formatCurrency(clientSummaryObj.totalPayment, isRestricted)}</p>
              </div>
            </CardContent>
          </Card>

          <Card className={`border ${clientSummaryObj.netBalance > 0 ? (isSupplierDetail ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-100 dark:border-purple-800' : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-850') : clientSummaryObj.netBalance < 0 ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-850' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700"><Wallet className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-slate-500 font-medium">الرصيد المتبقي</p>
                <p className="text-lg font-bold mt-0.5">
                  <span className={clientSummaryObj.netBalance > 0 ? (isSupplierDetail ? 'text-purple-700 dark:text-purple-400' : 'text-rose-600 dark:text-rose-400') : clientSummaryObj.netBalance < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}>
                    {clientSummaryObj.netBalance > 0 ? (isSupplierDetail ? 'له للمورد: ' : 'عليه: ') : clientSummaryObj.netBalance < 0 ? (isSupplierDetail ? 'عليه للمورد: ' : 'له: ') : 'متزن'}
                    {clientSummaryObj.netBalance !== 0 && formatCurrency(Math.abs(clientSummaryObj.netBalance), isRestricted)}
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Account Statements tables */}
        {!isSupplierDetail ? (
          <Card className="overflow-hidden">
            <CardHeader className="bg-slate-50/80 dark:bg-slate-800/40 py-3.5 px-6 border-b dark:border-slate-700/50">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-blue-900 dark:text-blue-200">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>كشف حركات الحساب التفصيلي للعميل</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {renderStatementTable(cumulativeOperationsList)}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex border-b border-slate-200 dark:border-slate-700">
              <button type="button" onClick={() => setSupplierDetailTab('STATEMENT')} className={`pb-3 px-6 text-sm font-bold border-b-2 transition-all ${supplierDetailTab === 'STATEMENT' ? 'border-purple-600 text-purple-700 dark:text-purple-400' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>كشف حركات الحساب والعمليات</button>
              <button type="button" onClick={() => setSupplierDetailTab('EXPENSES')} className={`pb-3 px-6 text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 ${supplierDetailTab === 'EXPENSES' ? 'border-purple-600 text-purple-700 dark:text-purple-400' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                <span>سجل المصروفات المرتبطة بالمورد</span>
                {supplierExpenseList.length > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-300 font-bold">{supplierExpenseList.length}</span>}
              </button>
            </div>

            {supplierDetailTab === 'STATEMENT' ? (
              <Card className="overflow-hidden"><CardContent className="p-0">{renderStatementTable(cumulativeOperationsList)}</CardContent></Card>
            ) : (
              <Card className="overflow-hidden border-purple-100 dark:border-purple-900/40">
                <CardHeader className="bg-gradient-to-r from-purple-50/60 to-indigo-50/40 dark:from-slate-800/80 py-3 px-6 border-b dark:border-slate-700/50 flex items-center justify-between">
                  <span className="text-xs text-slate-500">متابعة دفعات ومصروفات بند المورد المرتبط مع الرصيد التراكمي</span>
                  {supplierExpenseList.length > 0 && <div className="text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950 px-2 py-1 rounded-lg border border-purple-100 dark:border-purple-800">إجمالي المصروفات التراكمية: {formatCurrency(supplierExpenseList[0]?.cumulativeBalance || 0, isRestricted)}</div>}
                </CardHeader>
                <CardContent className="p-0">{renderLinkedExpensesTable(supplierExpenseList)}</CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed bottom-5 left-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-white font-medium text-sm transition-all duration-300 ${
          notification.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span>{notification.message}</span>
        </div>
      )}

            {selectedClientId === 'ALL' ? renderListView() : renderDetailView()}

      {/* MODAL: Add/Edit Client */}
      <Modal 
        isOpen={isClientModalOpen} 
        onClose={() => setIsClientModalOpen(false)} 
        title={editingClientId ? "تعديل بيانات الحساب" : "إضافة عميل / مورد جديد"}
      >
        <form onSubmit={handleSaveClient} className="space-y-4">
          {saveClientSuccessMsg && (
            <div className="p-3 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 border border-green-200 dark:border-green-800/50 rounded-xl flex items-center gap-2 text-sm font-medium animate-in fade-in zoom-in duration-200">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>{saveClientSuccessMsg}</span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-2">
              <Label>اسم العميل / المورد</Label>
              <Input 
                required 
                placeholder="مثال: شركة النور / أحمد علي" 
                value={clientName} 
                onChange={e => setClientName(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label>تحديد الصفة</Label>
              <select
                value={clientType}
                onChange={e => {
                  const newType = e.target.value as ClientType;
                  setClientType(newType);
                  if (newType === 'CLIENT') {
                    setLinkedExpenseCategoryId('');
                  }
                }}
                className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
              >
                <option value="CLIENT">عميل</option>
                <option value="SUPPLIER">مورد</option>
              </select>
            </div>
          </div>

          {/* Supplier Expense Category Linking Section */}
          {clientType === 'SUPPLIER' && (
            <div className="p-3.5 bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-800/50 rounded-2xl space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label className="text-purple-900 dark:text-purple-200 font-bold flex items-center gap-1.5 text-xs sm:text-sm">
                  <Link2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>ربط المورد ببنود المصروفات</span>
                </Label>
                
                <button
                  type="button"
                  onClick={handleAutoCreateExpenseCategory}
                  disabled={!clientName.trim()}
                  className="text-xs font-bold text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-100 bg-purple-100 dark:bg-purple-900/60 hover:bg-purple-200/80 dark:hover:bg-purple-800/80 px-2.5 py-1.5 rounded-xl flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="إنشاء بند جديد تلقائياً باسم المورد وربطه"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إنشاء بند جديد باسم المورد</span>
                </button>
              </div>

              <div className="space-y-1.5">
                <select
                  value={linkedExpenseCategoryId}
                  onChange={e => setLinkedExpenseCategoryId(e.target.value)}
                  className="w-full h-10 px-3 text-sm rounded-xl border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                >
                  <option value="">بدون ربط (اختياري)</option>
                  {storeExpenseCategories.map(cat => {
                    const linkedSuppliers = storeClients.filter(c => c.type === 'SUPPLIER' && c.linkedExpenseCategoryId === cat.id && c.id !== editingClientId);
                    const linkedText = linkedSuppliers.length > 0 ? ` (مرتبط بـ: ${linkedSuppliers.map(s => s.name).join('، ')})` : '';
                    return (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}{linkedText}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[11px] text-purple-800/80 dark:text-purple-300/80 leading-relaxed">
                  عند ربط المورد ببند مصروفات، يمكنك توجيه وسداد المصروفات الخاصة به بسهولة عبر نظام المصروفات.
                </p>
              </div>
            </div>
          )}

          <Button type="submit" className="w-full mt-4">
            {editingClientId ? "حفظ التعديلات" : "حفظ الحساب"}
          </Button>
        </form>
      </Modal>

      {/* MODAL: Add/Edit Operation */}
      <Modal 
        isOpen={isOpModalOpen} 
        onClose={() => setIsOpModalOpen(false)} 
        title={editingOp ? "تعديل حركة للعميل / المورد" : "تسجيل حركة دين / سداد"}
      >
        <form onSubmit={handleSaveOp} className="space-y-4">
          {saveOpSuccessMsg && (
            <div className="p-3 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 border border-green-200 dark:border-green-800/50 rounded-xl flex items-center gap-2 text-sm font-medium animate-in fade-in zoom-in duration-200">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>{saveOpSuccessMsg}</span>
            </div>
          )}
          {/* Client Select */}
          <div className="space-y-2">
            <Label>العميل / المورد</Label>
            <select
              required
              value={opClientId}
              onChange={e => setOpClientId(e.target.value)}
              className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">اختر العميل أو المورد...</option>
              {storeClients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type === 'SUPPLIER' ? 'مورد' : 'عميل'})
                </option>
              ))}
            </select>
          </div>

          {/* Operation Date */}
          <div className="space-y-2">
            <Label>تاريخ الحركة</Label>
            <Input 
              type="date" 
              required 
              value={opDate} 
              onChange={e => setOpDate(e.target.value)} 
            />
          </div>

          {(() => {
            const selectedClientForOp = storeClients.find(c => c.id === opClientId);
            const isSupplierForOp = selectedClientForOp?.type === 'SUPPLIER';

            return (
              <>
                {/* Operation Type Radios */}
                <div className="space-y-2">
                  <Label>نوع الحركة</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl border cursor-pointer transition-all ${
                      opType === 'DEBT' 
                        ? (isSupplierForOp
                            ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 font-bold'
                            : 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 font-bold')
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}>
                      <input 
                        type="radio" 
                        name="opType" 
                        checked={opType === 'DEBT'} 
                        onChange={() => setOpType('DEBT')} 
                        className="sr-only" 
                      />
                      <div className="flex items-center gap-1.5">
                        <ArrowUpRight className={`w-4 h-4 ${isSupplierForOp ? 'text-purple-600 dark:text-purple-400' : 'text-rose-600'}`} />
                        <span>{isSupplierForOp ? 'وارد جديد (+)' : 'دين عليه (+)'}</span>
                      </div>
                      <span className="text-[10px] font-normal opacity-80 text-center">
                        {isSupplierForOp ? '(توريد بضاعة على الحساب - يضاف لحساب المورد)' : '(خصم تلقائي من الأرباح)'}
                      </span>
                    </label>

                    <label className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl border cursor-pointer transition-all ${
                      opType === 'PAYMENT' 
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-bold' 
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}>
                      <input 
                        type="radio" 
                        name="opType" 
                        checked={opType === 'PAYMENT'} 
                        onChange={() => setOpType('PAYMENT')} 
                        className="sr-only" 
                      />
                      <div className="flex items-center gap-1.5">
                        <ArrowDownLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>{isSupplierForOp ? 'دفع / سداد (-)' : 'دفعة / سداد (-)'}</span>
                      </div>
                      <span className="text-[10px] font-normal opacity-80 text-center">
                        {isSupplierForOp ? '(سداد للمورد - يخصم من المصروفات وحساب المورد)' : '(إيرادات متأخرة في الأرباح)'}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Linked Expense Category Info for Supplier */}
                {isSupplierForOp && (
                  <div className="p-3 rounded-xl bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/50 text-xs space-y-2">
                    {selectedClientForOp?.linkedExpenseCategoryId ? (() => {
                      const linkedCat = storeExpenseCategories.find(cat => cat.id === selectedClientForOp.linkedExpenseCategoryId);
                      return (
                        <div className="flex items-center gap-2 text-purple-900 dark:text-purple-200 font-semibold">
                          <Link2 className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                          <span>مرتبط ببند المصروفات:</span>
                          <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-100 font-bold">
                            {linkedCat ? linkedCat.name : 'بند غير موجود'}
                          </span>
                        </div>
                      );
                    })() : (
                      <div className="flex items-center justify-between gap-2 flex-wrap text-amber-900 dark:text-amber-200">
                        <span className="font-semibold">تنبيه: هذا المورد غير مرتبط ببند مصروفات.</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (!selectedClientForOp || !auth.currentStoreId) return;
                            const catName = selectedClientForOp.name.trim();
                            const existing = storeExpenseCategories.find(cat => cat.name.trim().toLowerCase() === catName.toLowerCase());
                            let catId = existing?.id;
                            if (!catId) {
                              catId = addExpenseCategory({ storeId: auth.currentStoreId, name: catName });
                            }
                            updateClient(selectedClientForOp.id, { linkedExpenseCategoryId: catId });
                            showNotification(`تم ربط المورد ببند المصروفات "${catName}"`);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-100 font-bold hover:bg-amber-200 transition-colors"
                        >
                          إنشاء وربط بند بالمورد الآن
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          })()}

          {/* Amount */}
          <div className="space-y-2">
            <Label>المبلغ (₪)</Label>
            <NumberInput 
              required 
              value={opAmount} 
              onChange={val => setOpAmount(val)} 
              placeholder="0.00" 
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>البيان / ملاحظات التفاصيل</Label>
            <Input 
              type="text" 
              placeholder="مثال: فاتورة بضاعة آجل / تسديد نقدي" 
              value={opDesc} 
              onChange={e => setOpDesc(e.target.value)} 
            />
          </div>

          <Button type="submit" className="w-full mt-4">
            {editingOp ? "حفظ التعديلات" : "حفظ الحركة"}
          </Button>
        </form>
      </Modal>

      {/* Delete Operation Confirmation Modal */}
      <Modal 
        isOpen={deletingOpId !== null} 
        onClose={() => setDeletingOpId(null)} 
        title="تأكيد حذف الحركة"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            هل أنت تأكد من رغبتك في حذف هذه الحركة؟ سيتم إعادة احتساب الرصيد التراكمي تلقائياً.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setDeletingOpId(null)}>إلغاء</Button>
            <Button variant="danger" onClick={handleConfirmDeleteOp}>حذف الحركة</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Client Confirmation Modal */}
      <Modal 
        isOpen={deletingClientId !== null} 
        onClose={() => setDeletingClientId(null)} 
        title="تأكيد حذف العميل"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            تحذير: سيتم حذف هذا العميل وجميع الحركات المالية المرتبطة به بشكل نهائي. هل تريد المتابعة؟
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setDeletingClientId(null)}>إلغاء</Button>
            <Button variant="danger" onClick={handleConfirmDeleteClient}>حذف العميل وحركاته</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
