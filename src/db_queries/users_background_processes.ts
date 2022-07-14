import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import moment from 'moment';
import 'moment-timezone';
import pg from 'pg';
import os from 'os-utils';
import dotenv from 'dotenv';
import { Conn } from '../db/conn';
import { Helpers } from '../utils/helpers';
import { Users } from './users';
import { UsersLessons } from './users_lessons';
import { UsersAvailableMentors } from './users_available_mentors';
import { UsersSteps } from './users_steps';
import { UsersQuizzes } from './users_quizzes';
import { UsersTimeZones } from './users_timezones';
import { UsersAppVersions } from './users_app_versions';
import { UsersPushNotifications } from './users_push_notifications';
import { UsersSendEmails } from './users_send_emails';
import { UsersWhatsAppMessages } from './users_whatsapp_messages';
import { AdminTrainingReminders } from './admin_training_reminders';
import User from '../models/user.model';
import Email from '../models/email.model';
import LessonRequest from '../models/lesson_request.model';
import { TrainingReminderType } from '../utils/training_reminder_type';

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();
const users = new Users();
const usersLessons = new UsersLessons();
const usersAvailableMentors = new UsersAvailableMentors();
const usersSteps = new UsersSteps();
const usersQuizzes = new UsersQuizzes();
const usersAppVersions = new UsersAppVersions();
const usersTimeZones = new UsersTimeZones();
const usersPushNotifications = new UsersPushNotifications();
const usersSendEmails = new UsersSendEmails();
const usersWhatsAppMessages = new UsersWhatsAppMessages();
const adminTrainingReminders = new AdminTrainingReminders();
dotenv.config();

export class UsersBackgroundProcesses {
  constructor() {
    autoBind(this);
  }

  async sendAllLessonRequestReminders(request: Request, response: Response): Promise<void> {
    try {
      await this.sendAllLessonRequestRemindersFromDB();
      response.status(200).send('Lesson request reminders sent');
    } catch (error) {
      response.status(400).send(error);
    }    
  }

  async sendAllLessonRequestRemindersFromDB(): Promise<void> {
    await this.sendLessonRequestRemindersMentors();
    await this.setLessonRequestsExpired();
    await this.sendLessonRequestExpiredStudents();
  }
  
  async sendLessonRequestRemindersMentors(): Promise<void> {
    const rows = await this.getLessonRequestRowsForReminders(1, 12);
    for (const row of rows) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const mentor = await users.getUserFromDB(row.mentor_id, client);
        const student = await users.getUserFromDB(row.student_id, client);
        const lessonRequest: LessonRequest = {
          mentor: mentor,
          student: student
        }        
        usersPushNotifications.sendPNLessonRequestReminder(lessonRequest);
        usersSendEmails.sendEmailLessonRequestReminder(lessonRequest);        
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }        
    }
  }

  async getLessonRequestRowsForReminders(days: number, hour: number): Promise<pg.QueryResultRow[]> {
    const getLessonRequestRemindersQuery = `SELECT ulr.id, ulr.mentor_id, ulr.student_id FROM users_lesson_requests ulr
    JOIN users_timezones ut
      ON ulr.mentor_id = ut.user_id
    WHERE ulr.is_previous_mentor IS DISTINCT FROM true
      AND date_trunc('day', now() AT TIME ZONE ut.name)::date - date_trunc('day', ulr.sent_date_time AT TIME ZONE ut.name)::date = $1
      AND extract(hour from now() AT TIME ZONE ut.name) = $2
      AND extract(minute from now() AT TIME ZONE ut.name) = 0`;
    const { rows }: pg.QueryResult = await pool.query(getLessonRequestRemindersQuery, [days, hour]);
    return rows;
  }  

  async setLessonRequestsExpired(): Promise<void> {
    const rows = await this.getLessonRequestRowsForReminders(2, 0);
    for (const row of rows) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await this.setLessonRequestExpired(row.id, client);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }        
    }
  }
  
  async setLessonRequestExpired(lessonRequestId: string, client: pg.PoolClient): Promise<void> {
    const setLessonRequestExpiredQuery = 'UPDATE users_lesson_requests SET is_expired = true, is_canceled = true WHERE id = $1 AND is_rejected IS DISTINCT FROM true';
    await client.query(setLessonRequestExpiredQuery, [lessonRequestId]);
  }  

  async sendLessonRequestExpiredStudents(): Promise<void> {
    const getMentorsForLessonRequestReminderQuery = `SELECT l.student_id, l.mentor_id FROM
      (SELECT ulr.id, ulr.mentor_id, ulr.student_id FROM users_lesson_requests ulr
          JOIN users_timezones ut
            ON ulr.mentor_id = ut.user_id
          WHERE ulr.is_previous_mentor IS DISTINCT FROM true
            AND date_trunc('day', now() AT TIME ZONE ut.name)::date - date_trunc('day', ulr.sent_date_time AT TIME ZONE ut.name)::date = 2
            AND ulr.is_expired IS true) l
      JOIN users_timezones ut
        ON l.student_id = ut.user_id
      WHERE extract(hour from now() AT TIME ZONE ut.name) = 0
        AND extract(minute from now() AT TIME ZONE ut.name) = 0`;
    const { rows }: pg.QueryResult = await pool.query(getMentorsForLessonRequestReminderQuery);
    for (const row of rows) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const mentor = await users.getUserFromDB(row.mentor_id, client);
        const student = await users.getUserFromDB(row.student_id, client);
        const lessonRequest: LessonRequest = {
          mentor: mentor,
          student: student
        }
        usersPushNotifications.sendPNLessonRequestExpired(lessonRequest);
        usersSendEmails.sendEmailLessonRequestExpired(lessonRequest);
        await usersWhatsAppMessages.sendWMLessonRequestExpired(lessonRequest);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }        
    }
  }

  async sendAllLessonReminders(request: Request, response: Response): Promise<void> {
    try {
      await this.sendAllLessonRemindersFromDB();
      response.status(200).send('Lesson reminders sent');
    } catch (error) {
      response.status(400).send(error);
    }    
  }

  async sendAllLessonRemindersFromDB(): Promise<void> {
    await this.sendBeforeLessonRemindersFromDB();
    await this.sendFirstAddLessonsRemindersMentors();
    await this.sendLastAddLessonsRemindersMentors();
    await this.setLessonsCanceled();
    await this.sendNoMoreLessonsAddedStudents();
    await this.sendAfterLessonFromDB();
  }  
  
  async sendBeforeLessonRemindersFromDB(): Promise<void> {
    const getLessonsQuery = `SELECT * FROM
      (SELECT id, mentor_id, is_canceled, EXTRACT(EPOCH FROM (date_trunc('minute', now()) + interval '30 minutes' - date_time)) / 3600 / 24 / 7 AS diff_date_time
          FROM users_lessons) ul
      WHERE ul.is_canceled IS DISTINCT FROM true
          AND ul.diff_date_time = FLOOR(ul.diff_date_time)`;
    const { rows }: pg.QueryResult = await pool.query(getLessonsQuery);
    for (const row of rows) {
      const client = await pool.connect();
      const mentor = await users.getUserFromDB(row.mentor_id, client);
      try {
        await client.query('BEGIN');
        const nextLesson = await usersLessons.getNextLessonFromDB(mentor.id as string, true, client);
        nextLesson.mentor = mentor;
        let difference = moment.duration(moment.utc(nextLesson.dateTime).diff(moment.utc().add(30, 'm')));
        if (moment.utc(nextLesson.dateTime).isBefore(moment.utc().add(30, 'm'))) {
          difference = moment.duration(moment.utc().add(30, 'm').diff(moment.utc(nextLesson.dateTime)));
        }
        if (difference.asSeconds() < 60) {
          const students = nextLesson.students;
          if (students != null && students.length > 0) {
            usersSendEmails.sendEmailLessonReminder(nextLesson, client);
            usersPushNotifications.sendPNLessonReminder(nextLesson);
            await usersWhatsAppMessages.sendWMLessonReminder(nextLesson, client);
          }
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }        
    }
  }
  
  async sendFirstAddLessonsRemindersMentors(): Promise<void> {
    const rows = await this.getLessonRowsForReminders(1, 12, false);
    for (const row of rows) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const lesson = await usersLessons.getPreviousLessonFromDB(row.mentor_id, client);
        usersPushNotifications.sendPNFirstAddLessonsReminder(lesson);
        usersSendEmails.sendEmailFirstAddLessonsReminder(lesson, client);        
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }        
    }
  }

  async getLessonRowsForReminders(days: number, hour: number, isCanceled: boolean): Promise<pg.QueryResultRow[]> {
    let getAddLessonsRemindersQuery = `SELECT ul.id, ul.mentor_id FROM users_lessons ul
      JOIN users_timezones ut
        ON ul.mentor_id = ut.user_id
      WHERE (ul.end_recurrence_date_time IS NULL AND date_trunc('day', now() AT TIME ZONE ut.name)::date - date_trunc('day', ul.date_time AT TIME ZONE ut.name)::date = $1
          OR date_trunc('day', now() AT TIME ZONE ut.name)::date - date_trunc('day', ul.end_recurrence_date_time AT TIME ZONE ut.name)::date = $1)  
        AND extract(hour from now() AT TIME ZONE ut.name) = $2
        AND extract(minute from now() AT TIME ZONE ut.name) = 0 `;
    if (isCanceled) {
      getAddLessonsRemindersQuery += 'AND ul.is_canceled IS true AND ul.canceled_date_time IS NULL';
    } else {
      getAddLessonsRemindersQuery += 'AND ul.is_canceled IS DISTINCT FROM true';
    }
    const { rows }: pg.QueryResult = await pool.query(getAddLessonsRemindersQuery, [days, hour]);
    return rows;
  }
  
  async sendLastAddLessonsRemindersMentors(): Promise<void> {
    const lessonRows = await this.getLessonRowsForReminders(2, 12, false);
    for (const lessonRow of lessonRows) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const lesson = await usersLessons.getPreviousLessonFromDB(lessonRow.mentor_id, client);
        usersPushNotifications.sendPNLastAddLessonsReminder(lesson);
        usersSendEmails.sendEmailLastAddLessonsReminder(lesson);        
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }        
    }
  }

  async setLessonsCanceled(): Promise<void> {
    const lessonRows = await this.getLessonRowsForReminders(3, 0, false);
    for (const lessonRow of lessonRows) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await this.setLessonCanceled(lessonRow.id, client);
        await this.deleteMentorLessonRequests(lessonRow.mentor_id, client);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }        
    }
  }

  async sendNoMoreLessonsAddedStudents(): Promise<void> {
    const lessonRows = await this.getLessonRowsForReminders(3, 14, true);
    for (const lessonRow of lessonRows) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const lesson = await usersLessons.getPreviousLessonFromDB(lessonRow.mentor_id, client);
        const students = lesson.students as Array<User>;
        for (const student of students) {
          const studentNextLesson = await usersLessons.getNextLessonFromDB(student.id as string, false, client);
          if (Object.keys(studentNextLesson).length == 0) {
            usersPushNotifications.sendPNNoMoreLessonsAdded(lesson.mentor as User, student);
            usersSendEmails.sendEmailNoMoreLessonsAdded(lesson.mentor as User, student);
            await usersWhatsAppMessages.sendWMNoMoreLessonsAdded(lesson.mentor as User, student);
          } 
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }        
    }
  }  
  
  async setLessonCanceled(lessonId: string, client: pg.PoolClient): Promise<void> {
    const setLessonCanceledQuery = 'UPDATE users_lessons SET is_canceled = true WHERE id = $1';
    await client.query(setLessonCanceledQuery, [lessonId]);
  }

  async deleteMentorLessonRequests(mentorId: string, client: pg.PoolClient): Promise<void> {
    const deleteMentorLessonRequestsQuery = 'DELETE FROM users_lesson_requests WHERE is_previous_mentor IS true AND mentor_id = $1';
    await client.query(deleteMentorLessonRequestsQuery, [mentorId]);
  }  
  
  async sendAfterLessonFromDB(): Promise<void> {
    try {
      const getAfterLessonQuery = `SELECT * FROM
        (SELECT id, mentor_id, end_recurrence_date_time, EXTRACT(EPOCH FROM (date_trunc('minute', now()) - interval '3 hours' - end_recurrence_date_time)) AS diff_end_recurrence_date_time, ROUND(EXTRACT(EPOCH FROM (date_trunc('minute', now()) - interval '3 hours' - date_time))) / 3600 / 24 / 7 AS diff_date_time
            FROM users_lessons
            GROUP BY id) ul
        WHERE end_recurrence_date_time IS NULL AND diff_date_time = 0
           OR end_recurrence_date_time IS NOT NULL AND diff_end_recurrence_date_time < 60 AND diff_date_time = FLOOR(diff_date_time)`;
      const { rows }: pg.QueryResult = await pool.query(getAfterLessonQuery);
      for (const row of rows) {
        const mentor: User = {
          id: row.mentor_id
        }
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const previousLesson = await usersLessons.getPreviousLessonFromDB(mentor.id as string, client);
          previousLesson.mentor = mentor;
          usersPushNotifications.sendPNAfterLesson(previousLesson);
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
        } finally {
          client.release();
        }        
      }
    } catch (error) {
      console.log(error);
    }
  }

  async sendAllTrainingReminders(request: Request, response: Response): Promise<void> {
    try {
      await this.sendAllTrainingRemindersFromDB();
      response.status(200).send('Training reminders sent');
    } catch (error) {
      response.status(400).send(error);
    }    
  }

  async sendAllTrainingRemindersFromDB(): Promise<void> {
    await this.sendTrainingRemindersFromDB(TrainingReminderType.First);
    await this.sendTrainingRemindersFromDB(TrainingReminderType.Last);
  }   
  
  async sendTrainingRemindersFromDB(type: TrainingReminderType): Promise<void> {
    const isFirst = type == TrainingReminderType.First;
    const days = isFirst ? 5 : 0;
    const getUsersForTrainingReminderQuery = `SELECT u.id, u.name, u.email, u.phone_number, u.is_mentor, u.registered_on FROM users AS u
      JOIN users_notifications_settings AS uns
        ON u.id = uns.user_id
      JOIN users_timezones AS ut
        ON u.id = ut.user_id
      WHERE uns.enabled = true
        AND (date_trunc('day', now() AT TIME ZONE ut.name)::date - date_trunc('day', u.registered_on AT TIME ZONE ut.name)::date) % 7 = $1
        AND date_trunc('day', now() AT TIME ZONE ut.name)::date <> date_trunc('day', u.registered_on AT TIME ZONE ut.name)::date
        AND date_trunc('day', now() AT TIME ZONE ut.name) + uns.time = date_trunc('minute', now() AT TIME ZONE ut.name);`;
    const { rows }: pg.QueryResult = await pool.query(getUsersForTrainingReminderQuery, [days]);
    for (const row of rows) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const user: User = {
          id: row.id,
          name: row.name,
          email: row.email,
          phoneNumber: row.phone_number,
          isMentor: row.is_mentor,
          registeredOn: row.registered_on
        }
        const showStepReminder = await this.getShowStepReminder(user, client);
        let showQuizReminder = false;
        let remainingQuizzes = 0;
        const hasOldAppVersion = await this.hasOldAppVersion(user.id as string, client);
        if (user.isMentor && hasOldAppVersion) {
          const quizNumber = await usersQuizzes.getQuizNumberFromDB(user.id as string, client);
          remainingQuizzes = 3 - (quizNumber - 1) % 3;
          showQuizReminder = quizNumber > 0 ? true : false;
        } else {
          const quizzes = await usersQuizzes.getQuizzesFromDB(user.id as string, client);
          remainingQuizzes = helpers.getRemainingQuizzes(quizzes);
          showQuizReminder = remainingQuizzes > 0 ? true : false;
        }
        await this.sendTrainingReminders(type, user, showStepReminder, showQuizReminder, remainingQuizzes, client);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }        
    }
  } 

  async sendTrainingReminders(type: TrainingReminderType, user: User, showStepReminder: boolean, showQuizReminder: boolean, remainingQuizzes: number, client: pg.PoolClient): Promise<void> {
    if (showStepReminder || showQuizReminder) {
      const isFirst = type == TrainingReminderType.First;
      if (isFirst) {
        usersPushNotifications.sendPNFirstTrainingReminder(user.id as string, showStepReminder, showQuizReminder, remainingQuizzes);
        usersSendEmails.sendEmailFirstTrainingReminder(user, showStepReminder, showQuizReminder, remainingQuizzes);
        if (!user.isMentor) {
          await usersWhatsAppMessages.sendWMFirstTrainingReminder(user, showStepReminder, showQuizReminder, remainingQuizzes);
        }
      } else {
        usersPushNotifications.sendPNLastTrainingReminder(user.id as string, showStepReminder, showQuizReminder, remainingQuizzes);
        usersSendEmails.sendEmailLastTrainingReminder(user, showStepReminder, showQuizReminder, remainingQuizzes);
        if (!user.isMentor) {
          await usersWhatsAppMessages.sendWMLastTrainingReminder(user, showStepReminder, showQuizReminder, remainingQuizzes);
        }        
        adminTrainingReminders.addTrainingReminder(user, !showStepReminder, remainingQuizzes, client);
      }
    }
  }
  
  async hasOldAppVersion(userId: string, client: pg.PoolClient): Promise<boolean> {
    const appVersion = await usersAppVersions.getAppVersion(userId, client);
    return appVersion.major == 1 && appVersion.minor == 0 && 
      (appVersion.revision == 1 && appVersion.build == 3 ||
       appVersion.revision == 4 && (appVersion.build == 15 || appVersion.build == 23));
  }
  
  async getShowStepReminder(user: User, client: pg.PoolClient): Promise<boolean> {
    const userTimeZone = await usersTimeZones.getUserTimeZone(user.id as string, client);
    const lastStepAdded = await usersSteps.getLastStepAddedFromDB(user.id as string, client);
    let nextDeadline = moment.utc(user.registeredOn).tz(userTimeZone.name).startOf('day');
    while (nextDeadline.isBefore(moment.utc().tz(userTimeZone.name).startOf('day'))) {
      nextDeadline = nextDeadline.add(7, 'd');
    }
    const lastStepAddedDateTime = moment.utc(lastStepAdded.dateTime).tz(userTimeZone.name).startOf('day');    
    let showStepReminder = false;
    const timeSinceRegistration = moment.utc().tz(userTimeZone.name).startOf('day').diff(moment.utc(user.registeredOn).tz(userTimeZone.name).startOf('day'));
    const limit = helpers.getDSTAdjustedDifferenceInDays(timeSinceRegistration) > 7 ? 7 : 8;
    if (Object.keys(lastStepAdded).length == 0 || helpers.getDSTAdjustedDifferenceInDays(nextDeadline.diff(lastStepAddedDateTime)) >= limit) {
      showStepReminder = true;
    }
    return showStepReminder;
  }

  async setAvailableMentorsFields(request: Request, response: Response): Promise<void> {
    try {
      await usersAvailableMentors.setAvailableMentorsFieldsFromDB();
      response.status(200).send('Available mentors fields are set');
    } catch (error) {
      response.status(400).send(error);
    } 
  }

  sendCPUUsage(): void {
    os.cpuUsage(function(v) {
      const server = process.env.SERVER;
      if (server == 'prod' && v >= 0.3) {
        const email: Email = {
          subject: 'High CPU alert',
          body: v.toString()
        }        
        usersSendEmails.sendEmail('edmondpr@gmail.com', email)
      }
    });       
  }
}

