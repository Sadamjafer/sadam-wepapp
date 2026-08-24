import { useState, useMemo, Fragment } from 'react';
import { useStore } from '../store/useStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { formatCurrency, formatMoney } from '../lib/utils';
import { 
  Calendar, TrendingUp, TrendingDown, DollarSign, Package, Download, ChevronDown, ChevronUp, FileSpreadsheet, Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function Reports() {
  const { auth, transactions, incomeRecords, expenseCategories, clientOperations } = useStore();
  const isRestricted = auth.role === 'RESTRICTED';

  // Current date helpers
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Filter States: Start Date & End Date
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // 1st of current month
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(todayStr);

  // State for expanded expense items (accordion)
  const [expandedExpenseItem, setExpandedExpenseItem] = useState<string | null>(null);

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
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === 'this_week') {
      const first = new Date(now);
      const day = first.getDay(); // 0 is Sunday
      const diff = first.getDate() - day + (day === 0 ? -6 : 1); // Monday start
      const monday = new Date(first.setDate(diff));
      setStartDate(monday.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'this_month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(first.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'last_month') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(first.toISOString().split('T')[0]);
      setEndDate(last.toISOString().split('T')[0]);
    }
  };

  // Determine active date range [start, end]
  const activeDateRange = useMemo(() => {
    const sParts = (startDate || todayStr).split('-').map(Number);
    const eParts = (endDate || todayStr).split('-').map(Number);
    const start = new Date(sParts[0], sParts[1] - 1, sParts[2], 0, 0, 0, 0);
    const end = new Date(eParts[0], eParts[1] - 1, eParts[2], 23, 59, 59, 999);
    
    const isSingleDay = startDate === endDate;
    const label = isSingleDay ? `يوم ${startDate}` : `من: ${startDate}  إلى: ${endDate}`;
    
    return { start, end, label, isSingleDay };
  }, [startDate, endDate, todayStr]);

  // Filter transactions within active range
  const filteredTx = useMemo(() => {
    return storeTx.filter(tx => {
      const d = new Date(tx.date);
      return d >= activeDateRange.start && d <= activeDateRange.end;
    });
  }, [storeTx, activeDateRange]);

  // Filter income records within active range (sorted by date)
  const filteredIncomeRecords = useMemo(() => {
    return storeIncomeRecords
      .filter(r => {
        const d = new Date(r.date);
        return d >= activeDateRange.start && d <= activeDateRange.end;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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

  // Aggregation of Expenses by Expense Name / Title (اسم المنصرف / بند المصروف)
  const expensesByItem = useMemo(() => {
    const itemMap: Record<string, { 
      itemName: string; 
      totalAmount: number; 
      count: number; 
      records: Array<{
        id: string;
        date: string;
        amount: number;
        notes: string;
        rawDate: string;
      }> 
    }> = {};

    filteredTx.forEach(tx => {
      if (tx.type === 'EXPENSE') {
        // Resolve item name from title or associated category
        const cat = storeCategories.find(c => c.id === tx.categoryId);
        const name = (tx.title && tx.title.trim()) || (cat?.name) || 'مصروف عام';
        
        const isPayment = (clientOperations || []).some(op => op.expenseTransactionId === tx.id && op.type === 'PAYMENT');
        const effectiveAmount = isPayment ? -tx.amount : tx.amount;

        if (!itemMap[name]) {
          itemMap[name] = {
            itemName: name,
            totalAmount: 0,
            count: 0,
            records: []
          };
        }

        itemMap[name].totalAmount += effectiveAmount;
        itemMap[name].count += 1;
        itemMap[name].records.push({
          id: tx.id,
          date: new Date(tx.date).toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' }),
          amount: effectiveAmount,
          notes: tx.notes || '',
          rawDate: tx.date
        });
      }
    });

    // Sort records within each item chronologically
    Object.values(itemMap).forEach(item => {
      item.records.sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime());
    });

    // Return list sorted descending by total amount
    return Object.values(itemMap).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredTx, storeCategories, clientOperations]);

  const toggleExpandExpense = (itemName: string) => {
    setExpandedExpenseItem(prev => prev === itemName ? null : itemName);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            التقرير المالي للفترة المحددة
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">{activeDateRange.label}</p>
        </div>
        <Button onClick={() => window.print()} className="print:hidden bg-primary-600 hover:bg-primary-700 shadow-sm text-white">
          <Download className="w-4 h-4 me-2" />
          حفظ كـ PDF / طباعة
        </Button>
      </div>

      {/* Period Selection Controls Card */}
      <Card className="print:hidden border-0 shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-800/50">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 sm:gap-4 justify-between">
            {/* Quick Preset Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 w-full sm:w-auto pb-2 sm:pb-0 border-b sm:border-b-0 border-slate-100 dark:border-slate-800">
              <Button 
                size="sm" 
                variant={startDate === todayStr && endDate === todayStr ? 'default' : 'outline'} 
                className="whitespace-nowrap shrink-0 text-xs h-8" 
                onClick={() => applyPreset('today')}
              >
                اليوم
              </Button>
              <Button size="sm" variant="outline" className="whitespace-nowrap shrink-0 text-xs h-8" onClick={() => applyPreset('yesterday')}>
                الأمس
              </Button>
              <Button size="sm" variant="outline" className="whitespace-nowrap shrink-0 text-xs h-8" onClick={() => applyPreset('this_week')}>
                هذا الأسبوع
              </Button>
              <Button size="sm" variant="outline" className="whitespace-nowrap shrink-0 text-xs h-8" onClick={() => applyPreset('this_month')}>
                هذا الشهر
              </Button>
              <Button size="sm" variant="outline" className="whitespace-nowrap shrink-0 text-xs h-8" onClick={() => applyPreset('last_month')}>
                الشهر الماضي
              </Button>
            </div>

            {/* Date Pickers: Start Date & End Date */}
            <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto flex-1 sm:justify-end">
              <div className="w-full sm:max-w-[190px]">
                <Label className="text-[11px] font-bold mb-1 block text-slate-600 dark:text-slate-300">من تاريخ</Label>
                <Input 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)} 
                  className="h-9 sm:h-10 text-xs font-semibold"
                />
              </div>
              <div className="w-full sm:max-w-[190px]">
                <Label className="text-[11px] font-bold mb-1 block text-slate-600 dark:text-slate-300">إلى تاريخ</Label>
                <Input 
                  type="date" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)} 
                  className="h-9 sm:h-10 text-xs font-semibold"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Overview Cards (Compact 2x2 on Mobile) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <Card className="bg-emerald-50/80 border-emerald-200/60 dark:bg-emerald-900/20 dark:border-emerald-800/40 shadow-none">
          <CardContent className="p-3 sm:p-5 flex flex-col justify-between">
            <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
              <span className="text-xs sm:text-sm font-bold truncate">إجمالي الإيرادات</span>
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 opacity-75 shrink-0" />
            </div>
            <div className="mt-2 sm:mt-4">
              <div className="text-base sm:text-2xl font-black text-emerald-700 dark:text-emerald-300 tracking-tight truncate">
                {formatCurrency(totalIncome, isRestricted)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-rose-50/80 border-rose-200/60 dark:bg-rose-900/20 dark:border-rose-800/40 shadow-none">
          <CardContent className="p-3 sm:p-5 flex flex-col justify-between">
            <div className="flex justify-between items-center text-rose-600 dark:text-rose-400">
              <span className="text-xs sm:text-sm font-bold truncate">إجمالي المصروفات</span>
              <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 opacity-75 shrink-0" />
            </div>
            <div className="mt-2 sm:mt-4">
              <div className="text-base sm:text-2xl font-black text-rose-700 dark:text-rose-300 tracking-tight truncate">
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
          <CardContent className="p-3 sm:p-5 flex flex-col justify-between">
            <div className={`flex justify-between items-center ${netProfit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
              <span className="text-xs sm:text-sm font-bold truncate">صافي الربح</span>
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 opacity-75 shrink-0" />
            </div>
            <div className="mt-2 sm:mt-4">
              <div className={`text-base sm:text-2xl font-black tracking-tight truncate ${netProfit >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-red-700 dark:text-red-300'}`}>
                {formatCurrency(netProfit, isRestricted)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50/80 border-purple-200/60 dark:bg-purple-900/20 dark:border-purple-800/40 shadow-none">
          <CardContent className="p-3 sm:p-5 flex flex-col justify-between">
            <div className="flex justify-between items-center text-purple-600 dark:text-purple-400">
              <span className="text-xs sm:text-sm font-bold truncate">إجمالي الوحدات</span>
              <Package className="w-4 h-4 sm:w-5 sm:h-5 opacity-75 shrink-0" />
            </div>
            <div className="mt-2 sm:mt-4">
              <div className="text-base sm:text-2xl font-black text-purple-700 dark:text-purple-300 tracking-tight truncate">
                {formatMoney(totalUnits, isRestricted)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 1: INCOME TABLE (جدول الإيرادات) */}
      <Card className="border-0 shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-800/50 overflow-hidden print:ring-0 print:shadow-none">
        <CardHeader className="bg-emerald-50/40 dark:bg-emerald-950/20 border-b border-emerald-100 dark:border-emerald-900/40 p-4 sm:p-5">
          <div className="flex justify-between items-center">
            <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
              <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>جدول الإيرادات اليومية</span>
            </CardTitle>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
              {filteredIncomeRecords.length} يوم/قيد
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile View */}
          <div className="md:hidden p-3 divide-y divide-slate-100 dark:divide-slate-800">
            {filteredIncomeRecords.map((rec) => (
              <div key={rec.id} className="py-3 first:pt-0 last:pb-0 flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    {new Date(rec.date).toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                  </span>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    +{formatCurrency(rec.amount, isRestricted)}
                  </span>
                </div>
                {(rec.notes || rec.units > 0) && (
                  <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40 p-2 rounded-lg">
                    <span>{rec.notes || 'إيراد يومية'}</span>
                    {rec.units > 0 && <span className="font-semibold">{formatMoney(rec.units, isRestricted)} وحدة</span>}
                  </div>
                )}
              </div>
            ))}
            {filteredIncomeRecords.length === 0 && (
              <div className="py-8 text-center text-slate-400 text-xs">
                لا توجد إيرادات مسجلة في هذه الفترة
              </div>
            )}
            {/* Total Mobile Row */}
            <div className="pt-3 mt-2 border-t-2 border-emerald-200 dark:border-emerald-800/60 flex justify-between items-center font-black">
              <span className="text-xs text-slate-800 dark:text-slate-200">إجمالي الإيرادات للفترة:</span>
              <span className="text-sm text-emerald-600 dark:text-emerald-400">{formatCurrency(totalIncome, isRestricted)}</span>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold text-xs border-b dark:border-slate-700/50">
                <tr>
                  <th className="px-6 py-3.5 whitespace-nowrap">التاريخ</th>
                  <th className="px-6 py-3.5">البيان / الملاحظات</th>
                  <th className="px-6 py-3.5 whitespace-nowrap text-center">عدد الوحدات</th>
                  <th className="px-6 py-3.5 whitespace-nowrap font-bold">المبلغ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {filteredIncomeRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-3.5 whitespace-nowrap font-bold text-slate-800 dark:text-slate-200">
                      {new Date(rec.date).toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                    </td>
                    <td className="px-6 py-3.5 text-slate-600 dark:text-slate-400 font-medium">
                      {rec.notes || 'إيراد مبيعات يومية'}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap text-center text-slate-600 dark:text-slate-400 font-semibold">
                      {rec.units > 0 ? formatMoney(rec.units, isRestricted) : '-'}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap font-black text-sm text-emerald-600 dark:text-emerald-400">
                      +{formatCurrency(rec.amount, isRestricted)}
                    </td>
                  </tr>
                ))}
                {filteredIncomeRecords.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400 font-medium">
                      لا توجد إيرادات مسجلة في هذه الفترة
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-emerald-50/60 dark:bg-emerald-950/30 border-t-2 border-emerald-300/80 dark:border-emerald-800/80 font-black text-xs">
                <tr>
                  <td colSpan={3} className="px-6 py-3.5 text-slate-800 dark:text-slate-200 text-sm">
                    إجمالي الإيرادات للفترة المحددة:
                  </td>
                  <td className="px-6 py-3.5 whitespace-nowrap text-base text-emerald-700 dark:text-emerald-300">
                    +{formatCurrency(totalIncome, isRestricted)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 2 & 3: EXPENSES TABLE BY ITEM NAME WITH EXPANDABLE DETAILS (جدول المصروفات المجمعة حسب بند المنصرف) */}
      <Card className="border-0 shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-800/50 overflow-hidden print:ring-0 print:shadow-none">
        <CardHeader className="bg-rose-50/40 dark:bg-rose-950/20 border-b border-rose-100 dark:border-rose-900/40 p-4 sm:p-5">
          <div className="flex justify-between items-center">
            <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-rose-800 dark:text-rose-300">
              <TrendingDown className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>جدول المصروفات (مجمعة حسب بند المنصرف)</span>
            </CardTitle>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              (اضغط على أي بند لعرض تفاصيل قيوده)
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile Accordion View */}
          <div className="md:hidden p-3 flex flex-col gap-2.5">
            {expensesByItem.map((item) => {
              const isExpanded = expandedExpenseItem === item.itemName;
              return (
                <div key={item.itemName} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs">
                  <div 
                    onClick={() => toggleExpandExpense(item.itemName)}
                    className="p-3.5 flex flex-col gap-2 cursor-pointer active:bg-slate-50 dark:active:bg-slate-700/50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <Layers className="w-4 h-4 text-rose-500 shrink-0" />
                        <span className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">{item.itemName}</span>
                      </div>
                      <span className="font-black text-sm text-rose-600 dark:text-rose-400 shrink-0">
                        {formatCurrency(item.totalAmount, isRestricted)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-700/50">
                      <span>{item.count} عمليات مسجلة</span>
                      <span className="text-primary-600 dark:text-primary-400 flex items-center gap-1 font-semibold text-[11px]">
                        {isExpanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </span>
                    </div>
                  </div>

                  {/* Collapsible Mobile Sub-Table */}
                  {isExpanded && (
                    <div className="bg-slate-50 dark:bg-slate-900/40 p-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
                      <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        تفاصيل قيود ({item.itemName}) خلال الفترة:
                      </p>
                      <div className="space-y-1.5">
                        {item.records.map((r, idx) => (
                          <div key={idx} className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800 dark:text-slate-200">{r.date}</span>
                              {r.notes && <span className="text-[10px] text-slate-500">{r.notes}</span>}
                            </div>
                            <span className="font-bold text-rose-600 dark:text-rose-400">{formatCurrency(r.amount, isRestricted)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs font-black">
                        <span>إجمالي {item.itemName}:</span>
                        <span className="text-rose-600">{formatCurrency(item.totalAmount, isRestricted)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {expensesByItem.length === 0 && (
              <div className="py-8 text-center text-slate-400 text-xs">
                لا توجد مصروفات مسجلة في هذه الفترة
              </div>
            )}

            {/* Mobile Total Row */}
            <div className="pt-3 mt-2 border-t-2 border-rose-200 dark:border-rose-800/60 flex justify-between items-center font-black">
              <span className="text-xs text-slate-800 dark:text-slate-200">إجمالي المصروفات للفترة:</span>
              <span className="text-sm text-rose-600 dark:text-rose-400">{formatCurrency(totalExpenses, isRestricted)}</span>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold text-xs border-b dark:border-slate-700/50">
                <tr>
                  <th className="px-6 py-3.5">المنصرف / بند المصروف</th>
                  <th className="px-6 py-3.5 text-center whitespace-nowrap">عدد العمليات</th>
                  <th className="px-6 py-3.5 whitespace-nowrap font-bold">إجمالي المصروف خلال الفترة</th>
                  <th className="px-6 py-3.5 w-12 text-center">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {expensesByItem.map((item) => {
                  const isExpanded = expandedExpenseItem === item.itemName;
                  return (
                    <Fragment key={item.itemName}>
                      <tr 
                        onClick={() => toggleExpandExpense(item.itemName)}
                        className={`
                          cursor-pointer transition-colors group
                          ${isExpanded ? 'bg-slate-100/70 dark:bg-slate-800/60' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'}
                        `}
                      >
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
                          <Layers className="w-4 h-4 text-rose-500 shrink-0" />
                          <span>{item.itemName}</span>
                        </td>
                        <td className="px-6 py-4 text-center font-semibold text-slate-600 dark:text-slate-400">
                          {item.count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-black text-sm text-rose-600 dark:text-rose-400">
                          {formatCurrency(item.totalAmount, isRestricted)}
                        </td>
                        <td className="px-6 py-4 text-center text-slate-400 group-hover:text-primary-600">
                          {isExpanded ? <ChevronUp className="w-4 h-4 inline" /> : <ChevronDown className="w-4 h-4 inline" />}
                        </td>
                      </tr>

                      {/* Expandable Details Sub-table */}
                      <AnimatePresence>
                        {isExpanded && (
                          <tr className="bg-slate-50/70 dark:bg-slate-900/30">
                            <td colSpan={4} className="p-0 border-b border-slate-200 dark:border-slate-700/60">
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="p-5 ps-10">
                                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
                                    <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                      <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
                                        تفاصيل قيود ({item.itemName}) داخل الفترة المحددة:
                                      </span>
                                      <span className="text-xs font-semibold text-slate-500">
                                        عدد القيود: {item.records.length}
                                      </span>
                                    </div>
                                    <table className="w-full text-xs text-right">
                                      <thead className="bg-slate-50/50 dark:bg-slate-800/40 text-slate-500 border-b dark:border-slate-700">
                                        <tr>
                                          <th className="px-4 py-2 font-medium">تاريخ القيد</th>
                                          <th className="px-4 py-2 font-medium">الملاحظات</th>
                                          <th className="px-4 py-2 font-medium">المبلغ</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                                        {item.records.map((r, idx) => (
                                          <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30">
                                            <td className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-200">
                                              {r.date}
                                            </td>
                                            <td className="px-4 py-2 text-slate-500">
                                              {r.notes || '-'}
                                            </td>
                                            <td className="px-4 py-2 font-bold text-rose-600 dark:text-rose-400">
                                              {formatCurrency(r.amount, isRestricted)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                      <tfoot className="bg-rose-50/40 dark:bg-rose-950/20 border-t border-rose-200 dark:border-rose-800/60 font-black">
                                        <tr>
                                          <td colSpan={2} className="px-4 py-2 text-slate-800 dark:text-slate-200">
                                            إجمالي {item.itemName}:
                                          </td>
                                          <td className="px-4 py-2 text-rose-600 dark:text-rose-400 font-black">
                                            {formatCurrency(item.totalAmount, isRestricted)}
                                          </td>
                                        </tr>
                                      </tfoot>
                                    </table>
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
                {expensesByItem.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400 font-medium">
                      لا توجد مصروفات مسجلة في هذه الفترة
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-rose-50/60 dark:bg-rose-950/30 border-t-2 border-rose-300/80 dark:border-rose-800/80 font-black text-xs">
                <tr>
                  <td colSpan={2} className="px-6 py-3.5 text-slate-800 dark:text-slate-200 text-sm">
                    إجمالي المصروفات للفترة:
                  </td>
                  <td colSpan={2} className="px-6 py-3.5 whitespace-nowrap text-base text-rose-700 dark:text-rose-300">
                    {formatCurrency(totalExpenses, isRestricted)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 4: FINANCIAL SUMMARY (الملخص المالي النهائي للفترة) */}
      <Card className="border-0 shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-800/50 overflow-hidden print:ring-0 print:shadow-none">
        <CardHeader className="bg-slate-900 text-white p-4 sm:p-5">
          <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-white">
            <DollarSign className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>الملخص المالي للفترة</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold text-xs border-b dark:border-slate-700">
              <tr>
                <th className="px-6 py-3.5">البيان</th>
                <th className="px-6 py-3.5 font-bold">المبلغ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>إجمالي الإيرادات</span>
                </td>
                <td className="px-6 py-4 font-black text-emerald-600 dark:text-emerald-400 text-base">
                  +{formatCurrency(totalIncome, isRestricted)}
                </td>
              </tr>
              <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span>إجمالي المصروفات</span>
                </td>
                <td className="px-6 py-4 font-black text-rose-600 dark:text-rose-400 text-base">
                  -{formatCurrency(totalExpenses, isRestricted)}
                </td>
              </tr>
              <tr className={`border-t-2 ${netProfit >= 0 ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50' : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/50'}`}>
                <td className="px-6 py-4 font-extrabold text-slate-900 dark:text-slate-100 text-base flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${netProfit >= 0 ? 'bg-blue-600' : 'bg-red-600'}`} />
                  <span>صافي الربح (الإيرادات - المصروفات)</span>
                </td>
                <td className="px-6 py-4 font-black text-lg">
                  <span className={`px-3 py-1 rounded-lg ${netProfit >= 0 ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300'}`}>
                    {netProfit >= 0 ? '+' : ''}{formatCurrency(netProfit, isRestricted)}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

