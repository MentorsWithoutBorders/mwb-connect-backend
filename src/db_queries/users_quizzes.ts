import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import pg from 'pg';
import moment from 'moment';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { UsersTimeZones } from './users_timezones';
import Quiz from '../models/quiz.model';
import QuizSettings from '../models/quiz_settings.model';
import TimeZone from '../models/timezone.model';

const conn: Conn = new Conn();
const pool = conn.pool;
const usersTimeZones: UsersTimeZones = new UsersTimeZones();

interface QuizData {
  round: number;
  roundCompleted: boolean;
  start: number;
}

interface QuizNumberData {
  quizNumber: number;
  quizNumberUpdated: boolean;
}

export class UsersQuizzes {
  constructor() {
    autoBind(this);
  }

  async getQuizNumber(request: Request, response: Response): Promise<void> {
    const userId: string = request.params.id;
    try {
      const getQuizzesSettingsQuery = 'SELECT * FROM quizzes_settings';
      let { rows }: pg.QueryResult = await pool.query(getQuizzesSettingsQuery);
      const quizSettings: QuizSettings = {
        count: rows[0].count,
        rounds: rows[0].rounds,
        timeBetweenRounds: rows[0].time_between_rounds
      }
      const getQuizzesQuery = `SELECT * FROM users_quizzes 
        WHERE user_id = $1
        ORDER BY date_time DESC`;
      ({ rows } = await pool.query(getQuizzesQuery, [userId]));
      const quizzes: Array<Quiz> = [];
      for (const row of rows) {
        const quiz: Quiz = {
          number: row.number,
          isCorrect: row.is_correct,
          dateTime: row.date_time
        }
        quizzes.push(quiz);
      }
      const solvedQuizzesRounds: Array<number> = [];
      for (let i = 1; i <= quizSettings.count; i++) {
        solvedQuizzesRounds[i] = 0;
      }      
      for (const quiz of quizzes) {
        if (quiz.isCorrect) {
          solvedQuizzesRounds[quiz.number]++;
        }
      }
      const lastQuizSubmitted = quizzes[0];
      const quizNumber = this.setQuizNumber(solvedQuizzesRounds, lastQuizSubmitted, quizSettings);
      response.status(200).json(quizNumber);
    } catch (error) {
      response.status(400).send(error);
    } 
  }
  
  setQuizNumber(solvedQuizzesRounds: Array<number>, lastQuizSubmitted: Quiz, quizSettings: QuizSettings): number {
    const { round, roundCompleted, start }: QuizData = this.getQuizData(solvedQuizzesRounds, lastQuizSubmitted, quizSettings);
    let quizNumber;
    if (this.shouldSkipQuiz(lastQuizSubmitted, round, roundCompleted, quizSettings)) {
      quizNumber = 0;
    } else {
      let quizData = this.getQuizNumberData(start + 1, quizSettings.count, solvedQuizzesRounds, round);
      if (!quizData.quizNumberUpdated) {
        quizData = this.getQuizNumberData(1, start, solvedQuizzesRounds, round);
      }
      quizNumber = quizData.quizNumber;
    }
    return quizNumber;
  }
 
  getQuizData(solvedQuizzesRounds: Array<number>, lastQuizSubmitted: Quiz, quizSettings: QuizSettings): QuizData {
    let round = 1;
    let shouldIncrementRound = true;
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
    let roundCompleted = false;
    if (solvedQuizzesRounds.length - 1 == quizSettings.count && shouldIncrementRound) {
      roundCompleted = true;
      round++;
      if (lastQuizSubmitted != null && lastQuizSubmitted.isCorrect) {
        start = 0;
      }           
    }
    return {
      round: round,
      start: start,
      roundCompleted: roundCompleted
    };
  }
  
  shouldSkipQuiz(lastQuizSubmitted: Quiz, round: number, roundCompleted: boolean, quizSettings: QuizSettings): boolean {
    const today = moment(new Date());
    let dayLastQuizSubmitted;
    if (lastQuizSubmitted != null) {
      dayLastQuizSubmitted = moment(lastQuizSubmitted.dateTime);
    } else {
      dayLastQuizSubmitted = today;
    }
    const diff = today.diff(dayLastQuizSubmitted, 'days');
    return round > quizSettings.rounds || roundCompleted && diff < (quizSettings.timeBetweenRounds as number);
  }

  getQuizNumberData(start: number, end: number, solvedQuizzesRounds: Array<number>, round: number): QuizNumberData {
    let quizNumber = 1;
    let quizNumberUpdated = false;
    for (let i = start; i <= end; i++) {
      if (solvedQuizzesRounds[i] < round) {
        quizNumber = i;
        quizNumberUpdated = true;
        break;
      }
    }
    return {
      quizNumber: quizNumber,
      quizNumberUpdated: quizNumberUpdated
    }    
  }

  async addQuiz(request: Request, response: Response): Promise<void> {
    const userId: string = request.params.id;
    const { number, isCorrect, isClosed }: Quiz = request.body
    try {
      const insertQuizQuery = `INSERT INTO users_quizzes (user_id, number, is_correct, is_closed, date_time)
        VALUES ($1, $2, $3, $4, $5) RETURNING *`;
      const timeZone: TimeZone = await usersTimeZones.getUserTimeZone(userId);
      const dateTime = moment.tz(new Date(), timeZone?.name).format(constants.DATE_TIME_FORMAT);
      const values = [userId, number, isCorrect, isClosed, dateTime];
      await pool.query(insertQuizQuery, values);
      response.status(200).send('Quiz has been added');
    } catch (error) {
      response.status(400).send(error);
    }
  }  
}

