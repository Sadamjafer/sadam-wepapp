import { useState, useMemo, Fragment } from 'react';
import { useStore } from '../store/useStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { formatCurrency, formatMoney } from '../lib/utils';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import { 
  Calendar, TrendingUp, TrendingDown, DollarSign, Package, FileText, Printer, Filter, Search, ChevronDown, ChevronUp, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type ReportType = 'daily' | 'custom';

export function Reports() {
  const { auth, transactions, incomeRecords, expenseCategories, clientOperations } = useStore();
  const isRestricted = auth.role === 'RESTRICTED';

  // Current date helpers
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Filter States
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // 1st of current month
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(todayStr);

  const [txTypeFilter, setTxTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Store-specific data
  const storeTx = useMemo(() => 
    transactions.filter(t => t.storeId === auth.currentStoreId), 
    [transactions, auth.currentStoreId]
  );
  
  const storeIncomeRecords = useMemo(() => 
    incomeRecords.filter(r => r.storeId === auth.currentStoreId), 
    [incomeRecords, auth.currentStoreId]
  );

  const storeCategories = useMemo(() => 
    expenseCategories.filter(c => c.storeId === auth.currentStoreId), 
    [expenseCategories, auth.currentStoreId]
  );

  // Quick Preset Handlers
  const applyPreset = (preset: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month') => {
    const now = new Date();
    if (preset === 'today') {
      setReportType('daily');
      setSelectedDate(todayStr);
    } else if (preset === 'yesterday') {
      setReportType('daily');
      const y = new Date();
      y.setDate(y.getDate() - 1);
      setSelectedDate(y.toISOString().split('T')[0]);
    } else if (preset === 'this_week') {
      setReportType('custom');
      const first = new Date(now);
      const day = first.getDay(); // 0 is Sunday
      const diff = first.getDate() - day + (day === 0 ? -6 : 1); // Monday start
      const monday = new Date(first.setDate(diff));
      setStartDate(monday.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'this_month') {
      setReportType('custom');
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(first.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'last_month') {
      setReportType('custom');
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(first.toISOString().split('T')[0]);
      setEndDate(last.toISOString().split('T')[0]);
    }
  };

  // Determine active date range [start, end]
  const activeDateRange = useMemo(() => {
    if (reportType === 'daily') {
      const parts = selectedDate.split('-').map(Number);
      const start = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
      const end = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
      return { start, end, label: `يوم ${selectedDate}` };
    } else {
      const sParts = startDate.split('-').map(Number);
      const eParts = endDate.split('-').map(Number);
      const start = new Date(sParts[0], sParts[1] - 1, sParts[2], 0, 0, 0, 0);
      const end = new Date(eParts[0], eParts[1] - 1, eParts[2], 23, 59, 59, 999);
      return { start, end, label: `من ${startDate} إلى ${endDate}` };
    }
  }, [reportType, selectedDate, startDate, endDate]);

  // Filter transactions within active range
  const filteredTx = useMemo(() => {
    return storeTx.filter(tx => {
      const d = new Date(tx.date);
      return d >= activeDateRange.start && d <= activeDateRange.end;
    });
  }, [storeTx, activeDateRange]);

  // Filter income records within active range
  const filteredIncomeRecords = useMemo(() => {
    return storeIncomeRecords.filter(r => {
      const d = new Date(r.date);
      return d >= activeDateRange.start && d <= activeDateRange.end;
    });
  }, [storeIncomeRecords, activeDateRange]);

  // Metrics calculation
  const totalIncome = useMemo(() => {
    return filteredTx
      .filter(t => t.type === 'INCOME')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTx]);

  const totalExpenses = useMemo(() => {
    return filteredTx
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => {
        const isPayment = (clientOperations || []).some(op => op.expenseTransactionId === t.id && op.type === 'PAYMENT');
        return sum + (isPayment ? -t.amount : t.amount);
      }, 0);
  }, [filteredTx, clientOperations]);

  const netProfit = totalIncome - totalExpenses;

  const totalUnits = useMemo(() => {
    return filteredIncomeRecords.reduce((sum, r) => sum + (r.units || 0), 0);
  }, [filteredIncomeRecords]);

  // Expense distribution by category
  const expensesByCategory = useMemo(() => {
    const categoryTotals: { [key: string]: { id: string; name: string; total: number; count: number; items: any[] } } = {};
    
    // Initialize with categories
    storeCategories.forEach(cat => {
      categoryTotals[cat.id] = { id: cat.id, name: cat.name, total: 0, count: 0, items: [] };
    });
    
    categoryTotals['other'] = { id: 'other', name: 'مصروف عام (بدون تصنيف)', total: 0, count: 0, items: [] };

    filteredTx.forEach(tx => {
      if (tx.type === 'EXPENSE') {
        const catId = tx.categoryId || 'other';
        if (!categoryTotals[catId]) {
          categoryTotals[catId] = { id: catId, name: tx.title || 'مصروف عام', total: 0, count: 0, items: [] };
        }
        
        const isPayment = (clientOperations || []).some(op => op.expenseTransactionId === tx.id && op.type === 'PAYMENT');
        const amount = isPayment ? -tx.amount : tx.amount;
        
        categoryTotals[catId].total += amount;
        categoryTotals[catId].count += 1;
        categoryTotals[catId].items.push({ ...tx, effectiveAmount: amount });
      }
    });

    return Object.values(categoryTotals)
      .filter(item => item.total > 0 || item.count > 0)
      .sort((a, b) => b.total - a.total);
  }, [storeCategories, filteredTx, clientOperations]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#e056fd', '#686de0'];

  // Filtered detailed transactions list
  const displayTxList = useMemo(() => {
    return filteredTx.filter(tx => {
      const matchesType = txTypeFilter === 'ALL' || tx.type === txTypeFilter;
      const matchesSearch = searchQuery === '' || 
        tx.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (tx.notes && tx.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesType && matchesSearch;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredTx, txTypeFilter, searchQuery]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">التقارير المالية</h2>
          <p className="text-sm text-slate-500 mt-1">{activeDateRange.label}</p>
        </div>
        <Button onClick={() => window.print()} className="print:hidden bg-primary-600 hover:bg-primary-700 shadow-sm text-white">
          <Download className="w-4 h-4 me-2" />
          حفظ كـ PDF / طباعة
        </Button>
      </div>

      {/* Report Controls & Filter Card */}
      <Card className="print:hidden border-0 shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-800/50">
        <CardContent className="p-4 sm:p-6 space-y-5">
          {/* Main Mode Selector */}
          <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl w-full max-w-sm mx-auto">
            <button
              type="button"
              onClick={() => { setReportType('daily'); setExpandedCategory(null); }}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                reportType === 'daily' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary-600 dark:text-primary-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              تقرير ليوم واحد
            </button>
            <button
              type="button"
              onClick={() => { setReportType('custom'); setExpandedCategory(null); }}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                reportType === 'custom' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary-600 dark:text-primary-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              تقرير لعدة أيام
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-4 justify-center sm:justify-start">
            {/* Quick Preset Buttons */}
            <div className="flex flex-wrap gap-2 w-full sm:w-auto pb-4 sm:pb-0 sm:border-b-0 border-b border-slate-100 dark:border-slate-800">
              <Button size="sm" variant={reportType === 'daily' && selectedDate === todayStr ? 'default' : 'outline'} onClick={() => applyPreset('today')}>
                اليوم
              </Button>
              <Button size="sm" variant="outline" onClick={() => applyPreset('yesterday')}>
                الأمس
              </Button>
              <Button size="sm" variant="outline" onClick={() => applyPreset('this_week')}>
                هذا الأسبوع
              </Button>
              <Button size="sm" variant="outline" onClick={() => applyPreset('this_month')}>
                هذا الشهر
              </Button>
            </div>

            {/* Date Pickers */}
            <div className="flex flex-wrap items-end gap-3 flex-1">
              {reportType === 'daily' ? (
                <div className="w-full sm:w-auto flex-1 max-w-[200px]">
                  <Label className="text-xs font-medium mb-1.5 block text-slate-500">اختر اليوم</Label>
                  <Input 
                    type="date" 
                    value={selectedDate} 
                    onChange={e => setSelectedDate(e.target.value)} 
                    className="h-10"
                  />
                </div>
              ) : (
                <>
                  <div className="w-full sm:w-auto flex-1 max-w-[200px]">
                    <Label className="text-xs font-medium mb-1.5 block text-slate-500">من تاريخ</Label>
                    <Input 
                      type="date" 
                      value={startDate} 
                      onChange={e => setStartDate(e.target.value)} 
                      className="h-10"
                    />
                  </div>
                  <div className="w-full sm:w-auto flex-1 max-w-[200px]">
                    <Label className="text-xs font-medium mb-1.5 block text-slate-500">إلى تاريخ</Label>
                    <Input 
                      type="date" 
                      value={endDate} 
                      onChange={e => setEndDate(e.target.value)} 
                      className="h-10"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-emerald-50/80 border-emerald-200/60 dark:bg-emerald-900/20 dark:border-emerald-800/40 shadow-none">
          <CardContent className="p-5 flex flex-col justify-between">
            <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
              <span className="text-sm font-bold">إجمالي الإيرادات</span>
              <TrendingUp className="w-5 h-5 opacity-75" />
            </div>
            <div className="mt-4">
              <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 tracking-tight">
                {formatCurrency(totalIncome, isRestricted)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-rose-50/80 border-rose-200/60 dark:bg-rose-900/20 dark:border-rose-800/40 shadow-none">
          <CardContent className="p-5 flex flex-col justify-between">
            <div className="flex justify-between items-center text-rose-600 dark:text-rose-400">
              <span className="text-sm font-bold">إجمالي المصروفات</span>
              <TrendingDown className="w-5 h-5 opacity-75" />
            </div>
            <div className="mt-4">
              <div className="text-2xl font-black text-rose-700 dark:text-rose-300 tracking-tight">
                {formatCurrency(totalExpenses, isRestricted)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border shadow-none ${
          netProfit >= 0 
            ? 'bg-blue-50/80 border-blue-200/60 dark:bg-blue-900/20 dark:border-blue-800/40' 
            : 'bg-red-50/80 border-red-200/60 dark:bg-red-900/20 dark:border-red-800/40'
        }`}>
          <CardContent className="p-5 flex flex-col justify-between">
            <div className={`flex justify-between items-center ${netProfit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
              <span className="text-sm font-bold">صافي الربح</span>
              <DollarSign className="w-5 h-5 opacity-75" />
            </div>
            <div className="mt-4">
              <div className={`text-2xl font-black tracking-tight ${netProfit >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-red-700 dark:text-red-300'}`}>
                {formatCurrency(netProfit, isRestricted)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50/80 border-purple-200/60 dark:bg-purple-900/20 dark:border-purple-800/40 shadow-none">
          <CardContent className="p-5 flex flex-col justify-between">
            <div className="flex justify-between items-center text-purple-600 dark:text-purple-400">
              <span className="text-sm font-bold">إجمالي الوحدات</span>
              <Package className="w-5 h-5 opacity-75" />
            </div>
            <div className="mt-4">
              <div className="text-2xl font-black text-purple-700 dark:text-purple-300 tracking-tight">
                {formatMoney(totalUnits, isRestricted)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Multi-Day Detailed Expenses Aggregation (Only visible if there's data) */}
      {expensesByCategory.length > 0 && (
        <Card className="border-0 shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-800/50 overflow-hidden">
          <CardHeader className="bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <PieChart className="w-5 h-5 text-primary-500" />
              إجمالي المصروفات حسب التصنيف
              {reportType === 'custom' && <span className="text-xs font-normal text-slate-500 ms-2">(اضغط على التصنيف لعرض تفاصيله بالتواريخ)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 border-b dark:border-slate-700/50">
                  <tr>
                    <th className="px-6 py-3.5">التصنيف</th>
                    <th className="px-6 py-3.5 text-center">عدد العمليات</th>
                    <th className="px-6 py-3.5">النسبة</th>
                    <th className="px-6 py-3.5 font-bold">إجمالي المبلغ</th>
                    {reportType === 'custom' && <th className="px-6 py-3.5 w-10"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {expensesByCategory.map((cat, idx) => {
                    const pct = totalExpenses > 0 ? ((cat.total / totalExpenses) * 100).toFixed(1) : '0';
                    const isExpanded = expandedCategory === cat.id;
                    
                    // Group items by date for the expanded view
                    const itemsByDate: Record<string, { date: string, items: any[], total: number }> = {};
                    cat.items.forEach(item => {
                      const d = new Date(item.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
                      if (!itemsByDate[d]) itemsByDate[d] = { date: d, items: [], total: 0 };
                      itemsByDate[d].items.push(item);
                      itemsByDate[d].total += item.effectiveAmount;
                    });
                    const groupedDates = Object.values(itemsByDate);

                    return (
                      <Fragment key={cat.id}>
                        <tr 
                          onClick={() => reportType === 'custom' && setExpandedCategory(isExpanded ? null : cat.id)}
                          className={`
                            group transition-colors 
                            ${reportType === 'custom' ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40' : ''} 
                            ${isExpanded ? 'bg-slate-50 dark:bg-slate-800/40' : ''}
                          `}
                        >
                          <td className="px-6 py-4 font-bold flex items-center gap-3">
                            <span className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                            {cat.name}
                          </td>
                          <td className="px-6 py-4 text-center font-medium text-slate-600 dark:text-slate-400">{cat.count}</td>
                          <td className="px-6 py-4 text-slate-500">
                            <div className="flex items-center gap-2">
                              <span>{pct}%</span>
                              <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden hidden sm:block">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[idx % COLORS.length] }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-black text-rose-600 dark:text-rose-400 text-base">{formatCurrency(cat.total, isRestricted)}</td>
                          {reportType === 'custom' && (
                            <td className="px-6 py-4 text-slate-400 group-hover:text-primary-500 transition-colors">
                              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </td>
                          )}
                        </tr>
                        
                        <AnimatePresence>
                          {isExpanded && reportType === 'custom' && (
                            <tr className="bg-slate-50/50 dark:bg-slate-900/20">
                              <td colSpan={5} className="p-0 border-b border-slate-200 dark:border-slate-700/60">
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="p-6 ps-12">
                                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                                      <Calendar className="w-4 h-4 text-primary-500" />
                                      تفاصيل مصروفات ({cat.name}) بالتاريخ:
                                    </h4>
                                    <div className="space-y-4">
                                      {groupedDates.map((group, i) => (
                                        <div key={i} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                                          <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                            <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{group.date}</span>
                                            <span className="font-bold text-sm text-rose-600 dark:text-rose-400">{formatCurrency(group.total, isRestricted)}</span>
                                          </div>
                                          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                            {group.items.map(item => (
                                              <div key={item.id} className="p-3 px-4 flex justify-between items-center hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                <div className="flex flex-col gap-1">
                                                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.title}</span>
                                                  {item.notes && <span className="text-xs text-slate-500">{item.notes}</span>}
                                                </div>
                                                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{formatCurrency(item.effectiveAmount, isRestricted)}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </AnimatePresence>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions Detail List in Period */}
      <Card className="border-0 shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-800/50 print:break-before-page print:ring-0 print:shadow-none">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="text-lg font-bold">سجل المعاملات التفصيلي</CardTitle>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto print:hidden">
            <div className="relative flex-1 sm:w-48">
              <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
              <Input
                type="text"
                placeholder="بحث..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pe-9 h-10 text-sm bg-white dark:bg-slate-900"
              />
            </div>
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 p-1 bg-white dark:bg-slate-900 shadow-sm">
              <button
                type="button"
                onClick={() => setTxTypeFilter('ALL')}
                className={`px-3 py-1.5 text-xs rounded-md font-bold transition-all ${
                  txTypeFilter === 'ALL' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setTxTypeFilter('INCOME')}
                className={`px-3 py-1.5 text-xs rounded-md font-bold transition-all ${
                  txTypeFilter === 'INCOME' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                إيرادات
              </button>
              <button
                type="button"
                onClick={() => setTxTypeFilter('EXPENSE')}
                className={`px-3 py-1.5 text-xs rounded-md font-bold transition-all ${
                  txTypeFilter === 'EXPENSE' ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                مصروفات
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 border-b dark:border-slate-700/50">
                <tr>
                  <th className="px-6 py-3.5">التاريخ والوقت</th>
                  <th className="px-6 py-3.5">النوع</th>
                  <th className="px-6 py-3.5">البيان / التصنيف</th>
                  <th className="px-6 py-3.5">المبلغ</th>
                  <th className="px-6 py-3.5">الملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {displayTxList.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-medium">
                      {new Date(tx.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-bold border ${
                        tx.type === 'INCOME' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60' 
                          : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60'
                      }`}>
                        {tx.type === 'INCOME' ? 'إيراد' : 'مصروف'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{tx.title}</td>
                    <td className="px-6 py-4 font-black text-base">
                      {(() => {
                        const isPayment = (clientOperations || []).some(op => op.expenseTransactionId === tx.id && op.type === 'PAYMENT');
                        if (tx.type === 'INCOME') {
                          return <span className="text-emerald-600 dark:text-emerald-400">+{formatCurrency(tx.amount, isRestricted)}</span>;
                        } else if (isPayment) {
                          return <span className="text-emerald-600 dark:text-emerald-400">-{formatCurrency(tx.amount, isRestricted)} (سداد)</span>;
                        } else {
                          return <span className="text-rose-600 dark:text-rose-400">-{formatCurrency(tx.amount, isRestricted)}</span>;
                        }
                      })()}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-sm">{tx.notes || '-'}</td>
                  </tr>
                ))}
                {displayTxList.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Filter className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
                        <p className="font-medium text-base text-slate-600 dark:text-slate-400">لا توجد معاملات مسجلة</p>
                        <p className="text-sm">تطابق خيارات البحث للفترة المحددة</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
