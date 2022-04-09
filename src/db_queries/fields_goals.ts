import { Response } from 'express';
import pg from 'pg';
import autoBind from 'auto-bind';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import FieldGoal from '../models/field_goal.model';

const conn = new Conn();
const pool = conn.pool;

export class FieldsGoals {
  constructor() {
    autoBind(this);
  }

  async getFieldsGoals(response: Response): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(constants.READ_ONLY_TRANSACTION);
      const getFieldsGoalsQuery = 'SELECT field_id, goal, why_choose_url FROM fields_goals';
      const { rows }: pg.QueryResult = await client.query(getFieldsGoalsQuery);
      const fieldsGoals: Array<FieldGoal> = [];
      for (const row of rows) {
        const fieldGoal: FieldGoal = {
          fieldId: row.field_id,
          goal: row.goal,
          whyChooseUrl: row.why_choose_url
        };
        fieldsGoals.push(fieldGoal);
      }
      response.status(200).json(fieldsGoals);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }  
  }
}

