import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import moment from 'moment';
import pg from 'pg';
import { Conn } from '../db/conn';
import Goal from '../models/goal.model';

const conn: Conn = new Conn();
const pool = conn.pool;

export class UsersGoals {
  constructor() {
    autoBind(this);
  }

  async getGoals(request: Request, response: Response): Promise<void> {
    const userId: string = request.params.id;
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
        index: row.index
      };
      goals.push(goal);
    }
    return goals;
  }

  async getGoalById(request: Request, response: Response): Promise<void> {
    const id: string = request.params.id;
    try {
      const getGoalQuery = `SELECT * FROM users_goals WHERE id = $1`;
      const { rows }: pg.QueryResult = await pool.query(getGoalQuery, [id]);
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
    const userId: string = request.params.id;
    const { text }: Goal = request.body;
    try {
      const goal: Goal = await this.addGoalToDB(userId, text);
      response.status(200).send(goal);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async addGoalToDB(userId: string, text: string): Promise<Goal> {
    const goals: Array<Goal> = await this.getGoalsFromDB(userId);
    const insertGoalQuery = `INSERT INTO users_goals (user_id, text, index, date_time)
      VALUES ($1, $2, $3, $4) RETURNING *`;
    const dateTime = moment.utc();
    let index = 0;
    if (goals.length > 0) {
      index = goals[goals.length-1].index as number + 1;
    }
    const values = [userId, text, index, dateTime];        
    const { rows }: pg.QueryResult = await pool.query(insertGoalQuery, values);
    return {
      id: rows[0].id,
      text: rows[0].text
    }   
  }

  async updateGoal(request: Request, response: Response): Promise<void> {
    const id: string = request.params.id;
    const { text }: Goal = request.body
    try {
      const updateGoalQuery = 'UPDATE users_goals SET text = $1, date_time = $2 WHERE id = $3';
      const dateTime = moment.utc();
      await pool.query(updateGoalQuery, [text, dateTime, id]);
      response.status(200).send(`Goal modified with ID: ${id}`);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async deleteGoal(request: Request, response: Response): Promise<void> {
    const id: string = request.params.id;
    try {
      await this.deleteSteps(id);
      const deleteGoalQuery = 'DELETE FROM users_goals WHERE id = $1';
      await pool.query(deleteGoalQuery, [id]);
      response.status(200).send(`Goal deleted with ID: ${id}`);
    } catch (error) {
      response.status(400).send(error);
    }    
  }

  async deleteSteps(goalId: string): Promise<void> {
    const deleteStepsQuery = 'DELETE FROM users_steps WHERE goal_id = $1';
    await pool.query(deleteStepsQuery, [goalId]);
  }  
}

