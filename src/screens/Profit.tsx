import { useState, useMemo, FormEvent, Fragment } from 'react';
import { useStore } from '../store/useStore';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { NumberInput } from '../components/ui/NumberInput';
import { Label } from '../components/ui/Label';
import { Modal } from '../components/ui/Modal';
import { formatCurrency, parseInputDateToISO } from '../lib/utils';
import { 
  MinusCircle, 
  Edit2, 
  Trash2, 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Wallet, 
  Calendar,
  CheckCircle2,
  PieChart,
  ListFilter,
  ChevronDown,
  ChevronUp,
  Clock,
  TrendingDown,
  AlertTriangle
} from 'lucide-react';

type MovementFilter = 'ALL' | 'INCOME' | 'LATE_INCOME' | 'DEDUCTION' | 'CLIENT_DEBT' | 'EXPENSE';
type ViewTab = 'DAILY_SUMMARY' | 'DETAILED_LOG';

interface ProfitMovement {
  id: string;
  originalId: string;
  type: 'INCOME' | 'EXPENSE' | 'DEDUCTION' | 'LATE_INCOME' | 'CLIENT_DEBT';
  date: string;
  description: string;
  addition: number;
  deduction: number;
  netImpact: number;
  cumulativeBalance: number;
}

interface DailyProfitSummary {
  dateKey: string; // YYYY-MM-DD
  displayDate: string;
  dailyIncome: number;
  dailyExpense: number;
  dailyDeduction: number;
  dailyNetProfit: number; // Income - Expense - Deduction
  cumulativeBalance: number;
  movementsCount: number;
  movements: ProfitMovement[];
}

export function Profit() {
  const { 
    auth, 
    transactions, 
    profitDeductions, 
    clients,
    clientOperations,
    addProfitDeduction,
    updateProfitDeduction,
    deleteProfitDeduction
  } = useStore();

  const [activeTab, setActiveTab] = useState<ViewTab>('DAILY_SUMMARY');
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDeductionId, setEditingDeductionId] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [deletingItem, setDeletingItem] = useState<{
    id: string;
    description?: string;
  } | null>(null);
  
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [deductionDate, setDeductionDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [typeFilter, setTypeFilter] = useState<MovementFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  const isRestricted = auth.role === 'RESTRICTED';
  const canManage = auth.role === 'ADMIN';

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const storeTx = useMemo(() => {
    return transactions.filter(t => t.storeId === auth.currentStoreId);
  }, [transactions, auth.currentStoreId]);

  const storeDeductions = useMemo(() => {
    return profitDeductions.filter(d => d.storeId === auth.currentStoreId);
  }, [profitDeductions, auth.currentStoreId]);

  const storeClients = useMemo(() => {
    return clients.filter(c => c.storeId === auth.currentStoreId);
  }, [clients, auth.currentStoreId]);

  const storeClientMap = useMemo(() => {
    const map = new Map<string, string>();
    storeClients.forEach(c => map.set(c.id, c.name));
    return map;
  }, [storeClients]);

  const storeClientOps = useMemo(() => {
    const clientIds = new Set(storeClients.map(c => c.id));
    return clientOperations.filter(op => clientIds.has(op.clientId));
  }, [clientOperations, storeClients]);

  // Calculate global totals
  const totalDirectIncome = useMemo(() => {
    return storeTx.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0);
  }, [storeTx]);

  const totalLateRevenue = useMemo(() => {
    return storeClientOps
      .filter(op => {
        if (op.type !== 'PAYMENT') return false;
        const clientObj = storeClients.find(c => c.id === op.clientId);
        return clientObj?.type !== 'SUPPLIER';
      })
      .reduce((acc, op) => acc + op.amount, 0);
  }, [storeClientOps, storeClients]);

  const totalIncome = totalDirectIncome + totalLateRevenue;

  const totalExpense = useMemo(() => {
    return storeTx.filter(t => t.type === 'EXPENSE').reduce((acc, t) => {
      const isPayment = (clientOperations || []).some(op => op.expenseTransactionId === t.id && op.type === 'PAYMENT');
      return acc + (isPayment ? -t.amount : t.amount);
    }, 0);
  }, [storeTx, clientOperations]);

  const totalDirectDeductions = useMemo(() => {
    return storeDeductions.reduce((acc, d) => acc + d.amount, 0);
  }, [storeDeductions]);

  const totalClientDebts = useMemo(() => {
    return storeClientOps
      .filter(op => {
        if (op.type !== 'DEBT') return false;
        const clientObj = storeClients.find(c => c.id === op.clientId);
        return clientObj?.type !== 'SUPPLIER';
      })
      .reduce((acc, op) => acc + op.amount, 0);
  }, [storeClientOps, storeClients]);

  const totalDeductions = totalDirectDeductions + totalClientDebts;

  const grossProfit = totalIncome - totalExpense;
  const netProfit = grossProfit - totalDeductions;

  // Build Chronological Ledger & Cumulative Balance per transaction
  const allMovementsWithCumulative = useMemo(() => {
    const rawMovements: Omit<ProfitMovement, 'cumulativeBalance'>[] = [];

    // 1. Income & Expense Transactions
    storeTx.forEach(t => {
      if (t.type === 'INCOME') {
        rawMovements.push({
          id: `tx-${t.id}`,
          originalId: t.id,
          type: 'INCOME',
          date: t.date,
          description: t.title + (t.notes ? ` (${t.notes})` : ''),
          addition: t.amount,
          deduction: 0,
          netImpact: t.amount
        });
      } else if (t.type === 'EXPENSE') {
        const isPayment = (clientOperations || []).some(op => op.expenseTransactionId === t.id && op.type === 'PAYMENT');
        rawMovements.push({
          id: `tx-${t.id}`,
          originalId: t.id,
          type: 'EXPENSE',
          date: t.date,
          description: t.title + (isPayment ? ' (سداد مورد)' : '') + (t.notes ? ` (${t.notes})` : ''),
          addition: isPayment ? t.amount : 0,
          deduction: isPayment ? 0 : t.amount,
          netImpact: isPayment ? t.amount : -t.amount
        });
      }
    });

    // 2. Profit Deductions / Withdrawals
    storeDeductions.forEach(d => {
      rawMovements.push({
        id: `ded-${d.id}`,
        originalId: d.id,
        type: 'DEDUCTION',
        date: d.date,
        description: d.description || 'سحب أرباح شخصي',
        addition: 0,
        deduction: d.amount,
        netImpact: -d.amount
      });
    });

    // 3. Client & Supplier Operations
    storeClientOps.forEach(op => {
      const clientObj = storeClients.find(c => c.id === op.clientId);
      const isSupplier = clientObj?.type === 'SUPPLIER';
      const clientName = clientObj?.name || 'عميل / مورد';

      if (isSupplier) {
        if (op.type === 'DEBT') {
          // Supplier "وارد جديد": added to supplier account balance only.
          // Does NOT deduct from store cash profit as a client debt.
        } else if (op.type === 'PAYMENT') {
          // If op has no expenseTransactionId (e.g. supplier has no linked category),
          // treat as direct supplier payment expense deduction:
          if (!op.expenseTransactionId) {
            rawMovements.push({
              id: `cop-${op.id}`,
              originalId: op.id,
              type: 'EXPENSE',
              date: op.date,
              description: `سداد للمورد: ${clientName}${op.description ? ` (${op.description})` : ''}`,
              addition: 0,
              deduction: op.amount,
              netImpact: -op.amount
            });
          }
          // Note: if op.expenseTransactionId exists, storeTx ALREADY contains this as an EXPENSE,
          // so it's already included in rawMovements under step 1 (storeTx.forEach)!
        }
      } else {
        if (op.type === 'DEBT') {
          rawMovements.push({
            id: `cop-${op.id}`,
            originalId: op.id,
            type: 'CLIENT_DEBT',
            date: op.date,
            description: `دين عليه: ${clientName}${op.description ? ` (${op.description})` : ''}`,
            addition: 0,
            deduction: op.amount,
            netImpact: -op.amount
          });
        } else if (op.type === 'PAYMENT') {
          rawMovements.push({
            id: `cop-${op.id}`,
            originalId: op.id,
            type: 'LATE_INCOME',
            date: op.date,
            description: `إيرادات متأخرة (سداد): ${clientName}${op.description ? ` (${op.description})` : ''}`,
            addition: op.amount,
            deduction: 0,
            netImpact: op.amount
          });
        }
      }
    });

    // Sort chronologically (oldest first)
    rawMovements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    const withCumulative: ProfitMovement[] = rawMovements.map(m => {
      runningBalance += m.netImpact;
      return {
        ...m,
        cumulativeBalance: runningBalance
      };
    });

    return withCumulative.reverse();
  }, [storeTx, storeDeductions, storeClientOps, storeClientMap]);

  // Build Daily Cumulative Profit Summaries
  const dailyProfitLedger = useMemo(() => {
    const map = new Map<string, {
      income: number;
      expense: number;
      deduction: number;
      movements: ProfitMovement[];
    }>();

    // Group all movements by Date (YYYY-MM-DD)
    allMovementsWithCumulative.forEach(m => {
      const dateKey = new Date(m.date).toISOString().split('T')[0];
      if (!map.has(dateKey)) {
        map.set(dateKey, { income: 0, expense: 0, deduction: 0, movements: [] });
      }
      const entry = map.get(dateKey)!;
      entry.movements.push(m);
      if (m.type === 'INCOME' || m.type === 'LATE_INCOME') entry.income += m.addition;
      if (m.type === 'EXPENSE') entry.expense += m.deduction;
      if (m.type === 'DEDUCTION' || m.type === 'CLIENT_DEBT') entry.deduction += m.deduction;
    });

    // Sort dates ascending to calculate cumulative daily balance
    const sortedDateKeys = Array.from(map.keys()).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    let runningCumulative = 0;
    const summaries: DailyProfitSummary[] = sortedDateKeys.map(dateKey => {
      const data = map.get(dateKey)!;
      const dailyNetProfit = data.income - data.expense - data.deduction;
      runningCumulative += dailyNetProfit;

      return {
        dateKey,
        displayDate: new Date(dateKey).toLocaleDateString('ar-EG', {
          weekday: 'long',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }),
        dailyIncome: data.income,
        dailyExpense: data.expense,
        dailyDeduction: data.deduction,
        dailyNetProfit,
        cumulativeBalance: runningCumulative,
        movementsCount: data.movements.length,
        movements: data.movements
      };
    });

    // Reverse for display (Newest date on top)
    return summaries.reverse();
  }, [allMovementsWithCumulative]);

  // Filtered Daily Summaries
  const filteredDailySummaries = useMemo(() => {
    if (!searchQuery.trim()) return dailyProfitLedger;
    const query = searchQuery.toLowerCase();
    return dailyProfitLedger.filter(s => 
      s.displayDate.toLowerCase().includes(query) || 
      s.dateKey.includes(query)
    );
  }, [dailyProfitLedger, searchQuery]);

  // Filtered Detailed Movements for display
  const filteredMovements = useMemo(() => {
    return allMovementsWithCumulative.filter(m => {
      if (typeFilter !== 'ALL' && m.type !== typeFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesDesc = m.description.toLowerCase().includes(query);
        const matchesDate = new Date(m.date).toLocaleDateString('ar-EG').includes(query);
        if (!matchesDesc && !matchesDate) return false;
      }
      return true;
    });
  }, [allMovementsWithCumulative, typeFilter, searchQuery]);

  const toggleExpandDate = (dateKey: string) => {
    setExpandedDates(prev => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  // Modal Handlers
  const handleOpenAdd = () => {
    setEditingDeductionId(null);
    setAmount('');
    setDesc('');
    setDeductionDate(new Date().toISOString().split('T')[0]);
    setSaveSuccessMsg('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (id: string, currentAmount: number, currentDesc: string, currentDate: string) => {
    setEditingDeductionId(id);
    setAmount(currentAmount.toString());
    setDesc(currentDesc);
    const formattedDate = currentDate ? new Date(currentDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    setDeductionDate(formattedDate);
    setIsModalOpen(true);
  };

  const onRequestDelete = (m: ProfitMovement) => {
    if (m.type !== 'DEDUCTION') return;
    setDeletingItem({
      id: m.originalId,
      description: m.description
    });
  };

  const handleConfirmDelete = () => {
    if (!deletingItem) return;
    deleteProfitDeduction(deletingItem.id);
    showNotification('تم حذف الخصم بنجاح');
    setDeletingItem(null);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!amount || !auth.currentStoreId) return;

    const parsedDate = parseInputDateToISO(deductionDate);
    const parsedAmount = parseFloat(amount);

    if (editingDeductionId) {
      if (!window.confirm('هل أنت متأكد من حفظ التعديلات؟')) return;
      updateProfitDeduction(editingDeductionId, {
        amount: parsedAmount,
        description: desc,
        date: parsedDate
      });
      showNotification('تم تعديل بيانات الخصم بنجاح');
      setIsModalOpen(false);
      setEditingDeductionId(null);
      setAmount('');
      setDesc('');
    } else {
      addProfitDeduction({
        storeId: auth.currentStoreId,
        amount: parsedAmount,
        description: desc,
        date: parsedDate
      });
      setSaveSuccessMsg('تم حفظ البيانات بنجاح!');
      setTimeout(() => setSaveSuccessMsg(''), 3000);
      
      setAmount('');
      setDesc('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-sm font-semibold animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4" />
          <span>{notification}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <PieChart className="w-7 h-7 text-primary-600 dark:text-primary-400" />
            جدول الرصيد التراكمي للأرباح
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            سجل حركة الأرباح اليومية والرصيد التراكمي المتبقي بصورة مبسطة.
          </p>
        </div>
        {canManage && (
          <Button variant="destructive" onClick={handleOpenAdd} className="shadow-md">
            <MinusCircle className="w-5 h-5 me-2" />
            تسجيل خصم / سحب أرباح
          </Button>
        )}
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Cumulative Net Profit Card */}
        <Card className="col-span-2 sm:col-span-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white border-0 shadow-md sm:shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
            <Wallet className="w-20 h-20 sm:w-28 sm:h-28 text-white" />
          </div>
          <CardContent className="p-4 sm:p-6">
            <p className="text-slate-400 text-[11px] sm:text-xs font-semibold tracking-wide uppercase mb-1">الرصيد التراكمي النهائي للأرباح</p>
            <h3 className={`text-xl sm:text-3xl font-extrabold ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatCurrency(netProfit, isRestricted)}
            </h3>
            <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-700/60 flex items-center justify-between text-[11px] sm:text-xs text-slate-300">
              <span>صافي الأرباح المتبقية:</span>
              <span className={`font-bold px-2 py-0.5 rounded text-[10px] sm:text-xs ${netProfit >= 0 ? 'bg-emerald-950/80 text-emerald-300' : 'bg-rose-950/80 text-rose-300'}`}>
                {netProfit >= 0 ? 'موجب' : 'سالب'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Total Income Profit Added Card */}
        <Card className="col-span-1 border border-slate-200 dark:border-slate-800 shadow-xs sm:shadow-sm">
          <CardContent className="p-3.5 sm:p-6">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">إجمالي الإيرادات</span>
              <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shrink-0">
                <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <h3 className="text-base sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5 sm:mt-2 truncate">
              {formatCurrency(totalIncome, isRestricted)}
            </h3>
            <p className="text-[10px] sm:text-xs text-slate-400 mt-1 sm:mt-2 truncate">
              {totalLateRevenue > 0 ? `تتضمن ${formatCurrency(totalLateRevenue, isRestricted)} متأخرة` : '+ الإيرادات المضافة'}
            </p>
          </CardContent>
        </Card>

        {/* Total Operational Expenses Card */}
        <Card className="col-span-1 border border-slate-200 dark:border-slate-800 shadow-xs sm:shadow-sm">
          <CardContent className="p-3.5 sm:p-6">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">إجمالي المصروفات</span>
              <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0">
                <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <h3 className="text-base sm:text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1.5 sm:mt-2 truncate">
              - {formatCurrency(totalExpense, isRestricted)}
            </h3>
            <p className="text-[10px] sm:text-xs text-slate-400 mt-1 sm:mt-2 truncate">المصروفات التشغيلية</p>
          </CardContent>
        </Card>

        {/* Total Deductions / Withdrawals Card */}
        <Card className="col-span-2 sm:col-span-1 border border-slate-200 dark:border-slate-800 shadow-xs sm:shadow-sm">
          <CardContent className="p-3.5 sm:p-6">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">الخصومات والمسحوبات</span>
              <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 shrink-0">
                <ArrowDownLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <h3 className="text-base sm:text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1.5 sm:mt-2 truncate">
              - {formatCurrency(totalDeductions, isRestricted)}
            </h3>
            <p className="text-[10px] sm:text-xs text-slate-400 mt-1 sm:mt-2 truncate">
              {totalClientDebts > 0 ? `تتضمن ${formatCurrency(totalClientDebts, isRestricted)} ديون عملاء` : 'مسحوبات وخصومات الأرباح'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card: Strictly Date, Description, Amount, Cumulative Balance */}
      <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Tab Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl w-fit">
              <button
                type="button"
                onClick={() => setActiveTab('DAILY_SUMMARY')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'DAILY_SUMMARY'
                    ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Calendar className="w-4 h-4" />
                الخصم اليومي والتراكمي
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('DETAILED_LOG')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'DETAILED_LOG'
                    ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <ListFilter className="w-4 h-4" />
                جميع الحركات
              </button>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px]">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="بحث في البيان أو التاريخ..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full h-9 pr-9 pl-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {activeTab === 'DETAILED_LOG' && (
                <select
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value as MovementFilter)}
                  className="h-9 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
                >
                  <option value="ALL">جميع الأنواع</option>
                  <option value="INCOME">إيرادات مباشرة</option>
                  <option value="LATE_INCOME">إيرادات متأخرة (سداد)</option>
                  <option value="EXPENSE">مصروفات</option>
                  <option value="DEDUCTION">سحوبات أرباح</option>
                  <option value="CLIENT_DEBT">ديون عملاء (خصم)</option>
                </select>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-3 sm:p-0">
          {/* TAB 1: DAILY SUMMARY */}
          {activeTab === 'DAILY_SUMMARY' && (
            <>
              {/* Mobile Accordion Card View */}
              <div className="md:hidden flex flex-col gap-2.5">
                {filteredDailySummaries.map((s) => {
                  const isExpanded = !!expandedDates[s.dateKey];

                  return (
                    <div key={s.dateKey} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs">
                      <div 
                        onClick={() => toggleExpandDate(s.dateKey)}
                        className="p-3.5 flex flex-col gap-2.5 cursor-pointer active:bg-slate-50 dark:active:bg-slate-700/50"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                            <Clock className="w-3.5 h-3.5 text-primary-500" />
                            <span>{s.displayDate}</span>
                          </div>
                          <span className={`font-black text-xs px-2.5 py-1 rounded-md ${
                            s.dailyNetProfit >= 0
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}>
                            {s.dailyNetProfit >= 0 ? '+' : ''}{formatCurrency(s.dailyNetProfit, isRestricted)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700/50 text-xs">
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <span>الرصيد التراكمي:</span>
                            <span className={`font-bold ${s.cumulativeBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {formatCurrency(s.cumulativeBalance, isRestricted)}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-600 dark:text-primary-400"
                          >
                            <span>{s.movementsCount} حركة</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="bg-slate-50 dark:bg-slate-900/40 p-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
                          <div className="divide-y divide-slate-200/60 dark:divide-slate-700/60">
                            {s.movements.map((m) => (
                              <div key={m.id} className="py-2 flex items-center justify-between text-xs gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                    m.type === 'INCOME' 
                                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                      : m.type === 'LATE_INCOME'
                                      ? 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
                                      : m.type === 'EXPENSE'
                                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                      : m.type === 'CLIENT_DEBT'
                                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                      : 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                                  }`}>
                                    {m.type === 'INCOME' 
                                      ? 'إيراد' 
                                      : m.type === 'LATE_INCOME'
                                      ? 'متأخرات'
                                      : m.type === 'EXPENSE'
                                      ? 'مصروف'
                                      : m.type === 'CLIENT_DEBT'
                                      ? 'دين'
                                      : 'سحب'}
                                  </span>
                                  <span className="font-medium text-slate-700 dark:text-slate-300 truncate">{m.description}</span>
                                </div>
                                <span className={`font-bold shrink-0 ${
                                  m.netImpact > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                }`}>
                                  {m.netImpact > 0 ? '+' : ''}{formatCurrency(m.netImpact, isRestricted)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {filteredDailySummaries.length === 0 && (
                  <div className="text-center py-10 text-slate-500 dark:text-slate-400">
                    <Wallet className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="font-medium text-xs">لا توجد حركات أرباح مسجلة</p>
                  </div>
                )}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold text-xs border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-5 py-3.5 whitespace-nowrap">التاريخ</th>
                      <th className="px-5 py-3.5">البيان</th>
                      <th className="px-5 py-3.5 whitespace-nowrap">المبلغ</th>
                      <th className="px-5 py-3.5 whitespace-nowrap">الرصيد التراكمي</th>
                      <th className="px-5 py-3.5 whitespace-nowrap text-center">التفاصيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {filteredDailySummaries.map((s) => {
                      const isExpanded = !!expandedDates[s.dateKey];

                      return (
                        <Fragment key={s.dateKey}>
                          <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                            {/* 1. التاريخ */}
                            <td className="px-5 py-3.5 whitespace-nowrap font-bold text-slate-900 dark:text-slate-100">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-primary-500" />
                                <span>{s.displayDate}</span>
                              </div>
                            </td>

                            {/* 2. البيان */}
                            <td className="px-5 py-3.5 font-medium text-slate-700 dark:text-slate-300">
                              <span>صافي حركات اليوم ({s.movementsCount} حركة)</span>
                            </td>

                            {/* 3. المبلغ (صافي الربح اليومي بعد الخصم) */}
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              <span className={`font-bold text-sm px-2.5 py-1 rounded-md ${
                                s.dailyNetProfit >= 0
                                  ? 'bg-emerald-100/80 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : 'bg-rose-100/80 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                              }`}>
                                {s.dailyNetProfit >= 0 ? '+' : ''}{formatCurrency(s.dailyNetProfit, isRestricted)}
                              </span>
                            </td>

                            {/* 4. الرصيد التراكمي */}
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              <span className={`font-extrabold text-sm px-3 py-1.5 rounded-lg ${
                                s.cumulativeBalance >= 0 
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/50' 
                                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/50'
                              }`}>
                                {formatCurrency(s.cumulativeBalance, isRestricted)}
                              </span>
                            </td>

                            {/* Action Expand */}
                            <td className="px-5 py-3.5 whitespace-nowrap text-center">
                              <button
                                type="button"
                                onClick={() => toggleExpandDate(s.dateKey)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                              >
                                <span>{s.movementsCount} حركة</span>
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            </td>
                          </tr>

                          {/* Collapsible Inner Movements for this Day */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={5} className="bg-slate-50/60 dark:bg-slate-900/40 px-6 py-3">
                                <div className="bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200/80 dark:border-slate-700 p-3 space-y-2">
                                  <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-700">
                                    <span>تفاصيل حركات يوم {s.displayDate}</span>
                                  </h4>
                                  <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                                    {s.movements.map((m) => (
                                      <div key={m.id} className="py-2 flex items-center justify-between text-xs gap-3">
                                        <div className="flex items-center gap-2">
                                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                            m.type === 'INCOME' 
                                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                              : m.type === 'LATE_INCOME'
                                              ? 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
                                              : m.type === 'EXPENSE'
                                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                              : m.type === 'CLIENT_DEBT'
                                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                              : 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                                          }`}>
                                            {m.type === 'INCOME' 
                                              ? 'إيراد' 
                                              : m.type === 'LATE_INCOME'
                                              ? 'إيرادات متأخرة'
                                              : m.type === 'EXPENSE'
                                              ? 'مصروف'
                                              : m.type === 'CLIENT_DEBT'
                                              ? 'دين عليه'
                                              : 'سحب أرباح'}
                                          </span>
                                          <span className="font-medium text-slate-800 dark:text-slate-200">{m.description}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                          <span className={`font-bold ${
                                            m.netImpact > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                          }`}>
                                            {m.netImpact > 0 ? '+' : ''}{formatCurrency(m.netImpact, isRestricted)}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}

                    {filteredDailySummaries.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-slate-500 dark:text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Wallet className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                            <p className="font-medium text-sm">لا توجد حركات أرباح مسجلة أو مطابقة للبحث</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* TAB 2: DETAILED LOG */}
          {activeTab === 'DETAILED_LOG' && (
            <>
              {/* Mobile Cards View */}
              <div className="md:hidden flex flex-col gap-2.5">
                {filteredMovements.map((m) => {
                  const isIncome = m.type === 'INCOME';
                  const isLateIncome = m.type === 'LATE_INCOME';
                  const isExpense = m.type === 'EXPENSE';
                  const isDeduction = m.type === 'DEDUCTION';
                  const isClientDebt = m.type === 'CLIENT_DEBT';

                  return (
                    <div key={m.id} className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-slate-500">
                          {new Date(m.date).toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                          })}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isIncome 
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : isLateIncome
                            ? 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
                            : isExpense
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            : isClientDebt
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                            : 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                        }`}>
                          {isIncome ? 'إيراد' : isLateIncome ? 'إيرادات متأخرة' : isExpense ? 'مصروف' : isClientDebt ? 'دين عليه' : 'سحب أرباح'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center gap-2">
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">{m.description}</span>
                        <span className={`font-black text-xs shrink-0 ${m.netImpact > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {m.netImpact > 0 ? '+' : ''}{formatCurrency(m.netImpact, isRestricted)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center pt-1.5 border-t border-slate-100 dark:border-slate-700 text-xs">
                        <div className="flex items-center gap-1 text-slate-500">
                          <span className="text-[11px]">الرصيد:</span>
                          <span className={`font-bold text-[11px] ${m.cumulativeBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {formatCurrency(m.cumulativeBalance, isRestricted)}
                          </span>
                        </div>

                        {canManage && isDeduction && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(m.originalId, m.deduction, m.description, m.date)}
                              className="p-1 rounded text-slate-500 hover:text-primary-600"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onRequestDelete(m)}
                              className="p-1 rounded text-slate-500 hover:text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {filteredMovements.length === 0 && (
                  <div className="text-center py-10 text-slate-500 dark:text-slate-400">
                    <Wallet className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="font-medium text-xs">لا توجد حركات أرباح مطابقة</p>
                  </div>
                )}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold text-xs border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-5 py-3.5 whitespace-nowrap">التاريخ</th>
                      <th className="px-5 py-3.5">البيان</th>
                      <th className="px-5 py-3.5 whitespace-nowrap">المبلغ</th>
                      <th className="px-5 py-3.5 whitespace-nowrap">الرصيد التراكمي</th>
                      {canManage && <th className="px-5 py-3.5 whitespace-nowrap text-center">إجراءات</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {filteredMovements.map((m) => {
                      const isIncome = m.type === 'INCOME';
                      const isLateIncome = m.type === 'LATE_INCOME';
                      const isExpense = m.type === 'EXPENSE';
                      const isDeduction = m.type === 'DEDUCTION';
                      const isClientDebt = m.type === 'CLIENT_DEBT';

                      return (
                        <tr 
                          key={m.id} 
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                            isDeduction || isClientDebt ? 'bg-rose-50/30 dark:bg-rose-950/10' : ''
                          }`}
                        >
                          {/* 1. التاريخ */}
                          <td className="px-5 py-3.5 whitespace-nowrap font-medium text-slate-700 dark:text-slate-300">
                            {new Date(m.date).toLocaleDateString('ar-EG', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit'
                            })}
                          </td>

                          {/* 2. البيان */}
                          <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-slate-100 max-w-[340px]">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
                                isIncome 
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : isLateIncome
                                  ? 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
                                  : isExpense
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                  : isClientDebt
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                  : 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                              }`}>
                                {isIncome 
                                  ? 'إيراد' 
                                  : isLateIncome 
                                  ? 'إيرادات متأخرة' 
                                  : isExpense 
                                  ? 'مصروف' 
                                  : isClientDebt 
                                  ? 'دين عليه (خصم)' 
                                  : 'سحب أرباح'}
                              </span>
                              <span className="truncate">{m.description}</span>
                            </div>
                          </td>

                          {/* 3. المبلغ */}
                          <td className="px-5 py-3.5 whitespace-nowrap font-bold text-xs">
                            <span className={m.netImpact > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                              {m.netImpact > 0 ? '+' : ''}{formatCurrency(m.netImpact, isRestricted)}
                            </span>
                          </td>

                          {/* 4. الرصيد التراكمي */}
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span className={`font-extrabold text-xs px-2.5 py-1 rounded-lg ${
                              m.cumulativeBalance >= 0 
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' 
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                            }`}>
                              {formatCurrency(m.cumulativeBalance, isRestricted)}
                            </span>
                          </td>

                          {/* Actions */}
                          {canManage && (
                            <td className="px-5 py-3.5 whitespace-nowrap text-center">
                              {isDeduction ? (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEdit(m.originalId, m.deduction, m.description, m.date)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                    title="تعديل الخصم"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onRequestDelete(m)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                    title="حذف الخصم"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (isClientDebt || isLateIncome) ? (
                                <span className="text-[11px] text-slate-400" title="تُدار حركات العملاء من صفحة العملاء">من صفحة العملاء</span>
                              ) : (
                                <span className="text-[11px] text-slate-400">-</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}

                    {filteredMovements.length === 0 && (
                      <tr>
                        <td colSpan={canManage ? 5 : 4} className="text-center py-12 text-slate-500 dark:text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Wallet className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                            <p className="font-medium text-sm">لا توجد حركات أرباح مطابقة للبحث أو الفلتر الحالي</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal for Add/Edit Profit Deduction */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingDeductionId ? "تعديل سحب / خصم الأرباح" : "تسجيل سحب أو خصم من الأرباح"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {saveSuccessMsg && (
            <div className="p-3 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 border border-green-200 dark:border-green-800/50 rounded-xl flex items-center gap-2 text-sm font-medium animate-in fade-in zoom-in duration-200">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}
          <div className="space-y-2">
            <Label>المبلغ (₪)</Label>
            <NumberInput 
              required 
              value={amount} 
              onChange={val => setAmount(val)} 
              placeholder="0.00" 
            />
          </div>

          <div className="space-y-2">
            <Label>تاريخ السحب / الخصم</Label>
            <Input
              type="date"
              required
              value={deductionDate}
              onChange={e => setDeductionDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>البيان / سبب السحب</Label>
            <Input 
              type="text" 
              value={desc} 
              onChange={e => setDesc(e.target.value)} 
              placeholder="مثال: سحب شخصي، توزيع أرباح شركاء..." 
            />
          </div>

          <Button type="submit" variant="destructive" className="w-full mt-4">
            {editingDeductionId ? "حفظ التعديلات" : "حفظ الخصم"}
          </Button>
        </form>
      </Modal>

      {/* Modal for Delete Confirmation */}
      <Modal 
        isOpen={!!deletingItem} 
        onClose={() => setDeletingItem(null)} 
        title="تأكيد حذف الحركة"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 rounded-xl text-sm">
            <AlertTriangle className="w-6 h-6 shrink-0 text-amber-600 dark:text-amber-400" />
            <p>
              هل أنت تأكد من رغبتك في حذف هذا السحب / الخصم؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
          </div>

          {deletingItem?.description && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300">
              البيان: {deletingItem.description}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingItem(null)}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              تأكيد الحذف
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
