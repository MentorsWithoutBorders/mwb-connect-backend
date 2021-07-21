import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import moment from 'moment';
import pg from 'pg';
import { Conn } from '../db/conn';
import Goal from '../models/goal.model';
import { constants } from '../utils/constants';

const conn: Conn = new Conn();
const pool = conn.pool;

export class UsersGoals {
  constructor() {
    autoBind(this);
  }

  async getGoals(request: Request, response: Response): Promise<void> {
    const userId: string = request.user.id as string;
    const client: pg.PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(constants.READ_ONLY_TRANSACTION);
      const goals: Array<Goal> = await this.getGoalsFromDB(userId, client);
      response.status(200).json(goals);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async getGoalsFromDB(userId: string, client: pg.PoolClient): Promise<Array<Goal>> {
    const getGoalsQuery = `SELECT id, text, index FROM users_goals 
      WHERE user_id = $1
      ORDER BY index ASC`;
    const { rows }: pg.QueryResult = await client.query(getGoalsQuery, [userId]);
    const goals: Array<Goal> = [];
    for (const row of rows) {
      const goal: Goal = {
        id: row.id,
        text: row.text,
        index: row.index
      };
      goals.push(goal);
    }
    return goals;
  }

  async getGoalById(request: Request, response: Response): Promise<void> {
    const userId: string = request.user.id as string;
    const goalId: string = request.params.id;
    try {
      const getGoalQuery = 'SELECT id, text FROM users_goals WHERE user_id = $1 AND id = $2';
      const { rows }: pg.QueryResult = await pool.query(getGoalQuery, [userId, goalId]);
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
    const userId: string = request.user.id as string;
    const { text }: Goal = request.body;
    const client: pg.PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      const goal: Goal = await this.addGoalToDB(userId, text, client);
      response.status(200).send(goal);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async addGoalToDB(userId: string, text: string, client: pg.PoolClient): Promise<Goal> {
    const goals: Array<Goal> = await this.getGoalsFromDB(userId, client);
    const insertGoalQuery = `INSERT INTO users_goals (user_id, text, index, date_time)
      VALUES ($1, $2, $3, $4) RETURNING *`;
    const dateTime = moment.utc();
    let index = 0;
    if (goals.length > 0) {
      index = goals[goals.length-1].index as number + 1;
    }
    const values = [userId, text, index, dateTime];        
    const { rows }: pg.QueryResult = await client.query(insertGoalQuery, values);
    return {
      id: rows[0].id,
      text: rows[0].text
    }   
  }

  async updateGoal(request: Request, response: Response): Promise<void> {
    const userId: string = request.user.id as string;
    const goalId: string = request.params.id;
    const { text }: Goal = request.body
    const dateTime = moment.utc();
    try {
      const updateGoalQuery = 'UPDATE users_goals SET text = $1, date_time = $2 WHERE user_id = $3 AND id = $4';
      await pool.query(updateGoalQuery, [text, dateTime, userId, goalId]);
      response.status(200).send(`Goal modified with ID: ${goalId}`);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async deleteGoal(request: Request, response: Response): Promise<void> {
    const userId: string = request.user.id as string;
    const goalId: string = request.params.id;
    const client: pg.PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      const deleteGoalQuery = 'DELETE FROM users_goals WHERE user_id = $1 AND id = $2';
      await this.deleteSteps(userId, goalId, client);
      await client.query(deleteGoalQuery, [userId, goalId]);
      response.status(200).send(`Goal deleted with ID: ${goalId}`);
      await client.query('COMMIT');
    } catch (error) {
      console.log(error);
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async deleteSteps(userId: string, goalId: string, client: pg.PoolClient): Promise<void> {
    const deleteStepsQuery = 'DELETE FROM users_steps WHERE user_id = $1 AND goal_id = $2';
    await client.query(deleteStepsQuery, [userId, goalId]);
  }  
}
