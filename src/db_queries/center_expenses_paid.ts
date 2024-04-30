import { Helpers } from '../utils/helpers';
import { Request, Response } from 'express';
import { Conn } from '../db/conn';
import CenterExpensePaid from '../models/center_expense_paid.model';
import { ValidationError } from '../utils/errors';
import * as yup from 'yup';

type QueryArgs = [string, (string | number | boolean)[]];

const conn = new Conn();
const dbClient = conn.db;
const helpers = new Helpers();

export class CenterExpensesPaid {
  private getExpensesPaidQuery = ({
    centerId,
    month,
    year
  }: {
    centerId: string;
    month: number;
    year: number;
  }): QueryArgs => [
    'SELECT * FROM organizations_centers_expenses_paid WHERE center_id = $1 AND month = $2 AND year = $3',
    [centerId, month, year]
  ];

  private updateExpensesPaidQuery = ({
    amount,
    centerId,
    month,
    year
  }: {
    amount: number;
    centerId: string;
    month: number;
    year: number;
  }): QueryArgs => [
    'UPDATE organizations_centers_expenses_paid SET amount = $1 WHERE center_id = $2 AND month = $3 AND year = $4',
    [amount, centerId, month, year]
  ];

  private createExpensesPaidQuery = ({
    centerId,
    month,
    year,
    amount
  }: {
    centerId: string;
    month: number;
    year: number;
    amount: number;
  }): QueryArgs => [
    'INSERT INTO organizations_centers_expenses_paid (center_id, month, year, amount) VALUES ($1, $2, $3, $4)',
    [centerId, month, year, amount]
  ];

  constructor() {
    helpers.autoBind(this);
  }

  async getCenterExpensesPaid(
    request: Request,
    response: Response
  ): Promise<void> {
    const { center_id } = request.params;
    const { month, year } = request.query;

    try {
      if (
        typeof month === 'string' &&
        typeof year === 'string' &&
        month &&
        year
      ) {
        // To be replaced with param validation like joi/yup
        const [query, values] = this.getExpensesPaidQuery({
          centerId: center_id,
          month: parseInt(month),
          year: parseInt(year)
        });
        const result = await dbClient.query<CenterExpensePaid>(query, values);
        response.status(200).json(result.rows[0]);
      } else {
        throw new ValidationError('Please provide month and year.');
      }
    } catch (error) {
      response.status(400).send(error);
    }
  }

  updateCenterExpensesPaidSchema = {
    bodySchema: yup.object().shape({
      month: yup.number().required(),
      year: yup.number().required(),
      amount: yup.number().required()
    })
  };

  async updateCenterExpensesPaid(
    request: Request,
    response: Response
  ): Promise<void> {
    const { center_id } = request.params;
    const { month, year, amount } = request.body;
    try {
      await dbClient.withClient(async (client) => {
        const [query, values] = this.getExpensesPaidQuery({
          centerId: center_id,
          month,
          year
        });
        const result = await client.query<CenterExpensePaid>(query, values);
        if (result.rowCount === 0) {
          const [createQuery, createValues] = this.createExpensesPaidQuery({
            centerId: center_id,
            month,
            year,
            amount
          });
          await client.query(createQuery, createValues);
        } else {
          const [updateQuery, updateValues] = this.updateExpensesPaidQuery({
            amount,
            centerId: center_id,
            month,
            year
          });
          await client.query(updateQuery, updateValues);
        }
      });
      response.status(200).send('Expense paid is saved.');
    } catch (error) {
      response.status(400).send(error);
    }
  }
}
