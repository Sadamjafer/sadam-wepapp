import { useStore } from '../store/useStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { formatCurrency } from '../lib/utils';
import { Wallet, ReceiptText, TrendingUp, Bell } from 'lucide-react';
import { motion } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function Dashboard() {
  const { auth, transactions, clientOperations } = useStore();
  const isRestricted = auth.role === 'RESTRICTED';

  const storeTx = transactions.filter(t => t.storeId === auth.currentStoreId);
  const totalIncome = storeTx.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = storeTx.filter(t => t.type === 'EXPENSE').reduce((acc, t) => {
    const isPayment = (clientOperations || []).some(op => op.expenseTransactionId === t.id && op.type === 'PAYMENT');
    return acc + (isPayment ? -t.amount : t.amount);
  }, 0);
  const balance = totalIncome - totalExpense;

  // Prepare chart data for last 7 days
  const last7DaysData = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    const dayTx = storeTx.filter(t => t.date.startsWith(dateStr));
    const income = dayTx.filter(t => t.type === 'INCOME').reduce((a, t) => a + t.amount, 0);
    const expense = dayTx.filter(t => t.type === 'EXPENSE').reduce((a, t) => {
      const isPayment = (clientOperations || []).some(op => op.expenseTransactionId === t.id && op.type === 'PAYMENT');
      return a + (isPayment ? -t.amount : t.amount);
    }, 0);
    return {
      name: d.toLocaleDateString('ar-EG', { weekday: 'short' }),
      date: dateStr,
      income,
      expense,
      balance: income - expense
    };
  });

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold">نظرة عامة</h2>
        <motion.div 
          className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-4 py-2 rounded-xl flex items-center text-sm font-medium"
          whileHover={{ scale: 1.05 }}
        >
          <Bell className="w-4 h-4 me-2 animate-bounce" />
          تنبيه: لا تنسَ مراجعة إيرادات ومصروفات اليوم.
        </motion.div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        <motion.div variants={itemVariants} className="col-span-2 md:col-span-1">
          <Card className="hover:shadow-md transition-shadow bg-gradient-to-r from-primary-500/10 via-primary-500/5 to-transparent border-primary-200/60 dark:border-primary-800/40">
            <CardContent className="p-4 sm:p-6 flex items-center gap-3 sm:gap-4">
              <div className="bg-primary-100 dark:bg-primary-900/40 p-3 sm:p-4 rounded-2xl text-primary-600 dark:text-primary-400 shrink-0">
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-0.5 sm:mb-1 truncate font-medium">الرصيد الحالي</p>
                <h3 className="text-xl sm:text-2xl font-bold truncate text-slate-900 dark:text-slate-100">{formatCurrency(balance, isRestricted)}</h3>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div variants={itemVariants} className="col-span-1">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-3.5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
              <div className="bg-green-100 dark:bg-green-900/30 p-2.5 sm:p-4 rounded-xl sm:rounded-full text-green-600 dark:text-green-400 shrink-0">
                <Wallet className="w-4 h-4 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0 w-full">
                <p className="text-[11px] sm:text-sm text-slate-500 dark:text-slate-400 mb-0.5 sm:mb-1 truncate font-medium">إجمالي الإيرادات</p>
                <h3 className="text-base sm:text-2xl font-bold truncate text-green-600 dark:text-green-400">{formatCurrency(totalIncome, isRestricted)}</h3>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants} className="col-span-1">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-3.5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
              <div className="bg-red-100 dark:bg-red-900/30 p-2.5 sm:p-4 rounded-xl sm:rounded-full text-red-600 dark:text-red-400 shrink-0">
                <ReceiptText className="w-4 h-4 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0 w-full">
                <p className="text-[11px] sm:text-sm text-slate-500 dark:text-slate-400 mb-0.5 sm:mb-1 truncate font-medium">إجمالي المصروفات</p>
                <h3 className="text-base sm:text-2xl font-bold truncate text-red-600 dark:text-red-400">{formatCurrency(totalExpense, isRestricted)}</h3>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants} className="h-full">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>أداء آخر 7 أيام</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-[300px]">
              {isRestricted ? (
                <div className="w-full h-full flex items-center justify-center text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  غير مصرح بعرض الرسم البياني
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={last7DaysData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#16a34a" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `£${val}`} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                      labelStyle={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}
                    />
                    <Area type="monotone" dataKey="income" name="إيرادات" stroke="#16a34a" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
                    <Area type="monotone" dataKey="expense" name="مصروفات" stroke="#dc2626" strokeWidth={3} fillOpacity={1} fill="url(#colorExpense)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>آخر الحركات</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {storeTx.slice(0, 5).map((tx, idx) => (
                  <motion.div 
                    key={tx.id} 
                    className="flex justify-between items-center p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * idx }}
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{tx.title}</span>
                      <span className="text-sm text-slate-500">{new Date(tx.date).toLocaleDateString('ar-EG')}</span>
                    </div>
                    <div className={`font-bold ${
                      tx.type === 'INCOME' 
                        ? 'text-green-600' 
                        : (clientOperations || []).some(op => op.expenseTransactionId === tx.id && op.type === 'PAYMENT')
                          ? 'text-green-600' 
                          : 'text-red-600'
                    }`}>
                      {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(tx.amount, isRestricted)}
                      {tx.type === 'EXPENSE' && (clientOperations || []).some(op => op.expenseTransactionId === tx.id && op.type === 'PAYMENT') && (
                        <span className="text-[10px] block font-medium text-green-600 text-left">(سداد مورد)</span>
                      )}
                    </div>
                  </motion.div>
                ))}
                {storeTx.length === 0 && (
                  <p className="text-center text-slate-500 py-4">لا توجد حركات مسجلة</p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
