import { useStore } from '../store/useStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { formatCurrency } from '../lib/utils';
import { Wallet, ReceiptText, TrendingUp, Bell } from 'lucide-react';

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold">نظرة عامة</h2>
        <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-4 py-2 rounded-xl flex items-center text-sm font-medium">
          <Bell className="w-4 h-4 me-2" />
          تنبيه: لا تنسَ مراجعة إيرادات ومصروفات اليوم.
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-primary-100 dark:bg-primary-900/30 p-4 rounded-full text-primary-600 dark:text-primary-400">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">الرصيد الحالي</p>
              <h3 className="text-2xl font-bold">{formatCurrency(balance, isRestricted)}</h3>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-full text-green-600 dark:text-green-400">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">إجمالي الإيرادات</p>
              <h3 className="text-2xl font-bold">{formatCurrency(totalIncome, isRestricted)}</h3>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-full text-red-600 dark:text-red-400">
              <ReceiptText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">إجمالي المصروفات</p>
              <h3 className="text-2xl font-bold">{formatCurrency(totalExpense, isRestricted)}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>آخر الحركات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {storeTx.slice(0, 5).map(tx => (
              <div key={tx.id} className="flex justify-between items-center p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
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
              </div>
            ))}
            {storeTx.length === 0 && (
              <p className="text-center text-slate-500 py-4">لا توجد حركات مسجلة</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
