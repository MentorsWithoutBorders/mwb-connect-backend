import type CenterExpenses from "../models/center_expenses.model";
import { Helpers } from '../utils/helpers';
import { Request, Response } from 'express';
import dbClient from "../db/client";
import { QueryResult } from "pg";

const helpers = new Helpers();

export class Expenses {

    _readExpenseQuery = "SELECT * FROM organizations_centers_expenses WHERE center_id = $1";
    _createExpenseQuery = "INSERT INTO organizations_centers_expenses (center_id, month, year, expense, amount, is_recurring) VALUES ($1, $2, $3, $4, $5, $6)";
    _deleteExpenseQuery = "DELETE FROM organizations_centers_expenses WHERE center_id = $1 AND id = $2";
    _updateExpenseQuery = "UPDATE organizations_centers_expenses SET month = $1, year = $2, expense = $3, amount = $4, is_recurring = $5 WHERE center_id = $6 AND id = $7";
    _totalExpenseQuery = "SELECT SUM(amount) FROM organizations_centers_expenses WHERE center_id = $1";
    _totalExpensePaidQuery = "SELECT SUM(amount) FROM organizations_centers_expenses_paid WHERE center_id = $1";

    constructor() {
        helpers.autoBind(this);
    }

    async _getCenterExpenseQuery(centerId: string): Promise<QueryResult<CenterExpenses>> {
        const query = this._readExpenseQuery;
        return await dbClient.query<CenterExpenses>(query, [centerId]);
    }

    _mergeExpense(targetExpense: CenterExpenses, sourceExpense: CenterExpenses){
        return {
                month: sourceExpense.month || targetExpense.month,
                year: sourceExpense.year || targetExpense.year,
                expense: sourceExpense.expense || targetExpense.expense,
                amount: sourceExpense.amount || targetExpense.amount,
                is_recurring: sourceExpense.is_recurring === undefined ? targetExpense.is_recurring : sourceExpense.is_recurring,
        } as CenterExpenses
    }

    async getCenterExpenses(request: Request, response: Response): Promise<void> {
        const centerId = request.params.center_id;

        try {
            const result = await this._getCenterExpenseQuery(centerId);

            if(result && result.rowCount === 0) {
                response.status(404).send("No expenses found");
            }

            response.status(200).json(result?.rows);
        } catch (error) {
            response.status(400).send(error);
        }
    }

    async createCenterExpenses(request: Request, response: Response): Promise<void> {
        const {center_id} = request.params;
        const { month, year, expense, amount,is_recurring } = request.body as CenterExpenses;
        try {
            await dbClient.query(this._createExpenseQuery, [center_id, month, year, expense, amount,is_recurring]);
            response.status(201).send("Expense is created.");
        } catch (error) {
            response.status(400).send(error);
        }
    }

    async deleteCenterExpenses(request: Request, response: Response): Promise<void> {
        const {center_id, expense_id} = request.params;
        try {
            await dbClient.query(this._deleteExpenseQuery, [center_id, expense_id]);
            response.status(200).send("Expense is deleted.");
        } catch (error) {
            response.status(400).send(error);
        }
    }

    async updateCenterExpenses(request: Request, response: Response): Promise<void> {
        // Todo: Add validation
        const {center_id, expense_id} = request.params;

        const expenseResult = await this._getCenterExpenseQuery(center_id);

        if(expenseResult.rowCount === 0) {
            response.status(404).send("No expenses found");
            return;
        }

        const { month, year, expense, amount, is_recurring } = this._mergeExpense(expenseResult.rows[0], request.body as CenterExpenses)

        try {
            await dbClient.query(this._updateExpenseQuery, [month, year, expense, amount,is_recurring, center_id, expense_id]);
            response.status(200).send("Expense is updated.");
        } catch (error) {
            response.status(400).send(error);
        }
    }

    async getCenterExpenseBalance(request: Request, response: Response): Promise<void> {
        const {center_id} = request.params;
        try{
            dbClient.withClient(async (client) => {
                try {
                    const totalExpense = await client.query(this._totalExpenseQuery, [center_id]);
                    const totalExpensePaid = await client.query(this._totalExpensePaidQuery, [center_id]);

                    if(totalExpense.rowCount === 0 || totalExpensePaid.rowCount === 0) {
                        response.status(404).send("No expenses found");
                        return;
                    }

                    const totalExpenseSum = totalExpense.rows[0].sum;
                    const totalExpensePaidSum = totalExpensePaid.rows[0].sum;
                    const balance = totalExpenseSum - totalExpensePaidSum;
                    response.status(200).json({totalExpense: totalExpenseSum, totalExpensePaid: totalExpensePaidSum, balance});
                } catch (error) {
                    response.status(400).send(error);
                }
            })
        } catch(error){
            response.status(400).send(error);
        }
    }
}