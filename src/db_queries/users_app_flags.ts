import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import pg from 'pg';
import { Conn } from '../db/conn';
import AppFlags from '../models/app_flags.model';

const conn = new Conn();
const pool = conn.pool;

export class UsersAppFlags {
  constructor() {
    autoBind(this);
  }

  async getAppFlags(request: Request, response: Response): Promise<void> {  
    const userId = request.user.id as string;
    try {
      const getAppFlagsQuery = 'SELECT is_training_enabled, is_mentoring_enabled FROM users_app_flags WHERE user_id = $1';
      const { rows }: pg.QueryResult = await pool.query(getAppFlagsQuery, [userId]);
      let appFlags: AppFlags = {};
      if (rows[0]) {
        appFlags = {
          isTrainingEnabled: rows[0].is_training_enabled,
          isMentoringEnabled: rows[0].is_mentoring_enabled
        }
      }  
      response.status(200).send(appFlags);
    } catch (error) {
      response.status(400).send(error);
    }
  }  

  async addAppFlags(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const { isTrainingEnabled, isMentoringEnabled }: AppFlags = request.body
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await this.addAppFlagsFromDB(userId, isTrainingEnabled as boolean, isMentoringEnabled as boolean, client);
      response.status(200).send(`App flags have been inserted for user: ${userId}`);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async addAppFlagsFromDB(userId: string, isTrainingEnabled: boolean, isMentoringEnabled: boolean, client: pg.PoolClient): Promise<void> {
    const deleteAppFlagsQuery = `DELETE FROM users_app_flags 
      WHERE user_id = $1`;
    await client.query(deleteAppFlagsQuery, [userId]);      
    const insertAppFlagsQuery = `INSERT INTO users_app_flags (user_id, is_training_enabled, is_mentoring_enabled) 
      VALUES ($1, $2, $3)`;
    const values = [userId, isTrainingEnabled, isMentoringEnabled];  
    await client.query(insertAppFlagsQuery, values);      
  }
}

