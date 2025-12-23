import { getDaysInMonth, isBefore, startOfDay } from "date-fns";
import { recurringExpenses } from "@/db/schema/recurring";
import { InferSelectModel } from "drizzle-orm";

export type RecurringExpense = InferSelectModel<typeof recurringExpenses>;

export function calculateDailyAllocatedCost(
  date: Date,
  expenses: RecurringExpense[]
): number {
  let totalDailyCost = 0;
  
  // Normalize date to avoid time issues
  const checkDate = startOfDay(date);

  for (const expense of expenses) {
    // Logic: For each ACTIVE recurring expense
    if (!expense.isActive) continue;
    
    const startDate = startOfDay(new Date(expense.startDate));
    
    // If D < start_date → ignore
    if (isBefore(checkDate, startDate)) continue;

    const amount = Number(expense.amount);
    if (isNaN(amount)) continue;

    if (expense.frequency === "MONTHLY") {
      const daysInMonth = getDaysInMonth(checkDate);
      totalDailyCost += amount / daysInMonth;
    } else if (expense.frequency === "YEARLY") {
      totalDailyCost += amount / 365;
    }
  }

  return totalDailyCost;
}

export function calculateRangeAllocatedCost(
  startDate: Date,
  endDate: Date, // Expecting exclusive end date [start, end)
  expenses: RecurringExpense[]
): number {
  let total = 0;
  const current = new Date(startDate);
  // Normalize start
  current.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  // Iterate day by day
  while (current < end) {
    total += calculateDailyAllocatedCost(current, expenses);
    current.setDate(current.getDate() + 1);
  }
  return total;
}
