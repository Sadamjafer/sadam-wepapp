import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  Role, Store, Transaction, IncomeRecord, 
  ExpenseCategory, Client, ClientOperation, ProfitDeduction 
} from '../types';

interface AppState {
  passcodes: { admin: string; supervisor: string; restricted: string };
  auth: { isLoggedIn: boolean; role: Role | null; currentStoreId: string | null };
  settings: { darkMode: boolean; fontSize: 'small' | 'medium' | 'large' };
  stores: Store[];
  transactions: Transaction[];
  incomeRecords: IncomeRecord[];
  expenseCategories: ExpenseCategory[];
  clients: Client[];
  clientOperations: ClientOperation[];
  profitDeductions: ProfitDeduction[];
  
  login: (passcode: string) => boolean;
  logout: () => void;
  setStoreId: (id: string) => void;
  updateSettings: (settings: Partial<AppState['settings']>) => void;
  updatePasscodes: (passcodes: Partial<AppState['passcodes']>) => void;
  
  addStore: (name: string) => void;
  updateStore: (id: string, name: string) => void;
  deleteStore: (id: string) => void;
  
  addTransaction: (tx: Omit<Transaction, 'id'>) => string;
  updateTransaction: (id: string, tx: Partial<Omit<Transaction, 'id'>>) => void;
  deleteTransaction: (id: string) => void;
  
  addIncomeRecord: (record: Omit<IncomeRecord, 'id'>) => string;
  updateIncomeRecord: (id: string, record: Partial<Omit<IncomeRecord, 'id'>>) => void;
  deleteIncomeRecord: (id: string) => void;
  addExpenseCategory: (category: Omit<ExpenseCategory, 'id'>) => string;
  
  addClient: (client: Omit<Client, 'id'>) => void;
  updateClient: (id: string, updates: Partial<Omit<Client, 'id'>> | string) => void;
  deleteClient: (id: string) => void;
  addClientOperation: (op: Omit<ClientOperation, 'id'>) => void;
  updateClientOperation: (id: string, op: Partial<Omit<ClientOperation, 'id'>>) => void;
  deleteClientOperation: (id: string) => void;
  
  addProfitDeduction: (deduction: Omit<ProfitDeduction, 'id'>) => void;
  updateProfitDeduction: (id: string, deduction: Partial<Omit<ProfitDeduction, 'id'>>) => void;
  deleteProfitDeduction: (id: string) => void;
  importBackupData: (data: Partial<AppState>) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      passcodes: { admin: '1234', supervisor: '2222', restricted: '3333' },
      auth: { isLoggedIn: false, role: null, currentStoreId: null },
      settings: { darkMode: false, fontSize: 'medium' },
      stores: [{ id: '1', name: 'المحل الرئيسي' }],
      transactions: [],
      incomeRecords: [],
      expenseCategories: [],
      clients: [],
      clientOperations: [],
      profitDeductions: [],

      login: (passcode) => {
        const { passcodes, stores } = get();
        let role: Role | null = null;
        if (passcode === passcodes.admin) role = 'ADMIN';
        else if (passcode === passcodes.supervisor) role = 'SUPERVISOR';
        else if (passcode === passcodes.restricted) role = 'RESTRICTED';

        if (role) {
          set({ 
            auth: { 
              isLoggedIn: true, 
              role, 
              currentStoreId: stores.length > 0 ? stores[0].id : null 
            } 
          });
          return true;
        }
        return false;
      },
      logout: () => set({ auth: { isLoggedIn: false, role: null, currentStoreId: null } }),
      setStoreId: (id) => set((state) => ({ auth: { ...state.auth, currentStoreId: id } })),
      
      updateSettings: (newSettings) => set((state) => ({ settings: { ...state.settings, ...newSettings } })),
      updatePasscodes: (newPasscodes) => set((state) => ({ passcodes: { ...state.passcodes, ...newPasscodes } })),

      addStore: (name) => set((state) => ({
        stores: [...state.stores, { id: crypto.randomUUID(), name }]
      })),
      updateStore: (id, name) => set((state) => ({
        stores: state.stores.map(s => s.id === id ? { ...s, name } : s)
      })),
      deleteStore: (id) => set((state) => ({
        stores: state.stores.filter(s => s.id !== id),
        auth: state.auth.currentStoreId === id 
          ? { ...state.auth, currentStoreId: state.stores.find(s => s.id !== id)?.id || null }
          : state.auth
      })),

      addTransaction: (tx) => {
        const id = crypto.randomUUID();
        set((state) => ({
          transactions: [{ ...tx, id }, ...state.transactions]
        }));
        return id;
      },
      updateTransaction: (id, tx) => set((state) => ({
        transactions: state.transactions.map(t => t.id === id ? { ...t, ...tx } : t)
      })),
      deleteTransaction: (id) => set((state) => ({
        transactions: state.transactions.filter(t => t.id !== id)
      })),

      addIncomeRecord: (record) => {
        const id = crypto.randomUUID();
        set((state) => ({
          incomeRecords: [{ ...record, id }, ...state.incomeRecords]
        }));
        return id;
      },
      updateIncomeRecord: (id, record) => set((state) => {
        const oldIncomeRecord = state.incomeRecords.find(r => r.id === id);
        const updatedIncomeRecords = state.incomeRecords.map(r => r.id === id ? { ...r, ...record } : r);
        const targetRecord = updatedIncomeRecords.find(r => r.id === id);

        if (!targetRecord) return { incomeRecords: updatedIncomeRecords };

        const newDate = record.date !== undefined ? record.date : targetRecord.date;
        const newAmount = record.amount !== undefined ? record.amount : targetRecord.amount;
        const newNotes = record.notes !== undefined ? record.notes : targetRecord.notes;

        const linkedTxIndex = state.transactions.findIndex(t => t.incomeRecordId === id || t.id === id);

        let updatedTransactions = [...state.transactions];

        if (linkedTxIndex !== -1) {
          const linkedTx = updatedTransactions[linkedTxIndex];
          updatedTransactions[linkedTxIndex] = {
            ...linkedTx,
            amount: newAmount,
            notes: newNotes,
            date: newDate,
            incomeRecordId: id
          };

          // Remove any duplicate linked transactions
          updatedTransactions = updatedTransactions.filter((t, idx) => {
            if (idx === linkedTxIndex) return true;
            if (t.incomeRecordId === id || t.id === id) return false;
            return true;
          });

          // Remove orphan unlinked income transactions in the same store that matched old date/amount
          if (oldIncomeRecord) {
            const oldDay = oldIncomeRecord.date ? oldIncomeRecord.date.split('T')[0] : null;
            let cleanedOrphan = false;
            updatedTransactions = updatedTransactions.filter(t => {
              if (!cleanedOrphan && t.type === 'INCOME' && !t.incomeRecordId && t.storeId === oldIncomeRecord.storeId) {
                const tDay = t.date ? t.date.split('T')[0] : null;
                if (tDay === oldDay || t.amount === oldIncomeRecord.amount) {
                  cleanedOrphan = true;
                  return false;
                }
              }
              return true;
            });
          }
        } else {
          // No linked transaction yet: try to find an unlinked INCOME transaction to update
          const oldDay = oldIncomeRecord?.date ? oldIncomeRecord.date.split('T')[0] : null;
          let unlinkedIdx = state.transactions.findIndex(t => {
            if (t.type === 'INCOME' && !t.incomeRecordId && t.storeId === targetRecord.storeId) {
              const tDay = t.date ? t.date.split('T')[0] : null;
              return tDay === oldDay || t.amount === oldIncomeRecord?.amount;
            }
            return false;
          });

          if (unlinkedIdx === -1) {
            unlinkedIdx = state.transactions.findIndex(t => t.type === 'INCOME' && !t.incomeRecordId && t.storeId === targetRecord.storeId);
          }

          if (unlinkedIdx !== -1) {
            updatedTransactions[unlinkedIdx] = {
              ...updatedTransactions[unlinkedIdx],
              amount: newAmount,
              notes: newNotes,
              date: newDate,
              incomeRecordId: id
            };
          } else {
            updatedTransactions.unshift({
              id: crypto.randomUUID(),
              storeId: targetRecord.storeId,
              title: 'إيراد يومية',
              amount: newAmount,
              type: 'INCOME',
              categoryId: 'direct',
              notes: newNotes,
              date: newDate,
              incomeRecordId: id
            });
          }
        }

        return {
          incomeRecords: updatedIncomeRecords,
          transactions: updatedTransactions,
        };
      }),
      deleteIncomeRecord: (id) => set((state) => {
        const targetRecord = state.incomeRecords.find(r => r.id === id);
        const targetDay = targetRecord?.date ? targetRecord.date.split('T')[0] : null;

        return {
          incomeRecords: state.incomeRecords.filter(r => r.id !== id),
          transactions: state.transactions.filter(t => {
            if (t.incomeRecordId === id || t.id === id) return false;
            if (targetRecord && t.type === 'INCOME' && !t.incomeRecordId && t.storeId === targetRecord.storeId) {
              const tDay = t.date ? t.date.split('T')[0] : null;
              if (tDay === targetDay || t.amount === targetRecord.amount) return false;
            }
            return true;
          })
        };
      }),
      addExpenseCategory: (category) => {
        const id = crypto.randomUUID();
        set((state) => ({
          expenseCategories: [{ ...category, id }, ...state.expenseCategories]
        }));
        return id;
      },

      addClient: (client) => set((state) => ({
        clients: [{ ...client, id: crypto.randomUUID() }, ...state.clients]
      })),
      updateClient: (id, updates) => set((state) => ({
        clients: state.clients.map(c => {
          if (c.id === id) {
            if (typeof updates === 'string') {
              return { ...c, name: updates };
            }
            return { ...c, ...updates };
          }
          return c;
        })
      })),
      deleteClient: (id) => set((state) => ({
        clients: state.clients.filter(c => c.id !== id),
        clientOperations: state.clientOperations.filter(op => op.clientId !== id)
      })),
      addClientOperation: (op) => set((state) => ({
        clientOperations: [{ ...op, id: crypto.randomUUID() }, ...state.clientOperations]
      })),
      updateClientOperation: (id, op) => set((state) => ({
        clientOperations: state.clientOperations.map(o => o.id === id ? { ...o, ...op } : o)
      })),
      deleteClientOperation: (id) => set((state) => ({
        clientOperations: state.clientOperations.filter(o => o.id !== id)
      })),

      addProfitDeduction: (deduction) => set((state) => ({
        profitDeductions: [{ ...deduction, id: crypto.randomUUID() }, ...state.profitDeductions]
      })),
      updateProfitDeduction: (id, deduction) => set((state) => ({
        profitDeductions: state.profitDeductions.map(d => d.id === id ? { ...d, ...deduction } : d)
      })),
      deleteProfitDeduction: (id) => set((state) => ({
        profitDeductions: state.profitDeductions.filter(d => d.id !== id)
      })),
      importBackupData: (data) => set((state) => ({
        passcodes: data.passcodes || state.passcodes,
        stores: data.stores || state.stores,
        transactions: data.transactions || state.transactions,
        incomeRecords: data.incomeRecords || state.incomeRecords,
        expenseCategories: data.expenseCategories || state.expenseCategories,
        clients: data.clients || state.clients,
        clientOperations: data.clientOperations || state.clientOperations,
        profitDeductions: data.profitDeductions || state.profitDeductions,
        auth: {
          ...state.auth,
          currentStoreId: data.stores && data.stores.length > 0 ? data.stores[0].id : state.auth.currentStoreId
        }
      })),
    }),
    {
      name: 'simpleledger-storage',
    }
  )
);
