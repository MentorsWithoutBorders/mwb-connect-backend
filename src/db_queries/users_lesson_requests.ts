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
import Subfield from '../models/subfield.model';
import LessonRequest from '../models/lesson_request.model';
import Lesson from '../models/lesson.model';
import TimeZone from '../models/timezone.model';
import Organization from '../models/organization.model';

const conn: Conn = new Conn();
const pool = conn.pool;
const users: Users = new Users();
const usersTimeZones: UsersTimeZones = new UsersTimeZones();

export class UsersLessonRequests {
  constructor() {
    autoBind(this);
  }

  async addLessonRequest(request: Request, response: Response): Promise<void> {
    const studentId: string = request.params.id;
    try {
      const insertLessonRequestQuery = `INSERT INTO users_lesson_requests (student_id, sent_date_time)
        VALUES ($1, $2) RETURNING *`;
      const timeZone: TimeZone = await usersTimeZones.getUserTimeZone(studentId);
      const sentDateTime = moment.tz(new Date(), timeZone?.name).format(constants.DATE_FORMAT);
      const values = [studentId, sentDateTime];
      const { rows }: pg.QueryResult = await pool.query(insertLessonRequestQuery, values);
      const lessonRequest: LessonRequest = {
        id: rows[0].id
      }
      response.status(200).send(lessonRequest);
    } catch (error) {
      response.status(400).send(error);
    }
  }
  
  async getLessonRequest(request: Request, response: Response): Promise<void> {
    const userId: string = request.params.id;
    try {
      const isMentor = await this.getIsMentor(userId);
      const userTypeId = isMentor ? 'mentor_id' : 'student_id';
      const getLessonRequestQuery = `SELECT ulr.id, ulr.student_id, ulr.subfield_id, ulr.sent_date_time, s.name AS subfield_name, ulr.is_canceled
        FROM users_lesson_requests ulr
        LEFT OUTER JOIN subfields s
        ON ulr.subfield_id = s.id
        WHERE ${userTypeId} = $1
        ORDER BY ulr.sent_date_time DESC LIMIT 1`;
      const { rows }: pg.QueryResult = await pool.query(getLessonRequestQuery, [userId]);
      let lessonRequest: LessonRequest = {};
      if (rows[0]) {
        const subfield: Subfield = {
          id: rows[0].subfield_id,
          name: rows[0].subfield_name
        }
        lessonRequest = {
          id: rows[0].id,
          subfield: subfield,
          sentDateTime: moment(rows[0].sent_date_time).format(constants.DATE_FORMAT),
          isCanceled: rows[0].is_canceled,
        }
        if (isMentor) {
          const user: User = await users.getUserFromDB(rows[0].student_id);
          const student: User = {
            id: user.id as string,
            name: user.name as string,
            organization: user.organization as Organization
          }
          lessonRequest.student = student;
        } 
      }   
      response.status(200).json(lessonRequest);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async getIsMentor(userId: string): Promise<boolean> {
    const getUserQuery = 'SELECT * FROM users WHERE id = $1';
    const { rows }: pg.QueryResult = await pool.query(getUserQuery, [userId]);
    return rows[0].is_mentor;
  }  

  async acceptLessonRequest(request: Request, response: Response): Promise<void> {
    const lessonRequestId: string = request.params.id;
    const { meetingUrl }: Lesson = request.body
    try {
      const getLessonRequestQuery = 'SELECT * FROM users_lesson_requests WHERE id = $1';
      const { rows }: pg.QueryResult = await pool.query(getLessonRequestQuery, [lessonRequestId]);
      const studentId = rows[0].student_id;
      const mentorId = rows[0].mentor_id;
      const subfieldId = rows[0].subfield_id;
      const lessonDateTime = rows[0].lesson_date_time;
      const lesson = await this.addLesson(studentId, mentorId, subfieldId, lessonDateTime, meetingUrl as string);
      await this.addStudentSubfield(studentId, subfieldId);
      await this.deleteLessonRequest(lessonRequestId);
      response.status(200).send(lesson);
    } catch (error) {
      response.status(400).send(error);
    }
  }
  
  async addLesson(studentId: string, mentorId: string, subfieldId: string, lessonDateTime: string, meetingUrl: string): Promise<Lesson> {
    const insertLessonQuery = `INSERT INTO users_lessons (student_id, mentor_id, subfield_id, date_time, meeting_url)
      VALUES ($1, $2, $3, $4, $5) RETURNING *`;
    const timeZone: TimeZone = await usersTimeZones.getUserTimeZone(mentorId);
    const dateTime = moment.tz(lessonDateTime, timeZone?.name).format(constants.DATE_FORMAT);
    const values = [studentId, mentorId, subfieldId, dateTime, meetingUrl];
    const { rows }: pg.QueryResult = await pool.query(insertLessonQuery, values);
    return {
      id: rows[0].id
    } 
  }

  async addStudentSubfield(studentId: string, subfieldId: string): Promise<void> {
    const getSubfieldQuery = 'SELECT * FROM users_subfields WHERE id = $1';
    const { rows }: pg.QueryResult = await pool.query(getSubfieldQuery, [studentId]);
    if (!rows[0]) {
      const insertSubfieldQuery = `INSERT INTO users_subfields (user_id, subfield_id)
        VALUES ($1, $2)`;
      const values = [studentId, subfieldId];
      await pool.query(insertSubfieldQuery, values);          
    }
  }

  async deleteLessonRequest(id: string): Promise<void> {
    const deleteLessonRequestQuery = 'DELETE FROM users_lesson_requests WHERE id = $1';
    await pool.query(deleteLessonRequestQuery, [id]);
  }
  
  async rejectLessonRequest(request: Request, response: Response): Promise<void> {
    const lessonRequestId: string = request.params.id;
    try {
      const updateLessonRequestQuery = 'UPDATE users_lesson_requests SET is_rejected = true WHERE id = $1';
      await pool.query(updateLessonRequestQuery, [lessonRequestId]);
      response.status(200).send(`Lesson request modified with ID: ${lessonRequestId}`);
    } catch (error) {
      response.status(400).send(error);
    }
  }
  
  async cancelLessonRequest(request: Request, response: Response): Promise<void> {
    const lessonRequestId: string = request.params.id;
    try {
      const updateLessonRequestQuery = 'UPDATE users_lesson_requests SET is_canceled = true WHERE id = $1';
      await pool.query(updateLessonRequestQuery, [lessonRequestId]);
      response.status(200).send(`Lesson request modified with ID: ${lessonRequestId}`);
    } catch (error) {
      response.status(400).send(error);
    }
  }   
}

