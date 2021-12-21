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
    const userId = request.user.id as string;
    const trainerId = request.params.trainer_id ? request.params.trainer_id : userId;
    const client = await pool.connect();    
    try {
      await client.query('BEGIN');
      const trainingReminders = await this.getTrainingRemindersFromDB(trainerId, client);
      response.status(200).json(trainingReminders);
      await client.query('COMMIT');      
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');      
    } finally {
      client.release();
    }
  }

  async getTrainingRemindersFromDB(trainerId: string, client: pg.PoolClient): Promise<Array<TrainingReminder>> {
    const trainer = await users.getUserFromDB(trainerId, client);
    trainer.workdays = await this.getTrainerWorkdays(trainerId, client);
    let getTrainingRemindersQuery = `SELECT atr.id, atr.user_id, u.name, u.email, u.phone_number, u.is_mentor, u.registered_on, atr.is_step_added, atr.last_reminder_date_time, atr.last_contacted_date_time, atrt.text, ac.conversations, ac.last_conversation_date_time 
      FROM admin_training_reminders atr
      JOIN users u
        ON atr.user_id = u.id
      JOIN users_notifications_settings uns
        ON atr.user_id = uns.user_id            
      FULL OUTER JOIN admin_training_reminders_texts atrt
        ON atr.reminder_to_send = atrt.serial_number
      FULL OUTER JOIN admin_assigned_users aau
        ON atr.user_id = aau.assigned_user_id
      FULL OUTER JOIN admin_conversations ac
        ON atr.user_id = ac.user_id
      WHERE uns.enabled IS true
        AND date_trunc('day', now())::date - date_trunc('day', atr.last_reminder_date_time)::date >= 2`;
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
        isMentor: row.is_mentor,
        registeredOn: moment.utc(row.registered_on).format(constants.DATE_TIME_FORMAT)
      };
      user.timeZone = await usersTimeZones.getUserTimeZone(user.id as string, client);
      const lastReminderDateTime = moment.utc(row.last_reminder_date_time).format(constants.DATE_TIME_FORMAT);
      const lastConversationDateTime = row.last_conversation_date_time ? moment.utc(row.last_conversation_date_time).format(constants.DATE_TIME_FORMAT) : '';
      const certificateDate = moment.utc(row.registered_on).tz(user.timeZone.name).add(3, 'months').format(constants.SHORT_DATE_FORMAT);
      const shouldShowTrainingReminder = this.getShouldShowTrainingReminder(lastReminderDateTime, lastConversationDateTime, user.timeZone, trainer.workdays);
      const isStepAdded = await this.getIsStepAdded(user.id as string, row.is_step_added, lastReminderDateTime, client);
      const allUserQuizzes = await usersQuizzes.getAllQuizzes(user.id as string, client);
      const hasPreviousRemainingQuizzes = this.getHasPreviousRemainingQuizzes(user, allUserQuizzes, quizSettings);
      const quizzes = await usersQuizzes.getQuizzesFromDB(user.id as string, client);
      const remainingQuizzes = helpers.getRemainingQuizzes(quizzes);
      const shouldShowRemainingQuizzes = this.getShouldShowRemainingQuizzes(hasPreviousRemainingQuizzes, remainingQuizzes, isStepAdded);
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
        const reminderToSend = this.getReminderToSend(trainingReminder, lastReminderDateTime, reminderText, trainer, user, weeklyQuizzesText, stepQuizzesText);
        trainingReminder.reminderToSend = reminderToSend;
        trainingReminders.push(trainingReminder);
      }
    }
    return trainingReminders;    
  }

  async getTrainerWorkdays(trainerId: string, client: pg.PoolClient): Promise<number> {
    const getTrainerWorkdaysQuery = `SELECT workdays FROM admin_trainers_workdays 
      WHERE trainer_id = $1`;
    const { rows }: pg.QueryResult = await client.query(getTrainerWorkdaysQuery, [trainerId]);
    if (rows.length > 0) {
      return rows[0].workdays;
    }
    return 7;
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
      return this.getHasRemainingQuizzes(user.isMentor as boolean, quizzesBetweenDates, quizSettings);
    }
  }
  
  getShouldShowRemainingQuizzes(hasPreviousRemainingQuizzes: boolean, remainingQuizzes: number, isStepAdded: boolean): boolean {
    return hasPreviousRemainingQuizzes && remainingQuizzes > 0 || !isStepAdded && remainingQuizzes > 0;    
  }

  async getIsOverdue(user: User, quizzes: Array<Quiz>, quizSettings: QuizSettings, client: pg.PoolClient): Promise<boolean> {
    const isMentor = user.isMentor;
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
      const weekEndDate = usersQuizzes.getWeekEndDate(registeredOn, weekNumber - 2, timeZone);
      const isStepAdded = await this.getIsStepAdded(user.id as string, false, moment.utc(weekStartDate).format(constants.DATE_TIME_FORMAT), client);
      const quizzesBetweenDates = usersQuizzes.getQuizzesBetweenDates(quizzes, weekStartDate, weekEndDate, timeZone);
      const hasRemainingQuizzes2WeeksBefore = this.getHasRemainingQuizzes(user.isMentor as boolean, quizzesBetweenDates, quizSettings);
      const hasPreviousRemainingQuizzes = this.getHasPreviousRemainingQuizzes(user, quizzes, quizSettings);
      const currentQuizzes = await usersQuizzes.getQuizzesFromDB(user.id as string, client);
      const remainingQuizzes = helpers.getRemainingQuizzes(currentQuizzes);
      const areQuizzesSolved = !(hasRemainingQuizzes2WeeksBefore && hasPreviousRemainingQuizzes && remainingQuizzes > 0);
      let isFirstQuizzesRoundCompleted = false;
      if (!isMentor) {
        isFirstQuizzesRoundCompleted = this.getIsFirstQuizzesRoundCompleted(quizzes, weekNumber, quizSettings);
      }
      return !isStepAdded || !areQuizzesSolved && (isMentor || !isMentor && !isFirstQuizzesRoundCompleted);
    }
  }

  getIsFirstQuizzesRoundCompleted(quizzes: Array<Quiz>, weekNumber: number, quizSettings: QuizSettings): boolean {
    let lastQuizSolved = 0;
    for (const quiz of quizzes) {
      if (quiz.isCorrect && quiz.number > lastQuizSolved) {
        lastQuizSolved = quiz.number;
      }
    }
    return lastQuizSolved == quizSettings.studentWeeklyCount * 4 && weekNumber > 3 && weekNumber < 11;
  }

  getHasRemainingQuizzes(isMentor: boolean, quizzes: Array<Quiz>, quizSettings: QuizSettings): boolean {
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
    return solvedQuizzes < quizzesWeeklyCount;
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

  getReminderToSend(trainingReminder: TrainingReminder, lastReminderDateTime: string, reminderText: string, trainer: User, user: User, weeklyQuizzesText: string, stepQuizzesText: string): string {
    if (!reminderText || trainingReminder.lastConversationDateTime != '' && moment.utc(trainingReminder.lastConversationDateTime).format(constants.DATE_FORMAT) == moment.utc().format(constants.DATE_FORMAT)) {
      return '';
    }
    const userFirstName = user.name?.split(' ')[0];
    const timeZoneName = user.timeZone?.name as string;
    if (user.isMentor) {
      reminderText = reminderText.split('{mentor_name}').join(userFirstName as string);
    } else {
      reminderText = reminderText.split('{student_name}').join(userFirstName as string);
    }
    reminderText = reminderText.split('{trainer_name}').join(trainer.name as string);
    const certificateDate = moment.utc(user.registeredOn).add(3, 'months');
    if (moment.utc(certificateDate).tz(timeZoneName).startOf('day').isAfter(moment.utc().tz(timeZoneName).startOf('day'))) {
      reminderText = reminderText.split('{certificate_date}').join(certificateDate.tz(timeZoneName).format(constants.SHORT_DATE_FORMAT));
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
    let lastReminderDay = 'tomorrow';
    const lastReminderDaysToAdd = this.getLastReminderDaysToAdd(lastReminderDateTime, user.timeZone as TimeZone, trainer.workdays as number);
    if (trainer.workdays == 5) {
      if (lastReminderDaysToAdd == 5) {
        lastReminderDay = 'on Sunday';
      } else if (lastReminderDaysToAdd == 4) {
        lastReminderDay = 'on Monday';
      }
    } else if (trainer.workdays == 6) {
      if (lastReminderDaysToAdd == 5) {
        lastReminderDay = 'on Monday';
      }
    }
    reminderText = reminderText.split('{last_reminder_day}').join(lastReminderDay);
    return reminderText;
  }

  getShouldShowTrainingReminder(lastReminderDateTime: string, lastConversationDateTime: string, userTimeZone: TimeZone, trainerWorkdays: number): boolean {
    let shouldShowTrainingReminder = false;
    const now = moment.utc().startOf('day');
    const lastReminderStartOfDay = moment.utc(lastReminderDateTime).startOf('day');
    let lastConversationStartOfDay;
    if (lastConversationDateTime != '') {
      lastConversationStartOfDay = moment.utc(lastConversationDateTime).startOf('day');
    }
    const lastReminderDaysToAdd = this.getLastReminderDaysToAdd(lastReminderDateTime, userTimeZone, trainerWorkdays);
    if (now.diff(lastReminderStartOfDay, 'days') == 2 ||
        now.diff(lastReminderStartOfDay, 'days') > 2 && (!lastConversationStartOfDay || lastConversationStartOfDay.diff(lastReminderStartOfDay, 'days') < 2 || lastConversationStartOfDay.format(constants.DATE_FORMAT) == now.format(constants.DATE_FORMAT)) ||
        moment.utc().tz(userTimeZone.name).format(constants.DATE_FORMAT) == moment.utc(lastReminderDateTime).tz(userTimeZone.name).add(lastReminderDaysToAdd, 'd').format(constants.DATE_FORMAT)) {
      shouldShowTrainingReminder = true;
    }
    return shouldShowTrainingReminder;
  }

  getLastReminderDaysToAdd(lastReminderDateTime: string, userTimeZone: TimeZone, trainerWorkdays: number): number {
    let days = 6;
    const lastReminderDateTimeUser = moment.utc(lastReminderDateTime).tz(userTimeZone.name);
    if (trainerWorkdays == 5) {
      if (lastReminderDateTimeUser.isoWeekday() == 7) {
        days = 5;
      } else if (lastReminderDateTimeUser.isoWeekday() == 1) {
        days = 4;
      }
    } else if (trainerWorkdays == 6) {
      if (lastReminderDateTimeUser.isoWeekday() == 1) {
        days = 5;
      }
    }
    return days;
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
    const userId = request.user.id as string;
    const trainerId = request.params.trainer_id ? request.params.trainer_id : userId;
    const client = await pool.connect();    
    try {
      await client.query('BEGIN');
      const trainingReminders = await this.getAllTrainingRemindersFromDB(trainerId, client);
      response.status(200).json(trainingReminders);
      await client.query('COMMIT');      
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');      
    } finally {
      client.release();
    }
  }
  
  async getAllTrainingRemindersFromDB(trainerId: string, client: pg.PoolClient): Promise<Array<TrainingReminder>> {
    const trainer = await users.getUserFromDB(trainerId, client);
    let getTrainingRemindersQuery = `SELECT u.id, u.name, u.email, u.phone_number, u.is_mentor, u.registered_on, atr.last_contacted_date_time, ac.conversations
      FROM users u
      FULL OUTER JOIN admin_training_reminders atr
        ON u.id = atr.user_id
      JOIN users_notifications_settings uns
        ON u.id = uns.user_id          
      FULL OUTER JOIN admin_assigned_users aau
        ON u.id = aau.assigned_user_id
      FULL OUTER JOIN admin_conversations ac
        ON u.id = ac.user_id
      WHERE uns.enabled IS true`;
    let values: Array<string> = [];
    if (!trainer.isAdmin) {
      getTrainingRemindersQuery += ' AND aau.trainer_id = $1';
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
        isMentor: row.is_mentor,
        registeredOn: moment.utc(row.registered_on).format(constants.DATE_TIME_FORMAT)
      };
      user.timeZone = await usersTimeZones.getUserTimeZone(user.id as string, client);
      const certificateDate = moment.utc(row.registered_on).tz(user.timeZone.name).add(3, 'months').format(constants.SHORT_DATE_FORMAT);
      const lastContactedDateTime = this.getLastContactedDateTime(row.last_contacted_date_time);
      const allUserQuizzes = await usersQuizzes.getAllQuizzes(user.id as string, client);
      const quizSettings = await quizzesSettings.getQuizzesSettingsFromDB(client);
      const trainingReminder: TrainingReminder = {
        user: user,
        certificateDate: certificateDate,
        lastContactedDateTime: lastContactedDateTime,
        conversations: row.conversations ?? ''
      }
      trainingReminder.isOverdue = await this.getIsOverdue(user, allUserQuizzes, quizSettings, client);
      trainingReminders.push(trainingReminder);
    }
    return trainingReminders;    
  }

  async addTrainingReminder(user: User, isStepAdded: boolean, remainingQuizzes: number, client: pg.PoolClient): Promise<void> {
    const getTrainingRemindersQuery = 'SELECT user_id, reminder_to_send FROM admin_training_reminders WHERE user_id = $1';
    const { rows }: pg.QueryResult = await client.query(getTrainingRemindersQuery, [user.id]);
    const lastReminderDateTime = moment.utc().format(constants.DATE_TIME_FORMAT);
    if (rows[0]) {
      if (!user.isMentor) {
        const reminderToSend = await this.getTrainingReminderSerialNumber(user, rows[0].reminder_to_send, false, client);
        const updateTrainingRemindersQuery = `UPDATE admin_training_reminders
          SET is_step_added = $1, remaining_quizzes = $2, last_reminder_date_time = $3, reminder_to_send = $4 WHERE user_id = $5`;
        const values = [isStepAdded, remainingQuizzes, lastReminderDateTime, reminderToSend, user.id];
        await client.query(updateTrainingRemindersQuery, values);
      }
    } else {
      const insertTrainingReminderQuery = `INSERT INTO admin_training_reminders (user_id, is_step_added, remaining_quizzes, last_reminder_date_time, reminder_to_send)
        VALUES ($1, $2, $3, $4, $5)`;
      const reminderToSend = user.isMentor ? 'm1' : 's1';
      const values = [user.id, isStepAdded, remainingQuizzes, lastReminderDateTime, reminderToSend];
      await client.query(insertTrainingReminderQuery, values)      
    }
  }

  async getTrainingReminderSerialNumber(user: User, previousSerialNumberString: string, isFromConversations: boolean, client: pg.PoolClient): Promise<string> {
    const serialNumberFirstLetter = previousSerialNumberString[0];
    const previousSerialNumber = parseInt(previousSerialNumberString.substring(1, previousSerialNumberString.length));
    if (!user.isMentor && (isFromConversations && previousSerialNumber % 2 == 0 ||
        !isFromConversations && previousSerialNumber % 2 != 0)) {
      return previousSerialNumberString;
    }
    const serialNumber = previousSerialNumber + 1;
    const serialNumberString = serialNumberFirstLetter + serialNumber.toString();
    const getTrainingRemindersTextsQuery = 'SELECT id FROM admin_training_reminders_texts WHERE serial_number = $1';
    const { rows }: pg.QueryResult = await client.query(getTrainingRemindersTextsQuery, [serialNumberString]);
    if (rows[0]) {
      return serialNumberString;
    } else {
      if (user.isMentor) {
        return previousSerialNumberString;
      } else {
        return serialNumberFirstLetter + (serialNumber - 2).toString();
      }
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
        await client.query(insertTrainingReminderQuery, values);
      }
      this.updateTrainingReminder(userId, lastConversationDateTime, client);
      response.status(200).json(`Conversation has been added for user: ${userId}`);
      await client.query('COMMIT');      
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');      
    } finally {
      client.release();
    }      
  }
  
  async updateTrainingReminder(userId: string, lastConversationDateTime: string, client: pg.PoolClient): Promise<void> {
    const user = await users.getUserFromDB(userId, client);
    const getTrainingRemindersQuery = 'SELECT reminder_to_send FROM admin_training_reminders WHERE user_id = $1';
    const { rows }: pg.QueryResult = await client.query(getTrainingRemindersQuery, [userId]);
    let updateTrainingReminderQuery = '';
    if (rows[0] && (!lastConversationDateTime || moment.utc().format(constants.DATE_FORMAT) != moment.utc(lastConversationDateTime).format(constants.DATE_FORMAT))) {
      const reminderToSend = await this.getTrainingReminderSerialNumber(user, rows[0].reminder_to_send, true, client);
      updateTrainingReminderQuery = `UPDATE admin_training_reminders
        SET reminder_to_send = $1 WHERE user_id = $2`;
      await client.query(updateTrainingReminderQuery, [reminderToSend, userId]);
    }
    updateTrainingReminderQuery = `UPDATE admin_training_reminders
      SET last_contacted_date_time = $1 WHERE user_id = $2`;
    const lastContactedDateTime = moment.utc().format(constants.DATE_TIME_FORMAT);
    await client.query(updateTrainingReminderQuery, [lastContactedDateTime, userId]);
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
  
  async getTrainers(request: Request, response: Response): Promise<void> {
    try {
      const getTrainersQuery = `SELECT DISTINCT u.id, u.email FROM admin_assigned_users aau
        JOIN users u
          ON u.id = aau.trainer_id`;
      const { rows }: pg.QueryResult = await pool.query(getTrainersQuery);
      const trainers: Array<User> = [];
      for (const row of rows) {
        const trainer: User = {
          id: row.id,
          email: row.email
        }
        trainers.push(trainer);
      }
      response.status(200).json(trainers);
    } catch (error) {
      response.status(400).send(error);
    }
  }  
}