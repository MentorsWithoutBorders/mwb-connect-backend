import { Helpers } from '../utils/helpers';
import { Request, Response } from 'express';
import dbClient from "../db/client";
import CenterExpensePaid from "../models/center_expense_paid.model";

const helpers = new Helpers();

export class ExpensesPaid {

    private centerExpensesPaidQuery = "SELECT * FROM organizations_centers_expenses_paid WHERE center_id = $1 AND month = $2 AND year = $3";
    private updateExpensePaidQuery = "UPDATE organizations_centers_expenses_paid SET amount = $1 WHERE center_id = $2 AND month = $3 AND year = $4";
    private createExpensePaidQuery = "INSERT INTO organizations_centers_expenses_paid (center_id, month, year, amount) VALUES ($1, $2, $3, $4)";

    constructor() {
        helpers.autoBind(this);
    }

    async getCenterExpensePaid(request: Request, response: Response): Promise<void>{
        const {center_id} = request.params;
        const {month, year} = request.query
        try {
            const result = await dbClient.query<CenterExpensePaid>(this.centerExpensesPaidQuery, [center_id, month, year]);

            if(result.rowCount === 0) {
                response.status(404).send("No expense paid yet");
                return;
            }

            response.status(200).json(result.rows[0]);
        } catch (error) {
            response.status(400).send(error);
        }
    }

    async updateCenterExpensePaid(request: Request, response: Response): Promise<void> {
        const {center_id} = request.params;
        const { month, year, amount } = request.body;
        try {
            await dbClient.withClient(async (client) => {
                const result = await client.query<CenterExpensePaid>(this.centerExpensesPaidQuery, [center_id, month, year]);
                if(result.rowCount === 0) {
                    await client.query(this.createExpensePaidQuery, [center_id, month, year, amount]);
                } else{
                    await client.query(this.updateExpensePaidQuery, [amount, center_id, month, year]);
                }
            })
            response.status(200).send("Expense paid is saved.");
        } catch (error) {
            response.status(400).send(error);
        }
    }
}