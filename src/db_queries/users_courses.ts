import { Request, Response } from 'express';
import pg from 'pg';
import autoBind from 'auto-bind';
import moment from 'moment';
import 'moment-timezone';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Users } from './users';
import Course from '../models/course.model';
import CourseMentor from '../models/course_mentor.model';
import CourseStudent from '../models/course_student.model';
import CourseType from '../models/course_type.model';
import InAppMessage from '../models/in_app_message';

const conn = new Conn();
const pool = conn.pool;
const users = new Users();

export class UsersCourses {
  constructor() {
    autoBind(this);
  }

  async getAvailableCourses(request: Request, response: Response): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const courses: Array<Course> = [];
      const getCoursesQuery = `SELECT uc.id, uc.start_date_time, ct.duration, ct.is_with_partner
        FROM users_courses uc 
        JOIN courses_types ct
          ON uc.course_type_id = ct.id
        WHERE is_canceled IS DISTINCT FROM true
          AND now() < (uc.start_date_time + (INTERVAL '1 month' * ct.duration))`;
      const { rows }: pg.QueryResult = await client.query(getCoursesQuery);
      if (rows && rows.length > 0) {
        for (const row of rows) {
          const courseType: CourseType = {
            duration: rows[0].duration,
            isWithPartner: rows[0].is_with_partner
          }
          const mentors = await this.getCourseMentors(row.id, client);
          const students = await this.getCourseStudents(row.id, client);
          const course = {
            id: rows[0].id,
            type: courseType,
            startDateTime: moment.utc(rows[0].start_date_time).format(constants.DATE_TIME_FORMAT),
            mentors: mentors,
            students: students
          }          
          courses.push(course);
        }
      }      
      response.status(200).json(courses);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }  

  async getCurrentCourse(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const user = await users.getUserFromDB(userId, client);
      let course: Course = {};
      let getCourseQuery;
      if (user.isMentor) {
        getCourseQuery = `SELECT course_id FROM users_courses_mentors
          WHERE mentor_id = $1 AND is_canceled IS DISTINCT FROM true`;
      } else {
        getCourseQuery = `SELECT course_id FROM users_courses_students
          WHERE student_id = $1 AND is_canceled IS DISTINCT FROM true`;
      }
      const { rows }: pg.QueryResult = await client.query(getCourseQuery, [userId]);
      if (rows && rows.length > 0) {
        for (const row of rows) {
          course = await this.getCourseById(row.course_id, client);
          if (Object.keys(course).length > 0) {
            break;
          }
        }
      }
      response.status(200).json(course);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async getCourseById(courseId: string, client: pg.PoolClient): Promise<Course> {
    const getCourseQuery = `SELECT uc.id, uc.start_date_time, ct.duration, ct.is_with_partner
      FROM users_courses uc 
      JOIN courses_types ct
        ON uc.course_type_id = ct.id
      WHERE uc.id = $1
        AND now() < (uc.start_date_time + (INTERVAL '1 month' * ct.duration))`;
    const { rows }: pg.QueryResult = await client.query(getCourseQuery, [courseId]);
    let course: Course = {};
    if (rows[0]) {
      const courseType: CourseType = {
        duration: rows[0].duration,
        isWithPartner: rows[0].is_with_partner
      }
      const mentors = await this.getCourseMentors(courseId, client);
      const students = await this.getCourseStudents(courseId, client);
      course = {
        id: rows[0].id,
        type: courseType,
        startDateTime: moment.utc(rows[0].start_date_time).format(constants.DATE_TIME_FORMAT),
        mentors: mentors,
        students: students
      }
    }
    return course;
  }
  
  async getCourseMentors(courseId: string, client: pg.PoolClient): Promise<Array<CourseMentor>> {
    const getCourseMentorsQuery = `SELECT mentor_id, subfield_id, meeting_url
      FROM users_courses_mentors
      WHERE course_id = $1
        AND is_canceled IS DISTINCT FROM true`;
    const { rows }: pg.QueryResult = await client.query(getCourseMentorsQuery, [courseId]);
    const mentors: Array<CourseMentor> = [];
    if (rows && rows.length > 0) {
      for (const row of rows) {
        const mentor = await users.getUserFromDB(row.mentor_id, client);
        const mentorSubfields = mentor?.field?.subfields;
        if (mentor && mentor.field && mentorSubfields && mentorSubfields.length > 0) {
          mentor.field.subfields = mentorSubfields.filter(subfield => subfield.id == rows[0].subfield_id);
        }        
        mentors.push(mentor as CourseMentor);
      }
    }
    return mentors;
  }

  async getCourseStudents(courseId: string, client: pg.PoolClient): Promise<Array<CourseStudent>> {
    const getCourseStudentsQuery = `SELECT student_id
      FROM users_courses_students
      WHERE course_id = $1
        AND is_canceled IS DISTINCT FROM true`;
    const { rows }: pg.QueryResult = await client.query(getCourseStudentsQuery, [courseId]);
    const students: Array<CourseStudent> = [];
    if (rows && rows.length > 0) {
      for (const row of rows) {
        const student = await users.getUserFromDB(row.student_id, client);
        students.push(student as CourseStudent);
      }
    }
    return students;
  }
  
  async addCourse(request: Request, response: Response): Promise<void> {
    const mentorId = request.user.id as string;
    const { type, mentors, startDateTime }: Course = request.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const mentor = (await users.getUserFromDB(mentorId, client)) as CourseMentor;
      if (mentors) {
        mentor.meetingUrl = mentors[0].meetingUrl;
      }
      let course: Course = {
        type: type,
        mentors: [mentor],
        startDateTime: startDateTime
      }
      course = await this.addCourseFromDB(course, client);
      response.status(200).json(course);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }  

  async addCourseFromDB(course: Course, client: pg.PoolClient): Promise<Course> {
    const insertCourseQuery = 'INSERT INTO users_courses (start_date_time, course_type_id) VALUES ($1, $2) RETURNING *';
    const values = [course.startDateTime, course.type?.id]; 
    const { rows }: pg.QueryResult = await client.query(insertCourseQuery, values);
    course.id = rows[0].id;
    if (course.mentors && course.mentors.length > 0) {
      for (const mentor of course.mentors) {
        await this.addCourseMentor(course.id as string, mentor, client);
      }
    }
    return course;
  }
  
  async addCourseMentor(courseId: string, mentor: CourseMentor, client: pg.PoolClient): Promise<void> {
    const insertMentorQuery = `INSERT INTO users_courses_mentors (course_id, mentor_id, subfield_id, meeting_url)
      VALUES ($1, $2, $3, $4)`;
    const mentorSubfields = mentor?.field?.subfields;
    const mentorSubfield = mentorSubfields && mentorSubfields.length > 0 ? mentorSubfields[0] : {};
    const values = [courseId, mentor.id, mentorSubfield.id, mentor.meetingUrl];
    await client.query(insertMentorQuery, values);
  }
  
  async joinCourse(request: Request, response: Response): Promise<void> {
    const studentId = request.user.id as string;
    const courseId = request.params.id;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const student: CourseStudent = {
        id: studentId
      }
      await this.addCourseStudent(courseId, student, client);
      response.status(200).send(`Student has been added successfully to course ${courseId}`);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async addCourseStudent(courseId: string, student: CourseStudent, client: pg.PoolClient): Promise<void> {
    const getCourseStudentQuery = `SELECT student_id
      FROM users_courses_students
      WHERE course_id = $1
        AND student_id = $2
        AND is_canceled IS DISTINCT FROM true`;
    const { rows }: pg.QueryResult = await client.query(getCourseStudentQuery, [courseId, student.id]);
    if (rows.length == 0) {
      const insertStudentQuery = `INSERT INTO users_courses_students (course_id, student_id)
        VALUES ($1, $2)`;
      const values = [courseId, student.id];
      await client.query(insertStudentQuery, values);
    }
  }  
  
  async cancelCourse(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const courseId = request.params.id;
    const { text }: InAppMessage = request.body;    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const user = await users.getUserFromDB(userId, client);
      let cancelCourseUserQuery;
      if (user.isMentor) {
        cancelCourseUserQuery = 'UPDATE users_courses_mentors SET is_canceled = true, canceled_date_time = $1 WHERE mentor_id = $2 AND course_id = $3';
      } else {
        cancelCourseUserQuery = 'UPDATE users_courses_students SET is_canceled = true, canceled_date_time = $1 WHERE student_id = $2 AND course_id = $3';
      }
      const canceledDateTime = moment.utc().format(constants.DATE_TIME_FORMAT);
      await client.query(cancelCourseUserQuery, [canceledDateTime, userId, courseId]);
      const mentors = await this.getCourseMentors(courseId, client);
      const students = await this.getCourseStudents(courseId, client);      
      if (mentors.length == 0 || students.length == 0) {
        const cancelCourseQuery = 'UPDATE users_courses SET is_canceled = true, canceled_date_time = $1 WHERE id = $2';
        await client.query(cancelCourseQuery, [canceledDateTime, courseId]);
      }
      response.status(200).send(`Course ${courseId} was canceled successfully for user ${userId}`);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }
}

