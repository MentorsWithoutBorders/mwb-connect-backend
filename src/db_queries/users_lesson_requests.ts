import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import moment from 'moment';
import pg from 'pg';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Users } from './users';
import { UsersLessons } from './users_lessons';
import User from '../models/user.model';
import Subfield from '../models/subfield.model';
import LessonRequest from '../models/lesson_request.model';
import Lesson from '../models/lesson.model';
import Organization from '../models/organization.model';

const conn: Conn = new Conn();
const pool = conn.pool;
const users: Users = new Users();
const usersLessons: UsersLessons = new UsersLessons();

export class UsersLessonRequests {
  constructor() {
    autoBind(this);
  }

  
  async addLessonRequest(request: Request, response: Response): Promise<void> {
    const studentId: string = request.user.id as string;
    try {
      const insertLessonRequestQuery = `INSERT INTO users_lesson_requests (student_id, sent_date_time)
        VALUES ($1, $2) RETURNING *`;
      const sentDateTime = moment.utc();
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
    const userId: string = request.user.id as string;
    const client: pg.PoolClient = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(constants.READ_ONLY_TRANSACTION);
      const isMentor = await this.getIsMentor(userId);
      const userTypeId = isMentor ? 'ulr.mentor_id' : 'ulr.student_id';
      const getLessonRequestQuery = `SELECT ulr.id, ulr.student_id, ulr.subfield_id, ulr.sent_date_time, ulr.lesson_date_time, s.name AS subfield_name, ulr.is_canceled
        FROM users_lesson_requests ulr
        LEFT OUTER JOIN subfields s
        ON ulr.subfield_id = s.id
        WHERE ${userTypeId} = $1
        ORDER BY ulr.sent_date_time DESC LIMIT 1`;
      const { rows }: pg.QueryResult = await client.query(getLessonRequestQuery, [userId]);
      let lessonRequest: LessonRequest = {};
      if (rows[0]) {
        const subfield: Subfield = {
          id: rows[0].subfield_id,
          name: rows[0].subfield_name
        }
        let lessonDateTime;
        if (rows[0].lesson_date_time != null) {
          lessonDateTime = moment.utc(rows[0].lesson_date_time).format(constants.DATE_TIME_FORMAT);
        }
        lessonRequest = {
          id: rows[0].id,
          subfield: subfield,
          sentDateTime: moment.utc(rows[0].sent_date_time).format(constants.DATE_TIME_FORMAT),
          lessonDateTime: lessonDateTime as string,
          isCanceled: rows[0].is_canceled,
        }
        if (isMentor) {
          const user: User = await users.getUserFromDB(rows[0].student_id, client);
          const student: User = {
            id: user.id as string,
            name: user.name as string,
            organization: user.organization as Organization
          }
          lessonRequest.student = student;
        } 
      }   
      response.status(200).json(lessonRequest);
      await client.query("COMMIT");
    } catch (error) {
      response.status(500).send(error);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  }

  async getIsMentor(userId: string): Promise<boolean> {
    const getUserQuery = 'SELECT * FROM users WHERE id = $1';
    const { rows }: pg.QueryResult = await pool.query(getUserQuery, [userId]);
    return rows[0].is_mentor;
  }  

  async acceptLessonRequest(request: Request, response: Response): Promise<void> {
    const mentorId: string = request.user.id as string;
    const lessonRequestId: string = request.params.id;
    const { meetingUrl, isRecurrent, endRecurrenceDateTime, isRecurrenceDateSelected }: Lesson = request.body
    const getLessonRequestQuery = 'SELECT * FROM users_lesson_requests WHERE mentor_id = $1 AND id = $2';
    const client: pg.PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows }: pg.QueryResult = await client.query(getLessonRequestQuery, [mentorId, lessonRequestId]);
      const student: User = {
        id: rows[0].student_id
      };
      const mentor: User = {
        id: mentorId
      };
      const subfield: Subfield = {
        id: rows[0].subfield_id
      };        
      let lesson: Lesson = {
        id: rows[0].id,
        students: [student],
        mentor: mentor,
        subfield: subfield,
        dateTime: rows[0].lesson_date_time,
        meetingUrl: meetingUrl,
        isRecurrent: isRecurrent,
        endRecurrenceDateTime: endRecurrenceDateTime,
        isRecurrenceDateSelected: isRecurrenceDateSelected
      }
      lesson = await this.addLesson(lesson, client);
      await this.addStudentSubfield(student.id as string, subfield.id as string, client);
      await this.deleteLessonRequest(mentorId, lessonRequestId, client);
      response.status(200).send(lesson);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }
  
  async addLesson(lesson: Lesson, client: pg.PoolClient): Promise<Lesson> {
    const insertLessonQuery = `INSERT INTO users_lessons (mentor_id, subfield_id, date_time, meeting_url, is_recurrent, end_recurrence_date_time, is_recurrence_date_selected)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`;
    const dateTime = moment.utc(lesson.dateTime);
    const endRecurrence = lesson.isRecurrent && lesson.endRecurrenceDateTime != undefined ? moment.utc(lesson.endRecurrenceDateTime) : null;
    const values = [lesson.mentor?.id, lesson.subfield?.id, dateTime, lesson.meetingUrl, lesson.isRecurrent, endRecurrence, lesson.isRecurrenceDateSelected];
    const { rows }: pg.QueryResult = await client.query(insertLessonQuery, values);
    const addedLesson = {
      id: rows[0].id
    }
    let student: User = {};
    if (lesson.students != null) {
      student = lesson.students[0];
    }
    await this.addStudent(addedLesson.id as string, student.id as string, client);
    return usersLessons.getNextLessonFromDB(lesson.mentor?.id as string, client);
  }

  async addStudent(lessonId: string, studentId: string, client: pg.PoolClient): Promise<void> {
    const insertStudentQuery = `INSERT INTO users_lessons_students (lesson_id, student_id)
      VALUES ($1, $2)`;
    const values = [lessonId, studentId];
    await client.query(insertStudentQuery, values);          
  }  

  async addStudentSubfield(studentId: string, subfieldId: string, client: pg.PoolClient): Promise<void> {
    const getSubfieldQuery = 'SELECT * FROM users_subfields WHERE user_id = $1';
    const { rows }: pg.QueryResult = await client.query(getSubfieldQuery, [studentId]);
    if (!rows[0]) {
      const insertSubfieldQuery = `INSERT INTO users_subfields (user_id, subfield_id)
        VALUES ($1, $2)`;
      const values = [studentId, subfieldId];
      await client.query(insertSubfieldQuery, values);          
    }
  }

  async deleteLessonRequest(mentorId: string, lessonId: string, client: pg.PoolClient): Promise<void> {
    const deleteLessonRequestQuery = 'DELETE FROM users_lesson_requests WHERE mentor_id = $1 AND id = $2';
    await client.query(deleteLessonRequestQuery, [mentorId, lessonId]);
  }
  
  async rejectLessonRequest(request: Request, response: Response): Promise<void> {
    const mentorId: string = request.user.id as string;
    const lessonRequestId: string = request.params.id;
    try {
      const updateLessonRequestQuery = 'UPDATE users_lesson_requests SET is_rejected = true WHERE mentor_id = $1 AND id = $2';
      await pool.query(updateLessonRequestQuery, [mentorId, lessonRequestId]);
      response.status(200).send(`Lesson request modified with ID: ${lessonRequestId}`);
    } catch (error) {
      response.status(400).send(error);
    }
  }
  
  async cancelLessonRequest(request: Request, response: Response): Promise<void> {
    const studentId: string = request.user.id as string;
    const lessonRequestId: string = request.params.id;
    try {
      const updateLessonRequestQuery = 'UPDATE users_lesson_requests SET is_canceled = true WHERE student_id = $1 AND id = $2';
      await pool.query(updateLessonRequestQuery, [studentId, lessonRequestId]);
      response.status(200).send(`Lesson request modified with ID: ${lessonRequestId}`);
    } catch (error) {
      response.status(400).send(error);
    }
  }   
}

