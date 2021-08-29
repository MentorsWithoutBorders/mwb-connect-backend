import autoBind from 'auto-bind';
import pg from 'pg';
import TimeZone from '../models/timezone.model';

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
    const values = [userId, timeZone.abbreviation, timeZone.name, timeZone.offset];        
    await client.query(insertTimeZoneQuery, values);
  }
}

