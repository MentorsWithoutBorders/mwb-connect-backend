export default interface CenterExpenses{
    id: string;
    expense: string;
    amount: number;
    month: number;
    year: number;
    is_recurring: boolean;
    center_id?: string;
}