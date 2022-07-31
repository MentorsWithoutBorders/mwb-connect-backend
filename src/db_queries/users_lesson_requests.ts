import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import moment from 'moment';
import pg from 'pg';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Helpers } from '../utils/helpers';
import { Users } from './users';
import { UsersAvailableMentors } from './users_available_mentors';
import { UsersLessons } from './users_lessons';
import { UsersPushNotifications } from './users_push_notifications';
import { UsersSendEmails } from './users_send_emails';
import { UsersWhatsAppMessages } from './users_whatsapp_messages';
import { UsersInAppMessages } from './users_in_app_messages';
import User from '../models/user.model';
import Subfield from '../models/subfield.model';
import Organization from '../models/organization.model';
import LessonRequest from '../models/lesson_request.model';
import Lesson from '../models/lesson.model';
import LessonRequestResult from '../models/lesson_request_result_model';
import InAppMessage from '../models/in_app_message';

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();
const users = new Users();
const usersAvailableMentors = new UsersAvailableMentors();
const usersLessons = new UsersLessons();
const usersPushNotifications = new UsersPushNotifications();
const usersSendEmails = new UsersSendEmails();
const usersWhatsAppMessages = new UsersWhatsAppMessages();
const usersInAppMessages = new UsersInAppMessages();

export class UsersLessonRequests {
  constructor() {
    autoBind(this);
  }

  async addLessonRequest(request: Request, response: Response): Promise<void> {
    const studentId = request.user.id as string;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const lessonRequest = await this.addLessonRequestFromDB(studentId, client);
      response.status(200).send(lessonRequest);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async addLessonRequestFromDB(studentId: string, client: pg.PoolClient): Promise<LessonRequest> {
    const insertLessonRequestQuery = `INSERT INTO users_lesson_requests (student_id, sent_date_time)
      VALUES ($1, $2) RETURNING *`;
    const sentDateTime = moment.utc();
    const values = [studentId, sentDateTime];
    const { rows }: pg.QueryResult = await client.query(insertLessonRequestQuery, values);
    const lessonRequest: LessonRequest = {
      id: rows[0].id
    }
    return lessonRequest;
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
          WHERE ulr.mentor_id = $1 
            AND ulr.is_rejected IS DISTINCT FROM true
            AND ulr.is_previous_mentor IS DISTINCT FROM true
          ORDER BY ulr.sent_date_time DESC LIMIT 1`;
      } else {
        getLessonRequestQuery = `SELECT ulr.id, ulr.student_id, ulr.subfield_id, ulr.sent_date_time, ulr.lesson_date_time, s.name AS subfield_name, ulr.is_rejected, ulr.is_canceled
          FROM users_lesson_requests ulr
          LEFT OUTER JOIN subfields s
            ON ulr.subfield_id = s.id
          WHERE ulr.student_id = $1 
            AND ulr.is_canceled IS DISTINCT FROM true 
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
          isRejected: rows[0].is_rejected,
          isCanceled: rows[0].is_canceled,
          isExpired: rows[0].is_expired,
          wasCanceledShown: rows[0].was_canceled_shown,
          wasExpiredShown: rows[0].was_expired_shown
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
  
  async sendCustomLessonRequest(request: Request, response: Response): Promise<void> {
    const studentId = request.user.id as string;
    const { id, field, availabilities }: User = request.body 
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await this.updateStudentGoal(studentId, field?.id as string, client);
      await this.updateStudentField(studentId, field?.id as string, client);
      await users.deleteUserSubfields(studentId, client);
      const subfields = field?.subfields;
      let subfield;
      if (subfields && subfields?.length > 0) {
        subfield = subfields[0];
      }
      await this.insertStudentSubfield(studentId, subfield?.id as string, client);
      let availability;
      if (availabilities) {
        availability = availabilities[0];
        const timeTo = moment(availability.time.from, 'h:ma').add(2, 'h').format('h:ma');
        availability.time.to = timeTo;
      }
      await this.cancelPreviousLessonRequests(studentId, client);
      const mentorId = id as string;
      const availableMentors = await usersAvailableMentors.getAvailableMentorsFromDB(undefined, undefined, client);
      const availableLessonsMentors = await usersAvailableMentors.getAvailableLessonsMentorsFromDB(undefined, undefined, client);
      const student = await users.getUserFromDB(studentId, client);
      const mentor = await users.getUserFromDB(id as string, client);
      const previousLesson = await usersLessons.getPreviousLessonFromDB(studentId, client);
      const isPreviousMentor = previousLesson.mentor?.id === mentorId;
      const lessonRequestResult: LessonRequestResult = {};
      if (this.getIsInAvailableLessonsMentors(mentorId, availableLessonsMentors)) {
        const availableLesson = await usersLessons.getNextLessonFromDB(mentor.id as string, true, client);
        availableLesson.mentor = mentor;
        await this.addStudentToAvailableLesson(student, availableLesson, client);
        lessonRequestResult.id = availableLesson.id;
        lessonRequestResult.isLessonRequest = false;
      } else if (this.getIsInAvailableMentors(mentorId, availableMentors) || isPreviousMentor) {
        let lessonDateTime = moment.utc().add(2, 'd');
        while (lessonDateTime.format('dddd') != availability?.dayOfWeek) {
          lessonDateTime = lessonDateTime.add(1, 'd');
        }
        const hours = moment(availability.time.from, ['h:mma']).format("HH");
        const minutes = moment(availability.time.from, ['h:mma']).format("mm");
        lessonDateTime = lessonDateTime.set('hour', parseInt(hours)).set('minute', parseInt(minutes)).set('second', 0);
        let lessonRequest: LessonRequest = {
          student: student,
          mentor: mentor,
          subfield: subfield,
          lessonDateTime: lessonDateTime.format(constants.DATE_TIME_FORMAT),
          isPreviousMentor: isPreviousMentor
        }        
        lessonRequest = await this.addNewLessonRequest(lessonRequest, client);
        lessonRequestResult.id = lessonRequest.id;
        lessonRequestResult.isLessonRequest = true;
        if (!isPreviousMentor) {
          usersPushNotifications.sendPNLessonRequest(lessonRequest);
          usersSendEmails.sendEmailLessonRequest(lessonRequest, client);
        }
      }
      response.status(200).send(lessonRequestResult);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async updateStudentGoal(studentId: string, fieldId: string, client: pg.PoolClient): Promise<void> {
    const getUserFieldQuery = `SELECT field_id FROM users WHERE id = $1`;
    let { rows }: pg.QueryResult = await client.query(getUserFieldQuery, [studentId]);
    let previousFieldId = '';
    if (rows[0]) {
      previousFieldId = rows[0].field_id;    
    }
    if (fieldId != previousFieldId) {
      const getFieldGoalQuery = `SELECT goal FROM fields_goals WHERE field_id = $1`;
      ({ rows } = await client.query(getFieldGoalQuery, [fieldId]));
      let goalText = '';
      if (rows[0]) {
        goalText = rows[0].goal;    
      }
      const updateStudentFieldQuery = `UPDATE users_goals SET text = $1 WHERE user_id = $2`;
      await client.query(updateStudentFieldQuery, [goalText, studentId]);
    }
  }  
  
  async updateStudentField(studentId: string, fieldId: string, client: pg.PoolClient): Promise<void> {
    const updateStudentFieldQuery = `UPDATE users SET field_id = $1 WHERE id = $2`;
    await client.query(updateStudentFieldQuery, [fieldId, studentId]);
  }
  
  async insertStudentSubfield(studentId: string, subfieldId: string, client: pg.PoolClient): Promise<void> {
    const insertSubfieldQuery = `INSERT INTO users_subfields (user_id, subfield_id)
      VALUES ($1, $2)`;
    await client.query(insertSubfieldQuery, [studentId, subfieldId]); 
  }

  async cancelPreviousLessonRequests(studentId: string, client: pg.PoolClient): Promise<void> {
    const updateLessonRequestsQuery = 'UPDATE users_lesson_requests SET is_canceled = true WHERE student_id = $1';
    await client.query(updateLessonRequestsQuery, [studentId]);    
  }

  getIsInAvailableMentors(mentorId: string, availableMentors: Array<User>): boolean {
    let found = false;
    for (const mentor of availableMentors) {
      if (mentorId == mentor.id) {
        found = true;
        break;
      }
    }
    return found;
  }

  getIsInAvailableLessonsMentors(mentorId: string, availableLessonsMentors: Array<User>): boolean {
    let found = false;
    for (const mentor of availableLessonsMentors) {
      if (mentorId == mentor.id) {
        found = true;
        break;
      }
    }
    return found;
  }  

  async addNewLessonRequest(lessonRequest: LessonRequest, client: pg.PoolClient): Promise<LessonRequest> {
    const insertLessonRequestQuery = `INSERT INTO users_lesson_requests 
      (student_id, mentor_id, subfield_id, lesson_date_time, sent_date_time, is_previous_mentor) 
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;
    const values = [
      lessonRequest.student?.id as string,
      lessonRequest.mentor?.id as string,
      lessonRequest.subfield?.id as string,
      lessonRequest.lessonDateTime as string,
      moment.utc().format(constants.DATE_TIME_FORMAT),
      lessonRequest.isPreviousMentor
    ];
    const { rows }: pg.QueryResult = await client.query(insertLessonRequestQuery, values);
    if (rows[0]) {
      lessonRequest.id = rows[0].id;
    }
    return lessonRequest;
  }  

  async acceptLessonRequest(request: Request, response: Response): Promise<void> {
    const mentorId = request.user.id as string;
    const lessonRequestId = request.params.id;
    const { meetingUrl, endRecurrenceDateTime }: Lesson = request.body
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
          endRecurrenceDateTime: endRecurrenceDateTime
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
        await usersWhatsAppMessages.sendWMLessonRequestAccepted(lesson);
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
    const insertLessonQuery = `INSERT INTO users_lessons (mentor_id, subfield_id, date_time, meeting_url, end_recurrence_date_time)
      VALUES ($1, $2, $3, $4, $5) RETURNING *`;
    const dateTime = moment.utc(lesson.dateTime);
    const isLessonRecurrent = helpers.isLessonRecurrent(lesson.dateTime as string, lesson.endRecurrenceDateTime);
    const endRecurrence = isLessonRecurrent && lesson.endRecurrenceDateTime != undefined ? moment.utc(lesson.endRecurrenceDateTime) : null;
    const values = [lesson.mentor?.id, lesson.subfield?.id, dateTime, lesson.meetingUrl, endRecurrence];
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
    const { text }: InAppMessage = request.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const getLessonRequestQuery = 'SELECT student_id, is_canceled FROM users_lesson_requests WHERE id = $1';
      const { rows }: pg.QueryResult = await client.query(getLessonRequestQuery, [lessonRequestId]);
      if (rows && rows[0] && !rows[0].is_canceled) {
        const studentId = rows[0].student_id;
        const updateLessonRequestQuery = 'UPDATE users_lesson_requests SET is_rejected = true WHERE mentor_id = $1 AND id = $2';
        await client.query(updateLessonRequestQuery, [mentorId, lessonRequestId]);
        await this.cancelLessons(mentorId, studentId, client);
        const student = await users.getUserFromDB(studentId, client);
        const mentor = await users.getUserFromDB(mentorId, client);
        const lessonRequest: LessonRequest = {
          mentor: mentor,
          student: student
        }        
        usersPushNotifications.sendPNLessonRequestRejected(lessonRequest, text);
        usersSendEmails.sendEmailLessonRequestRejected(lessonRequest, text);
        await usersWhatsAppMessages.sendWMLessonRequestRejected(lessonRequest, text);
        usersInAppMessages.addUIAMLessonRequestRejected(lessonRequest, text);
      }
      response.status(200).send(`Lesson request modified with ID: ${lessonRequestId}`);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async cancelLessons(mentorId: string, studentId: string, client: pg.PoolClient): Promise<void> {
    const getStudentLessonsQuery = `SELECT lesson_id FROM users_lessons_students WHERE student_id = $1`;
    let { rows }: pg.QueryResult = await client.query(getStudentLessonsQuery, [studentId]);
    const studentLessonsIds: Array<string> = [];
    for (const row of rows) {
      studentLessonsIds.push(row.lesson_id);
    }
    const getMentorLessonsQuery = `SELECT id FROM users_lessons WHERE mentor_id = $1`;
    ({ rows } = await client.query(getMentorLessonsQuery, [mentorId]));
    const mentorLessonsIds: Array<string> = [];
    for (const row of rows) {
      mentorLessonsIds.push(row.id);
    }   
    const commonLessonsIds = studentLessonsIds.filter(studentLessonId => mentorLessonsIds.includes(studentLessonId));
    let lessonsIds = '';
    for (const lessonId of commonLessonsIds) {
      lessonsIds = lessonsIds + `id = '${lessonId}' OR `;
    }
    if (lessonsIds) {
      lessonsIds = lessonsIds.substring(0, lessonsIds.length - 4);
      lessonsIds = ` AND (${lessonsIds})`;
      const updateLessonsQuery = `UPDATE users_lessons SET is_canceled = true 
        WHERE mentor_id = $1
        ${lessonsIds}`;
      await client.query(updateLessonsQuery, [mentorId]);      
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
    const userId = request.user.id as string;
    const lessonRequestId = request.params.id;
    const { wasCanceledShown, wasExpiredShown }: LessonRequest = request.body;
    try {
      const updateLessonRequestQuery = `UPDATE users_lesson_requests SET was_canceled_shown = $1, was_expired_shown = $2
        WHERE (mentor_id = $3 OR student_id = $3)
          AND id = $4`;
      await pool.query(updateLessonRequestQuery, [wasCanceledShown, wasExpiredShown, userId, lessonRequestId]);
      response.status(200).send(`Lesson request modified with ID: ${lessonRequestId}`);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  addAvailableLesson(lessonStudentsNumber: number, maxStudents: number, availableLesson: Lesson, availableLessons: Array<Lesson>): Array<Lesson> {
    if (lessonStudentsNumber < maxStudents) {
      availableLessons.push(availableLesson);
    }
    return availableLessons;
  }

  async addStudentToAvailableLesson(student: User, availableLesson: Lesson, client: pg.PoolClient): Promise<void> {
    const lessonId = availableLesson.id as string;
    await this.addStudent(lessonId, student.id as string, client);
    await this.addStudentSubfield(student.id as string, availableLesson.subfield?.id as string, client);    
    const mentor = await users.getUserFromDB(availableLesson.mentor?.id as string, client);
    availableLesson.mentor = mentor;
    const mentorSubfields = mentor.field?.subfields;
    if (mentorSubfields != null && mentorSubfields.length > 0) {
      for (const mentorSubfield of mentorSubfields) {
        if (availableLesson.subfield?.id == mentorSubfield.id) {
          availableLesson.subfield = mentorSubfield;
          break;
        }
      }
    }
    usersPushNotifications.sendPNStudentAddedToLesson(student, availableLesson);
    usersSendEmails.sendEmailStudentAddedToLesson(student, availableLesson);
  }  
}

