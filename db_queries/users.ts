import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import pg from 'pg';
import { Conn } from '../db/conn';
import { Auth } from './auth';
import User from '../models/user.model';

const conn: Conn = new Conn();
const pool = conn.pool;
const auth: Auth = new Auth();

export class Users {
  constructor() {
    autoBind(this);
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
    const { name, email }: User = request.body
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
      await auth.revokeRefreshToken(id);
      response.status(200).send(`User deleted with ID: ${id}`);
    } catch (error) {
      response.status(400).send(error);
    }    
  }
}

