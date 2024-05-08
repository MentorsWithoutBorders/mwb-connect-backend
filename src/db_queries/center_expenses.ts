import type CenterExpense from '../models/center_expense.model';
import { Helpers } from '../utils/helpers';
import { Request, Response } from 'express';
import { Conn } from '../db/conn';
import * as yup from 'yup';
import moment from 'moment';
import { QueryResultRow } from 'pg';

type QueryArgs = [string, (string | number | boolean)[]];

const conn = new Conn();
const dbClient = conn.db;
const helpers = new Helpers();

export class CenterExpenses {
  private getExpensesQuery({
    centerId,
    month,
    year,
    isRecurring,
    expenseId
  }: {
    centerId: string;
    month?: number;
    year?: number;
    isRecurring?: boolean;
    expenseId?: string;
  }): QueryArgs {
    let paramCounter = 1;
    let query = `SELECT * FROM organizations_centers_expenses WHERE center_id = $${paramCounter}`;
    const values: Array<string | number | boolean> = [centerId];

    if (Number.isInteger(month)) {
      paramCounter += 1;
      query += ` and month=$${paramCounter}`;
      values.push(month as number);
    }

    if (Number.isInteger(year)) {
      paramCounter += 1;
      query += ` and year=$${paramCounter}`;
      values.push(year as number);
    }

    if (isRecurring !== undefined) {
      paramCounter += 1;
      query += ` and is_recurring=$${paramCounter}`;
      values.push(isRecurring);
    }

    if (expenseId) {
      paramCounter += 1;
      query += ` and id=$${paramCounter}`;
      values.push(expenseId);
    }

    return [query, values];
  }

  private getRecurringExpenseQuery({
    centerId,
    month,
    year
  }: {
    centerId: string;
    month: number;
    year: number;
  }): QueryArgs {
    return [
      'SELECT * FROM organizations_centers_expenses WHERE center_id = $1 AND is_recurring = true AND month <= $2 AND year <= $3',
      [centerId, month, year]
    ];
  }

  private createExpenseQuery = ({
    centerId,
    month,
    year,
    expense,
    amount,
    isRecurring
  }: Omit<CenterExpense, 'id'>): QueryArgs => {
    return [
      'INSERT INTO organizations_centers_expenses (center_id, month, year, expense, amount, is_recurring) VALUES ($1, $2, $3, $4, $5, $6)',
      [centerId, month, year, expense, amount, isRecurring]
    ];
  };

  private deleteExpenseQuery = ({
    centerId,
    id
  }: {
    centerId: string;
    id: string;
  }): QueryArgs => [
    'DELETE FROM organizations_centers_expenses WHERE center_id = $1 AND id = $2',
    [centerId, id]
  ];

  private updateExpenseQuery = ({
    centerId,
    month,
    year,
    expense,
    amount,
    isRecurring,
    id
  }: CenterExpense): QueryArgs => [
    'UPDATE organizations_centers_expenses SET month = $1, year = $2, expense = $3, amount = $4, is_recurring = $5 WHERE center_id = $6 AND id = $7',
    [month, year, expense, amount, isRecurring, centerId, id]
  ];

  private getTotalExpensesQuery = ({
    centerId
  }: {
    centerId: string;
  }): QueryArgs => [
    'SELECT SUM(amount) FROM organizations_centers_expenses WHERE center_id = $1',
    [centerId]
  ];

  private getTotalExpensesPaidQuery = ({
    centerId
  }: {
    centerId: string;
  }): QueryArgs => [
    'SELECT SUM(amount) FROM organizations_centers_expenses_paid WHERE center_id = $1',
    [centerId]
  ];

  constructor() {
    helpers.autoBind(this);
  }

  private async getCenterExpensesQuery(
    centerId: string,
    month: number,
    year: number
  ): Promise<CenterExpense[]> {
    let expenses: QueryResultRow[];
    let [query, values] = this.getExpensesQuery({
      centerId,
      month,
      year
    });

    const expensesForMonth = await dbClient.query(query, values);
    expenses = expensesForMonth.rows;

    if (expensesForMonth.rows.length === 0) {
      [query, values] = this.getRecurringExpenseQuery({
        centerId,
        month,
        year
      });
      const recurringExpenses = await dbClient.query(query, values);
      expenses = recurringExpenses.rows;
    }

    return expenses.map((row) => ({
      id: row.id,
      expense: row.expense,
      amount: row.amount,
      month: row.month,
      year: row.year,
      isRecurring: row.is_recurring,
      centerId: row.center_id
    }));
  }

  private mergeExpenses(
    targetExpense: CenterExpense,
    sourceExpense: CenterExpense
  ) {
    return {
      month: sourceExpense.month || targetExpense.month,
      year: sourceExpense.year || targetExpense.year,
      expense: sourceExpense.expense || targetExpense.expense,
      amount: sourceExpense.amount || targetExpense.amount,
      isRecurring:
        sourceExpense.isRecurring === undefined
          ? targetExpense.isRecurring
          : sourceExpense.isRecurring
    } as CenterExpense;
  }

  async getCenterExpenses(request: Request, response: Response): Promise<void> {
    const centerId = request.params.center_id;

    try {
      const result = await this.getCenterExpensesQuery(
        centerId,
        parseInt(request.query.month as string),
        parseInt(request.query.year as string)
      );
      response.status(200).json(result);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async createCenterExpense(
    request: Request,
    response: Response
  ): Promise<void> {
    const { center_id } = request.params;
    const { month, year, expense, amount, isRecurring } =
      request.body as CenterExpense;
    try {
      const [query, values] = this.createExpenseQuery({
        centerId: center_id,
        month,
        year,
        expense,
        amount,
        isRecurring
      });

      await dbClient.query(query, values);
      response.status(201).send('Expense is created.');
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async deleteCenterExpense(
    request: Request,
    response: Response
  ): Promise<void> {
    const { center_id, expense_id } = request.params;
    try {
      const [query, values] = this.deleteExpenseQuery({
        centerId: center_id,
        id: expense_id
      });
      await dbClient.query(query, values);
      response.status(200).send('Expense is deleted.');
    } catch (error) {
      response.status(400).send(error);
    }
  }

  updateCenterExpensesValidationSchema = {
    paramSchema: yup.object({
      center_id: yup.string().required(),
      expense_id: yup.string().required()
    }),
    bodySchema: yup.object({
      expense: yup.string(),
      amount: yup.number(),
      month: yup.number().min(0).max(11),
      year: yup.number().min(999).max(9999),
      isRecurring: yup.boolean()
    })
  };

  async updateCenterExpense(
    request: Request,
    response: Response
  ): Promise<void> {
    const { center_id, expense_id } = request.params;

    try {
      let [query, values] = this.getExpensesQuery({
        centerId: center_id,
        expenseId: expense_id
      });

      const expenseResult = await dbClient.query(query, values);

      if (expenseResult.rows.length === 0) {
        response.status(404).send('No expenses found');
        return;
      }

      const existingExpense = expenseResult.rows[0] as CenterExpense;

      const { month, year, expense, amount, isRecurring } = this.mergeExpenses(
        existingExpense,
        request.body as CenterExpense
      );

      [query, values] = this.updateExpenseQuery({
        centerId: center_id,
        month,
        year,
        expense,
        amount,
        isRecurring,
        id: expense_id
      });
      await dbClient.query(query, values);
      response.status(200).send('Expense is updated.');
    } catch (error) {
      response.status(400).send(error);
    }
  }

  createCenterExpensesValidationSchema = {
    paramsSchema: yup.object({ center_id: yup.string().required() }),
    bodySchema: yup.object({
      expense: yup.string().required(),
      amount: yup.number().required(),
      month: yup.number().min(0).max(11).required(),
      year: yup.number().min(999).max(9999).required(),
      isRecurring: yup.boolean().required()
    })
  };

  calculateMonths({
    fromMonth,
    fromYear,
    toMonth,
    toYear
  }: {
    fromMonth: number;
    fromYear: number;
    toMonth: number;
    toYear: number;
  }): number {
    const fromDate = moment({ year: fromYear, month: fromMonth });
    const toDate = moment({ year: toYear, month: toMonth });

    return toDate.diff(fromDate, 'months');
  }

  async getCenterExpensesBalance(
    request: Request,
    response: Response
  ): Promise<void> {
    const { center_id } = request.params;
    try {
      dbClient.withClient(async (client) => {
        const [query, values] = this.getTotalExpensesQuery({
          centerId: center_id
        });
        const totalExpenses = await client.query(query, values);

        const [expensesPaidQuery, expensesPaidValues] =
          this.getTotalExpensesPaidQuery({
            centerId: center_id
          });

        const totalExpensesPaid = await client.query(
          expensesPaidQuery,
          expensesPaidValues
        );

        const totalExpensesPaidSum = totalExpensesPaid.rows[0].sum || 0;

        const balance = totalExpensesPaidSum - totalExpenses.rows[0].sum;

        response.status(200).json({
          totalExpenses: totalExpenses,
          totalExpensesPaid: totalExpensesPaidSum,
          balance
        });
      });
    } catch (error) {
      response.status(400).send(error);
    }
  }
}
