import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import moment from 'moment';
import 'moment-timezone';
import pg from 'pg';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { UsersTimeZones } from './users_timezones';
import Step from '../models/step.model';
import TimeZone from '../models/timezone.model';

const conn: Conn = new Conn();
const pool = conn.pool;
const usersTimeZones: UsersTimeZones = new UsersTimeZones();

export class UsersSteps {
  constructor() {
    autoBind(this);
  }

  async getSteps(request: Request, response: Response): Promise<void> {
    const goalId: string = request.params.id;
    try {
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
    const id: string = request.params.id;
    try {
      const getStepQuery = `SELECT * FROM users_steps WHERE id = $1`;
      const { rows }: pg.QueryResult = await pool.query(getStepQuery, [id]);
      const step: Step = {
        id: rows[0].id,
        text: rows[0].text,
        index: rows[0].index,
        level: rows[0].level,
        parentId: rows[0].parent_id
      };
      response.status(200).json(step);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async getLastStepAdded(request: Request, response: Response): Promise<void> {
    const userId: string = request.params.id;
    try {
      const getStepQuery = `SELECT * FROM users_steps 
        WHERE user_id = $1
        ORDER BY date_time DESC LIMIT 1`;
      const { rows }: pg.QueryResult = await pool.query(getStepQuery, [userId]);
      const step: Step = {
        id: rows[0].id,
        text: rows[0].text,
        dateTime: moment(rows[0].date_time).format(constants.DATE_FORMAT)
      }
      response.status(200).json(step);
    } catch (error) {
      response.status(400).send(error);
    }
  }  

  async addStep(request: Request, response: Response): Promise<void> {
    const userId: string = request.params.user_id;
    const goalId: string = request.params.goal_id;
    const { text, index, level, parentId }: Step = request.body
    try {
      const insertStepQuery = `INSERT INTO users_steps (user_id, goal_id, text, index, level, parent_id, date_time)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`;
      const timeZone: TimeZone = await usersTimeZones.getUserTimeZone(userId);
      const dateTime = moment.tz(new Date(), timeZone?.name).format(constants.DATE_FORMAT);
      const values = [userId, goalId, text, index, level, parentId, dateTime];        
      let { rows }: pg.QueryResult = await pool.query(insertStepQuery, values);
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
    const userId: string = request.params.user_id;
    const id: string = request.params.id;
    const { text, index, level, parentId }: Step = request.body
    try {
      const updateQuery = 'UPDATE users_steps SET text = $1, index = $2, level = $3, parent_id = $4, date_time = $5 WHERE id = $6';
      const timeZone: TimeZone = await usersTimeZones.getUserTimeZone(userId);
      const dateTime = moment.tz(new Date(), timeZone?.name).format(constants.DATE_FORMAT);
      await pool.query(updateQuery, [text, index, level, parentId, dateTime, id]);
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

