import { Request, Response } from 'express';
import pg from 'pg';
import moment from 'moment';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Helpers } from '../utils/helpers';
import { Users } from './users';
import { UsersTimeZones } from './users_timezones';
import { UsersSendEmails } from './users_send_emails';
import NotificationsSettings from '../models/notifications_settings.model';

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();
const users = new Users();
const usersTimeZones = new UsersTimeZones();
const usersSendEmails = new UsersSendEmails();

export class UsersNotificationsSettings {
  constructor() {
    helpers.autoBind(this);
  }

  async getNotificationsSettings(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    try {
      const getNotificationsSettingsQuery = 'SELECT enabled, time, training_reminders_enabled, training_reminders_time, start_course_reminders_enabled, start_course_reminders_date FROM users_notifications_settings WHERE user_id = $1';
      const { rows }: pg.QueryResult = await pool.query(getNotificationsSettingsQuery, [userId]);
			let trainingRemindersEnabledDB = true;
			if (rows[0].training_reminders_enabled) {
				trainingRemindersEnabledDB = rows[0].training_reminders_enabled;
			} else if (rows[0].enabled) {
				trainingRemindersEnabledDB = rows[0].enabled;
			}
			let trainingRemindersTimeDB = '';
			if (rows[0].training_reminders_time) {
				trainingRemindersTimeDB = rows[0].training_reminders_time;
			} else if (rows[0].time) {
				trainingRemindersTimeDB = rows[0].time;
			}
      const trainingRemindersTime = trainingRemindersTimeDB.substring(0, trainingRemindersTimeDB.lastIndexOf(':'));
      const notificationsSettings: NotificationsSettings = {
				enabled: trainingRemindersEnabledDB,
				time: trainingRemindersTime,
        trainingRemindersEnabled: trainingRemindersEnabledDB,
        trainingRemindersTime: trainingRemindersTime,
				startCourseRemindersEnabled: rows[0].start_course_reminders_enabled,
				startCourseRemindersDate: rows[0].start_course_reminders_date ? moment.utc(rows[0].start_course_reminders_date).format(constants.DATE_TIME_FORMAT) : null
      }
      response.status(200).json(notificationsSettings);
    } catch (error) {
      response.status(400).send(error);
    } 
  }

  async updateNotificationsSettings(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const { enabled, time, trainingRemindersEnabled, trainingRemindersTime, startCourseRemindersEnabled, startCourseRemindersDate }: NotificationsSettings = request.body
		const client = await pool.connect();
    try {
			await client.query('BEGIN');
      const updateNotificationsSettingsQuery = `UPDATE users_notifications_settings
        SET enabled = $1, time = $2, training_reminders_enabled = $3, training_reminders_time = $4, start_course_reminders_enabled = $5, start_course_reminders_date = $6 WHERE user_id = $7`;
			const user = await users.getUserFromDB(userId, client);
			const userTimeZone = await usersTimeZones.getUserTimeZone(userId, client);
			let trainingRemindersEnabledForUpdate = true;
			if (trainingRemindersEnabled) {
				trainingRemindersEnabledForUpdate = trainingRemindersEnabled;
			} else if (enabled) {
				trainingRemindersEnabledForUpdate = enabled;
			}
			let trainingRemindersTimeForUpdate = '';
			if (trainingRemindersTime) {
				trainingRemindersTimeForUpdate = trainingRemindersTime;
			} else if (time) {
				trainingRemindersTimeForUpdate = time;
			}
			let values = [];
			if (user.isMentor) {
				values = [trainingRemindersEnabledForUpdate, trainingRemindersTimeForUpdate, trainingRemindersEnabledForUpdate, trainingRemindersTimeForUpdate, startCourseRemindersEnabled, moment.utc(startCourseRemindersDate).tz(userTimeZone.name).format(constants.DATE_FORMAT), userId];
			} else {
				values = [trainingRemindersEnabledForUpdate, trainingRemindersTimeForUpdate, trainingRemindersEnabledForUpdate, trainingRemindersTimeForUpdate, null, null, userId];
			}
      await client.query(updateNotificationsSettingsQuery, values);
      usersSendEmails.sendEmailNotificationsSettingsUpdate(userId, trainingRemindersEnabled);
      response.status(200).send(`Notifications settings have been updated for user: ${userId}`);
			await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }    
}

