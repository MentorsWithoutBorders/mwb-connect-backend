import { Request, Response } from 'express';
import moment from 'moment';
import pg from 'pg';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Helpers } from '../utils/helpers';
import { AdminTrainingReminders } from './admin_training_reminders';
import Step from '../models/step.model';

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();
const adminTrainingReminders = new AdminTrainingReminders();

export class UsersSteps {
  constructor() {
    helpers.autoBind(this);
  }

  async getSteps(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const goalId = request.params.id;
    try {
      const getStepsQuery = 'SELECT id, text, index, level, parent_id, date_time FROM users_steps WHERE user_id = $1 AND goal_id = $2';
      const { rows }: pg.QueryResult = await pool.query(getStepsQuery, [userId, goalId]);
      const steps: Array<Step> = [];
      for (const row of rows) {
        const step: Step = {
          id: row.id,
          text: row.text,
          index: row.index,
          level: row.level,
          parentId: row.parent_id,
          dateTime: moment.utc(row.date_time).format(constants.DATE_TIME_FORMAT)
        };
        steps.push(step);
      }
      response.status(200).json(steps);
    } catch (error) {
      response.status(400).send(error);
    }   
  }

  async getAllSteps(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    try {
      const getStepsQuery = 'SELECT id, goal_id, text, index, level, parent_id, date_time FROM users_steps WHERE user_id = $1';
      const { rows }: pg.QueryResult = await pool.query(getStepsQuery, [userId]);
      const steps: Array<Step> = [];
      for (const row of rows) {
        const step: Step = {
          id: row.id,
          goalId: row.goal_id,
          text: row.text,
          index: row.index,
          level: row.level,
          parentId: row.parent_id,
          dateTime: moment.utc(row.date_time).format(constants.DATE_TIME_FORMAT)
        };
        steps.push(step);
      }
      response.status(200).json(steps);
    } catch (error) {
      response.status(400).send(error);
    }   
  }

  async getStepById(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const stepId = request.params.id;
    const client = await pool.connect();
    try {
      await client.query(constants.READ_ONLY_TRANSACTION);
      const step: Step = await this.getStepByIdFromDB(userId, stepId, client);
      response.status(200).json(step);
    } catch (error) {
      response.status(400).send(error);
    } finally {
      client.release();
    }
  }

  async getStepByIdFromDB(userId: string, stepId: string, client: pg.PoolClient): Promise<Step> {
    const getStepQuery = `SELECT id, text, index, level, parent_id, date_time FROM users_steps WHERE user_id = $1 AND id = $2`;
    const { rows }: pg.QueryResult = await client.query(getStepQuery, [userId, stepId]);
    let step: Step = {};
    if (rows[0]) {    
      step = {
        id: rows[0].id,
        text: rows[0].text,
        index: rows[0].index,
        level: rows[0].level,
        parentId: rows[0].parent_id,
        dateTime: moment.utc(rows[0].date_time).format(constants.DATE_TIME_FORMAT)
      };
    }
    return step;
  }

  async getLastStepAdded(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const client = await pool.connect();
    try {
      await client.query(constants.READ_ONLY_TRANSACTION);
      const step: Step = await adminTrainingReminders.getLastStepAddedFromDB(userId, client);
      response.status(200).json(step);
    } catch (error) {
      response.status(400).send(error);
    } finally {
      client.release();
    }
  }

  async addStep(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const goalId = request.params.id;
    const { id, text, index, level, parentId, dateTime }: Step = request.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const stepDateTime = dateTime ? dateTime : moment.utc();
      let insertStepQuery = `INSERT INTO users_steps (user_id, goal_id, text, index, level, parent_id, date_time)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`;
      let values = [userId, goalId, text, index, level, parentId, stepDateTime];       
      if (id) {
        insertStepQuery = `INSERT INTO users_steps (id, user_id, goal_id, text, index, level, parent_id, date_time)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`;
        values = [id, userId, goalId, text, index, level, parentId, stepDateTime];        
      }
      const { rows }: pg.QueryResult = await pool.query(insertStepQuery, values);
      const step: Step = {
        id: rows[0].id,
        text: rows[0].text,
        index: rows[0].index,
        level: rows[0].level,
        parentId: rows[0].parent_id
      };
      await this.updateTrainingReminderStepAdded(userId, client);
      await client.query('COMMIT');
      response.status(200).send(step);	
    } catch (error) {
      await client.query('ROLLBACK');
      response.status(400).send(error);
    } finally {
      client.release();
    }
  }

  async updateStep(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const stepId = request.params.id;
    const { text, index, level, parentId }: Step = request.body
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const dateTime = moment.utc().format(constants.DATE_TIME_FORMAT);
      const step: Step = {
        id: stepId, 
        text: text,
        index: index, 
        level: level, 
        parentId: parentId, 
        dateTime: dateTime
      }
      await this.updateStepInDB(userId, step, client);
      await client.query('COMMIT');
      response.status(200).send(`Step modified with ID: ${stepId}`);
    } catch (error) {
      await client.query('ROLLBACK');
      response.status(400).send(error);
    } finally {
      client.release();
    }
  }

  async updateStepInDB(userId: string, step: Step, client: pg.PoolClient): Promise<void> {
    const updateStepQuery = 'UPDATE users_steps SET text = $1, index = $2, level = $3, parent_id = $4, date_time = $5 WHERE user_id = $6 AND id = $7';
    await client.query(updateStepQuery, [step.text, step.index, step.level, step.parentId, step.dateTime, userId, step.id]);
  }
  
  async deleteStep(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const stepId = request.params.id;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const stepToDelete = await this.getStepByIdFromDB(userId, stepId, client);
      const { dateTime }: Step = stepToDelete;
      const lastStepAddedBeforeDelete = await adminTrainingReminders.getLastStepAddedFromDB(userId, client);
      const deleteStepQuery = 'DELETE FROM users_steps WHERE user_id = $1 AND id = $2';
      await client.query(deleteStepQuery, [userId, stepId]);
      if (lastStepAddedBeforeDelete.id == stepId) {
        const lastStepAdded = await adminTrainingReminders.getLastStepAddedFromDB(userId, client);
        const { id, text, index, level, parentId }: Step = lastStepAdded;
        const step: Step = {
          id: id, 
          text: text,
          index: index, 
          level: level, 
          parentId: parentId, 
          dateTime: dateTime
        }        
        await this.updateStepInDB(userId, step, client);
      }
      await client.query('COMMIT');
      response.status(200).send(`Step deleted with ID: ${stepId}`);
    } catch (error) {
      await client.query('ROLLBACK');
      response.status(400).send(error);
    } finally {
      client.release();
    }    
  }

  async deleteSteps(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const goalId = request.params.id;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const deleteStepsQuery = 'DELETE FROM users_steps WHERE user_id = $1 AND goal_id = $2';
      await client.query(deleteStepsQuery, [userId, goalId]);
      await client.query('COMMIT');
      response.status(200).send(`All steps have been deleted for goal ${goalId}`);
    } catch (error) {
      await client.query('ROLLBACK');
      response.status(400).send(error);
    } finally {
      client.release();
    }
  }

  async updateTrainingReminderStepAdded(userId: string, client: pg.PoolClient): Promise<void> {
    const updateStepAddedQuery = `UPDATE admin_training_reminders
      SET is_step_added = true WHERE user_id = $1`;
    await client.query(updateStepAddedQuery, [userId]);
  }
    
}

