import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import pg from 'pg';
import moment from 'moment';
import { Conn } from '../db/conn';
import User from '../models/user.model';
import TrainingReminder from '../models/training_reminder.model';

const conn = new Conn();
const pool = conn.pool;

export class AdminTrainingReminders {
  constructor() {
    autoBind(this);
  }

  async getTrainingReminders(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    try {
      const getTrainingRemindersQuery = 'SELECT enabled, time FROM admin_training_reminders WHERE user_id = $1';
      const { rows }: pg.QueryResult = await pool.query(getTrainingRemindersQuery, [userId]);
      const time = rows[0].time.substring(0, rows[0].time.lastIndexOf(':'));
      // const trainingReminder: TrainingReminder = {
      //   enabled: rows[0].enabled,
      //   time: time
      // }
      // response.status(200).json(trainingReminder);
    } catch (error) {
      response.status(400).send(error);
    } 
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
      const reminderToSend = user.isMentor ? 'm1.1' : 's1.1';
      const values = [user.id, isStepAdded, remainingQuizzes, lastReminderDateTime, reminderToSend];
      await pool.query(insertTrainingReminderQuery, values)      
    }
  }

  async getTrainingReminderSerialNumber(previousSerialNumber: string): Promise<string> {
    const previousSerialNumberArray = previousSerialNumber.split('.');
    const serialNumber = previousSerialNumberArray[0] + '.' + (parseInt(previousSerialNumberArray[1]) + 1).toString();
    const getTrainingRemindersTextsQuery = 'SELECT serial_number FROM admin_training_reminders_texts WHERE serial_number = $1';
    const { rows }: pg.QueryResult = await pool.query(getTrainingRemindersTextsQuery, [serialNumber]);
    if (rows[0]) {
      return serialNumber;
    } else {
      return previousSerialNumber;
    }
  }  
}

