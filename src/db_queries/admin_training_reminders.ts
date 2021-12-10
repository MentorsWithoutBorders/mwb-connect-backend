import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import pg from 'pg';
import moment from 'moment';
import 'moment-timezone';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Helpers } from '../utils/helpers';
import { Users } from './users';
import { UsersQuizzes } from './users_quizzes';
import { UsersTimeZones } from './users_timezones';
import { QuizzesSettings } from './quizzes_settings';
import User from '../models/user.model';
import TrainingReminder from '../models/training_reminder.model';
import TimeZone from '../models/timezone.model';
import Quiz from '../models/quiz.model';
import QuizSettings from '../models/quiz_settings.model';

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();
const users = new Users();
const usersQuizzes = new UsersQuizzes();
const usersTimeZones = new UsersTimeZones();
const quizzesSettings = new QuizzesSettings();

export class AdminTrainingReminders {
  constructor() {
    autoBind(this);
  }

  async getTrainingReminders(request: Request, response: Response): Promise<void> {
    const trainerId = request.user.id as string;
    const client = await pool.connect();    
    try {
      await client.query('BEGIN');
      const trainer = await users.getUserFromDB(trainerId, client);
      let getTrainingRemindersQuery = `SELECT atr.id, atr.user_id, u.name, u.email, u.phone_number, u.registered_on, atr.is_step_added, atr.last_reminder_date_time, atr.last_contacted_date_time, atrt.text, ac.conversations, ac.last_conversation_date_time 
        FROM admin_training_reminders atr
        JOIN users u
          ON atr.user_id = u.id
        FULL OUTER JOIN admin_training_reminders_texts atrt
          ON atr.reminder_to_send = atrt.serial_number
        FULL OUTER JOIN admin_assigned_users aau
          ON atr.user_id = aau.assigned_user_id
        FULL OUTER JOIN admin_conversations ac
          ON atr.user_id = ac.user_id
        WHERE date_trunc('day', now())::date - date_trunc('day', atr.last_reminder_date_time)::date >= 2`;
      let values: Array<string> = [];
      if (!trainer.isAdmin) {
        getTrainingRemindersQuery += ' AND aau.trainer_id = $1';
        values = [trainerId];
      }
      const { rows }: pg.QueryResult = await client.query(getTrainingRemindersQuery, values);
      const trainingReminders: Array<TrainingReminder> = [];
      const quizSettings = await quizzesSettings.getQuizzesSettingsFromDB(client);
      for (const row of rows) {
        const user: User = {
          id: row.user_id,
          name: row.name,
          email: row.email,
          phoneNumber: row.phone_number ?? '',
          registeredOn: moment.utc(row.registered_on).format(constants.DATE_TIME_FORMAT)
        };
        user.timeZone = await usersTimeZones.getUserTimeZone(user.id as string, client);
        const lastReminderDateTime = moment.utc(row.last_reminder_date_time).format(constants.DATE_TIME_FORMAT);
        const lastConversationDateTime = row.last_conversation_date_time ? moment.utc(row.last_conversation_date_time).format(constants.DATE_TIME_FORMAT) : '';
        const certificateDate = moment.utc(row.registered_on).tz(user.timeZone.name).add(3, 'months').format(constants.SHORT_DATE_FORMAT);
        const shouldShowTrainingReminder = this.getShouldShowTrainingReminder(user.timeZone, lastReminderDateTime, lastConversationDateTime);
        const isStepAdded = await this.getIsStepAdded(user.id as string, row.is_step_added, lastReminderDateTime, client);
        const allUserQuizzes = await usersQuizzes.getAllQuizzes(user.id as string, client);
        const hasPreviousRemainingQuizzes = this.getHasPreviousRemainingQuizzes(user, allUserQuizzes, quizSettings);
        const quizzes = await usersQuizzes.getQuizzesFromDB(user.id as string, client);
        const remainingQuizzes = helpers.getRemainingQuizzes(quizzes);
        const shouldShowRemainingQuizzes = hasPreviousRemainingQuizzes && remainingQuizzes > 0;
        if (shouldShowTrainingReminder && (!isStepAdded || shouldShowRemainingQuizzes)) {
          const firstReminderAtTimeZone = moment.utc(lastReminderDateTime).tz(user.timeZone.name).subtract(2, 'd').format(constants.SHORT_DATE_FORMAT);
          const lastReminderAtTimeZone = moment.utc(lastReminderDateTime).tz(user.timeZone.name).format(constants.SHORT_DATE_FORMAT);
          const lastContactedDateTime = this.getLastContactedDateTime(row.last_contacted_date_time);
          const trainingReminder: TrainingReminder = {
            id: row.id,
            user: user,
            certificateDate: certificateDate,
            firstReminderDate: firstReminderAtTimeZone,
            lastReminderDate: lastReminderAtTimeZone,
            isStepAdded: isStepAdded,
            conversations: row.conversations ?? '',
            lastContactedDateTime: lastContactedDateTime,
            lastConversationDateTime: lastConversationDateTime
          }
          if (shouldShowRemainingQuizzes) {
            trainingReminder.remainingQuizzes = remainingQuizzes;
          }
          trainingReminder.isOverdue = await this.getIsOverdue(user, allUserQuizzes, quizSettings, client);
          const reminderText = row.text;
          const stepQuizzesText = this.getStepQuizzesText(user.isMentor as boolean, isStepAdded, remainingQuizzes, quizSettings);
          const weeklyQuizzesText = this.getWeeklyQuizzesText(user.isMentor as boolean, remainingQuizzes, quizSettings);
          const reminderToSend = this.getReminderToSend(trainingReminder, reminderText, trainer, user, user.timeZone, weeklyQuizzesText, stepQuizzesText);
          trainingReminder.reminderToSend = reminderToSend;
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

  getHasPreviousRemainingQuizzes(user: User, quizzes: Array<Quiz>, quizSettings: QuizSettings): boolean {
    const timeZone = user.timeZone as TimeZone;
    const timeZoneName = user.timeZone?.name as string;
    const registeredOn = moment.utc(user.registeredOn).tz(timeZoneName).startOf('day');
    const today = moment.utc().tz(timeZoneName).startOf('day');
    const timeSinceRegistration = today.subtract(1, 'd').diff(registeredOn);
    const weekNumber = Math.trunc(helpers.getDSTAdjustedDifferenceInDays(timeSinceRegistration) / 7);
    if (weekNumber == 0) {
      return false;
    } else {
      const weekStartDate = usersQuizzes.getWeekStartDate(registeredOn, weekNumber - 1, timeZone);
      const weekEndDate = usersQuizzes.getWeekEndDate(registeredOn, weekNumber - 1, timeZone);
      const quizzesBetweenDates = usersQuizzes.getQuizzesBetweenDates(quizzes, weekStartDate, weekEndDate, timeZone);
      return this.getHasRemainingQuizzes(user.isMentor as boolean, quizzesBetweenDates, 1, quizSettings);
    }
  }  

  async getIsOverdue(user: User, quizzes: Array<Quiz>, quizSettings: QuizSettings, client: pg.PoolClient): Promise<boolean> {
    const timeZone = user.timeZone as TimeZone;
    const timeZoneName = user.timeZone?.name as string;
    const registeredOn = moment.utc(user.registeredOn).tz(timeZoneName).startOf('day');
    const today = moment.utc().tz(timeZoneName).startOf('day');
    const timeSinceRegistration = today.subtract(1, 'd').diff(registeredOn);
    const weekNumber = Math.trunc(helpers.getDSTAdjustedDifferenceInDays(timeSinceRegistration) / 7);
    if (weekNumber < 2) {
      return false;
    } else {
      const weekStartDate = usersQuizzes.getWeekStartDate(registeredOn, weekNumber - 2, timeZone);
      const weekEndDate = usersQuizzes.getWeekEndDate(registeredOn, weekNumber - 1, timeZone);
      const isStepAdded = await this.getIsStepAdded(user.id as string, false, moment.utc(weekStartDate).format(constants.DATE_TIME_FORMAT), client);
      const quizzesBetweenDates = usersQuizzes.getQuizzesBetweenDates(quizzes, weekStartDate, weekEndDate, timeZone);
      const hasRemainingQuizzes = this.getHasRemainingQuizzes(user.isMentor as boolean, quizzesBetweenDates, 2, quizSettings);
      return !isStepAdded && hasRemainingQuizzes;
    }
  }

  getHasRemainingQuizzes(isMentor: boolean, quizzes: Array<Quiz>, numberOfWeeks: number, quizSettings: QuizSettings): boolean {
    let quizzesWeeklyCount = 0;
    if (isMentor) {
      quizzesWeeklyCount = quizSettings.mentorWeeklyCount;
    } else {
      quizzesWeeklyCount = quizSettings.studentWeeklyCount;
    }
    let solvedQuizzes = 0;
    for (const quiz of quizzes) {
      if (quiz.isCorrect) {
        solvedQuizzes++;
      }
    }
    return solvedQuizzes < quizzesWeeklyCount * numberOfWeeks;
  }  

  getLastContactedDateTime(lastContactedDateTime: string): string {
    if (lastContactedDateTime) {
      return moment.utc(lastContactedDateTime).format(constants.DATE_TIME_FORMAT);
    } else {
      return '';
    }
  }

  getStepQuizzesText(isMentor: boolean, isStepAdded: boolean, remainingQuizzes: number, quizSettings: QuizSettings): string {
    let quizzesWeeklyCount = 0;
    if (isMentor) {
      quizzesWeeklyCount = quizSettings.mentorWeeklyCount;
    } else {
      quizzesWeeklyCount = quizSettings.studentWeeklyCount;
    }
    let stepQuizzesText = isStepAdded ? '' : '{add} a new step';
    if (remainingQuizzes > 0) {
      if (!isStepAdded) {
        stepQuizzesText += ' and ';
      }
      if (remainingQuizzes == quizzesWeeklyCount) {
        stepQuizzesText += `{solve} the ${quizzesWeeklyCount} quizzes`;
      } else {
        const remainingQuizzesText = remainingQuizzes > 1 ? `${remainingQuizzes} quizzes` : `quiz`;
        stepQuizzesText += `{solve} the remaining ${remainingQuizzesText}`;
      }
    }
    return stepQuizzesText;
  }

  getWeeklyQuizzesText(isMentor: boolean, remainingQuizzes: number, quizSettings: QuizSettings): string {
    let quizzesWeeklyCount = 0;
    if (isMentor) {
      quizzesWeeklyCount = quizSettings.mentorWeeklyCount;
    } else {
      quizzesWeeklyCount = quizSettings.studentWeeklyCount;
    }    
    if (remainingQuizzes <= quizzesWeeklyCount) {
      return `${quizzesWeeklyCount} quizzes`;
    } else {
      return 'quizzes';
    }
  }  

  getReminderToSend(trainingReminder: TrainingReminder, reminderText: string, trainer: User, user: User, userTimeZone: TimeZone, weeklyQuizzesText: string, stepQuizzesText: string): string {
    if (!reminderText || trainingReminder.lastConversationDateTime != '' && moment.utc(trainingReminder.lastConversationDateTime).format(constants.DATE_FORMAT) == moment.utc().format(constants.DATE_FORMAT)) {
      return '';
    }
    const userFirstName = user.name?.split(' ')[0];
    if (user.isMentor) {
      reminderText = reminderText.split('{mentor_name}').join(userFirstName as string);
    } else {
      reminderText = reminderText.split('{student_name}').join(userFirstName as string);
    }
    reminderText = reminderText.split('{trainer_name}').join(trainer.name as string);
    const certificateDate = moment.utc(user.registeredOn).add(3, 'months');
    if (moment.utc(certificateDate).tz(userTimeZone.name).startOf('day').isAfter(moment.utc().tz(userTimeZone.name).startOf('day'))) {
      reminderText = reminderText.split('{certificate_date}').join(certificateDate.tz(userTimeZone.name).format(constants.SHORT_DATE_FORMAT));
    } else {
      reminderText = reminderText.split(' on {certificate_date}').join('');
    }
    reminderText = reminderText.split('{first_reminder_date}').join(trainingReminder.firstReminderDate as string);
    reminderText = reminderText.split('{last_reminder_date}').join(trainingReminder.lastReminderDate as string);  
    reminderText = reminderText.split('{weekly_quizzes}').join(weeklyQuizzesText);
    const stepQuizzesNotDone = stepQuizzesText.split('{add}').join('added').split('{solve}').join('solved') + ' for the current week of training';
    reminderText = reminderText.split('{step_quizzes_not_done}').join(stepQuizzesNotDone);
    const stepQuizzesToDo = stepQuizzesText.split('{add}').join('add').split('{solve}').join('solve');
    reminderText = reminderText.split('{step_quizzes_to_do}').join(stepQuizzesToDo);
    const stepQuizzesDoing = stepQuizzesText.split('{add}').join('adding').split('{solve}').join('solving');
    reminderText = reminderText.split('{step_quizzes_doing}').join(stepQuizzesDoing);
    return reminderText;
  }

  getShouldShowTrainingReminder(userTimeZone: TimeZone, lastReminderDateTime: string, lastConversationDateTime: string): boolean {
    let shouldShowTrainingReminder = false;
    const now = moment.utc().startOf('day');
    const lastReminderStartOfDay = moment.utc(lastReminderDateTime).startOf('day');
    let lastConversationStartOfDay;
    if (lastConversationDateTime != '') {
      lastConversationStartOfDay = moment.utc(lastConversationDateTime).startOf('day');
    }
    if (now.diff(lastReminderStartOfDay, 'days') == 2 ||
        now.diff(lastReminderStartOfDay, 'days') > 2 && (!lastConversationStartOfDay || lastConversationStartOfDay.diff(lastReminderStartOfDay, 'days') < 2 || lastConversationStartOfDay.format(constants.DATE_FORMAT) == now.format(constants.DATE_FORMAT)) ||
        moment.utc().tz(userTimeZone.name).format(constants.DATE_FORMAT) == moment.utc(lastReminderDateTime).tz(userTimeZone.name).add(6, 'd').format(constants.DATE_FORMAT)) {
      shouldShowTrainingReminder = true;
    }
    return shouldShowTrainingReminder;
  }

  async getIsStepAdded(userId: string, isStepAdded: boolean, dateTime: string, client: pg.PoolClient): Promise<boolean> {
    const getIsStepAddedQuery = `SELECT id FROM users_steps 
      WHERE user_id = $1
        AND date_time >= $2::TIMESTAMP`;
    const { rows }: pg.QueryResult = await client.query(getIsStepAddedQuery, [userId, dateTime]);
    if (rows.length > 0) {
      isStepAdded = true;
    }
    return isStepAdded;
  }

  async getAllTrainingReminders(request: Request, response: Response): Promise<void> {
    const trainerId = request.user.id as string;
    const client = await pool.connect();    
    try {
      await client.query('BEGIN');
      const trainer = await users.getUserFromDB(trainerId, client);
      let getTrainingRemindersQuery = `SELECT u.id, u.name, u.email, u.phone_number, u.registered_on, atr.last_contacted_date_time, ac.conversations
        FROM admin_training_reminders atr
        JOIN users u
          ON atr.user_id = u.id
        FULL OUTER JOIN admin_assigned_users aau
          ON atr.user_id = aau.assigned_user_id
        FULL OUTER JOIN admin_conversations ac
          ON atr.user_id = ac.user_id`;
      let values: Array<string> = [];
      if (!trainer.isAdmin) {
        getTrainingRemindersQuery += ' WHERE aau.trainer_id = $1';
        values = [trainerId];
      }
      getTrainingRemindersQuery += ' ORDER BY atr.last_contacted_date_time DESC NULLS LAST';
      const { rows }: pg.QueryResult = await client.query(getTrainingRemindersQuery, values);
      const trainingReminders: Array<TrainingReminder> = [];
      for (const row of rows) {
        const user: User = {
          id: row.id,
          name: row.name,
          email: row.email,
          phoneNumber: row.phone_number ?? '',
          registeredOn: moment.utc(row.registered_on).format(constants.DATE_TIME_FORMAT)
        };
        const userTimeZone = await usersTimeZones.getUserTimeZone(user.id as string, client);
        const certificateDate = moment.utc(row.registered_on).tz(userTimeZone.name).add(3, 'months').format(constants.SHORT_DATE_FORMAT);
        const lastContactedDateTime = this.getLastContactedDateTime(row.last_contacted_date_time);
        const trainingReminder: TrainingReminder = {
          user: user,
          certificateDate: certificateDate,
          lastContactedDateTime: lastContactedDateTime,
          conversations: row.conversations ?? ''
        }
        trainingReminders.push(trainingReminder);
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

  async addTrainingReminder(user: User, isStepAdded: boolean, remainingQuizzes: number, client: pg.PoolClient): Promise<void> {
    const getTrainingRemindersQuery = 'SELECT user_id, reminder_to_send FROM admin_training_reminders WHERE user_id = $1';
    const { rows }: pg.QueryResult = await client.query(getTrainingRemindersQuery, [user.id]);
    const lastReminderDateTime = moment.utc().format(constants.DATE_TIME_FORMAT);
    if (rows[0]) {
      const reminderToSend = await this.getTrainingReminderSerialNumber(rows[0].reminder_to_send, false, client);
      const updateTrainingRemindersQuery = `UPDATE admin_training_reminders
        SET is_step_added = $1, remaining_quizzes = $2, last_reminder_date_time = $3, reminder_to_send = $4 WHERE user_id = $5`;
      const values = [isStepAdded, remainingQuizzes, lastReminderDateTime, reminderToSend, user.id];
      await client.query(updateTrainingRemindersQuery, values);
    } else {
      const insertTrainingReminderQuery = `INSERT INTO admin_training_reminders (user_id, is_step_added, remaining_quizzes, last_reminder_date_time, reminder_to_send)
        VALUES ($1, $2, $3, $4, $5)`;
      const reminderToSend = user.isMentor ? 'm1' : 's1';
      const values = [user.id, isStepAdded, remainingQuizzes, lastReminderDateTime, reminderToSend];
      await client.query(insertTrainingReminderQuery, values)      
    }
  }

  async getTrainingReminderSerialNumber(previousSerialNumberString: string, isFromConversations: boolean, client: pg.PoolClient): Promise<string> {
    const serialNumberFirstLetter = previousSerialNumberString[0];
    const previousSerialNumber = parseInt(previousSerialNumberString.substring(1, previousSerialNumberString.length));
    if (isFromConversations && previousSerialNumber % 2 == 0 ||
        !isFromConversations && previousSerialNumber % 2 != 0) {
      return previousSerialNumberString;
    }
    const serialNumber = previousSerialNumber + 1;
    const serialNumberString = serialNumberFirstLetter + serialNumber.toString();
    const getTrainingRemindersTextsQuery = 'SELECT id FROM admin_training_reminders_texts WHERE serial_number = $1';
    const { rows }: pg.QueryResult = await client.query(getTrainingRemindersTextsQuery, [serialNumberString]);
    if (rows[0]) {
      return serialNumberString;
    } else {
      return serialNumberFirstLetter + (serialNumber - 2).toString();
    }
  }
  
  async addConversation(request: Request, response: Response): Promise<void> {
    const { user, conversations }: TrainingReminder = request.body;
    const client = await pool.connect();    
    try {
      const userId = user?.id as string;
      const getConversationsQuery = 'SELECT id, last_conversation_date_time FROM admin_conversations WHERE user_id = $1';
      const { rows }: pg.QueryResult = await client.query(getConversationsQuery, [userId]);
      const now = moment.utc().format(constants.DATE_TIME_FORMAT);
      let lastConversationDateTime;
      if (rows[0]) {
        lastConversationDateTime = rows[0].last_conversation_date_time;
        const updateConversationsQuery = `UPDATE admin_conversations
          SET conversations = $1, last_conversation_date_time = $2 WHERE user_id = $3`;
        const values = [conversations, now, userId];
        await client.query(updateConversationsQuery, values);
      } else {
        const insertTrainingReminderQuery = `INSERT INTO admin_conversations (user_id, conversations, last_conversation_date_time)
          VALUES ($1, $2, $3)`;
        const values = [userId, conversations, now];
        await client.query(insertTrainingReminderQuery, values)      
      }
      this.updateReminderToSend(userId, lastConversationDateTime, client);
      response.status(200).json(`Conversation has been added for user: ${userId}`);
      await client.query('COMMIT');      
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');      
    } finally {
      client.release();
    }      
  }
  
  async updateReminderToSend(userId: string, lastConversationDateTime: string, client: pg.PoolClient): Promise<void> {
    const getTrainingRemindersQuery = 'SELECT reminder_to_send FROM admin_training_reminders WHERE user_id = $1';
    const { rows }: pg.QueryResult = await client.query(getTrainingRemindersQuery, [userId]);
    if (rows[0] && (!lastConversationDateTime || moment.utc().format(constants.DATE_FORMAT) != moment.utc(lastConversationDateTime).format(constants.DATE_FORMAT))) {
      const reminderToSend = await this.getTrainingReminderSerialNumber(rows[0].reminder_to_send, true, client);
      const updateTrainingRemindersQuery = `UPDATE admin_training_reminders
        SET reminder_to_send = $1 WHERE user_id = $2`;
      const values = [reminderToSend, userId];
      await client.query(updateTrainingRemindersQuery, values);
    }
  }
  
  async updateLastContacted(request: Request, response: Response): Promise<void> {
    const id = request.params.id;
    const { lastContactedDateTime }: TrainingReminder = request.body;
    const client = await pool.connect();    
    try {
      const updateLastContactedQuery = `UPDATE admin_training_reminders
        SET last_contacted_date_time = $1 WHERE id = $2`;
      const values = [lastContactedDateTime, id];
      await client.query(updateLastContactedQuery, values);
      response.status(200).json(`Last contacted date/time has been updated for training reminder: ${id}`);
      await client.query('COMMIT');      
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');      
    } finally {
      client.release();
    }      
  }

}