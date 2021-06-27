import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import moment from 'moment';
import { Conn } from '../db/conn';
import SupportRequest from '../models/support_request.model';

const conn: Conn = new Conn();
const pool = conn.pool;

export class UsersSupportRequests {
  constructor() {
    autoBind(this);
  }

  async addSupportRequest(request: Request, response: Response): Promise<void> {
    const userId: string = request.params.id;
    const { text }: SupportRequest = request.body
    try {
      const insertSupportRequestQuery = `INSERT INTO users_support_requests (user_id, text, date_time)
        VALUES ($1, $2, $3)`;
      const dateTime = moment.utc();
      const values = [userId, text, dateTime];
      await pool.query(insertSupportRequestQuery, values);
      response.status(200).send('Support request has been added');
    } catch (error) {
      response.status(400).send(error);
    }
  }  
}

