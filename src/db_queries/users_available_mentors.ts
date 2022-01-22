import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import pg from 'pg';
import * as redis from 'redis';
import moment from 'moment';
import 'moment-timezone';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Users } from './users';
import User from '../models/user.model';
import Lesson from '../models/lesson.model';
import Field from '../models/field.model';
import Subfield from '../models/subfield.model';

const conn = new Conn();
const pool = conn.pool;
const redisClient = redis.createClient();
const users: Users = new Users();

export class UsersAvailableMentors {
  constructor() {
    autoBind(this);
  }

  async getAvailableMentors(request: Request, response: Response): Promise<void> {
    const { field, availabilities }: User = request.body;
    const client = await pool.connect();    
    try {
      await client.query('BEGIN');
      const lessons = await this.getAvailableMentorsLessons(field?.id, client);
      const mentors: Array<User> = [];
      await redisClient.connect();      
      for (const lesson of lessons) {
        const mentorString = await redisClient.get('user' + lesson.mentor?.id);
        if (!mentorString) {
          const mentor = await users.getUserFromDB(lesson.mentor?.id as string, client);
          await redisClient.set('user' + lesson.mentor?.id, JSON.stringify(mentor));
          mentors.push(mentor);
        } else {
          mentors.push(JSON.parse(mentorString));
        }
      }
      response.status(200).json(mentors);
      await redisClient.disconnect();
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');      
    } finally {
      client.release();
    }
  }  

  async getAvailableMentorsLessons(fieldId: string | undefined, client: pg.PoolClient): Promise<Array<Lesson>> {
    let getLessonsQuery = `SELECT l.mentor_id, l.mentor_name, l.available_from, l.lesson_id, l.field_id, f.name AS field_name, l.subfield_name, l.date_time, l.is_recurrent, l.end_recurrence_date_time, l.is_canceled, l.should_contact, l.last_contacted_date_time, l.is_inactive 
      FROM (SELECT u.id AS mentor_id, u.name AS mentor_name, u.field_id AS user_field_id, u.available_from, ul.id AS lesson_id, fs.field_id, s.name AS subfield_name, ul.date_time, ul.is_recurrent, ul.end_recurrence_date_time, ul.is_canceled, aau.should_contact, aau.last_contacted_date_time, aau.is_inactive 
        FROM users_lessons ul
        JOIN users u
          ON ul.mentor_id = u.id
        JOIN fields_subfields fs
          ON ul.subfield_id = fs.subfield_id 
        JOIN subfields s
          ON ul.subfield_id = s.id
        LEFT OUTER JOIN admin_available_users aau
          ON u.id = aau.user_id            
        WHERE u.available_from <= now()) l
      JOIN fields f
        ON l.field_id = f.id
      WHERE l.is_inactive IS DISTINCT FROM true`;
    let values: Array<string> = [];
    if (fieldId) {
      getLessonsQuery += ' AND l.user_field_id = $1';
      values = [fieldId];
    }
    const { rows }: pg.QueryResult = await client.query(getLessonsQuery, values);
    const group = rows.reduce((r, a) => {
      r[a.mentor_id] = [...r[a.mentor_id] || [], a];
      return r;
    }, {});

    let lessons: Array<Lesson> = [];
    for (const i in group) {
      const lessonItems = group[i];
      let mentorLessons = [];
      for (const row of lessonItems) {
        const field: Field = {
          id: row.field_id,
          name: row.field_name
        }
        const mentor: User = {
          id: row.mentor_id,
          name: row.mentor_name,
          field: field,
          availableFrom: moment.utc(row.available_from).format(constants.DATE_TIME_FORMAT),
          shouldContact: row.should_contact ?? true,
          lastContactedDateTime: this.getLastContactedDateTime(row.last_contacted_date_time)
        }
        const subfield: Subfield = {
          name: row.subfield_name
        }
        const lesson: Lesson = {
          id: row.lesson_id,
          mentor: mentor,
          subfield: subfield,
          dateTime: moment.utc(row.date_time).format(constants.DATE_TIME_FORMAT),
          isRecurrent: row.is_recurrent ?? false,
          isCanceled: row.is_canceled ?? false
        };
        if (lesson.isRecurrent) {
          lesson.endRecurrenceDateTime = moment.utc(row.end_recurrence_date_time).format(constants.DATE_TIME_FORMAT)            
        }
        mentorLessons.push(lesson);
      }
      mentorLessons = this.getSortedLessons(mentorLessons, false);
      if (this.getShouldAddLesson(mentorLessons)) {
        lessons.push(mentorLessons[0]);
      }
    }
    lessons = this.getSortedLessons(lessons, true);
    const mentorsWihoutLessons = await this.getMentorsWithoutLessons(fieldId, client);
    lessons = mentorsWihoutLessons.concat(lessons);
    return lessons.sort((a, b) => moment.utc(a.mentor?.availableFrom).diff(moment.utc(b.mentor?.availableFrom)));
  }

  getLastContactedDateTime(lastContactedDateTime?: string): string | undefined {
    if (lastContactedDateTime) {
      return moment.utc(lastContactedDateTime).format(constants.DATE_TIME_FORMAT);
    } else {
      return undefined;
    }
  }

  getShouldAddLesson(sortedLessons: Array<Lesson>): boolean {
    let shouldAddLesson = true;
    const lastLessonDateTime = !sortedLessons[0].isRecurrent ? moment.utc(sortedLessons[0].dateTime) : moment.utc(sortedLessons[0].endRecurrenceDateTime);
    const isLastLessonCanceled = sortedLessons[0].isCanceled;
    if (lastLessonDateTime.isAfter(moment.utc()) && !isLastLessonCanceled) {
      shouldAddLesson = false;
    }
    return shouldAddLesson;
  }

  getSortedLessons(lessons: Array<Lesson>, isAscending: boolean): Array<Lesson> {
    let lessonDates = new Map();
    for (let i = 0; i < lessons.length; i++) {
      if (!lessons[i].isRecurrent) {
        lessonDates.set(i, moment.utc(lessons[i].dateTime));
      } else {
        lessonDates.set(i, moment.utc(lessons[i].endRecurrenceDateTime));
      }
    }
    if (isAscending) {
      lessonDates = new Map([...lessonDates.entries()].sort((a, b) => a[1].diff(b[1])));
    } else {
      lessonDates = new Map([...lessonDates.entries()].sort((a, b) => b[1].diff(a[1])));
    }
    const keys = Array.from(lessonDates.keys());
    const sortedLessons = [];
    for (const key of keys) {
      sortedLessons.push(lessons[key]);
    }
    return sortedLessons; 
  }

  async getMentorsWithoutLessons(fieldId: string | undefined, client: pg.PoolClient): Promise<Array<Lesson>> {
    let getMentorsQuery = `SELECT u.id AS mentor_id, u.name AS mentor_name, u.available_from, u.field_id, f.name AS field_name, aau.should_contact, aau.last_contacted_date_time, aau.is_inactive 
      FROM users u
      JOIN fields f
        ON u.field_id = f.id
      LEFT OUTER JOIN admin_available_users aau
        ON u.id = aau.user_id
      WHERE u.is_mentor IS true
        AND u.id NOT IN (
          SELECT DISTINCT mentor_id FROM users_lessons
        )
        AND aau.is_inactive IS DISTINCT FROM true`;
    let values: Array<string> = [];
    if (fieldId) {
      getMentorsQuery += ' AND u.field_id = $1';
      values = [fieldId];
    }        
    const { rows }: pg.QueryResult = await client.query(getMentorsQuery, values);
    const lessons: Array<Lesson> = [];
    for (const row of rows) {
      const field: Field = {
        id: row.field_id,
        name: row.field_name
      }
      const mentor: User = {
        id: row.mentor_id,
        name: row.mentor_name,
        field: field,
        availableFrom: moment.utc(row.available_from).format(constants.DATE_TIME_FORMAT),
        shouldContact: row.should_contact ?? true,
        lastContactedDateTime: this.getLastContactedDateTime(row.last_contacted_date_time)
      }     
      const lesson: Lesson = {
        mentor: mentor
      };
      lessons.push(lesson);
    }
    return lessons;    
  }
}