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
import Lesson from '../models/lesson.model';

const conn: Conn = new Conn();
const pool = conn.pool;
const users: Users = new Users();

export class UsersLessons {
  constructor() {
    autoBind(this);
  }

  async getNextLesson(request: Request, response: Response): Promise<void> {
    const userId: string = request.params.id;
    try {
      const isMentor = await this.getIsMentor(userId);
      const userTypeId = isMentor ? 'mentor_id' : 'student_id';
      const getNextLessonQuery = `SELECT ul.id, ul.student_id, ul.mentor_id, ul.date_time, s.name AS subfield, ul.meeting_url, ul.is_canceled
        FROM users_lessons ul
        JOIN subfields s
        ON ul.subfield_id = s.id
        WHERE ${userTypeId} = $1
        ORDER BY ul.date_time DESC LIMIT 1`;
      const { rows }: pg.QueryResult = await pool.query(getNextLessonQuery, [userId]);
      const lesson: Lesson = {
        id: rows[0].id,
        subfield: rows[0].subfield,
        dateTime: moment(rows[0].date_time).format(constants.DATE_FORMAT),
        meetingUrl: rows[0].meeting_url,
        isCanceled: rows[0].is_canceled
      }
      if (isMentor) {
        const student: User = await users.getUserFromDB(rows[0].student_id);
        lesson.student = student.name as string;
        lesson.organization = student.organization?.name as string;
      } else {
        const mentor: User = await users.getUserFromDB(rows[0].mentor_id);
        lesson.mentor = mentor.name as string;
      }
      response.status(200).json(lesson);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async getIsMentor(userId: string): Promise<boolean> {
    const getUserQuery = 'SELECT * FROM users WHERE id = $1';
    const { rows }: pg.QueryResult = await pool.query(getUserQuery, [userId]);
    return rows[0].is_mentor;
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

