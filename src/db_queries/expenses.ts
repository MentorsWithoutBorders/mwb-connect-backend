import type CenterExpense from '../models/center_expenses.model';
import { Helpers } from '../utils/helpers';
import { Request, Response } from 'express';
import { dbClient } from '../db/conn';
import { QueryResult } from 'pg';

type QueryArgs = [string, (string | number | boolean)[]];

const helpers = new Helpers();

export class Expenses {
  private getReadExpensesQuery({ centerId }: { centerId: string }): QueryArgs {
    return [
      `SELECT * FROM organizations_centers_expenses WHERE center_id = $1`,
      [centerId]
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

  private updateExpensesQuery = ({
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

  private totalExpenseQuery = ({
    centerId
  }: {
    centerId: string;
  }): QueryArgs => [
    'SELECT SUM(amount) FROM organizations_centers_expenses WHERE center_id = $1',
    [centerId]
  ];

  private totalExpensePaidQuery = ({
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
    centerId: string
  ): Promise<QueryResult<CenterExpense>> {
    const [query, values] = this.getReadExpensesQuery({ centerId });
    return await dbClient.query<CenterExpense>(query, values);
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
      const result = await this.getCenterExpensesQuery(centerId);
      response.status(200).json(result?.rows);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async createCenterExpenses(
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

  async deleteCenterExpenses(
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

  async updateCenterExpenses(
    request: Request,
    response: Response
  ): Promise<void> {
    // Todo: Add validation
    const { center_id, expense_id } = request.params;

    const expenseResult = await this.getCenterExpensesQuery(center_id);

    if (expenseResult.rowCount === 0) {
      response.status(404).send('No expenses found');
      return;
    }

    const { month, year, expense, amount, isRecurring } = this.mergeExpenses(
      expenseResult.rows[0],
      request.body as CenterExpense
    );

    try {
      const [query, values] = this.updateExpensesQuery({
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

  async getCenterExpensesBalance(
    request: Request,
    response: Response
  ): Promise<void> {
    const { center_id } = request.params;
    try {
      dbClient.withClient(async (client) => {
        try {
          const [query, values] = this.totalExpenseQuery({
            centerId: center_id
          });
          const totalExpense = await client.query(query, values);

          const [expensePaidQuery, expensePaidValues] =
            this.totalExpensePaidQuery({
              centerId: center_id
            });

          const totalExpensePaid = await client.query(
            expensePaidQuery,
            expensePaidValues
          );

          if (totalExpense.rowCount === 0 || totalExpensePaid.rowCount === 0) {
            response.status(404).send('No expenses found');
            return;
          }

          const totalExpenseSum = totalExpense.rows[0].sum;
          const totalExpensePaidSum = totalExpensePaid.rows[0].sum;
          const balance = totalExpensePaidSum - totalExpenseSum;

          response.status(200).json({
            totalExpense: totalExpenseSum,
            totalExpensePaid: totalExpensePaidSum,
            balance
          });
        } catch (error) {
          response.status(400).send(error);
        }
      });
    } catch (error) {
      response.status(400).send(error);
    }
  }
}
