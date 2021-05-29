import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import pg from 'pg';
import { Conn } from '../db/conn';
import Availability from '../models/availability.model';
import Time from '../models/time.model';

const conn: Conn = new Conn();
const pool = conn.pool;

export class Availabilities {
  constructor() {
    autoBind(this);
  }

  async getAvailabilities(request: Request, response: Response): Promise<void> {
    const userId: string = request.params.user_id;
    try {
      const getAvailabilitiesQuery = `SELECT * FROM availabilities
        WHERE user_id = $1`;
      const { rows }: pg.QueryResult = await pool.query(getAvailabilitiesQuery, [userId]);
      const availabilities: Array<Availability> = [];
      for (const row of rows) {
        const time: Time = {
          from: row.time_from,
          to: row.time_to
        }
        const availability: Availability = {
          dayOfWeek: row.day_of_week,
          time: time
        };
        availabilities.push(availability);
      }
      response.status(200).json(availabilities);
    } catch (error) {
      response.status(400).send(error);
    } 
  }
}

