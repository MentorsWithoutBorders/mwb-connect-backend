import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import dotenv from 'dotenv';
import autoBind from 'auto-bind';
import moment from 'moment';
import { v4 as uuidv4 } from 'uuid';
import { Conn } from '../db/conn';
import { Helpers } from '../utils/helpers';
import { UsersGoals } from './users_goals';
import { UsersTimeZones } from './users_timezones';
import Token from '../models/token.model';
import Tokens from '../models/tokens.model';
import User from '../models/user.model';
import ApprovedUser from '../models/approved_user.model';
import Field from '../models/field.model';
import Organization from '../models/organization.model';
import Availability from '../models/availability.model';
import Time from '../models/time.model';
import LessonsAvailability from '../models/lessons_availability';
import TimeZone from '../models/timezone.model';
import NotificationsSettings from '../models/notifications_settings.model';

const conn: Conn = new Conn();
const pool = conn.pool;
const helpers: Helpers = new Helpers();
const usersGoals: UsersGoals = new UsersGoals();
const usersTimeZones: UsersTimeZones = new UsersTimeZones();
dotenv.config();

export class Auth {
  constructor() {
    autoBind(this);
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
    
    try {
      const getUsersQuery = 'SELECT * FROM users WHERE email = $1';
      let { rows }: pg.QueryResult = await pool.query(getUsersQuery, [email]);
      if (rows[0]) {
        response.status(400).send({'message': 'User already exists.'});
        return ;
      }

      const approvedUser: ApprovedUser = await this.getApprovedUser(email);
      if (approvedUser.email == '') {
        response.status(400).send({'message': 'You have to be a student from one of our partner NGOs or an employee of one of our partner companies.'});
        return ;
      }

      const hashPassword: string = helpers.hashPassword(password);  
      const createUserQuery = `INSERT INTO 
        users (id, name, email, password, field_id, organization_id, is_mentor, available_from, registered_on) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
        returning *`;
      const values = [
        uuidv4(),
        name || approvedUser.name || '',
        email,
        hashPassword,
        approvedUser.field != null ? approvedUser.field.id : '',
        approvedUser.organization != null ? approvedUser.organization.id as string : '',
        String(approvedUser.isMentor),
        moment.utc(),
        moment.utc()
      ];
      ({ rows } = await pool.query(createUserQuery, values));
      const userId: string = rows[0].id;
      await this.setDefaultUserProfile(userId, approvedUser.isMentor as boolean);
      await usersTimeZones.addTimeZone(userId, timeZone as TimeZone);
      if (!approvedUser.isMentor) {
        await usersGoals.addGoalToDB(userId, approvedUser.goal as string);
      }
      const tokens: Tokens = await this.setTokens(userId);
      response.status(200).send(tokens);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async getApprovedUser(email: string): Promise<ApprovedUser> {
    let approvedUser: ApprovedUser = {
      email: email
    };
    const getApprovedUserQuery = 'SELECT * FROM approved_users WHERE email = $1';
    const { rows }: pg.QueryResult = await pool.query(getApprovedUserQuery, [email]);
    if (!rows[0]) {
      approvedUser.email = '';
    } else {
      const field: Field = {
        id: rows[0].field_id
      }
      const organization: Organization = {
        id: rows[0].organization_id
      }      
      approvedUser = {
        email: email,
        name: rows[0].name,
        field: field,
        organization: organization,
        isMentor: rows[0].is_mentor,
        goal: rows[0].goal
      };
    }
    return approvedUser;
  }

  async setDefaultUserProfile(userId: string, isMentor: boolean): Promise<void> {
    const getDefaultUserQuery = 'SELECT * FROM user_default_profile';
    const { rows }: pg.QueryResult = await pool.query(getDefaultUserQuery);
    const time: Time = {
      from: rows[0].availability_time_from,
      to: rows[0].availability_time_to
    };
    const availability: Availability = {
      dayOfWeek: rows[0].availability_day_of_week,
      time: time
    };
    const lessonsAvailability: LessonsAvailability = {
      minInterval: rows[0].lessons_availability_min_interval,
      minIntervalUnit: rows[0].lessons_availability_min_interval_unit,
      maxStudents: rows[0].lessons_availability_max_students
    };
    const notificationsSettings: NotificationsSettings = {
      enabled: rows[0].notifications_enabled,
      time: rows[0].notifications_time
    }
    const defaultUser: User = {
      isAvailable: rows[0].is_available,
      availabilities: [availability],
      lessonsAvailability: lessonsAvailability
    };
    const updateUserQuery = `UPDATE users SET is_available = $1 WHERE id = $2`;
    await pool.query(updateUserQuery, [defaultUser.isAvailable, userId]);    
    const insertUserAvailabilityQuery = `INSERT INTO users_availabilities (user_id, day_of_week, time_from, time_to)
      VALUES ($1, $2, $3, $4)`;
    await pool.query(insertUserAvailabilityQuery, [userId, availability.dayOfWeek, availability.time.from, availability.time.to]);
    if (isMentor) {
      const insertUserLessonsAvailabilityQuery = `INSERT INTO users_lessons_availabilities (user_id, min_interval, min_interval_unit, max_students)
        VALUES ($1, $2, $3, $4)`;
      await pool.query(insertUserLessonsAvailabilityQuery, [userId, lessonsAvailability.minInterval, lessonsAvailability.minIntervalUnit, lessonsAvailability.maxStudents]);
    }
    const insertNotificationsSettingsQuery = `INSERT INTO users_notifications_settings (user_id, enabled, time)
      VALUES ($1, $2, $3)`;
    await pool.query(insertNotificationsSettingsQuery, [userId, notificationsSettings.enabled, notificationsSettings.time]);    
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
    
    try {
      const loginQuery = 'SELECT * FROM users WHERE email = $1';
      const { rows }: pg.QueryResult = await pool.query(loginQuery, [email]);
      if (!rows[0]) {
        response.status(400).send({'message': 'The credentials you provided are incorrect'});
        return ;
      }
      if (!helpers.comparePassword(rows[0].password, password)) {
        response.status(400).send({'message': 'The credentials you provided are incorrect'});
        return ;
      }
      const userId: string = rows[0].id;
      const tokens: Tokens = await this.setTokens(userId);
      response.status(200).send(tokens);
    } catch (error) {
      response.status(400).send(error);
    }
  }
  
  async setTokens(userId: string): Promise<Tokens> {
    const accessToken: string = helpers.generateAccessToken(userId);
    const refreshToken: string = helpers.generateRefreshToken();
    await this.setRefreshToken(userId, refreshToken);
    return {
      userId: userId,
      accessToken: accessToken,
      refreshToken: refreshToken
    }
  }

  async setRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const getRefreshTokenQuery = 'SELECT * FROM users_refresh_tokens WHERE user_id = $1';
    const { rows }: pg.QueryResult = await pool.query(getRefreshTokenQuery, [userId]);
    if (!rows[0]) {
      await this.addRefreshToken(userId, refreshToken);
    } else {
      await this.updateRefreshToken(userId, refreshToken);
    }
  }

  async addRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const insertRefreshTokenQuery = `INSERT INTO 
      users_refresh_tokens (user_id, refresh_token) 
      VALUES ($1, $2)`;
    const values: Array<string> = [
      userId,
      refreshToken
    ];     
    await pool.query(insertRefreshTokenQuery, values);
  }

  async updateRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const updateRefreshTokenQuery = `UPDATE users_refresh_tokens SET refresh_token = $1 WHERE user_id = $2`;
    const values: Array<string> = [
      refreshToken,
      userId
    ];      
    await pool.query(updateRefreshTokenQuery, values);
  }

  async revokeRefreshToken(userId: string): Promise<void> {
    const deleteRefreshTokenQuery = 'DELETE FROM users_refresh_tokens WHERE user_id = $1';
    await pool.query(deleteRefreshTokenQuery, [userId]);
  }  

  async logout(request: Request, response: Response): Promise<void> {
    const userId: string = request.user.id as string;
    try {
      await this.revokeRefreshToken(userId || '');
      response.status(200).json()
    } catch (error) {
      response.status(400).send(error);
    }    
  }  

  async verifyAccessToken(request: Request, response: Response, next: NextFunction): Promise<void> {
    if (!request.headers.authorization) {
      response.status(401).send({'message': 'Token is not provided'});
      return ;
    }  
    const token: string = request.headers.authorization.replace('Bearer ','');
    if (!token) {
      response.status(401).send({'message': 'Token is not provided'});
      return ;
    }
    try {
      const decoded: Token = await jwt.verify(token, process.env.JWT_SECRET_KEY as string) as Token;
      const getUsersQuery = 'SELECT * FROM users WHERE id = $1';
      const { rows }: pg.QueryResult = await pool.query(getUsersQuery, [decoded.userId]);
      if (!rows[0]) {
        response.status(401).send({'message': 'The token you provided is invalid'});
        return ;
      }
      request.user = {id: decoded.userId}
      next();
    } catch (error) {
      response.status(401).send(error);
    }
  }

  async getAccessToken(request: Request, response: Response): Promise<void> {
    const userId: string = request.user.id as string;
    const refreshToken: string = request.query.refreshToken as string;
    try {
      const getRefreshTokenQuery = 'SELECT * FROM users_refresh_tokens WHERE user_id = $1 AND refresh_token = $2';
      const { rows }: pg.QueryResult = await pool.query(getRefreshTokenQuery, [userId, refreshToken]);
      if (rows[0]) {
        const tokens: Tokens = await this.setTokens(userId);
        response.status(200).send(tokens);
      } else {
        this.revokeRefreshToken(userId);
        response.status(401).send({'message': 'Refresh token is invalid'});
      }      
    } catch (error) {
      response.status(400).send(error);
    } 
  }
}