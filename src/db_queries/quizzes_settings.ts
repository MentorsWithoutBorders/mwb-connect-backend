import { Request, Response } from 'express';
import pg from 'pg';
import { Conn } from '../db/conn';
import { Helpers } from '../utils/helpers';
import QuizSettings from '../models/quiz_settings.model';

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();

export class QuizzesSettings {
  constructor() {
    helpers.autoBind(this);
  }

  async getQuizzesSettings(request: Request, response: Response): Promise<void> {
    const client = await pool.connect();    
    try {
      await client.query('BEGIN');
      const quizzesSettings = await this.getQuizzesSettingsFromDB(client);
      response.status(200).json(quizzesSettings);
      await client.query('COMMIT');      
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');      
    } finally {
      client.release();
    }
  }

  async getQuizzesSettingsFromDB(client: pg.PoolClient): Promise<QuizSettings> {
    const getQuizzesSettingsQuery = 'SELECT student_weekly_count, mentor_weekly_count FROM quizzes_settings';
    const { rows }: pg.QueryResult = await client.query(getQuizzesSettingsQuery);
    return {
      studentWeeklyCount: rows[0].student_weekly_count,
      mentorWeeklyCount: rows[0].mentor_weekly_count
    }    
  }
}

