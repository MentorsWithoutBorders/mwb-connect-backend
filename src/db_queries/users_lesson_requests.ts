import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import moment from 'moment';
import 'moment-timezone';
import pg from 'pg';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Users } from './users';
import { UsersTimeZones } from './users_timezones';
import User from '../models/user.model';
import LessonRequest from '../models/lesson_request.model';
import TimeZone from '../models/timezone.model';
import Organization from '../models/organization.model';

const conn: Conn = new Conn();
const pool = conn.pool;
const users: Users = new Users();
const usersTimeZones: UsersTimeZones = new UsersTimeZones();

export class UsersLessonRequests {
  constructor() {
    autoBind(this);
  }

  async addLessonRequest(request: Request, response: Response): Promise<void> {
    const studentId: string = request.params.id;
    try {
      const insertLessonRequestQuery = `INSERT INTO users_lesson_requests (student_id, sent_date_time)
        VALUES ($1, $2)`;
      const timeZone: TimeZone = await usersTimeZones.getUserTimeZone(studentId);
      const sentDateTime = moment.tz(new Date(), timeZone?.name).format(constants.DATE_FORMAT);
      const values = [studentId, sentDateTime];
      await pool.query(insertLessonRequestQuery, values);
      response.status(200).send('Lesson request has been added');
    } catch (error) {
      response.status(400).send(error);
    }
  }
  
  async getLastLessonRequest(request: Request, response: Response): Promise<void> {
    const userId: string = request.params.id;
    try {
      const user: User = await users.getUserFromDB(userId);
      const userTypeId = user.isMentor ? 'mentor_id' : 'student_id';
      const getLastLessonRequestQuery = `SELECT ulr.id, ulr.sent_date_time, s.name AS subfield
        FROM users_lesson_requests ulr
        LEFT OUTER JOIN subfields s
        ON ulr.subfield_id = s.id
        WHERE ${userTypeId} = $1
        ORDER BY ulr.sent_date_time DESC LIMIT 1`;
      const { rows }: pg.QueryResult = await pool.query(getLastLessonRequestQuery, [userId]);
      const userOrganization = user.organization as Organization;
      const lessonRequest: LessonRequest = {
        id: rows[0].id,
        organization: userOrganization.name as string,
        subfield: rows[0].subfield,
        sentDateTime: moment(rows[0].sent_date_time).format(constants.DATE_FORMAT)
      }
      if (user.isMentor) {
        lessonRequest.mentor = user.name as string;
      } else {
        lessonRequest.student = user.name as string;
      }
      response.status(200).json(lessonRequest);
    } catch (error) {
      response.status(400).send(error);
    }
  }
  
}

