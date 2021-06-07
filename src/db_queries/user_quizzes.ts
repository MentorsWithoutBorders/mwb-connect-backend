import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import pg from 'pg';
import moment from 'moment';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import Quiz from '../models/quiz.model';
import QuizSettings from '../models/quiz_settings.model';

const conn: Conn = new Conn();
const pool = conn.pool;

interface QuizData {
  round: number;
  start: number;
}

export class UserQuizzes {
  constructor() {
    autoBind(this);
  }

  async getQuizNumber(request: Request, response: Response): Promise<void> {
    const userId: string = request.params.user_id;
    try {
      const getQuizzesSettingsQuery = 'SELECT * FROM quizzes_settings';
      let { rows }: pg.QueryResult = await pool.query(getQuizzesSettingsQuery);
      const quizSettings: QuizSettings = {
        count: rows[0].count,
        rounds: rows[0].rounds
      }
      const getQuizzesQuery = `SELECT * FROM users_quizzes 
        WHERE user_id = $1
        ORDER BY date_time DESC`;
      ({ rows } = await pool.query(getQuizzesQuery, [userId]));
      const quizzes: Array<Quiz> = [];
      for (const row of rows) {
        const quiz: Quiz = {
          number: row.number,
          isCorrect: row.is_correct
        }
        quizzes.push(quiz);
      }
      let solvedQuizzesRounds: Array<number> = [];
      for (let i = 1; i <= quizSettings.count; i++) {
        solvedQuizzesRounds[i] = 0;
      }      
      for (const quiz of quizzes) {
        if (quiz.isCorrect) {
          solvedQuizzesRounds[quiz.number]++;
        }
      }
      
      const lastQuizSubmitted = quizzes[0];
      const { round, start }: QuizData = this.getQuizData(solvedQuizzesRounds, lastQuizSubmitted, quizSettings);

      let quizNumber = 1;
      let quizNumberUpdated = false;
      for (var j = start + 1; j <= quizSettings.count; j++) {
        if (solvedQuizzesRounds[j] < round) {
          quizNumber = j;
          quizNumberUpdated = true;
          break;
        }
      }
      if (!quizNumberUpdated) {
        for (var k = 1; k <= start; k++) {
          if (solvedQuizzesRounds[k] < round) {
            quizNumber = k;
            break;
          }
        }        
      }
      response.status(200).json(quizNumber);
    } catch (error) {
      response.status(400).send(error);
    } 
  }

  getQuizData(solvedQuizzesRounds: Array<number>, lastQuizSubmitted: Quiz, quizSettings: QuizSettings): QuizData {
    let round: number = 1;
    let shouldIncrementRound: boolean = true;
    for (const solvedQuizRound of solvedQuizzesRounds) {
      if (solvedQuizRound > round) {
        round = solvedQuizRound;
      } else if (solvedQuizRound < round) {
        shouldIncrementRound = false;
      }
    }
    let start = 0;
    if (lastQuizSubmitted != null) {
      start = lastQuizSubmitted.number;
    }
    if (solvedQuizzesRounds.length - 1 == quizSettings.count && shouldIncrementRound) {
      round++;
      if (lastQuizSubmitted != null && lastQuizSubmitted.isCorrect) {
        start = 0;
      }           
    }
    return {
      round: round,
      start: start
    };
  }  

  async addQuiz(request: Request, response: Response): Promise<void> {
    const userId: string = request.params.user_id;
    const { number, isCorrect }: Quiz = request.body
    try {
      const insertQuizQuery = `INSERT INTO users_quizzes (user_id, number, is_correct, date_time)
        VALUES ($1, $2, $3, $4) RETURNING *`;
      const dateTime = moment(new Date()).format(constants.DATE_FORMAT);
      const values = [userId, number, isCorrect, dateTime];
      await pool.query(insertQuizQuery, values);
      response.status(200).send('Quiz has been added');
    } catch (error) {
      response.status(400).send(error);
    }
  }  
}

