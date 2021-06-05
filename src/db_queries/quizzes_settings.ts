import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import pg from 'pg';
import { Conn } from '../db/conn';
import QuizSettings from '../models/quiz_settings.model';

const conn: Conn = new Conn();
const pool = conn.pool;

export class QuizzesSettings {
  constructor() {
    autoBind(this);
  }

  async getQuizzesSettings(request: Request, response: Response): Promise<void> {
    try {
      const getQuizzesSettingsQuery = 'SELECT * FROM quizzes_settings';
      const { rows }: pg.QueryResult = await pool.query(getQuizzesSettingsQuery);
      const quizzesSettings: QuizSettings = {
        count: rows[0].count,
        rounds: rows[0].rounds,
        showTimer: rows[0].show_timer,
        timeBetweenRounds: rows[0].time_between_rounds
      }
      response.status(200).json(quizzesSettings);
    } catch (error) {
      response.status(400).send(error);
    } 
  }
}

