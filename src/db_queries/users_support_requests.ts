import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import moment from 'moment';
import 'moment-timezone';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { UsersTimeZones } from './users_timezones';
import SupportRequest from '../models/support_request.model';
import TimeZone from '../models/timezone.model';

const conn: Conn = new Conn();
const pool = conn.pool;
const usersTimeZones: UsersTimeZones = new UsersTimeZones();

export class UsersSupportRequests {
  constructor() {
    autoBind(this);
  }

  async addSupportRequest(request: Request, response: Response): Promise<void> {
    const userId: string = request.params.user_id;
    const { text }: SupportRequest = request.body
    try {
      const timeZone: TimeZone = await usersTimeZones.getUserTimeZone(userId);
      const insertSupportRequestQuery = `INSERT INTO users_support_requests (user_id, text, date_time)
        VALUES ($1, $2, $3)`;
      const dateTime = moment.tz(new Date(), timeZone?.name).format(constants.DATE_FORMAT);
      const values = [userId, text, dateTime];
      await pool.query(insertSupportRequestQuery, values);
      response.status(200).send('Support request has been added');
    } catch (error) {
      response.status(400).send(error);
    }
  }  
}

