import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import moment from 'moment'
import pg from 'pg';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import Goal from '../models/goal.model';

const conn: Conn = new Conn();
const pool = conn.pool;

export class Goals {
  constructor() {
    autoBind(this);
  }

  async getGoals(request: Request, response: Response): Promise<void> {
    const userId: string = request.params.user_id;
    try {
      const goals: Array<Goal> = await this.getGoalsFromDB(userId);
      response.status(200).json(goals);
    } catch (error) {
      response.status(400).send(error);
    }   
  }

  async getGoalsFromDB(userId: string): Promise<Array<Goal>> {
    const getGoalsQuery = `SELECT * FROM users_goals 
      WHERE user_id = $1
      ORDER BY index ASC`;
    const { rows }: pg.QueryResult = await pool.query(getGoalsQuery, [userId]);
    const goals: Array<Goal> = [];
    for (const row of rows) {
      const goal: Goal = {
        id: row.id,
        text: row.text,
      };
      goals.push(goal);
    }
    return goals;
  }

  async getGoalById(request: Request, response: Response): Promise<void> {
    const userId: string = request.params.user_id;
    const id: string = request.params.id;
    try {
      const getGoalQuery = `SELECT * FROM users_goals
        WHERE user_id = $1 AND id = $2`;
      const { rows }: pg.QueryResult = await pool.query(getGoalQuery, [userId, id]);
      const goal: Goal = {
        id: rows[0].id,
        text: rows[0].text
      };
      response.status(200).json(goal);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async addGoal(request: Request, response: Response): Promise<void> {
    const userId: string = request.params.user_id;
    const { text }: Goal = request.body
    try {
      const goals: Array<Goal> = await this.getGoalsFromDB(userId);
      const insertGoalQuery = `INSERT INTO users_goals (user_id, text, index, date_time)
        VALUES ($1, $2, $3, $4) RETURNING *`;
      const dateTime = moment(new Date()).format(constants.DATE_FORMAT);
      const values = [userId, text, goals.length + 1, dateTime];        
      let { rows }: pg.QueryResult = await pool.query(insertGoalQuery, values);
      response.status(200).send(rows[0].id);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async updateGoal(request: Request, response: Response): Promise<void> {
    const id: string = request.params.id;
    const { text }: Goal = request.body
    try {
      const updateQuery = 'UPDATE goals SET text = $1, date_time = $2 WHERE id = $3';
      await pool.query(updateQuery, [text, id]);
      response.status(200).send(`Goal modified with ID: ${id}`);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async deleteGoal(request: Request, response: Response): Promise<void> {
    const id: string = request.params.id;
    try {
      const deleteQuery = 'DELETE FROM users_goals WHERE id = $1';
      await pool.query(deleteQuery, [id]);
      response.status(200).send(`Goal deleted with ID: ${id}`);
    } catch (error) {
      response.status(400).send(error);
    }    
  }
}

