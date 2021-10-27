import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import pg from 'pg';
import moment from 'moment'
import dotenv from 'dotenv';
import { Conn } from '../db/conn';
import { UsersSendEmails } from './users_send_emails';
import { Helpers } from '../utils/helpers';
import ResetPassword from '../models/reset_password.model';

const conn = new Conn();
const usersSendEmails = new UsersSendEmails();
const helpers = new Helpers();
const pool = conn.pool;
dotenv.config();

export class UsersResetPassword {
  constructor() {
    autoBind(this);
  }

  async resetPassword(request: Request, response: Response): Promise<void> {
    const { id, newPassword }: ResetPassword = request.body
    const client: pg.PoolClient = await pool.connect();
    try {
      const getEmailQuery = `SELECT email FROM users_reset_password
        WHERE id = $1`;
      const { rows }: pg.QueryResult = await client.query(getEmailQuery, [id]);
      if (rows[0]) {
        const updatePasswordQuery = 'UPDATE users SET password = $1 WHERE email = $2';
        const hashPassword: string = helpers.hashPassword(newPassword as string); 
        await client.query(updatePasswordQuery, [hashPassword, rows[0].email]);
        const deleteResetPasswordQuery = 'DELETE FROM users_reset_password WHERE id = $1';
        await client.query(deleteResetPasswordQuery, [id]);        
      }
      response.status(200).send({});
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }   

  async addUserResetPassword(request: Request, response: Response): Promise<void> {
    const email = request.params.email;
    const client: pg.PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      const findUserQuery = `SELECT id FROM users WHERE email = $1`;
      let { rows }: pg.QueryResult = await client.query(findUserQuery, [email]);
      if (rows[0]) {
        const deleteResetPasswordQuery = `DELETE FROM users_reset_password 
          WHERE email = $1`;
        await client.query(deleteResetPasswordQuery, [email]);      
        const insertResetPasswordQuery = `INSERT INTO users_reset_password (email, date_time)
          VALUES ($1, $2) RETURNING id`;
        const dateTime = moment.utc();
        const values = [email, dateTime];        
        ({ rows } = await client.query(insertResetPasswordQuery, values));
        usersSendEmails.sendEmailResetPassword(email, rows[0].id);
      }
      response.status(200).send('Reset password data inserted');
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }
}

