import { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import autoBind from 'auto-bind';
import pg from 'pg';
import moment from 'moment'
import { Conn } from '../db/conn';
import ResetPassword from '../models/reset_password.model';

const conn: Conn = new Conn();
const pool = conn.pool;

export class UsersResetPassword {
  constructor() {
    autoBind(this);
  }

  async getUserResetPassword(request: Request, response: Response): Promise<void> {
    const userId: string = request.user.id as string;
    try {
      const getResetPasswordQuery = `SELECT is_resuming FROM users_reset_password
        WHERE user_id = $1 
        ORDER BY pause_datetime DESC 
        LIMIT 1`;
      const { rows }: pg.QueryResult = await pool.query(getResetPasswordQuery, [userId]);
      const resetPassword: ResetPassword = {
        
      }
      response.status(200).send(resetPassword);
    } catch (error) {
      response.status(400).send(error);
    }
  }   

  async addUserResetPassword(request: Request, response: Response): Promise<void> {
    const email: string = request.params.email;
    const client: pg.PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      const findUserQuery = `SELECT id FROM users WHERE email = $1`;
      const { rows }: pg.QueryResult = await client.query(findUserQuery, [email]);
      if (rows[0]) {
        const deleteResetPasswordQuery = `DELETE FROM users_reset_password 
          WHERE email = $1`;
        await client.query(deleteResetPasswordQuery, [email]);      
        const insertResetPasswordQuery = `INSERT INTO users_reset_password (email, date_time)
          VALUES ($1, $2)`;
        const dateTime = moment.utc();
        const values = [email, dateTime];        
        await client.query(insertResetPasswordQuery, values);
        this.sendEmail(email);
      }
      response.status(200).send('Reset password data inserted');
      await client.query('COMMIT');
    } catch (error) {
      response.status(500).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  sendEmail(email: string): void {
    const transporter = nodemailer.createTransport({
      service: 'SendinBlue', 
      auth: {
        user: 'edmondpr@gmail.com',
        pass: 'EBadHLRxnjWOqfQv'
      }
    });
    
    transporter.sendMail({
      to: email,
      from: 'edmond@mwbtraining.net',
      subject: 'Signup verification',
      html: 'Verification email'
    })
      .then((res) => console.log(res))
      .catch((err) => console.log(err))    
  }
}

