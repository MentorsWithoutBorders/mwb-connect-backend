import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import moment from 'moment';
import 'moment-timezone';
import pg from 'pg';
import os from 'os-utils';
import dotenv from 'dotenv';
import { Conn } from '../db/conn';
import { Helpers } from '../utils/helpers';
import { UsersLessons } from './users_lessons';
import { UsersLessonRequests } from './users_lesson_requests';
import { UsersSteps } from './users_steps';
import { UsersQuizzes } from './users_quizzes';
import { UsersTimeZones } from './users_timezones';
import { UsersAppVersions } from './users_app_versions';
import { UsersPushNotifications } from './users_push_notifications';
import { UsersSendEmails } from './users_send_emails';
import { AdminTrainingReminders } from './admin_training_reminders';
import User from '../models/user.model';
import Email from '../models/email.model';

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();
const usersLessons = new UsersLessons();
const usersLessonRequests = new UsersLessonRequests();
const usersSteps = new UsersSteps();
const usersQuizzes = new UsersQuizzes();
const usersAppVersions = new UsersAppVersions();
const usersTimeZones = new UsersTimeZones();
const usersPushNotifications = new UsersPushNotifications();
const usersSendEmails = new UsersSendEmails();
const adminTrainingReminders = new AdminTrainingReminders();
dotenv.config();

export class UsersBackgroundProcesses {
  constructor() {
    autoBind(this);
  }

  async sendLessonRequests(request: Request, response: Response): Promise<void> {
    try {
      await usersLessonRequests.sendLessonRequestsFromDB();
      response.status(200).send('Lesson request sent');
    } catch (error) {
      response.status(400).send(error);
    }    
  }

  async sendLessonReminders(request: Request, response: Response): Promise<void> {
    try {
      await this.sendLessonRemindersFromDB();
      response.status(200).send('Lesson reminders sent');
    } catch (error) {
      response.status(400).send(error);
    }    
  }
  
  async sendLessonRemindersFromDB(): Promise<void> {
    const getLessonsQuery = `SELECT * FROM
      (SELECT id, mentor_id, is_canceled, EXTRACT(EPOCH FROM (date_trunc('minute', now()) + interval '30 minutes' - date_time)) / 3600 / 24 / 7 AS diff_date_time
          FROM users_lessons) ul
      WHERE ul.is_canceled IS DISTINCT FROM true
          AND ul.diff_date_time = FLOOR(ul.diff_date_time)`;
    const { rows }: pg.QueryResult = await pool.query(getLessonsQuery);
    for (const row of rows) {
      const mentor: User = {
        id: row.mentor_id
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const nextLesson = await usersLessons.getNextLessonFromDB(mentor.id as string, true, client);
        let difference = moment.duration(moment.utc(nextLesson.dateTime).diff(moment.utc().add(30, 'm')));
        if (moment.utc(nextLesson.dateTime).isBefore(moment.utc().add(30, 'm'))) {
          difference = moment.duration(moment.utc().add(30, 'm').diff(moment.utc(nextLesson.dateTime)));
        }
        if (difference.asSeconds() < 60) {
          nextLesson.mentor = mentor;
          const students = nextLesson.students;
          if (students != null && students.length > 0) {
            usersSendEmails.sendEmailLessonReminder(nextLesson, client);
            usersPushNotifications.sendPNLessonReminder(nextLesson);
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

  async sendAfterLesson(request: Request, response: Response): Promise<void> {
    try {
      await this.sendAfterLessonFromDB();
      response.status(200).send('After lesson sent');
    } catch (error) {
      response.status(400).send(error);
    }    
  }
  
  async sendAfterLessonFromDB(): Promise<void> {
    try {
      const getAfterLessonQuery = `SELECT * FROM
        (SELECT id, mentor_id, is_recurrent, EXTRACT(EPOCH FROM (now() - interval '3 hours' - end_recurrence_date_time)) AS diff_end_recurrence_date_time, ROUND(EXTRACT(EPOCH FROM (now() - interval '3 hours' - date_time))/60)/60/24/7 AS diff_date_time
            FROM users_lessons
            GROUP BY id) ul
        WHERE is_recurrent IS DISTINCT FROM true AND diff_date_time = 0
          OR is_recurrent = true AND diff_end_recurrence_date_time < 60 AND diff_date_time = FLOOR(diff_date_time)`;
      const { rows }: pg.QueryResult = await pool.query(getAfterLessonQuery);
      for (const row of rows) {
        const mentor: User = {
          id: row.mentor_id
        }
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const previousLesson = await usersLessons.getPreviousLessonFromDB(mentor.id as string, client);
          let difference = moment.duration(moment.utc(previousLesson.dateTime).diff(moment.utc().subtract(3, 'h')));
          if (moment.utc(previousLesson.dateTime).isBefore(moment.utc().subtract(3, 'h'))) {
            difference = moment.duration(moment.utc().subtract(3, 'h').diff(moment.utc(previousLesson.dateTime)));
          }
          if (difference.asSeconds() < 60) {
            previousLesson.mentor = mentor;
            const students = previousLesson.students;
            if (students != null && students.length > 0) {
              usersPushNotifications.sendPNAfterLesson(previousLesson);
            }
          }
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

  async sendTrainingReminders(request: Request, response: Response): Promise<void> {
    try {
      await this.sendTrainingRemindersFromDB(true);
      await this.sendTrainingRemindersFromDB(false);
      response.status(200).send('Training reminders sent');
    } catch (error) {
      response.status(400).send(error);
    }    
  }
  
  async sendTrainingRemindersFromDB(isFirst: boolean): Promise<void> {
    const days = isFirst ? 5 : 0;
    const getUsersForTrainingReminderQuery = `SELECT u.id, u.name, u.email, u.is_mentor, u.registered_on FROM users AS u
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
        this.sendFirstAndSecondTrainingReminders(isFirst, user, showStepReminder, showQuizReminder, remainingQuizzes, client);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }        
    }
  }

  sendFirstAndSecondTrainingReminders(isFirst: boolean, user: User, showStepReminder: boolean, showQuizReminder: boolean, remainingQuizzes: number, client: pg.PoolClient): void {
    if (showStepReminder || showQuizReminder) {
      if (isFirst) {
        usersPushNotifications.sendPNFirstTrainingReminder(user.id as string, showStepReminder, showQuizReminder, remainingQuizzes);
        usersSendEmails.sendEmailFirstTrainingReminder(user, showStepReminder, showQuizReminder, remainingQuizzes);
      } else {
        usersPushNotifications.sendPNSecondTrainingReminder(user.id as string, showStepReminder, showQuizReminder, remainingQuizzes);
        usersSendEmails.sendEmailSecondTrainingReminder(user, showStepReminder, showQuizReminder, remainingQuizzes);
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

