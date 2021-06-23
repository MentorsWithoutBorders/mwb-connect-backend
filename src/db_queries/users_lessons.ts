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
import Organization from '../models/organization.model';
import Lesson from '../models/lesson.model';
import Subfield from '../models/subfield.model';
import TimeZone from '../models/timezone.model';

const conn: Conn = new Conn();
const pool = conn.pool;
const users: Users = new Users();
const usersTimeZones: UsersTimeZones = new UsersTimeZones();

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
    const timeZone: TimeZone = await usersTimeZones.getUserTimeZone(userId);
    const now = moment.tz(new Date(), timeZone?.name);
    console.log('now: ' + now.format(constants.DATE_TIME_FORMAT));
    if (lessonRow) {
      const endRecurrenceDateTime = moment.tz(lessonRow.end_recurrence_date_time, timeZone?.name);
      console.log('endRecurrenceDateTime: ' + endRecurrenceDateTime);
      let lessonDateTime = moment.tz(lessonRow.date_time, timeZone?.name);
      console.log('lessonDateTime: ' + lessonDateTime);
      if (lessonRow.is_recurrent) {
        if (endRecurrenceDateTime.isBefore(now)) {
          lessonRow = null;
        } else {
          while (lessonDateTime.isBefore(now)) {
            lessonDateTime = lessonDateTime.add(7, 'd');
          }
          if (lessonDateTime.isAfter(endRecurrenceDateTime)) {
            lessonRow = null;
          } else {
            lessonRow.date_time = lessonDateTime.toDate();
          }
        }
      } else {
        if (lessonDateTime.isBefore(now)) {
          lessonRow = null;
        } else {
          lessonRow.date_time = lessonDateTime.toDate();
        }
      }
      students = await this.getLessonStudents(lessonRow.id);
    }
    return this.setLesson(lessonRow, students, isMentor);
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
        dateTime: moment(lessonRow.date_time).format(constants.DATE_TIME_FORMAT),
        meetingUrl: lessonRow.meeting_url,
        isRecurrent: lessonRow.is_recurrent,
        isCanceled: lessonRow.is_canceled
      }
      if (lessonRow.end_recurrence_date_time != null) {
        lesson.endRecurrenceDateTime = moment(lessonRow.end_recurrence_date_time).format(constants.DATE_TIME_FORMAT)
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
      const timeZone: TimeZone = await usersTimeZones.getUserTimeZone(userId);
      const now = moment.tz(new Date(), timeZone?.name).format(constants.DATE_TIME_FORMAT);        
      let getPreviousLessonQuery = '';
      if (isMentor) {
        getPreviousLessonQuery = `SELECT ul.id, ul.mentor_id, ul.subfield_id, ul.date_time, s.name AS subfield_name, ul.meeting_url, ul.is_recurrent, ul.end_recurrence_date_time, ul.is_canceled
          FROM users_lessons ul
          JOIN subfields s
          ON ul.subfield_id = s.id
          WHERE mentor_id = $1 AND ul.date_time::timestamp < $2
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
      const lessonRow = rows[0];
      let students: Array<User> = [];
      if (lessonRow != null) {
        students = await this.getLessonStudents(lessonRow.id);
      }
      const lesson = await this.setLesson(lessonRow, students, isMentor);
      response.status(200).json(lesson);
    } catch (error) {
      response.status(400).send(error);
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

