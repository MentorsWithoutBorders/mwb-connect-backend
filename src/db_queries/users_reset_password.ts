import { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import autoBind from 'auto-bind';
import pg from 'pg';
import moment from 'moment'
import dotenv from 'dotenv';
import { Conn } from '../db/conn';
import { Helpers } from '../utils/helpers';
import ResetPassword from '../models/reset_password.model';

const conn: Conn = new Conn();
const helpers: Helpers = new Helpers();
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
      response.status(500).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }   

  async addUserResetPassword(request: Request, response: Response): Promise<void> {
    const email: string = request.params.email;
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
        this.sendEmail(email, rows[0].id);
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

  sendEmail(email: string, id: string): void {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_SERVER as string,
      port: parseInt(process.env.SMTP_PORT as string),
      auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD
      }
    });
    
    const link = `https://www.mentorswithoutborders.net/reset-password.php?uuid=${id}`;
    transporter.sendMail({
      to: email,
      from: process.env.SMTP_SENDER,
      subject: 'Password reset request',
      html: `Please use the link below in order to reset your password:<br><br>${link}<br><br>`
    })
      .then(() => console.log(`Reset password link successfully sent for user: ${email}`))
      .catch(() => console.log(`Reset password link wasn't sent for user: ${email}`))    
  }
}

