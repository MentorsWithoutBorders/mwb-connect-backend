import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import moment from 'moment';
import pg from 'pg';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Users } from './users';
import { UsersLessons } from './users_lessons';
import { UsersPushNotifications } from './users_push_notifications';
import { UsersSendEmails } from './users_send_emails';
import User from '../models/user.model';
import Subfield from '../models/subfield.model';
import LessonRequest from '../models/lesson_request.model';
import Lesson from '../models/lesson.model';
import Organization from '../models/organization.model';

const conn = new Conn();
const pool = conn.pool;
const users = new Users();
const usersLessons = new UsersLessons();
const usersPushNotifications = new UsersPushNotifications();
const usersSendEmails = new UsersSendEmails();

export class UsersLessonRequests {
  constructor() {
    autoBind(this);
  }

  async addLessonRequest(request: Request, response: Response): Promise<void> {
    const studentId = request.user.id as string;
    try {
      const insertLessonRequestQuery = `INSERT INTO users_lesson_requests (student_id, sent_date_time, is_allowed_last_mentor)
        VALUES ($1, $2, false) RETURNING *`;
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
    const userId = request.user.id as string;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(constants.READ_ONLY_TRANSACTION);
      const isMentor = await this.getIsMentor(userId, client);
      let getLessonRequestQuery = '';
      if (isMentor) {
        getLessonRequestQuery = `SELECT ulr.id, ulr.student_id, ulr.subfield_id, ulr.sent_date_time, ulr.lesson_date_time, s.name AS subfield_name, ulr.is_canceled, ulr.is_rejected, ulr.is_expired, ulr.was_canceled_shown, ulr.was_expired_shown
          FROM users_lesson_requests ulr
          LEFT OUTER JOIN subfields s
            ON ulr.subfield_id = s.id
          WHERE ulr.mentor_id = $1 AND ulr.is_rejected IS DISTINCT FROM true
          ORDER BY ulr.sent_date_time DESC LIMIT 1`;
      } else {
        getLessonRequestQuery = `SELECT ulr.id, ulr.student_id, ulr.subfield_id, ulr.sent_date_time, ulr.lesson_date_time, s.name AS subfield_name, ulr.is_canceled, ulr.is_obsolete
          FROM users_lesson_requests ulr
          LEFT OUTER JOIN subfields s
            ON ulr.subfield_id = s.id
          WHERE ulr.student_id = $1 AND ulr.is_canceled IS DISTINCT FROM true AND ulr.is_obsolete IS DISTINCT FROM true
          ORDER BY ulr.sent_date_time DESC LIMIT 1`;
      }
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
          isExpired: rows[0].is_expired,
          wasCanceledShown: rows[0].was_canceled_shown,
          wasExpiredShown: rows[0].was_expired_shown,
        }
        if (isMentor) {
          const user = await users.getUserFromDB(rows[0].student_id, client);
          const student: User = {
            id: user.id as string,
            name: user.name as string,
            organization: user.organization as Organization
          }
          lessonRequest.student = student;
        } 
      }   
      response.status(200).json(lessonRequest);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async getIsMentor(userId: string, client: pg.PoolClient): Promise<boolean> {
    const getUserQuery = 'SELECT is_mentor FROM users WHERE id = $1';
    const { rows }: pg.QueryResult = await client.query(getUserQuery, [userId]);
    return rows[0].is_mentor;
  }  

  async acceptLessonRequest(request: Request, response: Response): Promise<void> {
    const mentorId = request.user.id as string;
    const lessonRequestId = request.params.id;
    const { meetingUrl, isRecurrent, endRecurrenceDateTime, isRecurrenceDateSelected }: Lesson = request.body
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const getLessonRequestQuery = `SELECT ulr.id, ulr.student_id, ulr.subfield_id, s.name AS subfield_name, ulr.lesson_date_time 
        FROM users_lesson_requests ulr
        JOIN users u
          ON ulr.student_id = u.id
        JOIN subfields s
          ON ulr.subfield_id = s.id
        WHERE ulr.mentor_id = $1 AND ulr.id = $2 AND ulr.is_expired IS DISTINCT FROM true AND ulr.is_canceled IS DISTINCT FROM true`;
      const { rows }: pg.QueryResult = await client.query(getLessonRequestQuery, [mentorId, lessonRequestId]);
      const mentor = await users.getUserFromDB(mentorId, client);
      let lesson: Lesson = {};
      if (rows[0]) {
        const student = await users.getUserFromDB(rows[0].student_id, client);
        const subfield: Subfield = {
          id: rows[0].subfield_id,
          name: rows[0].subfield_name
        };        
        lesson = {
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
        lesson.students = [student];
        await this.addStudentSubfield(student.id as string, subfield.id as string, client);
        await this.deleteLessonRequest(lessonRequestId, client);
      }
      response.status(200).send(lesson);
      await client.query('COMMIT');
      if (Object.keys(lesson).length > 0) {
        lesson.mentor = mentor;
        usersPushNotifications.sendPNLessonRequestAccepted(lesson);
        usersSendEmails.sendEmailLessonRequestAccepted(lesson);
        usersSendEmails.sendEmailLessonScheduled(mentor, lesson, client);
      }
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
    return usersLessons.getNextLessonFromDB(lesson.mentor?.id as string, true, client);
  }

  async addStudent(lessonId: string, studentId: string, client: pg.PoolClient): Promise<void> {
    const nextLesson = await usersLessons.getNextLessonFromDB(studentId, false, client);
    if (Object.keys(nextLesson).length == 0) {
      const insertStudentQuery = `INSERT INTO users_lessons_students (lesson_id, student_id)
        VALUES ($1, $2)`;
      const values = [lessonId, studentId];
      await client.query(insertStudentQuery, values);
    }
  }  

  async addStudentSubfield(studentId: string, subfieldId: string, client: pg.PoolClient): Promise<void> {
    const getSubfieldQuery = 'SELECT user_id FROM users_subfields WHERE user_id = $1';
    const { rows }: pg.QueryResult = await client.query(getSubfieldQuery, [studentId]);
    if (!rows[0]) {
      const insertSubfieldQuery = `INSERT INTO users_subfields (user_id, subfield_id)
        VALUES ($1, $2)`;
      const values = [studentId, subfieldId];
      await client.query(insertSubfieldQuery, values);          
    }
  }

  async deleteLessonRequest(lessonRequestId: string, client: pg.PoolClient): Promise<void> {
    const deleteLessonRequestQuery = 'DELETE FROM users_lesson_requests WHERE id = $1';
    await client.query(deleteLessonRequestQuery, [lessonRequestId]);
  }
  
  async rejectLessonRequest(request: Request, response: Response): Promise<void> {
    const mentorId = request.user.id as string;
    const lessonRequestId = request.params.id;
    try {
      const updateLessonRequestQuery = 'UPDATE users_lesson_requests SET is_rejected = true WHERE mentor_id = $1 AND id = $2';
      await pool.query(updateLessonRequestQuery, [mentorId, lessonRequestId]);
      response.status(200).send(`Lesson request modified with ID: ${lessonRequestId}`);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async cancelLessonRequest(request: Request, response: Response): Promise<void> {
    const studentId = request.user.id as string;
    const lessonRequestId = request.params.id;
    try {
      const updateLessonRequestQuery = 'UPDATE users_lesson_requests SET is_canceled = true WHERE student_id = $1 AND id = $2';
      await pool.query(updateLessonRequestQuery, [studentId, lessonRequestId]);
      response.status(200).send(`Lesson request modified with ID: ${lessonRequestId}`);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async updateLessonRequest(request: Request, response: Response): Promise<void> {
    const mentorId = request.user.id as string;
    const lessonRequestId = request.params.id;
    const { wasCanceledShown, wasExpiredShown }: LessonRequest = request.body;
    try {
      const updateLessonRequestQuery = 'UPDATE users_lesson_requests SET was_canceled_shown = $1, was_expired_shown = $2 WHERE mentor_id = $3 AND id = $4';
      await pool.query(updateLessonRequestQuery, [wasCanceledShown, wasExpiredShown, mentorId, lessonRequestId]);
      response.status(200).send(`Lesson request modified with ID: ${lessonRequestId}`);
    } catch (error) {
      response.status(400).send(error);
    }
  }  
}

