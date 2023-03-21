import { PoolClient } from 'pg';
import moment from 'moment';
import { constants } from '../../src/utils/constants';
import { Helpers } from '../../src/utils/helpers';
import { Conn } from '../../src/db/conn';
import { Users } from '../../src/db_queries/users';
import { UsersCourses } from '../../src/db_queries/users_courses';
import Course from '../../src/models/course.model';
import CourseMentor from '../../src/models/course_mentor.model';
import CourseStudent from '../../src/models/course_student.model';

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();
const users = new Users();
const usersCourses = new UsersCourses();
let client: PoolClient;

export class UsersCoursesTestHelpers {
  constructor() {
    helpers.autoBind(this);
  }

  async deleteAllCoursesData() {
    client = await pool.connect();
    await client.query('DELETE FROM mentors_waiting_requests');
    await client.query('DELETE FROM mentors_partnership_requests');
    await client.query('DELETE FROM users_courses_partnership_schedule');
    await client.query('DELETE FROM users_courses_lessons_canceled');
    await client.query('DELETE FROM users_courses_mentors');
    await client.query('DELETE FROM users_courses_students');
    await client.query('DELETE FROM users_courses');
  }

  getTestCourse(): Course {
    const startDateTime = moment.utc();
    startDateTime.subtract(3, 'days');
    startDateTime.set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
    let course: Course = {
      type: {
        id: '67ccff8b-646e-4e0b-b425-e0ec19552ceb',
        duration: 3
      },
      mentors: [],
      students: [],
      startDateTime: moment.utc(startDateTime).format(constants.DATE_TIME_FORMAT),
    };
    return course;
  }

  async addMentor(mentorId: string, course: Course): Promise<Course> {
    const mentor = (await users.getUserFromDB(mentorId, client)) as CourseMentor;
    mentor.meetingUrl = 'https://meet.google.com/test';
    course.mentors?.push(mentor);
    return course;
  }

  async addStudent(studentId: string, course: Course): Promise<Course> {
    const student = (await users.getUserFromDB(studentId, client)) as CourseStudent;
    course.students?.push(student);
    await usersCourses.addCourseStudent(course.id as string, student, client);
    return course;
  }
}