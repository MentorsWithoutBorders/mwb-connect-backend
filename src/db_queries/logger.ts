// @ts-nocheck

import { Request, Response } from 'express';
import moment from 'moment';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Helpers } from '../utils/helpers';
import LogEntry from '../models/log_entry.model';

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();

export class Logger {
  constructor() {
    helpers.autoBind(this);
  }

  async addLogEntry(request: Request, response: Response): Promise<void> {
    const userId = request.user?.id;
    const { text }: LogEntry = request.body;
    try {
      const insertLogEntryQuery =
        'INSERT INTO logger (user_id, log_entry, date_time) VALUES ($1, $2, $3)';
      const dateTime = moment.utc().format(constants.DATE_TIME_FORMAT);
      await pool.query(insertLogEntryQuery, [userId, text, dateTime]);
      response.status(200).send(`Log entry added`);
    } catch (error) {
      response.status(400).send(error);
    }
  }
}
