import { Request, Response } from 'express';
import pg from 'pg';
import { createClient } from 'async-redis';
import moment from 'moment';
import 'moment-timezone';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Helpers } from '../utils/helpers';
import { Users } from './users';
import { UsersAvailableMentors } from './users_available_mentors';
import MentorWaitingRequest from '../models/mentor_waiting_request.model';
import CourseType from '../models/course_type.model';

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();
const redisClient = createClient();
const users = new Users();
const usersAvailableMentors = new UsersAvailableMentors();

export class MentorsWaitingRequests {
  constructor() {
    helpers.autoBind(this);
  }

  async getMentorsWaitingRequests(request: Request, response: Response): Promise<void> {
    const mentorId = request.user.id as string;
    const page = request.query.page as string;
    const { courseType, mentor }: MentorWaitingRequest = request.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(constants.READ_ONLY_TRANSACTION);
      let getMentorsWaitingRequestsQuery = `SELECT mwr.id, mwr.mentor_id, mwr.course_type_id, ct.duration AS course_duration, ct.is_with_partner, ct.index 
        FROM mentors_waiting_requests mwr
        JOIN course_types ct
          ON mwr.course_type_id = ct.id
        FULL OUTER JOIN (
          SELECT *,
            row_number() over (PARTITION BY partner_mentor_id ORDER BY sent_date_time DESC) AS row_number_mentors_partnership_requests
            FROM mentors_partnership_requests 
        ) mpr
        ON mwr.mentor_id = mpr.partner_mentor_id               
        WHERE ct.is_with_partner IS true
          AND mwr.mentor_id <> $1
          AND mwr.is_canceled IS DISTINCT FROM true
          AND (mpr.row_number_mentors_partnership_requests = 1 AND (mpr.is_canceled IS true AND (EXTRACT(EPOCH FROM (now() - mpr.sent_date_time))/3600 > 168 OR mpr.mentor_id <> $1)
            OR mpr.is_expired IS true AND EXTRACT(EPOCH FROM (now() - mpr.sent_date_time))/3600 > 168
            OR mpr.is_rejected IS true AND EXTRACT(EPOCH FROM (now() - mpr.sent_date_time))/3600 > 168)
              OR mpr.id IS NULL)`;
      const courseDuration = courseType?.duration;
      const values: Array<string> = [mentorId];
      if (courseDuration) {
        getMentorsWaitingRequestsQuery += ` AND ct.duration = $2`;
        values.push(courseDuration.toString());
      }          
      const { rows }: pg.QueryResult = await client.query(getMentorsWaitingRequestsQuery, values);
      let mentorsWaitingRequests: Array<MentorWaitingRequest> = [];
      const server = process.env.SERVER as string;
      for (const row of rows) {
        const mentorId = row.mentor_id;
        const mentorString = await redisClient.get(`user-${server}-${mentorId}`);
        let mentorFromDB;
        if (!mentorString) {
          mentorFromDB = await users.getUserFromDB(mentorId, client);
          await redisClient.set(`user-${server}-${mentorId}`, JSON.stringify(mentorFromDB));
        } else {
          mentorFromDB = JSON.parse(mentorString);
        }
        const courseType: CourseType = {
          id: row.course_type_id,
          duration: row.course_duration,
          isWithPartner: row.is_with_partner,
          index: row.index
        };
        const mentorWaitingRequest: MentorWaitingRequest = {
          id: row.id,
          mentor: mentorFromDB,
          courseType: courseType
        };
        if (usersAvailableMentors.isValidMentor(mentorFromDB, mentor?.field, mentor?.availabilities)) {
          mentorsWaitingRequests.push(mentorWaitingRequest);
        }
      }
      mentorsWaitingRequests = this.getPaginatedMentorsWaitingRequests(mentorsWaitingRequests, page);
      response.status(200).json(mentorsWaitingRequests);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }  
  }

  getPaginatedMentorsWaitingRequests(mentorsWaitingRequests: Array<MentorWaitingRequest>, page: string | undefined): Array<MentorWaitingRequest> {
    const paginatedMentorsWaitingRequests: Array<MentorWaitingRequest> = [];
    if (!page) {
      return mentorsWaitingRequests;
    }
    for (let i = constants.AVAILABLE_MENTORS_RESULTS_PER_PAGE * (parseInt(page) - 1); i < constants.AVAILABLE_MENTORS_RESULTS_PER_PAGE * parseInt(page); i++) {
      if (mentorsWaitingRequests[i]) {
        paginatedMentorsWaitingRequests.push(mentorsWaitingRequests[i]);
      }
    }
    return paginatedMentorsWaitingRequests;
  }  

  async getCurrentMentorWaitingRequest(request: Request, response: Response): Promise<void> {
    const mentorId = request.user.id as string;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(constants.READ_ONLY_TRANSACTION);
      const getMentorWaitingRequestQuery = `SELECT mwr.id, mwr.course_type_id, ct.duration AS course_duration, ct.is_with_partner, ct.index
        FROM mentors_waiting_requests mwr
        JOIN course_types ct
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
      await this.deleteMentorWaitingRequest(mentorId, client);
      const mentorWaitingRequest = await this.addMentorWaitingRequestFromDB(mentorId, courseType?.id as string, client);
      response.status(200).send(mentorWaitingRequest);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async addMentorWaitingRequestFromDB(mentorId: string, courseTypeId: string, client: pg.PoolClient): Promise<MentorWaitingRequest> {
    const insertMentorWaitingRequestQuery = `INSERT INTO mentors_waiting_requests (mentor_id, course_type_id)
      VALUES ($1, $2) RETURNING *`;
    const values = [mentorId, courseTypeId];        
    const { rows }: pg.QueryResult = await client.query(insertMentorWaitingRequestQuery, values);
    const mentorWaitingRequest: MentorWaitingRequest = {
      id: rows[0].id,
      mentor: {
        id: mentorId
      },
      courseType: {
        id: courseTypeId
      }
    };
    return mentorWaitingRequest;
  }

  async cancelMentorWaitingRequest(request: Request, response: Response): Promise<void> {
    const mentorId = request.user.id as string;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const updateMentorWaitingRequestQuery = 'UPDATE mentors_waiting_requests SET is_canceled = true, canceled_date_time = $1 WHERE mentor_id = $2';
      const canceledDateTime = moment.utc().format(constants.DATE_TIME_FORMAT);      
      await client.query(updateMentorWaitingRequestQuery, [canceledDateTime, mentorId]);
      response.status(200).send(`Mentor waiting requests canceled for mentor: ${mentorId}`);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }
  
  async deleteMentorWaitingRequest(mentorId: string, client: pg.PoolClient): Promise<void> {
    const deleteMentorWaitingRequestQuery = 'DELETE FROM mentors_waiting_requests WHERE mentor_id = $1 AND is_canceled IS DISTINCT FROM true';
    await client.query(deleteMentorWaitingRequestQuery, [mentorId]);
  }    
}

