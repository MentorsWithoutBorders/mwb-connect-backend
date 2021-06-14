import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import moment from 'moment';
import 'moment-timezone';
import pg from 'pg';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Users } from './users';
import { UsersTimeZones } from './users_timezones';
import User from '../models/user.model';
import Organization from '../models/organization.model';
import Lesson from '../models/lesson.model';
import Subfield from '../models/subfield.model';
import TimeZone from '../models/timezone.model';

const conn: Conn = new Conn();
const pool = conn.pool;
const users: Users = new Users();
const usersTimeZones: UsersTimeZones = new UsersTimeZones();

export class UsersLessons {
  constructor() {
    autoBind(this);
  }

  async getNextLesson(request: Request, response: Response): Promise<void> {
    const userId: string = request.params.id;
    try {
      const isMentor = await this.getIsMentor(userId);
      const userTypeId = isMentor ? 'mentor_id' : 'student_id';
      const timeZone: TimeZone = await usersTimeZones.getUserTimeZone(userId);
      const today = moment.tz(new Date(), timeZone?.name).format(constants.DATE_FORMAT);      
      const getNextLessonQuery = `SELECT ul.id, ul.student_id, ul.mentor_id, ul.subfield_id, ul.date_time, s.name AS subfield_name, ul.meeting_url, ul.is_canceled
        FROM users_lessons ul
        JOIN subfields s
        ON ul.subfield_id = s.id
        WHERE ${userTypeId} = $1 AND ul.date_time::timestamp >= '${today}'
        ORDER BY ul.date_time DESC LIMIT 1`;
      const { rows }: pg.QueryResult = await pool.query(getNextLessonQuery, [userId]);
      const lesson = await this.setLesson(rows[0], isMentor);
      response.status(200).json(lesson);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async setLesson(row: pg.QueryResultRow, isMentor: boolean): Promise<Lesson> {
    let lesson: Lesson = {};
    if (row) {    
      const subfield: Subfield = {
        id: row.subfield_id,
        name: row.subfield_name
      }
      lesson = {
        id: row.id,
        subfield: subfield,
        dateTime: moment(row.date_time).format(constants.DATE_FORMAT),
        meetingUrl: row.meeting_url,
        isCanceled: row.is_canceled
      }
      if (isMentor) {
        const user: User = await users.getUserFromDB(row.student_id);
        const student: User = {
          id: user.id as string,
          name: user.name as string,
          organization: user.organization as Organization
        }
        lesson.student = student;
      } else {
        const user: User = await users.getUserFromDB(row.mentor_id);
        const mentor: User = {
          id: user.id as string,
          name: user.name as string,
          organization: user.organization as Organization
        }        
        lesson.mentor = mentor;
      }
    }
    return lesson;
  }

  async getIsMentor(userId: string): Promise<boolean> {
    const getUserQuery = 'SELECT * FROM users WHERE id = $1';
    const { rows }: pg.QueryResult = await pool.query(getUserQuery, [userId]);
    return rows[0].is_mentor;
  }
  
  async getPreviousLesson(request: Request, response: Response): Promise<void> {
    const userId: string = request.params.id;
    try {
      const isMentor = await this.getIsMentor(userId);
      const userTypeId = isMentor ? 'mentor_id' : 'student_id';
      const timeZone: TimeZone = await usersTimeZones.getUserTimeZone(userId);
      const today = moment.tz(new Date(), timeZone?.name).format(constants.DATE_FORMAT);        
      const getPreviousLessonQuery = `SELECT ul.id, ul.student_id, ul.mentor_id, ul.subfield_id, ul.date_time, s.name AS subfield_name, ul.meeting_url, ul.is_canceled
        FROM users_lessons ul
        JOIN subfields s
        ON ul.subfield_id = s.id
        WHERE ${userTypeId} = $1 AND ul.date_time::timestamp < '${today}'
        ORDER BY ul.date_time DESC LIMIT 1`;
      const { rows }: pg.QueryResult = await pool.query(getPreviousLessonQuery, [userId]);
      const lesson = await this.setLesson(rows[0], isMentor);
      response.status(200).json(lesson);
    } catch (error) {
      response.status(400).send(error);
    }
  }  

  async cancelLesson(request: Request, response: Response): Promise<void> {
    const lessonId: string = request.params.id;
    try {
      const updateLessonQuery = 'UPDATE users_lessons SET is_canceled = true WHERE id = $1';
      await pool.query(updateLessonQuery, [lessonId]);
      response.status(200).send(`Lesson modified with ID: ${lessonId}`);
    } catch (error) {
      response.status(400).send(error);
    }
  }
  
  async setLessonPresenceStudent(request: Request, response: Response): Promise<void> {
    const lessonId: string = request.params.id;
    const { isStudentPresent }: Lesson = request.body
    try {
      const updateLessonQuery = 'UPDATE users_lessons SET is_student_present = $1 WHERE id = $2';
      await pool.query(updateLessonQuery, [isStudentPresent, lessonId]);
      response.status(200).send(`Lesson modified with ID: ${lessonId}`);
    } catch (error) {
      response.status(400).send(error);
    }
  }
  
  async setLessonPresenceMentor(request: Request, response: Response): Promise<void> {
    const lessonId: string = request.params.id;
    const { isMentorPresent }: Lesson = request.body
    try {
      const updateLessonQuery = 'UPDATE users_lessons SET is_mentor_present = $1 WHERE id = $2';
      await pool.query(updateLessonQuery, [isMentorPresent, lessonId]);
      response.status(200).send(`Lesson modified with ID: ${lessonId}`);
    } catch (error) {
      response.status(400).send(error);
    }
  }   
}

