import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import moment from 'moment';
import pg from 'pg';
import { Client } from 'whatsapp-web.js';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Helpers } from '../utils/helpers';
import { Users } from './users';
import { UsersSkills } from './users_skills';
import { Skills } from './skills';
import { UsersPushNotifications } from './users_push_notifications';
import { UsersSendEmails } from './users_send_emails';
import { UsersWhatsAppMessages } from './users_whatsapp_messages';
import User from '../models/user.model';
import Field from '../models/field.model';
import Subfield from '../models/subfield.model';
import Lesson from '../models/lesson.model';
import LessonNote from '../models/lesson_note.model';
import GuideTutorial from '../models/guide_tutorial.model';
import Skill from '../models/skill.model';
import GuideRecommendation from '../models/guide_recommendation.model';
import Ids from '../models/ids.model';

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();
const users = new Users();
const usersSkills = new UsersSkills();
const skillsQueries = new Skills();
const usersPushNotifications = new UsersPushNotifications();
const usersSendEmails = new UsersSendEmails();
const usersWhatsAppMessages = new UsersWhatsAppMessages();

export class UsersLessons {
  constructor() {
    autoBind(this);
  }
 
  async getNextLesson(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const isMentor = await this.getIsMentor(userId, client);
      let shouldStop = false;
      let lesson: Lesson = {};
      if (!isMentor) {
        shouldStop = await this.getShouldStop(userId, client);
        if (shouldStop) {
          lesson = {
            shouldStop: true
          }
        } else {
          lesson = await this.getNextLessonFromDB(userId, isMentor, client);
        }
      } else {
        lesson = await this.getNextLessonFromDB(userId, isMentor, client);
      }
      response.status(200).json(lesson);
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
  
  async getShouldStop(userId: string, client: pg.PoolClient): Promise<boolean> {
    const getShouldStopQuery = 'SELECT id FROM users_lessons_stopped WHERE student_id = $1';
    const { rows }: pg.QueryResult = await client.query(getShouldStopQuery, [userId]);
    return rows[0] ? true : false;
  }   

  async getNextLessonFromDB(userId: string, isMentor: boolean, client: pg.PoolClient): Promise<Lesson> {
    let getNextLessonQuery = '';
    if (isMentor) {
      getNextLessonQuery = `SELECT ul.id, ul.mentor_id, ul.subfield_id, ul.date_time, s.name AS subfield_name, ul.meeting_url, ul.end_recurrence_date_time, ul.is_canceled
        FROM users_lessons ul
        JOIN subfields s
          ON ul.subfield_id = s.id
        WHERE ul.mentor_id = $1 AND ul.is_canceled IS DISTINCT FROM true
        ORDER BY ul.date_time DESC LIMIT 1`;
    } else {
      getNextLessonQuery = `SELECT ul.id, ul.mentor_id, ul.subfield_id, ul.date_time, s.name AS subfield_name, ul.meeting_url, ul.end_recurrence_date_time, ul.is_canceled
        FROM users_lessons ul
        JOIN users_lessons_students uls
          ON ul.id = uls.lesson_id        
        JOIN subfields s
          ON ul.subfield_id = s.id
        WHERE uls.student_id = $1 AND ul.is_canceled IS DISTINCT FROM true AND uls.is_canceled IS DISTINCT FROM true
        ORDER BY ul.date_time DESC LIMIT 1`;      
    }
    const { rows }: pg.QueryResult = await client.query(getNextLessonQuery, [userId]);
    let lessonRow = rows[0];
    if (lessonRow) {
      const lesson: Lesson = {
        id: lessonRow.id,
        dateTime: moment.utc(lessonRow.date_time).format(constants.DATE_TIME_FORMAT)
      }
      if (lessonRow.end_recurrence_date_time != null) {
        lesson.endRecurrenceDateTime = moment.utc(lessonRow.end_recurrence_date_time).format(constants.DATE_TIME_FORMAT)
      }
      const lessonDateTime = await this.getNextLessonDateTime(lesson, userId, isMentor, client);
      if (lessonDateTime == undefined) {
        lessonRow = null;
      } else {
        lessonRow.date_time = lessonDateTime;
      }
    }
    return this.setLesson(lessonRow, isMentor, client);
  }

  async getNextLessonDateTime(lesson: Lesson, userId: string, isMentor: boolean, client: pg.PoolClient): Promise<string | undefined> {
    const endRecurrenceDateTime = moment.utc(lesson.endRecurrenceDateTime);
    const lessonDateTime = moment.utc(lesson.dateTime);
    const isLessonRecurrent = helpers.isLessonRecurrent(lesson.dateTime as string, lesson.endRecurrenceDateTime);
    if (isLessonRecurrent) {
      return this.getNextLessonRecurrentDateTime(lesson, userId, isMentor, endRecurrenceDateTime, lessonDateTime, client);
    } else {
      return this.getNextLessonSingleDateTime(lesson, userId, isMentor, lessonDateTime, client);
    }
  }

  async getNextLessonRecurrentDateTime(lesson: Lesson, userId: string, isMentor: boolean, endRecurrenceDateTime: moment.Moment, lessonDateTime: moment.Moment, client: pg.PoolClient): Promise<string | undefined> {
    let now = moment.utc();
    let endRecurrence = endRecurrenceDateTime.clone();
    if (isMentor) {
      now = now.subtract(3, 'h');
      endRecurrence = endRecurrence.add(3, 'h');
    } else {
      now = now.subtract(2, 'h');
      endRecurrence = endRecurrence.add(2, 'h');      
    }
    if (endRecurrenceDateTime.isBefore(now)) {
      return undefined;
    } else {
      while (lessonDateTime.isBefore(now)) {
        lessonDateTime = lessonDateTime.add(7, 'd');
      }
      const nextValidLessonDateTime = await this.getNextValidLessonDateTime(lesson, userId, lessonDateTime, client);
      if (nextValidLessonDateTime.isAfter(endRecurrence) || nextValidLessonDateTime.isBefore(now)) {
        return undefined;
      } else {
        return moment.utc(nextValidLessonDateTime).format(constants.DATE_TIME_FORMAT);
      }
    }
  }

  async getNextLessonSingleDateTime(lesson: Lesson, userId: string, isMentor: boolean, lessonDateTime: moment.Moment, client: pg.PoolClient): Promise<string | undefined> {
    let now = moment.utc();
    if (isMentor) {
      now = now.subtract(3, 'h');
    } else {
      now = now.subtract(2, 'h');      
    }
    if (lessonDateTime.isBefore(now)) {
      return undefined;
    } else {
      // Check if the single lesson has been canceled
      const nextValidLessonDateTime = await this.getNextValidLessonDateTime(lesson, userId, lessonDateTime, client);
      if (moment.utc(nextValidLessonDateTime).format(constants.DATE_TIME_FORMAT) != moment.utc(lessonDateTime).format(constants.DATE_TIME_FORMAT)) {
        return undefined;
      } else {
        return moment.utc(lessonDateTime).format(constants.DATE_TIME_FORMAT);
      }
    }    
  }

  async getNextValidLessonDateTime(lesson: Lesson, userId: string, lessonDateTime: moment.Moment, client: pg.PoolClient): Promise<moment.Moment> {
    let updatedLessonDateTime = lessonDateTime.clone();
    const lessonCanceledDateTimes = await this.getLessonCanceledDateTimes(userId, lesson.id as string, client);
    lessonCanceledDateTimes.forEach(function (dateTime) {
      if (moment.utc(dateTime).isSame(moment.utc(updatedLessonDateTime))) {
        updatedLessonDateTime = updatedLessonDateTime.add(7, 'd');
      } 
    });
    return updatedLessonDateTime;
  }

  async getLessonCanceledDateTimes(userId: string, lessonId: string, client: pg.PoolClient): Promise<Array<string>> {
    const getLessonCanceledDateTimesQuery = `SELECT lesson_date_time
      FROM users_lessons_canceled
      WHERE user_id = $1 AND lesson_id = $2`;
    const values = [userId, lessonId];
    const { rows }: pg.QueryResult = await client.query(getLessonCanceledDateTimesQuery, values);
    let lessonCanceledDateTimes: Array<string> = [];
    rows.forEach(function (row) {
      lessonCanceledDateTimes.push(moment.utc(row.lesson_date_time).format(constants.DATE_TIME_FORMAT));
    });
    lessonCanceledDateTimes = lessonCanceledDateTimes.sort((d1, d2) => {
      if (moment.utc(d1).isAfter(moment.utc(d2))) {
        return 1;
      }
      if (moment.utc(d1).isBefore(moment.utc(d2))) {
        return -1;
      }
      return 0;
    });
    return lessonCanceledDateTimes;
  }

  async getLessonStudents(lesson: Lesson, shouldAddCanceled: boolean, client: pg.PoolClient): Promise<Array<User>> {
    const getLessonStudentsQuery = `SELECT student_id
      FROM users_lessons_students
      WHERE lesson_id = $1`;
    const { rows }: pg.QueryResult = await client.query(getLessonStudentsQuery, [lesson.id]);
    const students: Array<User> = [];
    for (const studentRow of rows) {
      const student = await users.getUserFromDB(studentRow.student_id, client);
      let shouldAddStudent = true;
      if (lesson.dateTime && !shouldAddCanceled) {
        const lessonCanceledDateTimes = await this.getLessonCanceledDateTimes(student.id as string, lesson.id as string, client);
        if (lessonCanceledDateTimes.includes(lesson.dateTime)) {
          shouldAddStudent = false;
        }
      }
      if (shouldAddStudent) {
        students.push(student);
      }
    }  
    return students;  
  }

  async setLesson(lessonRow: pg.QueryResultRow, isMentor: boolean, client: pg.PoolClient): Promise<Lesson> {
    let lesson: Lesson = {};
    if (lessonRow) {    
      const subfield: Subfield = {
        id: lessonRow.subfield_id,
        name: lessonRow.subfield_name
      }
      lesson = {
        id: lessonRow.id,
        subfield: subfield,
        dateTime: moment.utc(lessonRow.date_time).format(constants.DATE_TIME_FORMAT),
        meetingUrl: lessonRow.meeting_url,
        isCanceled: lessonRow.is_canceled
      }
      if (lessonRow.end_recurrence_date_time != null) {
        lesson.endRecurrenceDateTime = moment.utc(lessonRow.end_recurrence_date_time).format(constants.DATE_TIME_FORMAT)
      }
      if (isMentor) {
        lesson.students = await this.getLessonStudents(lesson, false,client);
      } else {
        const user = await users.getUserFromDB(lessonRow.mentor_id, client);
        const mentor: User = {
          id: user.id as string,
          name: user.name as string,
          field: user.field,
          organization: user.organization
        }
        lesson.mentor = mentor;
      }
    }
    return lesson;
  }
  
  async getPreviousLesson(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(constants.READ_ONLY_TRANSACTION);
      const lesson: Lesson = await this.getPreviousLessonFromDB(userId, client);
      response.status(200).json(lesson);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async getPreviousLessonFromDB(userId: string, client: pg.PoolClient): Promise<Lesson> {
    const isMentor = await this.getIsMentor(userId, client);
    const now = moment.utc();
    let getPreviousLessonQuery = '';
    if (isMentor) {
      getPreviousLessonQuery = `SELECT ul.id, ul.mentor_id, ul.subfield_id, ul.date_time, s.name AS subfield_name, ul.meeting_url, ul.end_recurrence_date_time, ul.is_canceled
        FROM users_lessons ul
        JOIN subfields s
          ON ul.subfield_id = s.id
        WHERE ul.mentor_id = $1 AND ul.date_time::timestamp < $2
        ORDER BY ul.date_time DESC LIMIT 1`;
    } else {
      getPreviousLessonQuery = `SELECT ul.id, ul.mentor_id, ul.subfield_id, ul.date_time, s.name AS subfield_name, ul.meeting_url, ul.end_recurrence_date_time, ul.is_canceled
        FROM users_lessons ul
        JOIN users_lessons_students uls
          ON ul.id = uls.lesson_id        
        JOIN subfields s
          ON ul.subfield_id = s.id
        WHERE uls.student_id = $1 AND ul.date_time::timestamp < $2
        ORDER BY ul.date_time DESC LIMIT 1`;      
    }
    const { rows }: pg.QueryResult = await client.query(getPreviousLessonQuery, [userId, now]);
    let lessonRow = rows[0];
    let lesson: Lesson = {};
    if (lessonRow != null) {
      lesson = {
        id: lessonRow.id,
        dateTime: moment.utc(lessonRow.date_time).format(constants.DATE_TIME_FORMAT)
      }
      if (lessonRow.end_recurrence_date_time != null) {
        lesson.endRecurrenceDateTime = moment.utc(lessonRow.end_recurrence_date_time).format(constants.DATE_TIME_FORMAT);
      }
      const lessonDateTime = await this.getPreviousLessonDateTime(lesson, userId, client);
      if (lessonDateTime == undefined) {
        lessonRow = null;
      } else {
        lessonRow.date_time = lessonDateTime;
      }
    }
    return this.setLesson(lessonRow, isMentor, client);    
  }
  
  async getPreviousLessonDateTime(lesson: Lesson, userId: string, client: pg.PoolClient): Promise<string | undefined> {
    const now = moment.utc();
    let lessonDateTime = moment.utc(lesson.dateTime);
    const isLessonRecurrent = helpers.isLessonRecurrent(lesson.dateTime as string, lesson.endRecurrenceDateTime);
    if (isLessonRecurrent) {
      const endRecurrenceDateTime = moment.utc(lesson.endRecurrenceDateTime);
      while (lessonDateTime.isSameOrBefore(endRecurrenceDateTime)) {
        lessonDateTime = lessonDateTime.add(7, 'd');
      }
      lessonDateTime = lessonDateTime.subtract(7, 'd');
      const previousValidLessonDateTime = await this.getPreviousValidLessonDateTime(lesson, userId, lessonDateTime, client);
      if (endRecurrenceDateTime.isAfter(now)) {
        if (previousValidLessonDateTime.isBefore(now)) {
          return moment.utc(previousValidLessonDateTime).format(constants.DATE_TIME_FORMAT);
        } else {
          return undefined;
        }
      } else {
        return moment.utc(previousValidLessonDateTime).format(constants.DATE_TIME_FORMAT);
      } 
    } else {
      return moment.utc(lessonDateTime).format(constants.DATE_TIME_FORMAT);
    } 
  }

  async getPreviousValidLessonDateTime(lesson: Lesson, userId: string, lessonDateTime: moment.Moment, client: pg.PoolClient): Promise<moment.Moment> {
    let updatedLessonDateTime = lessonDateTime.clone();
    const lessonCanceledDateTimes = await this.getLessonCanceledDateTimes(userId, lesson.id as string, client);
    lessonCanceledDateTimes.slice().reverse().forEach(function (dateTime) {
      if (moment.utc(dateTime).isSame(moment.utc(updatedLessonDateTime))) {
        updatedLessonDateTime = updatedLessonDateTime.subtract(7, 'd');
      } 
    });
    return updatedLessonDateTime;
  }

  async cancelLesson(request: Request, response: Response, whatsAppClient: Client): Promise<void> {
    const userId = request.user.id as string;
    const lessonId = request.params.id;
    const lesson: Lesson = request.body
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      lesson.id = lessonId;
      await this.cancelLessonFromDB(userId, lesson, client);
      let isCancelAll = false;
      let lessonsCanceled = 0;
      const isMentor = lesson.mentor == null ? true : false;
      if (isMentor) {
        if (lesson.dateTime) {
          const nextLesson = await this.getNextLessonFromDB(userId, true, client);
          if (Object.keys(nextLesson).length == 0) {
            lesson.dateTime = '';
            await this.cancelLessonFromDB(userId, lesson, client);
          }
        } else {
          isCancelAll = true;
        }
      } else {
        lessonsCanceled = await this.cancelNextLessonNoStudents(lesson, client);
        if (!lesson.dateTime) {
          isCancelAll = true;
        }        
      }
      // For the push notifications, emails and WhatsApp messages
      let student: User = {};
      if (isMentor) {
        lesson.students = await this.getLessonStudents(lesson, false, client);
      } else {
        lesson.mentor = await users.getUserFromDB(lesson.mentor?.id as string, client);
        student = await users.getUserFromDB(userId, client);
      }
      await client.query('COMMIT');
      response.status(200).send(`Lesson modified with ID: ${lessonId}`);
      usersPushNotifications.sendPNLessonCanceled(lesson, student, isCancelAll, lessonsCanceled);
      usersSendEmails.sendEmailLessonCanceled(lesson, student, isCancelAll, lessonsCanceled);
      if (isMentor) {
        usersWhatsAppMessages.sendWMLessonCanceled(lesson, isCancelAll, whatsAppClient);
      }
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async cancelNextLessonNoStudents(lesson: Lesson, client: pg.PoolClient): Promise<number> {
    let nextLessonMentor = await this.getNextLessonFromDB(lesson.mentor?.id as string, true, client);
    let lessonsCanceled = 0;
    while (Object.keys(nextLessonMentor).length > 0 && nextLessonMentor.students?.length == 0 && lessonsCanceled < 10) {
      if (nextLessonMentor.students?.length == 0) {
        await this.cancelLessonFromDB(lesson.mentor?.id as string, nextLessonMentor, client);
        nextLessonMentor = await this.getNextLessonFromDB(lesson.mentor?.id as string, true, client);
        lessonsCanceled++;
      }
    }
    if (Object.keys(nextLessonMentor).length == 0) {
      lesson.dateTime = '';
      await this.cancelLessonFromDB(lesson.mentor?.id as string, lesson, client);
    }
    return lessonsCanceled;
  }

  async cancelLessonFromDB(userId: string, lesson: Lesson, client: pg.PoolClient): Promise<void> {
    const isMentor = await this.getIsMentor(userId, client);
    const canceledDateTime = moment.utc().format(constants.DATE_TIME_FORMAT);
    let nextLessonMentor: Lesson = {};
    let students: Array<User> = [];
    if (isMentor) {
      nextLessonMentor = await this.getNextLessonFromDB(userId, true, client);
      students = await this.getLessonStudents(lesson, true, client);
    }    
    if (lesson.dateTime) {
      await this.cancelSingleLesson(userId, isMentor, lesson, canceledDateTime, nextLessonMentor, students, client);
    } else {
      await this.cancelRecurrentLesson(userId, isMentor, lesson, canceledDateTime, nextLessonMentor, students, client);
    }     
  }

  async cancelSingleLesson(userId: string, isMentor: boolean, lesson: Lesson, canceledDateTime: string, nextLessonMentor: Lesson, students: Array<User>, client: pg.PoolClient): Promise<void> {
    const isCanceled = await this.isLessonAlreadyCanceled(userId, lesson.id as string, lesson.dateTime as string, client);
    if (!isCanceled) {
      const insertLessonCanceledQuery = `INSERT INTO users_lessons_canceled (user_id, lesson_id, lesson_date_time, canceled_date_time)
        VALUES ($1, $2, $3, $4)`;
      const lessonDateTime = moment.utc(lesson.dateTime);
      const values = [userId, lesson.id, lessonDateTime, canceledDateTime];
      await client.query(insertLessonCanceledQuery, values);
    }
    if (isMentor) {
      nextLessonMentor.endRecurrenceDateTime = undefined;
      for (const student of students) {
        await this.cancelUserLessons(student.id as string, nextLessonMentor, client);
      }
    }    
  }

  async cancelRecurrentLesson(userId: string, isMentor: boolean, lesson: Lesson, canceledDateTime: string, nextLessonMentor: Lesson, students: Array<User>, client: pg.PoolClient): Promise<void> {
    if (isMentor) {     
      const updateMentorLessonQuery = 'UPDATE users_lessons SET is_canceled = true, canceled_date_time = $1 WHERE id = $2';
      await client.query(updateMentorLessonQuery, [canceledDateTime, lesson.id]);     
      await this.cancelUserLessons(userId, nextLessonMentor, client);
      for (const student of students) {
        await this.cancelUserLessons(student.id as string, nextLessonMentor, client);
      }        
    } else {
      const nextLessonStudent = await this.getNextLessonFromDB(userId, false, client);
      const updateStudentLessonQuery = `UPDATE users_lessons_students SET is_canceled = true, canceled_date_time = $1 
        WHERE lesson_id = $2 AND student_id = $3`;
      await client.query(updateStudentLessonQuery, [canceledDateTime, lesson.id, userId]);
      await this.cancelUserLessons(userId, nextLessonStudent, client);
    }    
  }  

  async isLessonAlreadyCanceled(userId: string, lessonId: string, lessonDateTime: string, client: pg.PoolClient): Promise<boolean> {
    const getLessonCanceledDateTimesQuery = `SELECT user_id, lesson_id, lesson_date_time
      FROM users_lessons_canceled
      WHERE user_id = $1 AND lesson_id = $2 AND lesson_date_time = $3`;
    const values = [userId, lessonId, lessonDateTime];
    const { rows }: pg.QueryResult = await client.query(getLessonCanceledDateTimesQuery, values);
    let isCanceled = false;
    if (rows[0]) {
      isCanceled = true;
    }
    return isCanceled;
  }  

  async cancelUserLessons(userId: string, lesson: Lesson, client: pg.PoolClient): Promise<void> {
    let endDateTime = moment.utc(lesson.dateTime);
    const isLessonRecurrent = helpers.isLessonRecurrent(lesson.dateTime as string, lesson.endRecurrenceDateTime);
    if (isLessonRecurrent) {
      endDateTime = moment.utc(lesson.endRecurrenceDateTime);
    }
    let lessonDateTime = moment.utc(lesson.dateTime).clone();
    while (lesson.id != null && lessonDateTime.isSameOrBefore(endDateTime)) {
      const isCanceled = await this.isLessonAlreadyCanceled(userId, lesson.id, lessonDateTime.format(constants.DATE_TIME_FORMAT), client);
      if (!isCanceled) {
        const insertLessonCanceledQuery = `INSERT INTO users_lessons_canceled (user_id, lesson_id, lesson_date_time, canceled_date_time)
          VALUES ($1, $2, $3, $4)`;
        const canceledDateTime = moment.utc().format(constants.DATE_TIME_FORMAT);
        const values = [userId, lesson.id, lessonDateTime, canceledDateTime];
        await client.query(insertLessonCanceledQuery, values);
      }
      lessonDateTime = lessonDateTime.add(7, 'd');
    }
  }

  async setLessonMeetingUrl(request: Request, response: Response): Promise<void> {
    const mentorId = request.user.id as string;
    const lessonId = request.params.id;
    const { meetingUrl }: Lesson = request.body;
    try {
      const updateLessonQuery = 'UPDATE users_lessons SET meeting_url = $1 WHERE mentor_id = $2 AND id = $3';
      await pool.query(updateLessonQuery, [meetingUrl, mentorId, lessonId]);
      response.status(200).send(`Lesson modified with ID: ${lessonId}`);
    } catch (error) {
      response.status(400).send(error);
    }
  }
  
  async setLessonRecurrence(request: Request, response: Response, whatsAppClient: Client): Promise<void> {
    const mentorId = request.user.id as string;
    const lessonId = request.params.id;
    const { endRecurrenceDateTime }: Lesson = request.body
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const nextLesson = await this.getNextLessonFromDB(mentorId, true, client);
      const updateLessonQuery = 'UPDATE users_lessons SET end_recurrence_date_time = $1 WHERE mentor_id = $2 AND id = $3';
      const endRecurrence = endRecurrenceDateTime != undefined ? moment.utc(endRecurrenceDateTime) : null;
      await client.query(updateLessonQuery, [endRecurrence, mentorId, lessonId]);
      const lesson: Lesson = {
        id: lessonId
      }      
      const students = await this.getLessonStudents(lesson, false, client);
      if (nextLesson.endRecurrenceDateTime != endRecurrenceDateTime) {
        usersPushNotifications.sendPNLessonRecurrenceUpdated(students);
        usersSendEmails.sendEmailLessonRecurrenceUpdated(students);
        usersWhatsAppMessages.sendWMLessonRecurrenceUpdated(students, whatsAppClient);
      }
      response.status(200).send(`Lesson modified with ID: ${lessonId}`);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  } 
  
  async addStudentsSkills(request: Request, response: Response): Promise<void> {
    const lessonId = request.params.id;
    const { listIds }: Ids = request.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const lesson: Lesson = {
        id: lessonId
      }
      const students = await this.getLessonStudents(lesson, false, client);
      let skills = listIds;
      if (!skills) {
        skills = [];
      }
      for (const student of students) {
        const subfieldId = await this.getLessonSubfieldId(lessonId, client);
        await usersSkills.addUserSkillsToDB(student.id as string, subfieldId, skills, client);
      }
      response.status(200).send('Students skills have been added');
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async addStudentsLessonNotes(request: Request, response: Response): Promise<void> {
    const lessonId = request.params.id;
    const { text }: LessonNote = request.body
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const lesson: Lesson = {
        id: lessonId
      }      
      const students = await this.getLessonStudents(lesson, false, client);
      const dateTime = moment.utc().format(constants.DATE_TIME_FORMAT);
      for (const student of students) {
        const insertLessonNoteQuery = `INSERT INTO users_lessons_notes (student_id, lesson_id, text, date_time)
          VALUES ($1, $2, $3, $4)`;
        const values = [student.id, lessonId, text, dateTime];
        await client.query(insertLessonNoteQuery, values);
      }
      response.status(200).send('Lesson notes have been added');
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }  
  }
  
  async getLessonSubfieldId(lessonId: string, client: pg.PoolClient): Promise<string> {
    const getLessonQuery = `SELECT subfield_id FROM users_lessons WHERE id = $1`;
    const { rows }: pg.QueryResult = await client.query(getLessonQuery, [lessonId]);
    return rows[0].subfield_id;
  }

  async getStudentLessonNotes(request: Request, response: Response): Promise<void> {
    const studentId = request.params.id;
    try {
      const getLessonNotesQuery = `SELECT text, date_time
        FROM users_lessons_notes
        WHERE student_id = $1
        ORDER BY date_time DESC`;
      const { rows }: pg.QueryResult = await pool.query(getLessonNotesQuery, [studentId]);
      const lessonNotes: Array<LessonNote> = [];
      rows.forEach(function (row) {
        const lessonNote: LessonNote = {
          text: row.text,
          dateTime: moment.utc(row.date_time).format(constants.DATE_TIME_FORMAT)
        };
        lessonNotes.push(lessonNote);
      });      
      response.status(200).json(lessonNotes);
    } catch (error) {
      response.status(400).send(error);
    }   
  }
  
  async getLessonGuideRecommendations(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const lessonId = request.params.id;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(constants.READ_ONLY_TRANSACTION);
      const user = await users.getUserFromDB(userId, client);
      const field = user.field;
      const subfields = field?.subfields as Array<Subfield>;
      const subfieldId = await this.getLessonSubfieldId(lessonId, client);
      let lessonSubfield: Subfield = {};
      const guideRecommendations: Array<GuideRecommendation> = [];
      for (const subfield of subfields) {
        if (subfield.id === subfieldId) {
          lessonSubfield = subfield;
          break;
        }
      }
      guideRecommendations.push(await this.getGeneralGuideRecommendations(client));
      const fieldGuideRecommendation = await this.getFieldGuideRecommendations(field as Field, client);
      if (Object.keys(fieldGuideRecommendation).length > 0) {
        guideRecommendations.push(fieldGuideRecommendation);
      }
      const subfieldGuideRecommendation = await this.getSubfieldGuideRecommendations(lessonSubfield, client);
      if (Object.keys(subfieldGuideRecommendation).length > 0) {
        guideRecommendations.push(subfieldGuideRecommendation);
      }      
      response.status(200).json(guideRecommendations);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async getGeneralGuideRecommendations( client: pg.PoolClient ): Promise<GuideRecommendation> {
    const getGuideRecommendationsQuery = `SELECT text
      FROM guides_recommendations
      WHERE field_id IS NULL AND subfield_id IS NULL`;
    const { rows }: pg.QueryResult = await client.query(getGuideRecommendationsQuery);
    return {
      type: 'General',
      recommendations: rows[0].text.split(/\r?\n/)
    }    
  }

  async getFieldGuideRecommendations(field: Field, client: pg.PoolClient): Promise<GuideRecommendation> {
    const getGuideRecommendationsQuery = `SELECT text
      FROM guides_recommendations
      WHERE field_id = $1`;
    const { rows }: pg.QueryResult = await client.query(getGuideRecommendationsQuery, [field.id]);
    let fieldGuideRecommendation: GuideRecommendation = {};
    if (rows[0]) {
      fieldGuideRecommendation = {
        type: field.name as string,
        recommendations: rows[0].text.split(/\r?\n/)
      }  
    }
    return fieldGuideRecommendation;
  }

  async getSubfieldGuideRecommendations(subfield: Subfield,client: pg.PoolClient): Promise<GuideRecommendation> {
    const getGuideRecommendationsQuery = `SELECT text
      FROM guides_recommendations
      WHERE subfield_id = $1`;
    const { rows }: pg.QueryResult = await client.query(getGuideRecommendationsQuery, [subfield.id]);
    let subfieldGuideRecommendation: GuideRecommendation = {};
    if (rows[0]) {
      subfieldGuideRecommendation = {
        type: subfield.name as string,
        recommendations: rows[0].text.split(/\r?\n/)
      }  
    }
    return subfieldGuideRecommendation; 
  }   

  async getLessonGuideTutorials(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const lessonId = request.params.id;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(constants.READ_ONLY_TRANSACTION);
      const user = await users.getUserFromDB(userId, client);
      const subfieldId = await this.getLessonSubfieldId(lessonId, client);
      const subfields = user.field?.subfields as Array<Subfield>;
      const skills = await this.getLessonSkills(subfieldId, subfields, client);
      const guideTutorialsInitial: Array<GuideTutorial> = [];
      for (const skill of skills) {
        const getGuideTutorialsQuery = `SELECT gst.skill_id, gst.tutorial_index, gt.tutorial_url
          FROM guides_tutorials gt
          JOIN guides_skills_tutorials gst
          ON gt.id = gst.tutorial_id
          WHERE gst.skill_id = $1
          ORDER BY gst.tutorial_index ASC`;
        const { rows }: pg.QueryResult = await client.query(getGuideTutorialsQuery, [skill.id]);
        for (const row of rows) {
          const guideTutorial: GuideTutorial = {
            skills: [row.skill_id],
            tutorialUrls: [row.tutorial_url]
          }
          guideTutorialsInitial.push(guideTutorial);
        }
      }
      const guideTutorials = this.groupGuideTutorials(guideTutorialsInitial);
      for (const guideTutorial of guideTutorials) {
        guideTutorial.skills = this.replaceSkillsIdsWithNames(guideTutorial.skills, skills);
      }      
      response.status(200).json(guideTutorials);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }  
  }

  async getLessonSkills(subfieldId: string, subfields: Array<Subfield>, client: pg.PoolClient): Promise<Array<Skill>> {
    let skills: Array<Skill> = [];
    for (const subfield of subfields) {
      if (subfield.id === subfieldId) {
        skills = subfield.skills as Array<Skill>;
        break;
      }
    }
    const subfieldSkills = await skillsQueries.getSkillsFromDB(subfieldId, client);
    const orderedSkills: Array<Skill> = []; 
    for (const subfieldSkill of subfieldSkills) {
      for (const skill of skills) {
        if (skill.id === subfieldSkill.id) {
          orderedSkills.push(skill);
          break;
        }
      }
    }
    return orderedSkills;
  }

  groupGuideTutorials(guideTutorialsInitial: Array<GuideTutorial>): Array<GuideTutorial> {
    const tutorialUrls: Array<string> = [];
    for (const guideTutorial of guideTutorialsInitial) {
      if (!tutorialUrls.includes(guideTutorial.tutorialUrls[0])) {
        tutorialUrls.push(guideTutorial.tutorialUrls[0]);
      }
    }
    return this.addGuideTutorials(guideTutorialsInitial, tutorialUrls);
  }

  addGuideTutorials(guideTutorialsInitial: Array<GuideTutorial>, tutorialUrls: Array<string>): Array<GuideTutorial> {
    const guideTutorials: Array<GuideTutorial> = [];
    for (const tutorialUrl of tutorialUrls) {
      const skillsIds: Array<string> = [];
      for (const guideTutorial of guideTutorialsInitial) {
        if (guideTutorial.tutorialUrls[0] === tutorialUrl) {
          skillsIds.push(guideTutorial.skills[0]);
        }
      }    
      let found = false;
      for (const guideTutorial of guideTutorials) {
        if (helpers.checkArraysEqual(guideTutorial.skills, skillsIds)) {
          guideTutorial.tutorialUrls.push(tutorialUrl);
          found = true;
          break;
        }
      }
      if (!found) {
        guideTutorials.push({
          skills: skillsIds,
          tutorialUrls: [tutorialUrl]
        })
      }
    }
    return guideTutorials;   
  }
  
  replaceSkillsIdsWithNames(skillsIds: Array<string>, skills: Array<Skill>): Array<string> {
    const skillsNames: Array<string> = [];
    for (const skill of skills) {
      for (const skillId of skillsIds) {
        if (skillId === skill.id) {
          skillsNames.push(skill.name);
          break;
        }
      }
    }
    return skillsNames;
  }   
  
  async setLessonPresenceMentor(request: Request, response: Response): Promise<void> {
    const lessonId = request.params.id;
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

