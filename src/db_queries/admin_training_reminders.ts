import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import pg from 'pg';
import moment from 'moment';
import 'moment-timezone';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Helpers } from '../utils/helpers';
import { UsersQuizzes } from './users_quizzes';
import { UsersTimeZones } from './users_timezones';
import User from '../models/user.model';
import TrainingReminder from '../models/training_reminder.model';

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();
const usersQuizzes = new UsersQuizzes();
const usersTimeZones = new UsersTimeZones();

export class AdminTrainingReminders {
  constructor() {
    autoBind(this);
  }

  async getTrainingReminders(request: Request, response: Response): Promise<void> {
    const trainerId = request.user.id as string;
    const client: pg.PoolClient = await pool.connect();    
    try {
      await client.query('BEGIN');
      const getTrainingRemindersQuery = `SELECT atr.user_id, u.name, u.email, atr.is_step_added, atr.remaining_quizzes, atr.last_reminder_date_time, atrt.text, ac.conversation, ac.last_conversation_date_time FROM admin_training_reminders atr
        JOIN users u
          ON atr.user_id = u.id
        JOIN admin_training_reminders_texts atrt
          ON atr.reminder_to_send = atrt.serial_number
        JOIN admin_assigned_users aau
          ON atr.user_id = aau.assigned_user_id
        FULL OUTER JOIN admin_conversations ac
          ON atr.user_id = ac.user_id
        WHERE aau.trainer_id = $1
          AND date_trunc('day', now())::date - date_trunc('day', atr.last_reminder_date_time)::date >= 2`;
      const { rows }: pg.QueryResult = await client.query(getTrainingRemindersQuery, [trainerId]);
      const trainingReminders: Array<TrainingReminder> = [];
      for (const row of rows) {
        const user: User = {
          id: row.user_id,
          name: row.name,
          email: row.email
        };
        const lastReminderDateTime = moment.utc(row.last_reminder_date_time).format(constants.DATE_TIME_FORMAT);
        let lastConversationDateTime = '';
        if (row.last_conversation_date_time) {
          lastConversationDateTime = moment.utc(row.last_conversation_date_time).format(constants.DATE_TIME_FORMAT);
        }
        const shouldShowTrainingReminder = await this.getShouldShowTrainingReminder(user.id as string, lastReminderDateTime, lastConversationDateTime, client);
        let isStepAdded = row.is_step_added;
        if (!isStepAdded) {
          isStepAdded = await this.getIsStepAdded(user.id as string, lastReminderDateTime);
        }
        const previousRemainingQuizzes = row.remaining_quizzes;
        const quizzes = await usersQuizzes.getQuizzesFromDB(user.id as string, client);
        const remainingQuizzes = helpers.getRemainingQuizzes(quizzes);
        const shouldShowRemainingQuizzes = previousRemainingQuizzes > 0 && remainingQuizzes > 0;
        if (shouldShowTrainingReminder && (!isStepAdded || shouldShowRemainingQuizzes)) {
          const trainingReminder = {
            user: user,
            isStepAdded: isStepAdded,
            remainingQuizzes: 0
          }
          if (shouldShowRemainingQuizzes) {
            trainingReminder.remainingQuizzes = remainingQuizzes;
          }
          trainingReminders.push(trainingReminder);
        }
      }
      response.status(200).json(trainingReminders);
      await client.query('COMMIT');      
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');      
    } finally {
      client.release();
    }
  }

  async getShouldShowTrainingReminder(userId: string, lastReminderDateTime: string, lastConversationDateTime: string, client: pg.PoolClient): Promise<boolean> {
    let shouldShowTrainingReminder = false;
    const now = moment.utc().startOf('day');
    const lastReminderStartOfDay = moment.utc(lastReminderDateTime).startOf('day');
    let lastConversationStartOfDay;
    if (lastConversationDateTime != '') {
      lastConversationStartOfDay = moment.utc(lastConversationDateTime).startOf('day');
    }
    const userTimeZone = await usersTimeZones.getUserTimeZone(userId, client);
    if (now.diff(lastReminderStartOfDay, 'days') == 2 ||
        now.diff(lastReminderStartOfDay, 'days') > 2 && (!lastConversationStartOfDay || lastConversationStartOfDay.diff(lastReminderStartOfDay, 'days') < 2 || lastConversationStartOfDay.format(constants.DATE_FORMAT) == now.format(constants.DATE_FORMAT)) ||
        moment.utc().tz(userTimeZone.name).format(constants.DATE_FORMAT) == moment.utc(lastReminderDateTime).tz(userTimeZone.name).add(6, 'd').format(constants.DATE_FORMAT)) {
      shouldShowTrainingReminder = true;
    }
    return shouldShowTrainingReminder;
  }

  async getIsStepAdded(userId: string, dateTime: string): Promise<boolean> {
    let isStepAdded = false;
    const getIsStepAddedQuery = `SELECT id FROM users_steps 
      WHERE user_id = $1
        AND date_time >= $2::TIMESTAMP`;
    const { rows }: pg.QueryResult = await pool.query(getIsStepAddedQuery, [userId, dateTime]);
    if (rows.length > 0) {
      isStepAdded = true;
    }
    return isStepAdded;
  }

  async addTrainingReminder(user: User, isStepAdded: boolean, remainingQuizzes: number): Promise<void> {
    const getTrainingRemindersQuery = 'SELECT user_id, reminder_to_send FROM admin_training_reminders WHERE user_id = $1';
    const { rows }: pg.QueryResult = await pool.query(getTrainingRemindersQuery, [user.id]);
    const lastReminderDateTime = moment.utc();
    if (rows[0]) {
      const reminderToSend = await this.getTrainingReminderSerialNumber(rows[0].reminder_to_send);
      const updateTrainingRemindersQuery = `UPDATE admin_training_reminders
        SET is_step_added = $1, remaining_quizzes = $2, last_reminder_date_time = $3, reminder_to_send = $4 WHERE user_id = $5`;
      const values = [isStepAdded, remainingQuizzes, lastReminderDateTime, reminderToSend, user.id];
      await pool.query(updateTrainingRemindersQuery, values);
    } else {
      const insertTrainingReminderQuery = `INSERT INTO admin_training_reminders (user_id, is_step_added, remaining_quizzes, last_reminder_date_time, reminder_to_send)
        VALUES ($1, $2, $3, $4, $5)`;
      const reminderToSend = user.isMentor ? 'm1' : 's1';
      const values = [user.id, isStepAdded, remainingQuizzes, lastReminderDateTime, reminderToSend];
      await pool.query(insertTrainingReminderQuery, values)      
    }
  }

  async getTrainingReminderSerialNumber(previousSerialNumber: string): Promise<string> {
    const serialNumberFirstLetter = previousSerialNumber[0];
    const serialNumber = parseInt(previousSerialNumber.substring(1, previousSerialNumber.length)) + 1;
    const serialNumberString = serialNumberFirstLetter + serialNumber.toString();
    const getTrainingRemindersTextsQuery = 'SELECT serial_number FROM admin_training_reminders_texts WHERE serial_number = $1';
    const { rows }: pg.QueryResult = await pool.query(getTrainingRemindersTextsQuery, [serialNumberString]);
    if (rows[0]) {
      return serialNumberString;
    } else {
      return serialNumberFirstLetter + (serialNumber - 2).toString();
    }
  }  
}

