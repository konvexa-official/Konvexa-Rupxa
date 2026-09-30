import { Expense, ExpenseCategory, BudgetStatus } from '../types';
import { parseMoney } from './formatters';

export const BUDGET_CATEGORIES: ExpenseCategory[] = [
  'Food',
  'Travel',
  'Shopping',
  'Bills',
  'Entertainment',
  'Health',
  'Education',
  'Other',
];

export interface ComputedBudgetSummary {
  statuses: BudgetStatus[];
  totalBudget: number;
  totalSpent: number;
  hasExceeded: boolean;
  exceededCategories: BudgetStatus[];
  nearLimitCategories: BudgetStatus[];
  categoriesWithBudgetCount: number;
}

/**
 * Calculates current month's spending vs budget limit for every category.
 */
export function computeMonthlyBudgetStatuses(
  expenses: Expense[],
  budgets: Record<string, number>,
  targetYearMonth?: string
): ComputedBudgetSummary {
  // If targetYearMonth not provided, use current local year-month (YYYY-MM)
  const now = new Date();
  const yearMonth =
    targetYearMonth ||
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Filter expenses strictly belonging to the given month
  const currentMonthExpenses = expenses.filter((e) => {
    if (!e.expense_date) return false;
    return e.expense_date.substring(0, 7) === yearMonth;
  });

  // Aggregate spending per category for this month
  const spentByCategory: Record<string, number> = {};
  currentMonthExpenses.forEach((e) => {
    spentByCategory[e.category] = (spentByCategory[e.category] || 0) + parseMoney(e.amount);
  });

  let totalBudget = 0;
  let totalSpent = 0;
  const statuses: BudgetStatus[] = [];
  const exceededCategories: BudgetStatus[] = [];
  const nearLimitCategories: BudgetStatus[] = [];
  let categoriesWithBudgetCount = 0;

  BUDGET_CATEGORIES.forEach((category) => {
    const limit = parseMoney(budgets[category] || 0);
    const spent = parseMoney(spentByCategory[category] || 0);

    if (limit > 0) {
      totalBudget += limit;
      categoriesWithBudgetCount += 1;
    }
    totalSpent += spent;

    const isExceeded = limit > 0 && spent > limit;
    const isNearLimit = limit > 0 && spent >= limit * 0.8 && !isExceeded;
    const remaining = Math.max(0, limit - spent);
    const exceededBy = isExceeded ? spent - limit : 0;
    const percentage = limit > 0 ? Math.round((spent / limit) * 100) : 0;

    const status: BudgetStatus = {
      category,
      limit_amount: limit,
      spent_amount: spent,
      remaining_amount: remaining,
      percentage,
      is_exceeded: isExceeded,
      exceeded_by: exceededBy,
      is_near_limit: isNearLimit,
    };

    statuses.push(status);

    if (isExceeded) {
      exceededCategories.push(status);
    } else if (isNearLimit) {
      nearLimitCategories.push(status);
    }
  });

  return {
    statuses,
    totalBudget,
    totalSpent,
    hasExceeded: exceededCategories.length > 0,
    exceededCategories,
    nearLimitCategories,
    categoriesWithBudgetCount,
  };
}
