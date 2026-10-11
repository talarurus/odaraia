// SPDX-License-Identifier: MPL-2.0
export type AccountType = 'checking' | 'savings' | 'credit' | 'asset' | 'liability';
export type Status = 'posted' | 'pending' | 'removed';
export type Classification = 'income' | 'expense' | 'unclassified' | 'transfer' | 'adjustment';
export interface Account { id: string; name: string; type: AccountType; currency: 'USD'; anchor: string; opening: string; revision: number }
export interface Transaction { id: string; account: string; date: string; amount: string; payee: string; category: string; classification: Classification; status: Status; note: string; transferId: string | null; sourceKey: string; sourceId: string | null; revision: number; provenance: unknown }
export interface Budget {month: string; category: string; planned: string}
export interface FinancialState {accounts: Account[]; transactions: Transaction[]; budgets: Budget[]}
// Full trusted storage + application contract; transport consumers use ApplicationService.
export type FinanceRepository = import('../services/ledger.ts').Ledger;
