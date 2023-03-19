import { Request, Response } from 'express';
import pg from 'pg';
import moment from 'moment';
import 'moment-timezone';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Helpers } from '../utils/helpers';
import User from '../models/user.model';
import Lesson from '../models/lesson.model';
import Field from '../models/field.model';
import Subfield from '../models/subfield.model';

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();

export class AdminAvailableStudents {
  constructor() {
    helpers.autoBind(this);
  }

  async getAvailableStudentsLessons(request: Request, response: Response): Promise<void> {
    const client = await pool.connect();    
    try {
      await client.query('BEGIN');
      const getLessonsQuery = `SELECT l.student_id, u.name AS student_name, u.available_from, l.lesson_id, l.field_id, f.name AS field_name, l.subfield_name, l.date_time, l.end_recurrence_date_time, l.is_canceled_by_mentor, l.is_canceled_by_student, aau.should_contact, aau.last_contacted_date_time, aau.is_inactive 
        FROM (SELECT ul.id AS lesson_id, fs.field_id, s.name AS subfield_name, ul.date_time, ul.end_recurrence_date_time, ul.is_canceled AS is_canceled_by_mentor, uls.student_id, uls.is_canceled AS is_canceled_by_student 
          FROM users_lessons ul
          JOIN users_lessons_students uls
            ON ul.id = uls.lesson_id
          JOIN fields_subfields fs
            ON ul.subfield_id = fs.subfield_id 
          JOIN subfields s
            ON ul.subfield_id = s.id) l
        JOIN users u
          ON l.student_id = u.id
        LEFT OUTER JOIN admin_available_users aau
          ON l.student_id = aau.user_id           
        JOIN fields f
          ON l.field_id = f.id
        WHERE u.available_from <= now()
          AND aau.is_inactive IS DISTINCT FROM true`;
      const { rows }: pg.QueryResult = await client.query(getLessonsQuery);
      const group = rows.reduce((r, a) => {
        r[a.student_id] = [...r[a.student_id] || [], a];
        return r;
      }, {});

      let lessons: Array<Lesson> = [];
      for (const i in group) {
        const lessonItems = group[i];
        let studentLessons = [];
        for (const row of lessonItems) {
          const field: Field = {
            id: row.field_id,
            name: row.field_name
          }
          const student: User = {
            id: row.student_id,
            name: row.student_name,
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
            students: [student],
            subfield: subfield,
            dateTime: moment.utc(row.date_time).format(constants.DATE_TIME_FORMAT),
            isCanceled: this.getIsLessonCanceled(row.is_canceled_by_mentor, row.is_canceled_by_student)
          };
          const isLessonRecurrent = helpers.isLessonRecurrent(lesson.dateTime as string, lesson.endRecurrenceDateTime);
          if (isLessonRecurrent) {
            lesson.endRecurrenceDateTime = moment.utc(row.end_recurrence_date_time).format(constants.DATE_TIME_FORMAT)            
          }
          studentLessons.push(lesson);
        }
        studentLessons = this.getSortedLessonsByDateTime(studentLessons, false);
        if (this.getShouldAddLesson(studentLessons)) {
          lessons.push(studentLessons[0]);
        }
      }
      lessons = this.getSortedLessonsByDateTime(lessons, true);
      const studentsWihoutLessons = await this.getStudentsWithoutLessons(client);
      lessons = studentsWihoutLessons.concat(lessons);
      lessons = this.getSortedLessonsByAvailableFrom(lessons);
      response.status(200).json(lessons);
      await client.query('COMMIT');      
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');      
    } finally {
      client.release();
    }
  }

  getIsLessonCanceled(isCanceledByMentor?: boolean, isCanceledByStudent?: boolean): boolean {
    if (isCanceledByMentor) {
      return isCanceledByMentor;
    } else if (isCanceledByStudent) {
      return isCanceledByStudent;
    }
    return false;
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
    const isLessonRecurrent = helpers.isLessonRecurrent(sortedLessons[0].dateTime as string, sortedLessons[0].endRecurrenceDateTime);
    const lastLessonDateTime = !isLessonRecurrent ? moment.utc(sortedLessons[0].dateTime) : moment.utc(sortedLessons[0].endRecurrenceDateTime);
    const isLastLessonCanceled = sortedLessons[0].isCanceled;
    if (lastLessonDateTime.isAfter(moment.utc()) && !isLastLessonCanceled) {
      shouldAddLesson = false;
    }
    return shouldAddLesson;
  }

  getSortedLessonsByDateTime(lessons: Array<Lesson>, isAscending: boolean): Array<Lesson> {
    let lessonDates = new Map();
    for (let i = 0; i < lessons.length; i++) {
      const isLessonRecurrent = helpers.isLessonRecurrent(lessons[i].dateTime as string, lessons[i].endRecurrenceDateTime);
      if (!isLessonRecurrent) {
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

  getSortedLessonsByAvailableFrom(lessons: Array<Lesson>): Array<Lesson> {
    return lessons.sort((a, b) => {
      const studentA = a.students ? a.students[0] : {};
      const studentB = b.students ? b.students[0] : {};
      return moment.utc(studentA.availableFrom).diff(moment.utc(studentB.availableFrom))
    });   
  }

  async getStudentsWithoutLessons(client: pg.PoolClient): Promise<Array<Lesson>> {
    const getStudentsQuery = `SELECT u.id AS student_id, u.name AS student_name, u.available_from, u.field_id, f.name AS field_name, aau.should_contact, aau.last_contacted_date_time, aau.is_inactive 
      FROM users u
      JOIN fields f
        ON u.field_id = f.id
      LEFT OUTER JOIN admin_available_users aau
        ON u.id = aau.user_id
      WHERE u.is_mentor IS false
        AND u.id NOT IN (
          SELECT DISTINCT student_id FROM users_lessons_students
        )
        AND aau.is_inactive IS DISTINCT FROM true`;
    const { rows }: pg.QueryResult = await client.query(getStudentsQuery);
    const lessons: Array<Lesson> = [];
    for (const row of rows) {
      const field: Field = {
        id: row.field_id,
        name: row.field_name
      }
      const student: User = {
        id: row.student_id,
        name: row.student_name,
        field: field,
        availableFrom: moment.utc(row.available_from).format(constants.DATE_TIME_FORMAT),
        shouldContact: row.should_contact ?? true,
        lastContactedDateTime: this.getLastContactedDateTime(row.last_contacted_date_time)
      }     
      const lesson: Lesson = {
        students: [student]
      };
      lessons.push(lesson);
    }
    return lessons;    
  }
  
  async updateShouldContact(request: Request, response: Response): Promise<void> {
    const studentId = request.params.student_id;
    const { shouldContact, lastContactedDateTime }: User = request.body;
    const client = await pool.connect();    
    try {
      const getShouldContactQuery = 'SELECT id FROM admin_available_users WHERE user_id = $1';
      const { rows }: pg.QueryResult = await client.query(getShouldContactQuery, [studentId]);
      if (rows[0]) {
        const updateShouldContactQuery = `UPDATE admin_available_users
          SET should_contact = $1, last_contacted_date_time = $2 WHERE user_id = $3`;
        const values = [shouldContact, lastContactedDateTime, studentId];
        await client.query(updateShouldContactQuery, values);
      } else {
        const insertShouldContactQuery = `INSERT INTO admin_available_users (user_id, should_contact, last_contacted_date_time)
          VALUES ($1, $2, $3)`;
        const values = [studentId, shouldContact, lastContactedDateTime];
        await client.query(insertShouldContactQuery, values);    
      }
      response.status(200).json(`Last contacted date/time has been updated for user: ${studentId}`);
      await client.query('COMMIT');      
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');      
    } finally {
      client.release();
    }
  }  
}