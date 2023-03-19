import { Request, Response } from 'express';
import pg from 'pg';
import 'moment-timezone';
import { Conn } from '../db/conn';
import { Helpers } from '../utils/helpers';
import { UsersAvailableMentors } from './users_available_mentors';
import User from '../models/user.model';

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();
const usersAvailableMentors: UsersAvailableMentors = new UsersAvailableMentors();

export class AdminAvailableMentors {
  constructor() {
    helpers.autoBind(this);
  }

  async getAvailableMentorsLessons(request: Request, response: Response): Promise<void> {
    const client = await pool.connect();    
    try {
      await client.query('BEGIN');
      const lessons = await usersAvailableMentors.getAvailableMentorsLessons(undefined, client);
      response.status(200).json(lessons);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');      
    } finally {
      client.release();
    }
  }
  
  async updateShouldContact(request: Request, response: Response): Promise<void> {
    const mentorId = request.params.mentor_id;
    const { shouldContact, lastContactedDateTime }: User = request.body;
    const client = await pool.connect();    
    try {
      const getShouldContactQuery = 'SELECT id FROM admin_available_users WHERE user_id = $1';
      const { rows }: pg.QueryResult = await client.query(getShouldContactQuery, [mentorId]);
      if (rows[0]) {
        const updateShouldContactQuery = `UPDATE admin_available_users
          SET should_contact = $1, last_contacted_date_time = $2 WHERE user_id = $3`;
        const values = [shouldContact, lastContactedDateTime, mentorId];
        await client.query(updateShouldContactQuery, values);
      } else {
        const insertShouldContactQuery = `INSERT INTO admin_available_users (user_id, should_contact, last_contacted_date_time)
          VALUES ($1, $2, $3)`;
        const values = [mentorId, shouldContact, lastContactedDateTime];
        await client.query(insertShouldContactQuery, values);    
      }
      response.status(200).json(`Last contacted date/time has been updated for user: ${mentorId}`);
      await client.query('COMMIT');      
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');      
    } finally {
      client.release();
    }
  }  
}