import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import moment from 'moment';
import 'moment-timezone';
import { Conn } from '../db/conn';
import { Users } from './users';
import { UsersTimeZones } from './users_timezones';
import { QuizzesSettings } from './quizzes_settings';
import { constants } from '../utils/constants';
import Quiz from '../models/quiz.model';
import pg from 'pg';

const conn: Conn = new Conn();
const pool = conn.pool;
const users: Users = new Users();
const usersTimeZones: UsersTimeZones = new UsersTimeZones();
const quizzesSettings: QuizzesSettings = new QuizzesSettings();

export class UsersQuizzes {
  constructor() {
    autoBind(this);
  }

  async getQuizNumber(request: Request, response: Response): Promise<void> {
    const userId: string = request.user.id as string;
    const client: pg.PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(constants.READ_ONLY_TRANSACTION);
      const quizNumber = await this.getQuizNumberFromDB(userId, client);
      response.status(200).json(quizNumber);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async getQuizNumberFromDB(userId: string, client: pg.PoolClient): Promise<number> {
    const quizSettings = await quizzesSettings.getQuizzesSettingsFromDB();
    const user = await users.getUserFromDB(userId, client);
    const userTimeZone = await usersTimeZones.getUserTimeZone(userId, client);
    const registeredOn = moment.utc(user.registeredOn).tz(userTimeZone.name).startOf('day');
    const today = moment.utc().tz(userTimeZone.name).startOf('day');
    const weekNumber = today.subtract(1, 'd').diff(registeredOn, 'weeks');
    const weekStartDate = this.getWeekStartDate(registeredOn, weekNumber);
    const weekEndDate = this.getWeekEndDate(registeredOn, weekNumber);      
    let quizzes = await this.getQuizzes(userId, client);
    let quizNumber = 0;
    if (user.isMentor) {
      const weeklyCount = quizSettings.mentorWeeklyCount;
      const quizStartNumber = this.getQuizStartNumber(weekNumber, weeklyCount);
      const quizEndNumber = this.getQuizEndNumber(weekNumber, weeklyCount);
      quizzes = this.getQuizzesBetweenDates(quizzes, weekStartDate, weekEndDate); 
      quizNumber = this.calculateQuizNumber(quizzes, weeklyCount, quizStartNumber, quizEndNumber);
    } else {
      if (weekNumber <= constants.STUDENT_MAX_QUIZZES_SETS + constants.STUDENT_MAX_QUIZZES_SETS / 2 + 1) {
        const weeklyCount = quizSettings.studentWeeklyCount;
        const quizzesSetNumber = this.getQuizzesSetNumber(quizzes, registeredOn, weeklyCount);
        const quizStartNumber = this.getQuizStartNumber(quizzesSetNumber, weeklyCount);
        const quizEndNumber = this.getQuizEndNumber(quizzesSetNumber, weeklyCount);
        quizzes = this.getQuizzesBetweenDates(quizzes, weekStartDate, weekEndDate); 
        quizNumber = this.calculateQuizNumber(quizzes, weeklyCount, quizStartNumber, quizEndNumber);
      } else {
        const quizStartNumber = this.getQuizzesRemainingStartNumber(quizzes, registeredOn);
        quizNumber = this.calculateQuizNumber(quizzes, quizSettings.studentWeeklyCount, quizStartNumber, quizSettings.studentWeeklyCount * constants.WEEKS_PER_MONTH);
      }
    }
    return quizNumber;    
  }

  getQuizzesRemainingStartNumber(quizzes: Array<Quiz>, registeredOn: moment.Moment): number {
    const quizzesStartDate = moment.utc(registeredOn).add(constants.STUDENT_MAX_QUIZZES_SETS * 7, 'days');
    let startNumber = 0;
    for (const quiz of quizzes) {
      if (moment.utc(quiz.dateTime).isAfter(moment.utc(quizzesStartDate)) && quiz.isCorrect && quiz.number > startNumber) {
        startNumber = quiz.number + 1;
      }
    }
    return startNumber;
  }  

  getWeekStartDate(registeredOn: moment.Moment, weekNumber: number): moment.Moment {
    return moment.utc(registeredOn).add(weekNumber * 7, 'days');    
  }

  getWeekEndDate(registeredOn: moment.Moment, weekNumber: number): moment.Moment {
    return moment.utc(registeredOn).endOf('day').add((weekNumber + 1) * 7 + 1, 'days');
  }  

  getQuizStartNumber(weekNumber: number, weeklyCount: number): number {
    return weekNumber * weeklyCount + 1;
  }

  getQuizEndNumber(weekNumber: number, weeklyCount: number): number {
    return weekNumber * weeklyCount + weeklyCount;  
  }

  async getQuizzes(userId: string, client: pg.PoolClient): Promise<Array<Quiz>> {
    const getQuizzesQuery = `SELECT number, is_correct, date_time FROM users_quizzes 
      WHERE user_id = $1
      ORDER BY date_time DESC`;
    const { rows } = await client.query(getQuizzesQuery, [userId]);
    const quizzes: Array<Quiz> = [];
    for (const row of rows) {
      const quiz: Quiz = {
        number: row.number,
        isCorrect: row.is_correct,
        dateTime: moment.utc(row.date_time).format(constants.DATE_TIME_FORMAT)
      }
      quizzes.push(quiz);
    }
    return quizzes;
  }

  getQuizzesBetweenDates(quizzes: Array<Quiz>, weekStartDate: moment.Moment, weekEndDate: moment.Moment): Array<Quiz> {
    const quizzesBetweenDates: Array<Quiz> = [];
    for (const quiz of quizzes) {
      if (moment.utc(quiz.dateTime).isAfter(moment.utc(weekStartDate)) 
          && moment.utc(quiz.dateTime).isBefore(moment.utc(weekEndDate))) {
        quizzesBetweenDates.push(quiz);
      }
    }   
    return quizzesBetweenDates;
  }

  calculateQuizNumber(quizzes: Array<Quiz>, weeklyCount: number, quizStartNumber: number, quizEndNumber: number): number {
    let quizNumber = 0;
    const weekQuizzesSolved = this.getWeekQuizzesSolved(quizzes, quizStartNumber, quizEndNumber);
    if (quizStartNumber < constants.WEEKS_PER_MONTH * weeklyCount && 
        weekQuizzesSolved < quizEndNumber - quizStartNumber + 1) {
      if (weekQuizzesSolved == 0) {
        quizNumber = quizStartNumber;
      } else {
        if (!quizzes[0].isCorrect) {
          quizNumber = quizzes[0].number;
        } else {
          quizNumber = quizzes[0].number + 1;
          if (quizNumber > quizEndNumber) {
            quizNumber = quizStartNumber;
          }
        }
      }
    }
    return quizNumber;    
  }

  getWeekQuizzesSolved(quizzes: Array<Quiz>, quizStartNumber: number, quizEndNumber: number): number {
    let solvedQuizzes = 0;
    for (let i = quizStartNumber; i <= quizEndNumber; i++) {
      for (const quiz of quizzes) {
        if (quiz.number === i && quiz.isCorrect) {
          solvedQuizzes++;
        }
      }
    }
    return solvedQuizzes;
  }

  getQuizzesSetNumber(quizzes: Array<Quiz>, registeredOn: moment.Moment, weeklyCount: number): number {
    let quizzesSetNumber = 0;
    const today = moment.utc().startOf('day');
    const weekNumber = today.diff(registeredOn, 'weeks');
    let quizzesSetsStart = 0;
    let quizzesSetsEnd = constants.STUDENT_MAX_QUIZZES_SETS;
    if (weekNumber < quizzesSetsEnd + 1) {
      quizzesSetsEnd = weekNumber;
    } else {
      quizzesSetsStart = constants.STUDENT_MAX_QUIZZES_SETS + 1;
      quizzesSetsEnd = constants.STUDENT_MAX_QUIZZES_SETS + constants.STUDENT_MAX_QUIZZES_SETS / 2 + 1;
      if (weekNumber < quizzesSetsEnd) {
        quizzesSetsEnd = weekNumber;
      }
    }
    for (let i = 0; i < constants.STUDENT_MAX_QUIZZES_SETS / 2; i++) {
      const quizStartNumber = this.getQuizStartNumber(i, weeklyCount);
      const quizEndNumber = this.getQuizEndNumber(i, weeklyCount); 
      let areQuizzesSolved = false;
      for (let j = quizzesSetsStart; j < quizzesSetsEnd; j++) {
        const weekStartDate = this.getWeekStartDate(registeredOn, j);
        const weekEndDate = this.getWeekEndDate(registeredOn, j);        
        const quizzesBetweenDates = this.getQuizzesBetweenDates(quizzes, weekStartDate, weekEndDate);
        if (this.getWeekQuizzesSolved(quizzesBetweenDates, quizStartNumber, quizEndNumber) == weeklyCount) {
          areQuizzesSolved = true;
        } 
      }
      if (areQuizzesSolved) {
        quizzesSetNumber++;
      }
    }
    return quizzesSetNumber;
  }

  async addQuiz(request: Request, response: Response): Promise<void> {
    const userId: string = request.user.id as string;
    const { number, isCorrect, isClosed }: Quiz = request.body
    const client: pg.PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');      
      const insertQuizQuery = `INSERT INTO users_quizzes (user_id, number, is_correct, is_closed, date_time)
        VALUES ($1, $2, $3, $4, $5) RETURNING *`;
      const dateTime = moment.utc();
      const values = [userId, number, isCorrect, isClosed, dateTime];
      await client.query(insertQuizQuery, values);
      const quizNumber = await this.getQuizNumberFromDB(userId, client);
      response.status(200).json(quizNumber);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }  
}

