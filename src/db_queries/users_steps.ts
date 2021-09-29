import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import moment from 'moment';
import pg from 'pg';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Users } from './users';
import { UsersTimeZones } from './users_timezones';
import Step from '../models/step.model';

const conn = new Conn();
const pool = conn.pool;
const users = new Users();
const usersTimeZones = new UsersTimeZones();

export class UsersSteps {
  constructor() {
    autoBind(this);
  }

  async getSteps(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const goalId = request.params.id;
    try {
      const getStepsQuery = 'SELECT id, text, index, level, parent_id FROM users_steps WHERE user_id = $1 AND goal_id = $2';
      const { rows }: pg.QueryResult = await pool.query(getStepsQuery, [userId, goalId]);
      const steps: Array<Step> = [];
      for (const row of rows) {
        const step: Step = {
          id: row.id,
          text: row.text,
          index: row.index,
          level: row.level,
          parentId: row.parent_id
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
    const client: pg.PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(constants.READ_ONLY_TRANSACTION);
      const step: Step = await this.getStepByIdFromDB(userId, stepId, client);
      response.status(200).json(step);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
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
    const client: pg.PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(constants.READ_ONLY_TRANSACTION);
      const step: Step = await this.getLastStepAddedFromDB(userId, client);
      response.status(200).json(step);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }
  
  async getLastStepAddedFromDB(userId: string, client: pg.PoolClient): Promise<Step> {
    const getStepQuery = `SELECT id, text, index, level, parent_id, date_time FROM users_steps 
      WHERE user_id = $1
      ORDER BY date_time DESC LIMIT 1`;
    const { rows }: pg.QueryResult = await client.query(getStepQuery, [userId]);
    let step: Step = {};
    if (rows[0]) {
      step = {
        id: rows[0].id,
        text: rows[0].text,
        index: rows[0].index,
        level: rows[0].level,
        parentId: rows[0].parent_id,
        dateTime: moment.utc(rows[0].date_time).format(constants.DATE_TIME_FORMAT)
      } 
    }
    const user = await users.getUserFromDB(userId, client);
    const userTimeZone = await usersTimeZones.getUserTimeZone(userId, client);
    const timeSinceRegistration = moment.utc().tz(userTimeZone.name).startOf('day').diff(moment.utc(user.registeredOn).tz(userTimeZone.name).startOf('day'));
    if (user.isMentor && moment.duration(timeSinceRegistration).asWeeks() > constants.MENTOR_WEEKS_TRAINING ||
        !user.isMentor && moment.duration(timeSinceRegistration).asMonths() > constants.STUDENT_MONTHS_TRAINING + 0.05) {
      step.id = constants.TRAINING_COMPLETED_ID;
      step.dateTime = moment.utc().format(constants.DATE_TIME_FORMAT);
    }    
    return step;  
  }

  async addStep(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const goalId = request.params.id;
    const { text, index, level, parentId }: Step = request.body;
    try {
      const insertStepQuery = `INSERT INTO users_steps (user_id, goal_id, text, index, level, parent_id, date_time)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`;
      const dateTime = moment.utc();
      const values = [userId, goalId, text, index, level, parentId, dateTime];        
      const { rows }: pg.QueryResult = await pool.query(insertStepQuery, values);
      const step: Step = {
        id: rows[0].id,
        text: rows[0].text,
        index: rows[0].index,
        level: rows[0].level,
        parentId: rows[0].parent_id
      };      
      response.status(200).send(step);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async updateStep(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const stepId = request.params.id;
    const { text, index, level, parentId }: Step = request.body
    const client: pg.PoolClient = await pool.connect();
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
      response.status(200).send(`Step modified with ID: ${stepId}`);
      await client.query('COMMIT');
    } catch (error) {
      console.log(error);
      response.status(400).send(error);
      await client.query('ROLLBACK');
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
    const client: pg.PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      const stepToDelete = await this.getStepByIdFromDB(userId, stepId, client);
      const { dateTime }: Step = stepToDelete;
      const lastStepAddedBeforeDelete = await this.getLastStepAddedFromDB(userId, client);
      const deleteStepQuery = 'DELETE FROM users_steps WHERE user_id = $1 AND id = $2';
      await client.query(deleteStepQuery, [userId, stepId]);
      if (lastStepAddedBeforeDelete.id == stepId) {
        const lastStepAdded = await this.getLastStepAddedFromDB(userId, client);
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
      response.status(200).send(`Step deleted with ID: ${stepId}`);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }    
  }
}

