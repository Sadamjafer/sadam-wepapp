import { useState, useMemo } from 'react';
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
  Calendar, TrendingUp, TrendingDown, DollarSign, Package, FileText, Printer, Filter, Search
} from 'lucide-react';

type ReportType = 'daily' | 'monthly' | 'custom';

export function Reports() {
  const { auth, transactions, incomeRecords, expenseCategories, clientOperations } = useStore();
  const isRestricted = auth.role === 'RESTRICTED';

  // Current date helpers
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const currentMonthStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // Filter States
  const [reportType, setReportType] = useState<ReportType>('monthly');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // 1st of current month
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(todayStr);

  const [txTypeFilter, setTxTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

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
  const applyPreset = (preset: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'this_year') => {
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
      setReportType('monthly');
      setSelectedMonth(currentMonthStr);
    } else if (preset === 'last_month') {
      setReportType('monthly');
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      setSelectedMonth(`${lm.getFullYear()}-${String(lm.getMonth() + 1).padStart(2, '0')}`);
    } else if (preset === 'this_year') {
      setReportType('custom');
      setStartDate(`${now.getFullYear()}-01-01`);
      setEndDate(todayStr);
    }
  };

  // Determine active date range [start, end]
  const activeDateRange = useMemo(() => {
    if (reportType === 'daily') {
      const parts = selectedDate.split('-').map(Number);
      const start = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
      const end = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
      return { start, end, label: `يوم ${selectedDate}` };
    } else if (reportType === 'monthly') {
      const [year, month] = selectedMonth.split('-').map(Number);
      const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      return { start, end, label: `شهر ${selectedMonth}` };
    } else {
      const sParts = startDate.split('-').map(Number);
      const eParts = endDate.split('-').map(Number);
      const start = new Date(sParts[0], sParts[1] - 1, sParts[2], 0, 0, 0, 0);
      const end = new Date(eParts[0], eParts[1] - 1, eParts[2], 23, 59, 59, 999);
      return { start, end, label: `الفترة من ${startDate} إلى ${endDate}` };
    }
  }, [reportType, selectedDate, selectedMonth, startDate, endDate]);

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
    const categoryTotals: { [key: string]: { name: string; total: number; count: number } } = {};
    
    // Initialize with categories
    storeCategories.forEach(cat => {
      categoryTotals[cat.id] = { name: cat.name, total: 0, count: 0 };
    });

    filteredTx.forEach(tx => {
      if (tx.type === 'EXPENSE') {
        const catId = tx.categoryId || 'other';
        if (!categoryTotals[catId]) {
          categoryTotals[catId] = { name: tx.title || 'مصروف عام', total: 0, count: 0 };
        }
        const isPayment = (clientOperations || []).some(op => op.expenseTransactionId === tx.id && op.type === 'PAYMENT');
        if (isPayment) {
          categoryTotals[catId].total -= tx.amount;
        } else {
          categoryTotals[catId].total += tx.amount;
        }
        categoryTotals[catId].count += 1;
      }
    });

    return Object.values(categoryTotals).filter(item => item.total > 0);
  }, [storeCategories, filteredTx, clientOperations]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#e056fd', '#686de0'];

  // Trend Chart Data
  const trendData = useMemo(() => {
    if (reportType === 'daily') {
      // Group by 4-hour intervals or just show single day bar comparison
      return [
        { name: activeDateRange.label, الإيرادات: totalIncome, المصروفات: totalExpenses }
      ];
    } else if (reportType === 'monthly') {
      // Group by day of the month
      const [year, month] = selectedMonth.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      const daysMap = new Map<number, { name: string; الإيرادات: number; المصروفات: number }>();

      for (let i = 1; i <= daysInMonth; i++) {
        daysMap.set(i, { name: `${i}`, الإيرادات: 0, المصروفات: 0 });
      }

      filteredTx.forEach(tx => {
        const day = new Date(tx.date).getDate();
        if (daysMap.has(day)) {
          const entry = daysMap.get(day)!;
          if (tx.type === 'INCOME') entry.الإيرادات += tx.amount;
          else {
            const isPayment = (clientOperations || []).some(op => op.expenseTransactionId === tx.id && op.type === 'PAYMENT');
            if (isPayment) {
              entry.المصروفات -= tx.amount;
            } else {
              entry.المصروفات += tx.amount;
            }
          }
        }
      });

      return Array.from(daysMap.values());
    } else {
      // Custom range: Group by date
      const dateMap = new Map<string, { name: string; الإيرادات: number; المصروفات: number }>();
      
      filteredTx.forEach(tx => {
        const dateStr = new Date(tx.date).toLocaleDateString('ar-EG', { month: 'numeric', day: 'numeric' });
        if (!dateMap.has(dateStr)) {
          dateMap.set(dateStr, { name: dateStr, الإيرادات: 0, المصروفات: 0 });
        }
        const entry = dateMap.get(dateStr)!;
        if (tx.type === 'INCOME') entry.الإيرادات += tx.amount;
        else {
          const isPayment = (clientOperations || []).some(op => op.expenseTransactionId === tx.id && op.type === 'PAYMENT');
          if (isPayment) {
            entry.المصروفات -= tx.amount;
          } else {
            entry.المصروفات += tx.amount;
          }
        }
      });

      return Array.from(dateMap.values());
    }
  }, [reportType, activeDateRange, selectedMonth, filteredTx, totalIncome, totalExpenses, clientOperations]);

  // Filtered detailed transactions list
  const displayTxList = useMemo(() => {
    return filteredTx.filter(tx => {
      const matchesType = txTypeFilter === 'ALL' || tx.type === txTypeFilter;
      const matchesSearch = searchQuery === '' || 
        tx.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (tx.notes && tx.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesType && matchesSearch;
    });
  }, [filteredTx, txTypeFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">التقارير والإحصائيات</h2>
          <p className="text-sm text-slate-500 mt-1">{activeDateRange.label}</p>
        </div>
        <Button variant="outline" onClick={() => window.print()} className="print:hidden">
          <Printer className="w-4 h-4 me-2" />
          طباعة التقرير
        </Button>
      </div>

      {/* Report Controls & Filter Card */}
      <Card className="print:hidden">
        <CardContent className="p-4 sm:p-6 space-y-4">
          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap gap-2 pb-2 border-b border-slate-100 dark:border-slate-700/50">
            <span className="text-xs font-semibold text-slate-400 self-center me-2">خيارات سريعة:</span>
            <Button size="sm" variant={reportType === 'daily' && selectedDate === todayStr ? 'default' : 'outline'} onClick={() => applyPreset('today')}>
              اليوم
            </Button>
            <Button size="sm" variant="outline" onClick={() => applyPreset('yesterday')}>
              الأمس
            </Button>
            <Button size="sm" variant="outline" onClick={() => applyPreset('this_week')}>
              هذا الأسبوع
            </Button>
            <Button size="sm" variant={reportType === 'monthly' && selectedMonth === currentMonthStr ? 'default' : 'outline'} onClick={() => applyPreset('this_month')}>
              هذا الشهر
            </Button>
            <Button size="sm" variant="outline" onClick={() => applyPreset('last_month')}>
              الشهر الماضي
            </Button>
            <Button size="sm" variant="outline" onClick={() => applyPreset('this_year')}>
              هذه السنة
            </Button>
          </div>

          {/* Mode Selector & Date Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <Label className="text-xs font-medium mb-1.5 block">نوع التقرير</Label>
              <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 p-1 bg-slate-50 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setReportType('daily')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    reportType === 'daily' ? 'bg-white dark:bg-slate-700 shadow-sm font-bold text-primary-600 dark:text-primary-400' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  يومي
                </button>
                <button
                  type="button"
                  onClick={() => setReportType('monthly')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    reportType === 'monthly' ? 'bg-white dark:bg-slate-700 shadow-sm font-bold text-primary-600 dark:text-primary-400' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  شهري
                </button>
                <button
                  type="button"
                  onClick={() => setReportType('custom')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    reportType === 'custom' ? 'bg-white dark:bg-slate-700 shadow-sm font-bold text-primary-600 dark:text-primary-400' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  فترة محددة
                </button>
              </div>
            </div>

            {/* Date Pickers based on Report Type */}
            {reportType === 'daily' && (
              <div className="md:col-span-2">
                <Label className="text-xs font-medium mb-1.5 block">اختر اليوم</Label>
                <Input 
                  type="date" 
                  value={selectedDate} 
                  onChange={e => setSelectedDate(e.target.value)} 
                />
              </div>
            )}

            {reportType === 'monthly' && (
              <div className="md:col-span-2">
                <Label className="text-xs font-medium mb-1.5 block">اختر الشهر</Label>
                <Input 
                  type="month" 
                  value={selectedMonth} 
                  onChange={e => setSelectedMonth(e.target.value)} 
                />
              </div>
            )}

            {reportType === 'custom' && (
              <>
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">من تاريخ</Label>
                  <Input 
                    type="date" 
                    value={startDate} 
                    onChange={e => setStartDate(e.target.value)} 
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">إلى تاريخ</Label>
                  <Input 
                    type="date" 
                    value={endDate} 
                    onChange={e => setEndDate(e.target.value)} 
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Income */}
        <Card className="bg-emerald-50/50 border-emerald-200/60 dark:bg-emerald-950/20 dark:border-emerald-800/40">
          <CardContent className="p-4 flex flex-col justify-between">
            <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
              <span className="text-xs font-bold">إجمالي الإيرادات</span>
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="mt-3">
              <div className="text-xl sm:text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                {formatCurrency(totalIncome, isRestricted)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Expenses */}
        <Card className="bg-rose-50/50 border-rose-200/60 dark:bg-rose-950/20 dark:border-rose-800/40">
          <CardContent className="p-4 flex flex-col justify-between">
            <div className="flex justify-between items-center text-rose-600 dark:text-rose-400">
              <span className="text-xs font-bold">إجمالي المصروفات</span>
              <TrendingDown className="w-5 h-5" />
            </div>
            <div className="mt-3">
              <div className="text-xl sm:text-2xl font-bold text-rose-700 dark:text-rose-300">
                {formatCurrency(totalExpenses, isRestricted)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Net Profit */}
        <Card className={`border ${
          netProfit >= 0 
            ? 'bg-blue-50/50 border-blue-200/60 dark:bg-blue-950/20 dark:border-blue-800/40' 
            : 'bg-red-50/50 border-red-200/60 dark:bg-red-950/20 dark:border-red-800/40'
        }`}>
          <CardContent className="p-4 flex flex-col justify-between">
            <div className={`flex justify-between items-center ${netProfit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
              <span className="text-xs font-bold">صافي الربح</span>
              <DollarSign className="w-5 h-5" />
            </div>
            <div className="mt-3">
              <div className={`text-xl sm:text-2xl font-bold ${netProfit >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-red-700 dark:text-red-300'}`}>
                {formatCurrency(netProfit, isRestricted)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Units */}
        <Card className="bg-purple-50/50 border-purple-200/60 dark:bg-purple-950/20 dark:border-purple-800/40">
          <CardContent className="p-4 flex flex-col justify-between">
            <div className="flex justify-between items-center text-purple-600 dark:text-purple-400">
              <span className="text-xs font-bold">إجمالي الوحدات</span>
              <Package className="w-5 h-5" />
            </div>
            <div className="mt-3">
              <div className="text-xl sm:text-2xl font-bold text-purple-700 dark:text-purple-300">
                {formatMoney(totalUnits, isRestricted)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Operations */}
        <Card className="col-span-2 sm:col-span-1 bg-slate-50 border-slate-200/60 dark:bg-slate-800/50 dark:border-slate-700/50">
          <CardContent className="p-4 flex flex-col justify-between">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
              <span className="text-xs font-bold">عدد المعاملات</span>
              <FileText className="w-5 h-5" />
            </div>
            <div className="mt-3">
              <div className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-200">
                {filteredTx.length}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income vs Expenses Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              مقارنة الإيرادات والمصروفات ({activeDateRange.label})
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {trendData.length > 0 && (totalIncome > 0 || totalExpenses > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis hide={isRestricted} fontSize={12} />
                  <Tooltip formatter={(value: number) => formatCurrency(value, isRestricted)} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="الإيرادات" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="المصروفات" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                لا توجد بيانات للفترة المحددة
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expenses Category Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-rose-500" />
              توزيع المصروفات حسب التصنيف
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {expensesByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expensesByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="total"
                    nameKey="name"
                  >
                    {expensesByCategory.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value, isRestricted)} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                لا توجد مصروفات مسجلة للفترة المحددة
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Expense Category Summary Breakdown Table */}
      {expensesByCategory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold">تفاصيل المصروفات حسب التصنيف</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 border-b dark:border-slate-700/50">
                  <tr>
                    <th className="px-6 py-3">التصنيف</th>
                    <th className="px-6 py-3">عدد العمليات</th>
                    <th className="px-6 py-3">إجمالي المبلغ</th>
                    <th className="px-6 py-3">النسبة من المصروفات</th>
                  </tr>
                </thead>
                <tbody>
                  {expensesByCategory.map((cat, idx) => {
                    const pct = totalExpenses > 0 ? ((cat.total / totalExpenses) * 100).toFixed(1) : '0';
                    return (
                      <tr key={idx} className="border-b dark:border-slate-700/50 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-6 py-3 font-medium flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                          {cat.name}
                        </td>
                        <td className="px-6 py-3">{cat.count}</td>
                        <td className="px-6 py-3 font-bold text-rose-600">{formatCurrency(cat.total, isRestricted)}</td>
                        <td className="px-6 py-3">{pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions Detail List in Period */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="text-base font-bold">جدول المعاملات التفصيلي</CardTitle>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto print:hidden">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-48">
              <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
              <Input
                type="text"
                placeholder="بحث..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pe-9 h-9 text-xs"
              />
            </div>

            {/* Type Filter Buttons */}
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setTxTypeFilter('ALL')}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                  txTypeFilter === 'ALL' ? 'bg-white dark:bg-slate-700 shadow-sm font-bold' : 'text-slate-500'
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setTxTypeFilter('INCOME')}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                  txTypeFilter === 'INCOME' ? 'bg-emerald-500 text-white font-bold' : 'text-slate-500'
                }`}
              >
                إيرادات
              </button>
              <button
                type="button"
                onClick={() => setTxTypeFilter('EXPENSE')}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                  txTypeFilter === 'EXPENSE' ? 'bg-rose-500 text-white font-bold' : 'text-slate-500'
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
                  <th className="px-6 py-3">التاريخ</th>
                  <th className="px-6 py-3">النوع</th>
                  <th className="px-6 py-3">البيان / التصنيف</th>
                  <th className="px-6 py-3">المبلغ</th>
                  <th className="px-6 py-3">الملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {displayTxList.map(tx => (
                  <tr key={tx.id} className="border-b dark:border-slate-700/50 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                      {new Date(tx.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        tx.type === 'INCOME' 
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' 
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                      }`}>
                        {tx.type === 'INCOME' ? 'إيراد' : 'مصروف'}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-medium">{tx.title}</td>
                    <td className="px-6 py-3 font-bold">
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
                    <td className="px-6 py-3 text-slate-500">{tx.notes || '-'}</td>
                  </tr>
                ))}
                {displayTxList.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      لا توجد معاملات مسجلة تطابق خيارات البحث للفترة المحددة
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

