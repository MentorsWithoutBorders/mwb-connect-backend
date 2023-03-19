import { Request, Response } from 'express';
import pg from 'pg';
import moment from 'moment';
import 'moment-timezone';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Helpers } from '../utils/helpers';
import User from '../models/user.model';
import Lesson from '../models/lesson.model';
import Subfield from '../models/subfield.model';

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();

export class AdminLessons {
  constructor() {
    helpers.autoBind(this);
  }

  async getLessons(request: Request, response: Response): Promise<void> {
    const client = await pool.connect();    
    try {
      await client.query('BEGIN');
      const getLessonsQuery = `SELECT ml.lesson_id, ml.mentor_id, ml.mentor_name, ml.student_id, u.name AS student_name, ml.subfield_name, ml.date_time, ml.meeting_url, ml.end_recurrence_date_time, ml.is_canceled FROM 
        (SELECT ul.id AS lesson_id, ul.mentor_id, u.name AS mentor_name, uls.student_id, s.name AS subfield_name, ul.date_time, ul.meeting_url, ul.end_recurrence_date_time, ul.is_canceled FROM users_lessons ul
          JOIN users u
            ON ul.mentor_id = u.id
          JOIN subfields s
            ON ul.subfield_id = s.id
          JOIN users_lessons_students uls
            ON ul.id = uls.lesson_id) ml
        JOIN users u
          ON ml.student_id = u.id
        ORDER BY ml.mentor_name, ml.date_time DESC`;
      const { rows }: pg.QueryResult = await client.query(getLessonsQuery);
      const group = rows.reduce((r, a) => {
        r[a.mentor_id] = [...r[a.mentor_id] || [], a];
        return r;
      }, {});

      const lessons: Array<Lesson> = [];
      for (const i in group) {
        const lessonItems = group[i];
        const students: Array<User> = [];
        let lesson: Lesson = {};
        let j = 0;
        while (lessonItems[j] && lessonItems[j].lesson_id == lessonItems[0].lesson_id) {
          const lessonItem = lessonItems[j];
          const mentor: User = {
            id: lessonItem.mentor_id,
            name: lessonItem.mentor_name
          }
          const student: User = {
            id: lessonItem.student_id,
            name: lessonItem.student_name
          }
          students.push(student);
          const subfield: Subfield = {
            name: lessonItem.subfield_name
          }
          lesson = {
            id: lessonItem.lesson_id,
            mentor: mentor,
            students: students,
            subfield: subfield,
            dateTime: moment.utc(lessonItem.date_time).format(constants.DATE_TIME_FORMAT),
            meetingUrl: lessonItem.meeting_url,
            isCanceled: lessonItem.is_canceled ?? false
          };
          const isLessonRecurrent = helpers.isLessonRecurrent(lesson.dateTime as string, lessonItem.end_recurrence_date_time);
          if (isLessonRecurrent) {
            lesson.endRecurrenceDateTime = moment.utc(lessonItem.end_recurrence_date_time).format(constants.DATE_TIME_FORMAT);            
          }
          j++;
        }
        lessons.push(lesson);     
      }
      response.status(200).json(lessons);
      await client.query('COMMIT');      
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');      
    } finally {
      client.release();
    }
  }
}