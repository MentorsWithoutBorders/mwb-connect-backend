import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import moment from 'moment';
import 'moment-timezone';
import pg from 'pg';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Users } from './users';
import User from '../models/user.model';
import Organization from '../models/organization.model';
import Lesson from '../models/lesson.model';
import Subfield from '../models/subfield.model';

const conn: Conn = new Conn();
const pool = conn.pool;
const users: Users = new Users();

export class UsersLessons {
  constructor() {
    autoBind(this);
  }

  async getNextLesson(request: Request, response: Response): Promise<void> {
    const userId: string = request.params.id;
    try {
      const lesson = await this.getNextLessonFromDB(userId);
      response.status(200).json(lesson);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async getNextLessonFromDB(userId: string): Promise<Lesson> {
    const isMentor = await this.getIsMentor(userId);
    let getNextLessonQuery = '';
    if (isMentor) {
      getNextLessonQuery = `SELECT ul.id, ul.mentor_id, ul.subfield_id, ul.date_time, s.name AS subfield_name, ul.meeting_url, ul.is_recurrent, ul.end_recurrence_date_time, ul.is_canceled
        FROM users_lessons ul
        JOIN subfields s
        ON ul.subfield_id = s.id
        WHERE mentor_id = $1
        ORDER BY ul.date_time DESC LIMIT 1`;
    } else {
      getNextLessonQuery = `SELECT ul.id, ul.mentor_id, ul.subfield_id, ul.date_time, s.name AS subfield_name, ul.meeting_url, ul.is_recurrent, ul.end_recurrence_date_time, ul.is_canceled
        FROM users_lessons ul
        JOIN users_lessons_students uls
        ON ul.id = uls.lesson_id        
        JOIN subfields s
        ON ul.subfield_id = s.id
        WHERE uls.student_id = $1
        ORDER BY ul.date_time DESC LIMIT 1`;      
    }
    const { rows }: pg.QueryResult = await pool.query(getNextLessonQuery, [userId]);
    let lessonRow = rows[0];
    let students: Array<User> = [];
    if (lessonRow) {
      const lesson: Lesson = {
        dateTime: moment.utc(lessonRow.date_time).format(constants.DATE_TIME_FORMAT),
        isRecurrent: lessonRow.is_recurrent
      }
      if (lessonRow.end_recurrence_date_time != null) {
        lesson.endRecurrenceDateTime = moment.utc(lessonRow.end_recurrence_date_time).format(constants.DATE_TIME_FORMAT)
      }
      const lessonDateTime = this.getNextLessonDateTime(lesson);
      if (lessonDateTime == undefined) {
        lessonRow = null;
      } else {
        lessonRow.date_time = lessonDateTime;
        students = await this.getLessonStudents(lessonRow.id);
      }
    }
    return this.setLesson(lessonRow, students, isMentor);
  }

  getNextLessonDateTime(lesson: Lesson): string | undefined {
    const now = moment.utc();
    const endRecurrenceDateTime = moment.utc(lesson.endRecurrenceDateTime);
    let lessonDateTime = moment.utc(lesson.dateTime);
    if (lesson.isRecurrent) {
      if (endRecurrenceDateTime.isBefore(now)) {
        return undefined;
      } else {
        while (lessonDateTime.isBefore(now)) {
          lessonDateTime = lessonDateTime.add(7, 'd');
        }
        if (lessonDateTime.isAfter(endRecurrenceDateTime)) {
          return undefined;
        } else {
          return moment.utc(lessonDateTime).format(constants.DATE_TIME_FORMAT);
        }
      }
    } else {
      if (lessonDateTime.isBefore(now)) {
        return undefined;
      } else {
        return moment.utc(lessonDateTime).format(constants.DATE_TIME_FORMAT);
      }
    }
  }

  async getLessonStudents(lessonId: string): Promise<Array<User>> {
    const getLessonStudentsQuery = `SELECT student_id, is_canceled
      FROM users_lessons_students
      WHERE lesson_id = $1`;
    const { rows }: pg.QueryResult = await pool.query(getLessonStudentsQuery, [lessonId]);
    const students: Array<User> = [];
    for (const studentRow of rows) {
      const user: User = await users.getUserFromDB(studentRow.student_id);
      const student: User = {
        id: user.id as string,
        name: user.name as string,
        organization: user.organization as Organization
      }
      students.push(student);          
    }  
    return students;  
  }

  async setLesson(lessonRow: pg.QueryResultRow, students: Array<User>, isMentor: boolean): Promise<Lesson> {
    let lesson: Lesson = {};
    if (lessonRow) {    
      const subfield: Subfield = {
        id: lessonRow.subfield_id,
        name: lessonRow.subfield_name
      }
      lesson = {
        id: lessonRow.id,
        subfield: subfield,
        dateTime: moment.utc(lessonRow.date_time).format(constants.DATE_TIME_FORMAT),
        meetingUrl: lessonRow.meeting_url,
        isRecurrent: lessonRow.is_recurrent,
        isCanceled: lessonRow.is_canceled
      }
      if (lessonRow.end_recurrence_date_time != null) {
        lesson.endRecurrenceDateTime = moment.utc(lessonRow.end_recurrence_date_time).format(constants.DATE_TIME_FORMAT)
      }
      if (isMentor) {
        lesson.students = students;
      } else {
        const user: User = await users.getUserFromDB(lessonRow.mentor_id);
        const mentor: User = {
          id: user.id as string,
          name: user.name as string,
          organization: user.organization as Organization
        }        
        lesson.mentor = mentor;
      }
    }
    return lesson;
  }

  async getIsMentor(userId: string): Promise<boolean> {
    const getUserQuery = 'SELECT * FROM users WHERE id = $1';
    const { rows }: pg.QueryResult = await pool.query(getUserQuery, [userId]);
    return rows[0].is_mentor;
  }
  
  async getPreviousLesson(request: Request, response: Response): Promise<void> {
    const userId: string = request.params.id;
    try {
      const isMentor = await this.getIsMentor(userId);
      const now = moment.utc();
      let getPreviousLessonQuery = '';
      if (isMentor) {
        getPreviousLessonQuery = `SELECT ul.id, ul.mentor_id, ul.subfield_id, ul.date_time, s.name AS subfield_name, ul.meeting_url, ul.is_recurrent, ul.end_recurrence_date_time, ul.is_canceled
          FROM users_lessons ul
          JOIN subfields s
          ON ul.subfield_id = s.id
          WHERE ul.mentor_id = $1 AND ul.date_time::timestamp < $2
          ORDER BY ul.date_time DESC LIMIT 1`;
      } else {
        getPreviousLessonQuery = `SELECT ul.id, ul.mentor_id, ul.subfield_id, ul.date_time, s.name AS subfield_name, ul.meeting_url, ul.is_recurrent, ul.end_recurrence_date_time, ul.is_canceled
          FROM users_lessons ul
          JOIN users_lessons_students uls
          ON ul.id = uls.lesson_id        
          JOIN subfields s
          ON ul.subfield_id = s.id
          WHERE uls.student_id = $1 AND ul.date_time::timestamp < $2
          ORDER BY ul.date_time DESC LIMIT 1`;      
      }
      const { rows }: pg.QueryResult = await pool.query(getPreviousLessonQuery, [userId, now]);
      let lessonRow = rows[0];
      let students: Array<User> = [];
      let lesson: Lesson = {};
      if (lessonRow != null) {
        lesson = {
          dateTime: moment.utc(lessonRow.date_time).format(constants.DATE_TIME_FORMAT),
          isRecurrent: lessonRow.is_recurrent
        }
        if (lessonRow.end_recurrence_date_time != null) {
          lesson.endRecurrenceDateTime = moment.utc(lessonRow.end_recurrence_date_time).format(constants.DATE_TIME_FORMAT);
        }
        const lessonDateTime = this.getPreviousLessonDateTime(lesson);
        if (lessonDateTime == undefined) {
          lessonRow = null;
        } else {
          lessonRow.date_time = lessonDateTime;
          students = await this.getLessonStudents(lessonRow.id);
        }
      }
      lesson = await this.setLesson(lessonRow, students, isMentor);
      response.status(200).json(lesson);
    } catch (error) {
      response.status(400).send(error);
    }
  }
  
  getPreviousLessonDateTime(lesson: Lesson): string | undefined {
    const now = moment.utc();
    const endRecurrenceDateTime = moment.utc(lesson.endRecurrenceDateTime);
    let lessonDateTime = moment.utc(lesson.dateTime);
    if (lesson.isRecurrent) {
      while (lessonDateTime.isBefore(endRecurrenceDateTime)) {
        lessonDateTime = lessonDateTime.add(7, 'd');
      }
      lessonDateTime = lessonDateTime.subtract(7, 'd');
      if (endRecurrenceDateTime.isAfter(now)) {
        if (lessonDateTime.isBefore(now)) {
          return moment.utc(lessonDateTime).format(constants.DATE_TIME_FORMAT);
        } else {
          return undefined;
        }
      } else {
        return moment.utc(lessonDateTime).format(constants.DATE_TIME_FORMAT);
      } 
    } else {
      return moment.utc(lessonDateTime).format(constants.DATE_TIME_FORMAT);
    } 
  }     

  async cancelLesson(request: Request, response: Response): Promise<void> {
    const lessonId: string = request.params.id;
    try {
      const updateLessonQuery = 'UPDATE users_lessons SET is_canceled = true WHERE id = $1';
      await pool.query(updateLessonQuery, [lessonId]);
      response.status(200).send(`Lesson modified with ID: ${lessonId}`);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async setLessonMeetingUrl(request: Request, response: Response): Promise<void> {
    const lessonId: string = request.params.id;
    const { meetingUrl }: Lesson = request.body
    try {
      const updateLessonQuery = 'UPDATE users_lessons SET meeting_url = $1 WHERE id = $2';
      await pool.query(updateLessonQuery, [meetingUrl, lessonId]);
      response.status(200).send(`Lesson modified with ID: ${lessonId}`);
    } catch (error) {
      response.status(400).send(error);
    }
  } 
  
  async setLessonPresenceMentor(request: Request, response: Response): Promise<void> {
    const lessonId: string = request.params.id;
    const { isMentorPresent }: Lesson = request.body
    try {
      const updateLessonQuery = 'UPDATE users_lessons SET is_mentor_present = $1 WHERE id = $2';
      await pool.query(updateLessonQuery, [isMentorPresent, lessonId]);
      response.status(200).send(`Lesson modified with ID: ${lessonId}`);
    } catch (error) {
      response.status(400).send(error);
    }
  }   
}

