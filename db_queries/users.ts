import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import pg from 'pg';
import { Conn } from '../db/conn';
import Tokens from '../models/tokens.model';
import { Helpers } from '../utils/helpers';
import { v4 as uuidv4 } from 'uuid';
import User from '../models/user.model';

const helpers: Helpers = new Helpers();
const conn: Conn = new Conn();
const pool = conn.pool;

export class Users {
  constructor() {
    autoBind(this);
  }
  
  async createUser(request: Request, response: Response): Promise<void> {
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
      const hashPassword: string = helpers.hashPassword(password);  
      const createQuery: string = `INSERT INTO 
        users (id, name, email, password) 
        VALUES ($1, $2, $3, $4) 
        returning *`;
      const values: Array<string> = [
        uuidv4(),
        name,
        email,
        hashPassword
      ];
      const { rows }: pg.QueryResult = await pool.query(createQuery, values);
      const userId: string = rows[0].id;
      const tokens: Tokens = await this.setTokens(userId);
      response.status(201).send(tokens);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async setTokens(userId: string): Promise<Tokens> {
    const accessToken: string = helpers.generateAccessToken(userId);
    const refreshToken: string = helpers.generateRefreshToken(userId);
    await this.setRefreshToken(userId, refreshToken);
    return {
      userId: userId,
      accessToken: accessToken,
      refreshToken: refreshToken
    }
  }

  async setRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const getQuery: string = 'SELECT * FROM refresh_tokens WHERE user_id = $1';
    const { rows }: pg.QueryResult = await pool.query(getQuery, [userId]);
    if (!rows[0]) {
      await this.insertRefreshToken(userId, refreshToken);
    } else {
      await this.updateRefreshToken(userId, refreshToken);
    }
  }

  async insertRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const insertQuery: string = `INSERT INTO 
      refresh_tokens (user_id, refresh_token) 
      VALUES ($1, $2)`;
    const values: Array<string> = [
      userId,
      refreshToken
    ];     
    await pool.query(insertQuery, values);
  }

  async updateRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const updateQuery: string = `UPDATE refresh_tokens SET refresh_token = $1 WHERE user_id = $2`;
    const values: Array<string> = [
      refreshToken,
      userId
    ];      
    await pool.query(updateQuery, values);
  }

  async loginUser(request: Request, response: Response): Promise<void> {
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
      const loginQuery: string = 'SELECT * FROM users WHERE email = $1';
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
      response.status(201).send(tokens);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async revokeRefreshToken(userId: string): Promise<void> {
    const deleteQuery: string = 'DELETE FROM refresh_tokens WHERE user_id = $1';
    await pool.query(deleteQuery, [userId]);
  }

  async logoutUser(request: Request, response: Response): Promise<void> {
    const { id }: User = request.body;
    try {
      await this.revokeRefreshToken(id);
      response.status(200).json()
    } catch (error) {
      response.status(400).send(error);
    }    
  }



  async getUsers(request: Request, response: Response): Promise<void> {
    try {
      const getQuery: string = 'SELECT * FROM users ORDER BY id ASC';
      const { rows }: pg.QueryResult = await pool.query(getQuery);
      response.status(200).json(rows);
    } catch (error) {
      response.status(400).send(error);
    }   
  }

  async getUserById(request: Request, response: Response): Promise<void> {
    const id: string = request.params.id;    
    try {
      const getQuery: string = 'SELECT * FROM users WHERE id = $1';
      const { rows }: pg.QueryResult = await pool.query(getQuery, [id]);
      response.status(200).json(rows);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async updateUser(request: Request, response: Response): Promise<void> {
    const id: string = request.params.id;
    const { name, email }: { name: string, email: string } = request.body
    try {
      const updateQuery: string = 'UPDATE users SET name = $1, email = $2 WHERE id = $3';
      await pool.query(updateQuery, [name, email, id]);
      response.status(200).send(`User modified with ID: ${id}`);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async deleteUser(request: Request, response: Response): Promise<void> {
    const id: string = request.params.id;
    try {
      const deleteQuery: string = 'DELETE FROM users WHERE id = $1';
      await pool.query(deleteQuery, [id]);
      response.status(200).send(`User deleted with ID: ${id}`);
    } catch (error) {
      response.status(400).send(error);
    }    
  }
}

