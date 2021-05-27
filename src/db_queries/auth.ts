import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import dotenv from 'dotenv';
import autoBind from 'auto-bind';
import { v4 as uuidv4 } from 'uuid';
import { Conn } from '../db/conn';
import { Helpers } from '../utils/helpers';
import Token from '../models/token.model';
import Tokens from '../models/tokens.model';
import User from '../models/user.model';
import Field from '../models/field.model';
import Organization from '../models/organization.model';

const helpers: Helpers = new Helpers();
const conn: Conn = new Conn();
const pool = conn.pool;
dotenv.config();

export class Auth {
  constructor() {
    autoBind(this);
  }

  async signUp(request: Request, response: Response): Promise<void> {
    const { name, email, password }: User = request.body;
    if (!email || !password) {
      response.status(400).send({'message': 'Some values are missing'});
      return ;
    }
    if (!helpers.isValidEmail(email)) {
      response.status(400).send({'message': 'Please enter a valid email address'});
      return ;
    }
    
    try {
      const usersQuery = 'SELECT * FROM users WHERE email = $1';
      let { rows }: pg.QueryResult = await pool.query(usersQuery, [email]);
      if (rows[0]) {
        response.status(400).send({'message': 'User already exists.'});
        return ;
      }

      const approvedUser: User = await this.getApprovedUser(email);
      if (approvedUser.email == undefined) {
        response.status(400).send({'message': 'You have to be a student from one of our partner NGOs or an employee of one of our partner companies.'});
        return ;
      }

      const hashPassword: string = helpers.hashPassword(password);  
      const createQuery = `INSERT INTO 
        users (id, name, email, password, field_id, organization_id, is_mentor) 
        VALUES ($1, $2, $3, $4, $5, $6, $7) 
        returning *`;
      const values: Array<string> = [
        uuidv4(),
        name || '',
        email,
        hashPassword,
        approvedUser.field != null ? approvedUser.field.id : '',
        approvedUser.organization != null ? approvedUser.organization.id : '',
        String(approvedUser.isMentor)
      ];
      ({ rows } = await pool.query(createQuery, values));
      const userId: string = rows[0].id;
      const tokens: Tokens = await this.setTokens(userId);
      response.status(200).send(tokens);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async getApprovedUser(email: string): Promise<User> {
    let approvedUser: User = {
      email: email
    };
    const approvedQuery = 'SELECT * FROM approved_users WHERE email = $1';
    const { rows }: pg.QueryResult = await pool.query(approvedQuery, [email]);
    if (!rows[0]) {
      approvedUser.email = undefined;
    } else {
      const field: Field = {
        id: rows[0].field_id
      }
      const organization: Organization = {
        id: rows[0].organization_id
      }      
      approvedUser = {
        email: email,
        field: field,
        organization: organization,
        isMentor: rows[0].is_mentor
      };
    }
    return approvedUser;
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
    const getQuery = 'SELECT * FROM refresh_tokens WHERE user_id = $1';
    const { rows }: pg.QueryResult = await pool.query(getQuery, [userId]);
    if (!rows[0]) {
      await this.insertRefreshToken(userId, refreshToken);
    } else {
      await this.updateRefreshToken(userId, refreshToken);
    }
  }

  async insertRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const insertQuery = `INSERT INTO 
      refresh_tokens (user_id, refresh_token) 
      VALUES ($1, $2)`;
    const values: Array<string> = [
      userId,
      refreshToken
    ];     
    await pool.query(insertQuery, values);
  }

  async updateRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const updateQuery = `UPDATE refresh_tokens SET refresh_token = $1 WHERE user_id = $2`;
    const values: Array<string> = [
      refreshToken,
      userId
    ];      
    await pool.query(updateQuery, values);
  }

  async revokeRefreshToken(userId: string): Promise<void> {
    const deleteQuery = 'DELETE FROM refresh_tokens WHERE user_id = $1';
    await pool.query(deleteQuery, [userId]);
  }  

  async logout(request: Request, response: Response): Promise<void> {
    const { id }: User = request.body;
    try {
      await this.revokeRefreshToken(id || '');
      response.status(200).json()
    } catch (error) {
      response.status(400).send(error);
    }    
  }  

  async verifyAccessToken(request: Request, response: Response, next: NextFunction): Promise<void> {
    const { name, email, password }: User = request.body;
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
      const usersQuery = 'SELECT * FROM users WHERE id = $1';
      const { rows }: pg.QueryResult = await pool.query(usersQuery, [decoded.userId]);
      if (!rows[0]) {
        response.status(401).send({'message': 'The token you provided is invalid'});
        return ;
      }
      request.user = { id: (decoded as Token).userId, name: name, email: email, password: password };
      next();
    } catch (error) {
      response.status(401).send(error);
    }
  }

  async getAccessToken(request: Request, response: Response): Promise<void> {
    const userId: string = request.query.userId as string;
    const refreshToken: string = request.query.refreshToken as string;
    try {
      const getQuery = 'SELECT * FROM refresh_tokens WHERE user_id = $1 AND refresh_token = $2';
      const { rows }: pg.QueryResult = await pool.query(getQuery, [userId, refreshToken]);
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