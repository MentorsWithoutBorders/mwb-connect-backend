import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import moment from 'moment';
import { Conn } from '../db/conn';
import { Users } from './users';
import { QuizzesSettings } from './quizzes_settings';
import { constants } from '../utils/constants';
import Quiz from '../models/quiz.model';

const conn: Conn = new Conn();
const pool = conn.pool;
const users: Users = new Users();
const quizzesSettings: QuizzesSettings = new QuizzesSettings();

export class UsersQuizzes {
  constructor() {
    autoBind(this);
  }

  // works well - no transaction
  async getQuizNumber(request: Request, response: Response): Promise<void> {
    const userId: string = request.user.id as string;
    try {
      const quizSettings = await quizzesSettings.getQuizzesSettingsFromDB();
      const user = await users.getUserFromDB(userId);
      const registeredOn = moment.utc(user.registeredOn).startOf('day');
      const today = moment.utc().startOf('day');
      const weekNumber = today.diff(registeredOn, 'weeks');
      const weekStartDate = this.getWeekStartDate(registeredOn, weekNumber);
      const weekEndDate = this.getWeekEndDate(registeredOn, weekNumber);      
      let quizzes = await this.getQuizzes(userId);
      let quizNumber = 0;
      if (user.isMentor) {
        const quizStartNumber = this.getQuizStartNumber(weekNumber, quizSettings.mentorWeeklyCount);
        const quizEndNumber = this.getQuizEndNumber(weekNumber, quizSettings.mentorWeeklyCount);
        quizzes = this.getQuizzesBetweenDates(quizzes, weekStartDate, weekEndDate); 
        quizNumber = this.calculateQuizNumber(quizzes, quizStartNumber, quizEndNumber);
      } else {
        if (weekNumber <= constants.STUDENT_MAX_QUIZZES_SETS + constants.STUDENT_MAX_QUIZZES_SETS / 2 + 1) {
          const quizzesSetNumber = this.getQuizzesSetNumber(quizzes, registeredOn, quizSettings.studentWeeklyCount);
          const quizStartNumber = this.getQuizStartNumber(quizzesSetNumber, quizSettings.studentWeeklyCount);
          const quizEndNumber = this.getQuizEndNumber(quizzesSetNumber, quizSettings.studentWeeklyCount);
          quizzes = this.getQuizzesBetweenDates(quizzes, weekStartDate, weekEndDate); 
          quizNumber = this.calculateQuizNumber(quizzes, quizStartNumber, quizEndNumber);
        } else {
          const quizStartNumber = this.getQuizzesRemainingStartNumber(quizzes, registeredOn);
          quizNumber = this.calculateQuizNumber(quizzes, quizStartNumber, quizSettings.studentWeeklyCount * 4);
        }
      }
      response.status(200).json(quizNumber);
    } catch (error) {
      response.status(400).send(error);
    } 
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
    return moment.utc(registeredOn).endOf('day').add((weekNumber + 1) * 7, 'days');
  }  

  getQuizStartNumber(weekNumber: number, weeklyCount: number): number {
    return weekNumber * weeklyCount + 1;
  }

  getQuizEndNumber(weekNumber: number, weeklyCount: number): number {
    return weekNumber * weeklyCount + weeklyCount;  
  }

  async getQuizzes(userId: string): Promise<Array<Quiz>> {
    const getQuizzesQuery = `SELECT * FROM users_quizzes 
      WHERE user_id = $1
      ORDER BY date_time DESC`;
    const { rows } = await pool.query(getQuizzesQuery, [userId]);
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

  calculateQuizNumber(quizzes: Array<Quiz>, quizStartNumber: number, quizEndNumber: number): number {
    let quizNumber = 0;
    const weekQuizzesSolved = this.getWeekQuizzesSolved(quizzes, quizStartNumber, quizEndNumber);
    if (weekQuizzesSolved < quizEndNumber - quizStartNumber + 1) {
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

  // works well - no transaction
  async addQuiz(request: Request, response: Response): Promise<void> {
    const userId: string = request.user.id as string;
    const { number, isCorrect, isClosed }: Quiz = request.body
    try {
      const insertQuizQuery = `INSERT INTO users_quizzes (user_id, number, is_correct, is_closed, date_time)
        VALUES ($1, $2, $3, $4, $5) RETURNING *`;
      const dateTime = moment.utc();
      const values = [userId, number, isCorrect, isClosed, dateTime];
      await pool.query(insertQuizQuery, values);
      response.status(200).send('Quiz has been added');
    } catch (error) {
      response.status(400).send(error);
    }
  }  
}

