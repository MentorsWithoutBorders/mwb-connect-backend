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
        WHERE ul.mentor_id = $1 AND ul.is_canceled IS DISTINCT FROM true
        ORDER BY ul.date_time DESC LIMIT 1`;
    } else {
      getNextLessonQuery = `SELECT ul.id, ul.mentor_id, ul.subfield_id, ul.date_time, s.name AS subfield_name, ul.meeting_url, ul.is_recurrent, ul.end_recurrence_date_time, ul.is_canceled
        FROM users_lessons ul
        JOIN users_lessons_students uls
        ON ul.id = uls.lesson_id        
        JOIN subfields s
        ON ul.subfield_id = s.id
        WHERE uls.student_id = $1 AND ul.is_canceled IS DISTINCT FROM true AND uls.is_canceled IS DISTINCT FROM true
        ORDER BY ul.date_time DESC LIMIT 1`;      
    }
    const { rows }: pg.QueryResult = await pool.query(getNextLessonQuery, [userId]);
    let lessonRow = rows[0];
    let students: Array<User> = [];
    if (lessonRow) {
      const lesson: Lesson = {
        id: lessonRow.id,
        dateTime: moment.utc(lessonRow.date_time).format(constants.DATE_TIME_FORMAT),
        isRecurrent: lessonRow.is_recurrent
      }
      if (lessonRow.end_recurrence_date_time != null) {
        lesson.endRecurrenceDateTime = moment.utc(lessonRow.end_recurrence_date_time).format(constants.DATE_TIME_FORMAT)
      }
      const lessonDateTime = await this.getNextLessonDateTime(lesson, userId);
      if (lessonDateTime == undefined) {
        lessonRow = null;
      } else {
        lessonRow.date_time = lessonDateTime;
        students = await this.getLessonStudents(lessonRow.id);
      }
    }
    return this.setLesson(lessonRow, students, isMentor);
  }

  async getNextLessonDateTime(lesson: Lesson, userId: string): Promise<string | undefined> {
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
        const nextValidLessonDateTime = await this.getNextValidLessonDateTime(lesson, userId, lessonDateTime);
        if (nextValidLessonDateTime.isAfter(endRecurrenceDateTime)) {
          return undefined;
        } else {
          return moment.utc(nextValidLessonDateTime).format(constants.DATE_TIME_FORMAT);
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

  async getNextValidLessonDateTime(lesson: Lesson, userId: string, lessonDateTime: moment.Moment): Promise<moment.Moment> {
    let updatedLessonDateTime = lessonDateTime.clone();
    const lessonsCanceledDateTimes = await this.getLessonsCanceledDateTimes(userId, lesson.id as string);
    lessonsCanceledDateTimes.forEach(function (dateTime) {
      if (moment.utc(dateTime).isSame(moment.utc(updatedLessonDateTime))) {
        updatedLessonDateTime = updatedLessonDateTime.add(7, 'd');
      } 
    });
    return updatedLessonDateTime;
  }

  async getLessonsCanceledDateTimes(userId: string, lessonId: string): Promise<Array<string>> {
    const getLessonCanceledQuery = `SELECT lesson_date_time
      FROM users_lessons_canceled
      WHERE user_id = $1 AND lesson_id = $2`;
    const { rows }: pg.QueryResult = await pool.query(getLessonCanceledQuery, [userId, lessonId]);
    let lessonsCanceledDateTimes: Array<string> = [];
    rows.forEach(function (row) {
      lessonsCanceledDateTimes.push(row.lesson_date_time);
    });
    lessonsCanceledDateTimes = lessonsCanceledDateTimes.sort((d1, d2) => {
      if (moment.utc(d1).isAfter(moment.utc(d2))) {
        return 1;
      }
      if (moment.utc(d1).isBefore(moment.utc(d2))) {
        return -1;
      }
      return 0;
    });
    return lessonsCanceledDateTimes;
  }

  async getLessonStudents(lessonId: string): Promise<Array<User>> {
    const getLessonStudentsQuery = `SELECT student_id, is_canceled
      FROM users_lessons_students
      WHERE lesson_id = $1`;
    const { rows }: pg.QueryResult = await pool.query(getLessonStudentsQuery, [lessonId]);
    const students: Array<User> = [];
    for (const studentRow of rows) {
      if (!studentRow.is_canceled) {
        const user: User = await users.getUserFromDB(studentRow.student_id);
        const student: User = {
          id: user.id as string,
          name: user.name as string,
          organization: user.organization as Organization
        }
        students.push(student);
      }
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
          id: lessonRow.id,
          dateTime: moment.utc(lessonRow.date_time).format(constants.DATE_TIME_FORMAT),
          isRecurrent: lessonRow.is_recurrent
        }
        if (lessonRow.end_recurrence_date_time != null) {
          lesson.endRecurrenceDateTime = moment.utc(lessonRow.end_recurrence_date_time).format(constants.DATE_TIME_FORMAT);
        }
        const lessonDateTime = await this.getPreviousLessonDateTime(lesson, userId);
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
  
  async getPreviousLessonDateTime(lesson: Lesson, userId: string): Promise<string | undefined> {
    const now = moment.utc();
    const endRecurrenceDateTime = moment.utc(lesson.endRecurrenceDateTime);
    let lessonDateTime = moment.utc(lesson.dateTime);
    if (lesson.isRecurrent) {
      while (lessonDateTime.isBefore(now)) {
        lessonDateTime = lessonDateTime.add(7, 'd');
      }
      lessonDateTime = lessonDateTime.subtract(7, 'd');
      const previousValidLessonDateTime = await this.getPreviousValidLessonDateTime(lesson, userId, lessonDateTime);
      if (endRecurrenceDateTime.isAfter(now)) {
        if (previousValidLessonDateTime.isBefore(now)) {
          return moment.utc(previousValidLessonDateTime).format(constants.DATE_TIME_FORMAT);
        } else {
          return undefined;
        }
      } else {
        return moment.utc(previousValidLessonDateTime).format(constants.DATE_TIME_FORMAT);
      } 
    } else {
      return moment.utc(lessonDateTime).format(constants.DATE_TIME_FORMAT);
    } 
  }
  

  async getPreviousValidLessonDateTime(lesson: Lesson, userId: string, lessonDateTime: moment.Moment): Promise<moment.Moment> {
    let updatedLessonDateTime = lessonDateTime.clone();
    const lessonsCanceledDateTimes = await this.getLessonsCanceledDateTimes(userId, lesson.id as string);
    lessonsCanceledDateTimes.slice().reverse().forEach(function (dateTime) {
      if (moment.utc(dateTime).isSame(moment.utc(updatedLessonDateTime))) {
        updatedLessonDateTime = updatedLessonDateTime.subtract(7, 'd');
      } 
    });
    return updatedLessonDateTime;
  }


  async cancelLesson(request: Request, response: Response): Promise<void> {
    const userId: string = request.params.user_id;
    const lessonId: string = request.params.lesson_id;
    const { dateTime }: Lesson = request.body
    try {
      if (dateTime) {
        const insertLessonCanceledQuery = `INSERT INTO users_lessons_canceled (user_id, lesson_id, lesson_date_time)
          VALUES ($1, $2, $3)`;
        const lessonDateTime = moment.utc(dateTime);
        const values = [userId, lessonId, lessonDateTime];
        await pool.query(insertLessonCanceledQuery, values);        
      } else {
        const isMentor = await this.getIsMentor(userId);
        if (isMentor) {
          const updateMentorLessonQuery = 'UPDATE users_lessons SET is_canceled = true WHERE id = $1';
          await pool.query(updateMentorLessonQuery, [lessonId]);
        } else {
          const updateStudentLessonQuery = 'UPDATE users_lessons_students SET is_canceled = true  WHERE lesson_id = $1 AND student_id = $2';
          await pool.query(updateStudentLessonQuery, [lessonId, userId]);
        }
      }
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

