import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import moment from 'moment';
import 'moment-timezone';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Helpers } from '../utils/helpers';
import { Users } from './users';
import { UsersTimeZones } from './users_timezones';
import { QuizzesSettings } from './quizzes_settings';
import Quiz from '../models/quiz.model';
import pg from 'pg';
import TimeZone from '../models/timezone.model';

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();
const users = new Users();
const usersTimeZones = new UsersTimeZones();
const quizzesSettings = new QuizzesSettings();

export class UsersQuizzes {
  constructor() {
    autoBind(this);
  }

  async getQuizzes(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(constants.READ_ONLY_TRANSACTION);
      const quizNumber = await this.getQuizzesFromDB(userId, client);
      response.status(200).json(quizNumber);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }  

  async getQuizNumber(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const client = await pool.connect();
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

  async getQuizzesFromDB(userId: string, client: pg.PoolClient): Promise<Array<Quiz>> {
    const quizSettings = await quizzesSettings.getQuizzesSettingsFromDB(client);
    const user = await users.getUserFromDB(userId, client);
    const userTimeZone = await usersTimeZones.getUserTimeZone(userId, client);
    const registeredOn = moment.utc(user.registeredOn).tz(userTimeZone.name).startOf('day');
    const today = moment.utc().tz(userTimeZone.name).startOf('day');
    const timeSinceRegistration = today.subtract(1, 'd').diff(registeredOn);
    const weekNumber = Math.trunc(helpers.getDSTAdjustedDifferenceInDays(timeSinceRegistration) / 7);
    const weekStartDate = this.getWeekStartDate(registeredOn, weekNumber, userTimeZone);
    const weekEndDate = this.getWeekEndDate(registeredOn, weekNumber, userTimeZone);
    let quizzes = await this.getAllQuizzes(userId, client);
    const quizzesBetweenDates = this.getQuizzesBetweenDates(quizzes, weekStartDate, weekEndDate, userTimeZone); 
    if (user.isMentor) {
      const weeklyCount = quizSettings.mentorWeeklyCount;
      if (weekNumber < constants.MENTOR_MAX_QUIZZES_SETS - 1) {
        const quizStartNumber = this.getQuizzesRemainingStartNumber(quizzes, registeredOn);
        quizzes = this.getAssignedQuizzesMentor(quizzes, quizzesBetweenDates, quizStartNumber, weeklyCount, false);
      } else {
        const quizStartNumber = 1;
        quizzes = this.getAssignedQuizzesMentor(quizzes, quizzesBetweenDates, quizStartNumber, weeklyCount, true);
      }
    } else {
      const weeklyCount = quizSettings.studentWeeklyCount;
      if (weekNumber <= constants.STUDENT_MAX_QUIZZES_SETS * weeklyCount) {
        const quizzesSetNumber = this.getQuizzesSetNumber(quizzes, registeredOn, userTimeZone, weeklyCount);
        const quizStartNumber = this.getQuizStartNumber(quizzesSetNumber, weeklyCount);
        if (quizStartNumber < constants.STUDENT_MAX_QUIZZES_SETS * weeklyCount) {
          quizzes = this.getAssignedQuizzesStudent(quizzesBetweenDates, quizStartNumber, weeklyCount, false);          
        } else {
          quizzes = [];
        }
      } else {
        const quizzesStartDate = moment.utc(registeredOn).add((constants.STUDENT_MAX_QUIZZES_SETS * 2 + 1) * 7 + 1, 'days');
        const quizStartNumber = this.getQuizzesRemainingStartNumber(quizzes, quizzesStartDate);
        quizzes = this.getAssignedQuizzesStudent(quizzesBetweenDates, quizStartNumber, weeklyCount, true);
        const remainingQuizzes = helpers.getRemainingQuizzes(quizzes);
        if (remainingQuizzes == 0) {
          quizzes = [];
        }
      }
    }
    return quizzes;    
  }

  getAssignedQuizzesMentor(quizzes: Array<Quiz>, quizzesBetweenDates: Array<Quiz>, quizStartNumber:number, weeklyCount: number, isAllRemainingQuizzes: boolean): Array<Quiz> {
    const assignedQuizzes: Array<Quiz> = [];
    for (const quiz of quizzesBetweenDates) {
      if (!isAllRemainingQuizzes && quiz.number < quizStartNumber) {
        quizStartNumber = quiz.number;
      }
    }
    const quizEndNumber = isAllRemainingQuizzes ? weeklyCount * constants.WEEKS_PER_MONTH : quizStartNumber + weeklyCount - 1;
    const correctQuizzes = quizzes.filter(quiz => {
      return quiz.isCorrect === true
    });
    const correctQuizzesBetweenDates = quizzesBetweenDates.filter(quiz => {
      return quiz.isCorrect === true
    });
    for (let i = quizStartNumber; i <= quizEndNumber; i++) {
      if (!correctQuizzes.some(q => q.number === i) || correctQuizzesBetweenDates.some(q => q.number === i)) {
        const quiz: Quiz = {
          number: i
        }
        if (correctQuizzesBetweenDates.some(q => q.number === i)) {
          quiz.isCorrect = true;
        }
        assignedQuizzes.push(quiz)
      }
    }
    return assignedQuizzes;
  }
  
  getAssignedQuizzesStudent(quizzesBetweenDates: Array<Quiz>, quizStartNumber: number, weeklyCount: number, isAllRemainingQuizzes: boolean): Array<Quiz> {
    const assignedQuizzes: Array<Quiz> = [];
    for (const quiz of quizzesBetweenDates) {
      if (quiz.number < quizStartNumber) {
        quizStartNumber = quiz.number;
      }
    }
    const quizEndNumber = isAllRemainingQuizzes ? weeklyCount * constants.WEEKS_PER_MONTH : quizStartNumber + weeklyCount - 1;
    const correctQuizzesBetweenDates = quizzesBetweenDates.filter(quiz => {
      return quiz.isCorrect === true
    });  
    for (let i = quizStartNumber; i <= quizEndNumber; i++) {
      const quiz: Quiz = {
        number: i
      }
      if (correctQuizzesBetweenDates.some(q => q.number === i)) {
        quiz.isCorrect = true;
      }
      assignedQuizzes.push(quiz)
    }
    return assignedQuizzes;
  }

  async getQuizNumberFromDB(userId: string, client: pg.PoolClient): Promise<number> {
    let quizNumber = 0;
    const user = await users.getUserFromDB(userId, client);
    if (!user.isMentor) {
      const quizzes = await this.getQuizzesFromDB(userId, client);
      for (const quiz of quizzes) {
        if (!quiz.isCorrect) {
          quizNumber = quiz.number;
          break;
        }
      }
    } else {
      const quizSettings = await quizzesSettings.getQuizzesSettingsFromDB(client);
      const userTimeZone = await usersTimeZones.getUserTimeZone(userId, client);
      const registeredOn = moment.utc(user.registeredOn).tz(userTimeZone.name).startOf('day');
      const today = moment.utc().tz(userTimeZone.name).startOf('day');
      const timeSinceRegistration = today.subtract(1, 'd').diff(registeredOn);
      const weekNumber = Math.trunc(helpers.getDSTAdjustedDifferenceInDays(timeSinceRegistration) / 7);
      const weekStartDate = this.getWeekStartDate(registeredOn, weekNumber, userTimeZone);
      const weekEndDate = this.getWeekEndDate(registeredOn, weekNumber, userTimeZone);
      let quizzes = await this.getAllQuizzes(userId, client);
      const weeklyCount = quizSettings.mentorWeeklyCount;
      const quizStartNumber = this.getQuizStartNumber(weekNumber, weeklyCount);
      const quizEndNumber = this.getQuizEndNumber(weekNumber, weeklyCount);
      quizzes = this.getQuizzesBetweenDates(quizzes, weekStartDate, weekEndDate, userTimeZone); 
      quizNumber = this.calculateQuizNumber(quizzes, weeklyCount, quizStartNumber, quizEndNumber);
    }
    return quizNumber;    
  }

  getQuizzesRemainingStartNumber(quizzes: Array<Quiz>, quizzesStartDate: moment.Moment): number {
    let startNumber = 1;
    for (const quiz of quizzes) {
      if (moment.utc(quiz.dateTime).isAfter(moment.utc(quizzesStartDate)) && quiz.isCorrect && quiz.number >= startNumber) {
        startNumber = quiz.number + 1;      
      }
    }
    return startNumber;
  }  

  getWeekStartDate(registeredOn: moment.Moment, weekNumber: number, timeZone: TimeZone): moment.Moment {
    const extraDay = weekNumber == 0 ? 0 : 1;
    return moment.utc(registeredOn).tz(timeZone.name).add(weekNumber * 7 + extraDay, 'days');    
  }

  getWeekEndDate(registeredOn: moment.Moment, weekNumber: number, timeZone: TimeZone): moment.Moment {
    return moment.utc(registeredOn).tz(timeZone.name).add((weekNumber + 1) * 7, 'days');
  }  

  getQuizStartNumber(weekNumber: number, weeklyCount: number): number {
    return weekNumber * weeklyCount + 1;
  }

  getQuizEndNumber(weekNumber: number, weeklyCount: number): number {
    return weekNumber * weeklyCount + weeklyCount;  
  }

  async getAllQuizzes(userId: string, client: pg.PoolClient): Promise<Array<Quiz>> {
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

  getQuizzesBetweenDates(quizzes: Array<Quiz>, weekStartDate: moment.Moment, weekEndDate: moment.Moment, userTimeZone: TimeZone): Array<Quiz> {
    const quizzesBetweenDates: Array<Quiz> = [];
    for (const quiz of quizzes) {
      if (moment.utc(quiz.dateTime).tz(userTimeZone.name).isAfter(moment.utc(weekStartDate).tz(userTimeZone.name).startOf('day')) 
          && moment.utc(quiz.dateTime).tz(userTimeZone.name).isBefore(moment.utc(weekEndDate).tz(userTimeZone.name).endOf('day'))) {
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
            quizNumber = 0;
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

  getQuizzesSetNumber(quizzes: Array<Quiz>, registeredOn: moment.Moment, userTimeZone: TimeZone, weeklyCount: number): number {
    let quizzesSetNumber = 0;
    const today = moment.utc().tz(userTimeZone.name).startOf('day');
    const timeSinceRegistration = today.subtract(1, 'd').diff(registeredOn);
    const weekNumber = Math.trunc(helpers.getDSTAdjustedDifferenceInDays(timeSinceRegistration) / 7);
    let quizzesSetsStart = 0;
    let quizzesSetsEnd = constants.STUDENT_MAX_QUIZZES_SETS * 2;
    if (weekNumber < quizzesSetsEnd + 1) {
      quizzesSetsEnd = weekNumber;
    } else {
      quizzesSetsStart = constants.STUDENT_MAX_QUIZZES_SETS * 2 + 1;
      quizzesSetsEnd = constants.STUDENT_MAX_QUIZZES_SETS * 2 + constants.STUDENT_MAX_QUIZZES_SETS + 1;
      if (weekNumber < quizzesSetsEnd) {
        quizzesSetsEnd = weekNumber;
      }
    }
    for (let i = 0; i < constants.STUDENT_MAX_QUIZZES_SETS; i++) {
      const quizStartNumber = this.getQuizStartNumber(i, weeklyCount);
      const quizEndNumber = this.getQuizEndNumber(i, weeklyCount); 
      let areQuizzesSolved = false;
      for (let j = quizzesSetsStart; j < quizzesSetsEnd; j++) {
        const weekStartDate = this.getWeekStartDate(registeredOn, j, userTimeZone);
        const weekEndDate = this.getWeekEndDate(registeredOn, j, userTimeZone);
        const quizzesBetweenDates = this.getQuizzesBetweenDates(quizzes, weekStartDate, weekEndDate, userTimeZone);
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
    const userId = request.user.id as string;
    const { number, isCorrect, isClosed }: Quiz = request.body
    const client = await pool.connect();
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

