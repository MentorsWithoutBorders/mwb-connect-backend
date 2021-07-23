import autoBind from 'auto-bind';
import pg from 'pg';
import { Conn } from '../db/conn';
import TimeZone from '../models/timezone.model';

const conn: Conn = new Conn();
const pool = conn.pool;

export class UsersTimeZones {
  constructor() {
    autoBind(this);
  }

  async getUserTimeZone(userId: string): Promise<TimeZone> {
    const getTimeZoneQuery = 'SELECT abbreviation, name, offset FROM users_timezones WHERE user_id = $1';
    const { rows }: pg.QueryResult = await pool.query(getTimeZoneQuery, [userId]);
    return {
      abbreviation: rows[0].abbreviation,
      name: rows[0].name,
      offset: rows[0].offset
    }
  }

  async addTimeZone(userId: string, timeZone: TimeZone, client: pg.PoolClient): Promise<void> {
    const insertTimeZoneQuery = `INSERT INTO users_timezones (user_id, abbreviation, name, utc_offset) VALUES ($1, $2, $3, $4)`;
    const values = [userId, timeZone.abbreviation, timeZone.name, timeZone.offset];        
    await client.query(insertTimeZoneQuery, values);
  }
}

