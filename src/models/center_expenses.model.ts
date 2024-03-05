export default interface CenterExpense {
  id: string;
  expense: string;
  amount: number;
  month: number;
  year: number;
  isRecurring: boolean;
  centerId: string;
}
