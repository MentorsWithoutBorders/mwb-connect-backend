// @ts-nocheck

import { Request, Response } from 'express';
import moment from 'moment';
import { Conn } from '../db/conn';
import { Helpers } from '../utils/helpers';
import SupportRequest from '../models/support_request.model';

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();

export class UsersSupportRequests {
  constructor() {
    helpers.autoBind(this);
  }

  async addSupportRequest(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const { text }: SupportRequest = request.body;
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
