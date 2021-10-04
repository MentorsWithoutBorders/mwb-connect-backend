import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import moment from 'moment';
import 'moment-timezone';
import pg from 'pg';
import { Conn } from '../db/conn';
import TimeZone from '../models/timezone.model';

const conn = new Conn();
const pool = conn.pool;

export class UsersTimeZones {
  constructor() {
    autoBind(this);
  }

  async getUserTimeZone(userId: string, client: pg.PoolClient): Promise<TimeZone> {
    const getTimeZoneQuery = `SELECT abbreviation, name, utc_offset FROM users_timezones WHERE user_id = $1`;
    const { rows }: pg.QueryResult = await client.query(getTimeZoneQuery, [userId]);
    let timeZone: TimeZone = {
      name: 'UTC',
      abbreviation: 'UTC',
      offset: '00:00:00'
    }
    if (rows[0]) {
      timeZone = {
        abbreviation: rows[0].abbreviation,
        name: rows[0].name,
        offset: rows[0].utc_offset
      }
    }
    return timeZone;
  }  

  async addTimeZone(userId: string, timeZone: TimeZone, client: pg.PoolClient): Promise<void> {
    const insertTimeZoneQuery = `INSERT INTO users_timezones (user_id, abbreviation, name, utc_offset) VALUES ($1, $2, $3, $4)`;
    const timezoneAbbreviation = this.getTimeZoneAbbreviation(timeZone.name, timeZone.abbreviation);
    const values = [userId, timezoneAbbreviation, timeZone.name, timeZone.offset];        
    await client.query(insertTimeZoneQuery, values);
  }

  getTimeZoneAbbreviation(timeZoneName: string, abbreviation: string): string {
    return abbreviation != null && abbreviation.indexOf('+') > -1 ? moment.tz(timeZoneName).zoneAbbr() : abbreviation;
  }

  async updateTimeZone(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const { name, abbreviation, offset }: TimeZone = request.body
    try {
      const updateTimeZoneQuery = 'UPDATE users_timezones SET name = $1, abbreviation = $2, utc_offset = $3 WHERE user_id = $4';
      const timezoneAbbreviation = this.getTimeZoneAbbreviation(name, abbreviation);
      await pool.query(updateTimeZoneQuery, [name, timezoneAbbreviation, offset, userId]);
      response.status(200).send(`User timezone modified with ID: ${userId}`);
    } catch (error) {
      response.status(400).send(error);
    }
  }  
}

