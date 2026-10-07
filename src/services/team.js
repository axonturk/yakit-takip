import { roundMoney } from './storage';

export const ROLE_LABEL = { owner: 'Kurucu', member: 'Yönetici', driver: 'Şoför' };

const monthOf = (date) => String(date || '').slice(0, 7);
const thisMonth = (now) => {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// Fuel purchases a person entered in the current month.
export function memberMonthSpend(transactions, userId, now = Date.now()) {
  const ym = thisMonth(now);
  return roundMoney(
    transactions
      .filter((t) => t.type === 'expense' && !t.kind && t.enteredById === userId && monthOf(t.date) === ym)
      .reduce((sum, t) => sum + Number(t.amount || 0), 0)
  );
}

// What a role may do in the app. Without a shared ledger everyone is the owner of their own data.
export function permissions(role, userId) {
  const driver = role === 'driver';
  return {
    driver,
    manage: !driver,
    changeTx: (tx) => !driver || (tx.type === 'expense' && !tx.kind && Boolean(userId) && tx.enteredById === userId)
  };
}
