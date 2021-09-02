import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import moment from 'moment';
import { constants } from '../utils/constants';
import { Conn } from '../db/conn';
import LogEntry from '../models/log_entry.model';

const conn: Conn = new Conn();
const pool = conn.pool;

export class Logger {
  constructor() {
    autoBind(this);
  }

  async addLogEntry(request: Request, response: Response): Promise<void> {
    const { text }: LogEntry = request.body
    try {
      const insertLogEntryQuery = 'INSERT INTO logger (log_entry, date_time) VALUES ($1, $2)';
      const dateTime = moment.utc().format(constants.DATE_TIME_FORMAT);
      await pool.query(insertLogEntryQuery, [text, dateTime]);
      response.status(200).send(`Log entry added`);
    } catch (error) {
      response.status(400).send(error);
    }
  }  
}

