import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import moment from 'moment'
import pg from 'pg';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import Step from '../models/step.model';

const conn: Conn = new Conn();
const pool = conn.pool;

export class Steps {
  constructor() {
    autoBind(this);
  }

  async getSteps(request: Request, response: Response): Promise<void> {
    const goalId: string = request.params.goal_id;
    try {
      const steps: Array<Step> = await this.getStepsFromDB(goalId);
      response.status(200).json(steps);
    } catch (error) {
      response.status(400).send(error);
    }   
  }

  async getStepsFromDB(goalId: string): Promise<Array<Step>> {
    const getStepsQuery = `SELECT * FROM users_steps 
      WHERE goal_id = $1`;
    const { rows }: pg.QueryResult = await pool.query(getStepsQuery, [goalId]);
    const steps: Array<Step> = [];
    for (const row of rows) {
      const step: Step = {
        id: row.id,
        text: row.text,
        index: row.index,
        level: row.level,
        parent: row.parent
      };
      steps.push(step);
    }
    return steps;
  }

  async getStepById(request: Request, response: Response): Promise<void> {
    const goalId: string = request.params.goal_id;
    const id: string = request.params.id;
    try {
      const getStepQuery = `SELECT * FROM users_steps
        WHERE goal_id = $1 AND id = $2`;
      const { rows }: pg.QueryResult = await pool.query(getStepQuery, [goalId, id]);
      const step: Step = {
        id: rows[0].id,
        text: rows[0].text,
        index: rows[0].index,
        level: rows[0].level,
        parent: rows[0].parent
      };
      response.status(200).json(step);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async addStep(request: Request, response: Response): Promise<void> {
    const userId: string = request.params.user_id;
    const goalId: string = request.params.goal_id;
    const { text, index, level, parent }: Step = request.body
    try {
      const insertStepQuery = `INSERT INTO users_steps (user_id, goal_id, text, index, level, parent_step_id, date_time)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`;
      const dateTime = moment(new Date()).format(constants.DATE_FORMAT);
      const values = [userId, goalId, text, index, level, parent, dateTime];        
      let { rows }: pg.QueryResult = await pool.query(insertStepQuery, values);
      const step: Step = {
        id: rows[0].id,
        text: rows[0].text,
        index: rows[0].index,
        level: rows[0].level,
        parent: rows[0].parent
      };      
      response.status(200).send(step);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async updateStep(request: Request, response: Response): Promise<void> {
    const id: string = request.params.id;
    const { text, index, level, parent }: Step = request.body
    try {
      const updateQuery = 'UPDATE users_steps SET text = $1, index = $2, level = $3, parent_step_id = $4, date_time = $5 WHERE id = $6';
      const dateTime = moment(new Date()).format(constants.DATE_FORMAT);      
      await pool.query(updateQuery, [text, index, level, parent, dateTime, id]);
      response.status(200).send(`Step modified with ID: ${id}`);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async deleteStep(request: Request, response: Response): Promise<void> {
    const id: string = request.params.id;
    try {
      const deleteQuery = 'DELETE FROM users_steps WHERE id = $1';
      await pool.query(deleteQuery, [id]);
      response.status(200).send(`Step deleted with ID: ${id}`);
    } catch (error) {
      response.status(400).send(error);
    }    
  }
}

