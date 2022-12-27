import { Request, Response } from 'express';
import pg from 'pg';
import autoBind from 'auto-bind';
import moment from 'moment';
import 'moment-timezone';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Users } from './users';
import MentorWaitingRequest from '../models/mentor_waiting_request.model';
import CourseType from '../models/course_type.model';

const conn = new Conn();
const pool = conn.pool;
const users = new Users();

export class MentorsWaitingRequests {
  constructor() {
    autoBind(this);
  }

  async getMentorsWaitingRequests(request: Request, response: Response): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(constants.READ_ONLY_TRANSACTION);
      const getMentorsWaitingRequestsQuery = `SELECT mwr.id, mwr.mentor_id, mwr.course_type_id, ct.duration AS course_duration, ct.is_with_partner, ct.index 
        FROM mentors_waiting_requests mwr
        JOIN courses_types ct
          ON mwr.course_type_id = ct.id
        WHERE mwr.is_canceled IS DISTINCT FROM true`;
      const { rows }: pg.QueryResult = await client.query(getMentorsWaitingRequestsQuery);
      const mentorsWaitingRequests: Array<MentorWaitingRequest> = [];
      for (const row of rows) {
        const mentor = await users.getUserFromDB(row.mentor_id, client);
        const courseType: CourseType = {
          id: row.course_type_id,
          duration: row.course_duration,
          isWithPartner: row.is_with_partner,
          index: row.index
        };      
        const mentorWaitingRequest: MentorWaitingRequest = {
          id: row.id,
          mentor: mentor,
          courseType: courseType
        };
        mentorsWaitingRequests.push(mentorWaitingRequest);
      }      
      response.status(200).json(mentorsWaitingRequests);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }  
  }

  async getCurrentMentorWaitingRequest(request: Request, response: Response): Promise<void> {
    const mentorId = request.user.id as string;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(constants.READ_ONLY_TRANSACTION);
      const getMentorWaitingRequestQuery = `SELECT mwr.id, mwr.course_type_id, ct.duration AS course_duration, ct.is_with_partner, ct.index
        FROM mentors_waiting_requests mwr
        JOIN courses_types ct
          ON mwr.course_type_id = ct.id
        WHERE mwr.mentor_id = $1
          AND mwr.is_canceled IS DISTINCT FROM true`;
      const { rows }: pg.QueryResult = await client.query(getMentorWaitingRequestQuery, [mentorId]);
      let mentorWaitingRequest: MentorWaitingRequest = {};
      if (rows[0]) {
        const courseType: CourseType = {
          id: rows[0].course_type_id,
          duration: rows[0].course_duration,
          isWithPartner: rows[0].is_with_partner,
          index: rows[0].index
        };      
        mentorWaitingRequest = {
          id: rows[0].id,
          courseType: courseType
        };
      }
      response.status(200).json(mentorWaitingRequest);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }  
  }  
  
  async addMentorWaitingRequest(request: Request, response: Response): Promise<void> {
    const mentorId = request.user.id as string;
    const { courseType }: MentorWaitingRequest = request.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await this.addMentorWaitingRequestFromDB(mentorId, courseType, client);
      response.status(200).send('Mentor waiting request was added successfully');
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async addMentorWaitingRequestFromDB(mentorId: string, courseType: CourseType | undefined, client: pg.PoolClient): Promise<void> {
    const insertMentorWaitingRequestQuery = `INSERT INTO mentors_waiting_requests (mentor_id, course_type_id)
      VALUES ($1, $2)`;
    const values = [mentorId, courseType?.id];        
    await client.query(insertMentorWaitingRequestQuery, values);
  }

  async cancelMentorWaitingRequest(request: Request, response: Response): Promise<void> {
    const mentorWaitingRequestId = request.params.id;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const updateMentorWaitingRequestQuery = 'UPDATE mentors_waiting_requests SET is_canceled = true, canceled_date_time = $1 WHERE id = $2';
      const canceledDateTime = moment.utc().format(constants.DATE_TIME_FORMAT);      
      await client.query(updateMentorWaitingRequestQuery, [canceledDateTime, mentorWaitingRequestId]);
      response.status(200).send(`Mentor waiting request canceled with ID: ${mentorWaitingRequestId}`);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }
  
  async deleteMentorWaitingRequest(mentorId: string, client: pg.PoolClient): Promise<void> {
    const deleteMentorWaitingRequestQuery = 'DELETE FROM mentors_waiting_requests WHERE id = $1 AND is_canceled IS DISTINCT FROM true';
    await client.query(deleteMentorWaitingRequestQuery, [mentorId]);
  }    
}

