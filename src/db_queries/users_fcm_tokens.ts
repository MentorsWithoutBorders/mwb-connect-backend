import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import pg from 'pg';
import { Conn } from '../db/conn';
import FCMToken from '../models/fcm_token.model';

const conn: Conn = new Conn();
const pool = conn.pool;

export class UsersFCMTokens {
  constructor() {
    autoBind(this);
  }

  async getUserFCMToken(userId: string): Promise<FCMToken> {
    const getFCMTokenQuery = 'SELECT fcm_token FROM users_fcm_tokens WHERE user_id = $1';
    const { rows }: pg.QueryResult = await pool.query(getFCMTokenQuery, [userId]);
    return {
      token: rows[0].fcm_token
    }
  }

  async addFCMToken(request: Request, response: Response): Promise<void> {
    const userId: string = request.user.id as string;
    const { token }: FCMToken = request.body
    try {
      const insertFCMTokenQuery = `INSERT INTO users_fcm_tokens (user_id, fcm_token) VALUES ($1, $2)`;
      const values = [userId, token];        
      await pool.query(insertFCMTokenQuery, values);
      response.status(200).send('FCM token has been added');
    } catch (error) {
      response.status(400).send(error);
    }
  }
}

