import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import dotenv from 'dotenv';
import moment from 'moment';
import { v4 as uuidv4 } from 'uuid';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Helpers } from '../utils/helpers';
import { ApprovedUsers } from './approved_users';
import { UsersAppFlags } from './users_app_flags';
import { UsersGoals } from './users_goals';
import { UsersTimeZones } from './users_timezones';
import { AdminPermissions } from './admin_permissions';
import Token from '../models/token.model';
import Tokens from '../models/tokens.model';
import User from '../models/user.model';
import ApprovedUser from '../models/approved_user.model';
import LessonsAvailability from '../models/lessons_availability';
import TimeZone from '../models/timezone.model';
import NotificationsSettings from '../models/notifications_settings.model';

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();
const approvedUsers = new ApprovedUsers();
const usersAppFlags = new UsersAppFlags();
const usersGoals = new UsersGoals();
const usersTimeZones = new UsersTimeZones();
const adminPermissions = new AdminPermissions();
dotenv.config();

export class Auth {
  constructor() {
    helpers.autoBind(this);
  }

  async signUp(request: Request, response: Response): Promise<void> {
    const { name, email, password, timeZone }: User = request.body;
    if (!email || !password) {
      response.status(400).send({'message': 'Some values are missing'});
      return ;
    }
    if (!helpers.isValidEmail(email)) {
      response.status(400).send({'message': 'Please enter a valid email address'});
      return ;
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const getUsersQuery = 'SELECT email FROM users WHERE email = $1';
      let { rows }: pg.QueryResult = await client.query(getUsersQuery, [email]);
      if (rows[0]) {
        response.status(400).send({'message': 'User already exists.'});
        return ;
      }

      const approvedUser: ApprovedUser = await approvedUsers.getApprovedUser(email, client);
      if (approvedUser.email == '') {
        response.status(400).send({'message': 'You have to be a student from one of our partner NGOs or an employee of one of our partner companies.'});
        return ;
      }

      const hashPassword: string = helpers.hashPassword(password);  
      const createUserQuery = `INSERT INTO 
        users (id, name, email, password, phone_number, field_id, organization_id, is_mentor, available_from, registered_on) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
        RETURNING *`;
      const values = [
        uuidv4(),
        name || approvedUser.name || '',
        email,
        hashPassword,
        approvedUser.phoneNumber,
        approvedUser.field != null ? approvedUser.field.id : '',
        approvedUser.organization != null ? approvedUser.organization.id as string : '',
        String(approvedUser.isMentor),
        moment.utc().format(constants.DATE_TIME_FORMAT),
        moment.utc().format(constants.DATE_TIME_FORMAT),
      ];
      ({ rows } = await client.query(createUserQuery, values));

      const userId: string = rows[0].id;

      await adminPermissions.addPermission(userId, approvedUser, client);
      await usersTimeZones.addTimeZone(userId, timeZone as TimeZone, client);
      await this.setDefaultUserProfile(userId, approvedUser.isMentor as boolean, client);
      await usersAppFlags.addAppFlagsFromDB(userId, true, true, client);

      const isStudent = !(approvedUser.isMentor || approvedUser.isCenterManager || approvedUser.isOrgManager);
      if (isStudent) {
        await usersGoals.addGoalToDB(userId, approvedUser.goal as string, client);
      }

      const tokens: Tokens = await this.setTokens(userId, client);
      response.status(200).send(tokens);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async setDefaultUserProfile(userId: string, isMentor: boolean, client: pg.PoolClient): Promise<void> {
    const getDefaultUserQuery = 'SELECT lessons_availability_min_interval_in_days, lessons_availability_min_interval_unit, lessons_availability_max_students, training_reminders_enabled, training_reminders_time, start_course_reminders_enabled, is_available FROM user_default_profile';
    const { rows }: pg.QueryResult = await client.query(getDefaultUserQuery);
    const lessonsAvailability: LessonsAvailability = {
      minInterval: rows[0].lessons_availability_min_interval_in_days,
      minIntervalUnit: rows[0].lessons_availability_min_interval_unit,
      maxStudents: rows[0].lessons_availability_max_students
    };
		const userTimeZone = await usersTimeZones.getUserTimeZone(userId, client);
    const notificationsSettings: NotificationsSettings = {
      trainingRemindersEnabled: rows[0].training_reminders_enabled,
      trainingRemindersTime: rows[0].training_reminders_time,
			startCourseRemindersEnabled: rows[0].start_course_reminders_enabled,
			startCourseRemindersDate: moment.tz(userTimeZone.name).startOf('day').format(constants.DATE_FORMAT)
    }
    const defaultUser: User = {
      isAvailable: rows[0].is_available,
      lessonsAvailability: lessonsAvailability
    };
    const updateUserQuery = `UPDATE users SET is_available = $1 WHERE id = $2`;
    await client.query(updateUserQuery, [defaultUser.isAvailable, userId]);
    if (isMentor) {
      const insertUserLessonsAvailabilityQuery = `INSERT INTO users_lessons_availabilities (user_id, min_interval_in_days, min_interval_unit, max_students)
        VALUES ($1, $2, $3, $4)`;
      await client.query(insertUserLessonsAvailabilityQuery, [userId, lessonsAvailability.minInterval, lessonsAvailability.minIntervalUnit, lessonsAvailability.maxStudents]);
    }
		const startCourseRemindersEnabled = isMentor ? notificationsSettings.startCourseRemindersEnabled : null;
		const startCourseRemindersDate = isMentor ? notificationsSettings.startCourseRemindersDate : null;
    const insertNotificationsSettingsQuery = `INSERT INTO users_notifications_settings (user_id, training_reminders_enabled, training_reminders_time, start_course_reminders_enabled, start_course_reminders_date)
      VALUES ($1, $2, $3, $4, $5)`;
    await client.query(insertNotificationsSettingsQuery, [userId, notificationsSettings.trainingRemindersEnabled, notificationsSettings.trainingRemindersTime, startCourseRemindersEnabled, startCourseRemindersDate]);    
  }  

  async login(request: Request, response: Response): Promise<void> {
    const { email, password }: User = request.body;
    if (!email || !password) {
      response.status(400).send({'message': 'Some values are missing'});
      return ;
    }
    if (!helpers.isValidEmail(email)) {
      response.status(400).send({'message': 'Please enter a valid email address'});
      return ;
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const loginQuery = 'SELECT password, id FROM users WHERE email = $1';
      const { rows }: pg.QueryResult = await client.query(loginQuery, [email]);
      if (!rows[0]) {
        response.status(400).send({'message': 'The credentials you provided are incorrect'});
        await client.query('ROLLBACK');
        return ;
      }
      if (!helpers.comparePassword(rows[0].password, password)) {
        response.status(400).send({'message': 'The credentials you provided are incorrect'});
        await client.query('ROLLBACK');
        return ;
      }
      const userId: string = rows[0].id;
      const tokens: Tokens = await this.setTokens(userId, client);
      response.status(200).send(tokens);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }
  
  async setTokens(userId: string, client: pg.PoolClient): Promise<Tokens> {
    const accessToken: string = helpers.generateAccessToken(userId);
    const refreshToken: string = helpers.generateRefreshToken();
    await this.setRefreshToken(userId, refreshToken, client);
    return {
      userId: userId,
      accessToken: accessToken,
      refreshToken: refreshToken
    }
  }

  async setRefreshToken(userId: string, refreshToken: string, client: pg.PoolClient): Promise<void> {
    const getRefreshTokenQuery = 'SELECT user_id FROM users_refresh_tokens WHERE user_id = $1';
    const { rows }: pg.QueryResult = await client.query(getRefreshTokenQuery, [userId]);
    if (!rows[0]) {
      await this.addRefreshToken(userId, refreshToken, client);
    } else {
      await this.updateRefreshToken(userId, refreshToken, client);
    }
  }

  async addRefreshToken(userId: string, refreshToken: string, client: pg.PoolClient): Promise<void> {
    const insertRefreshTokenQuery = `INSERT INTO 
      users_refresh_tokens (user_id, refresh_token) 
      VALUES ($1, $2)`;
    const values: Array<string> = [
      userId,
      refreshToken
    ];     
    await client.query(insertRefreshTokenQuery, values);
  }

  async updateRefreshToken(userId: string, refreshToken: string, client: pg.PoolClient): Promise<void> {
    const updateRefreshTokenQuery = `UPDATE users_refresh_tokens SET refresh_token = $1 WHERE user_id = $2`;
    const values: Array<string> = [
      refreshToken,
      userId
    ];      
    await client.query(updateRefreshTokenQuery, values);
  }

  async revokeRefreshToken(userId: string, client: pg.PoolClient): Promise<void> {
    const deleteRefreshTokenQuery = 'DELETE FROM users_refresh_tokens WHERE user_id = $1';
    await client.query(deleteRefreshTokenQuery, [userId]);
  }  

  async logout(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await this.revokeRefreshToken(userId || '', client);
      const deleteFCMTokenQuery = 'DELETE FROM users_fcm_tokens WHERE user_id = $1';
      await client.query(deleteFCMTokenQuery, [userId]);      
      response.status(200).json()
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }    
  }  

  async verifyAccessToken(request: Request, response: Response, next: NextFunction): Promise<void> {
    if (!request.headers.authorization) {
      response.status(401).send({'message': 'Token is not provided'});
      return ;
    }  
    const token = request.headers.authorization.replace('Bearer ','');
    if (!token) {
      response.status(401).send({'message': 'Token is not provided'});
      return ;
    }
    try {
      const decoded = await jwt.verify(token, process.env.JWT_SECRET_KEY as string) as Token;
      const getUsersQuery = `
        SELECT 
          u.id, 
          u.organization_id, 
          ap.is_org_manager,
          ap.is_center_manager,
          ap.is_admin 
        FROM 
          users u
        LEFT JOIN
          admin_permissions ap ON u.id = ap.user_id
        WHERE 
          u.id = $1`;
      const { rows }: pg.QueryResult = await pool.query(getUsersQuery, [decoded.userId]);
      if (!rows[0]) {
        response.status(401).send({'message': 'The token you provided is invalid'});
        return ;
      }
      
      const {
        id,
        organization_id: orgId,
        is_org_manager: isOrgManager,
        is_center_manager: isCenterManager,
        is_admin: isAdmin
      } = rows[0];
      request.user = { id, orgId, isAdmin, isOrgManager, isCenterManager };
      next();
    } catch (error) {
      response.status(401).send(error);
    }
  }

  async getAccessToken(request: Request, response: Response): Promise<void> {
    const userId = request.params.id;
    const refreshToken = request.query.refreshToken as string;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const getRefreshTokenQuery = 'SELECT user_id FROM users_refresh_tokens WHERE user_id = $1 AND refresh_token = $2';
      const { rows }: pg.QueryResult = await client.query(getRefreshTokenQuery, [userId, refreshToken]);
      if (rows[0]) {
        const tokens: Tokens = await this.setTokens(userId, client);
        response.status(200).send(tokens);
      } else {
        this.revokeRefreshToken(userId, client);
        response.status(401).send({'message': 'Refresh token is invalid'});
      }
      await client.query('COMMIT'); 
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }
}