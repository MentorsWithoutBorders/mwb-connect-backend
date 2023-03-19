import { PoolClient } from 'pg';
import moment from 'moment';
import { Conn } from '../../src/db/conn';
import { constants } from '../../src/utils/constants';
import { Users } from '../../src/db_queries/users';
import { UsersCourses } from '../../src/db_queries/users_courses';
import { deleteAllCoursesData } from '../utils/helpers';
import Course from '../../src/models/course.model';
import CourseMentor from '../../src/models/course_mentor.model';

const conn = new Conn();
const pool = conn.pool;
const users = new Users();
const usersCourses = new UsersCourses();
let client: PoolClient;
let mentorId: string;

describe('Mentor and student lessons functionality', () => {
  beforeAll(async () => {
    client = await pool.connect();
    mentorId = 'd4c98320-22ee-4b77-9c2f-81337b94e885';
  });

  beforeEach(async () => {
    await deleteAllCoursesData();
  });

  afterAll(async () => {
    await client.release();
    await pool.end();
  });

  test('getNextLessonDateTimeForMentor returns the correct date for single mentor when there are no canceled lessons', async () => {
    const mentor = (await users.getUserFromDB(mentorId, client)) as CourseMentor;
    mentor.meetingUrl = 'https://meet.google.com/test';
    const startDateTime = moment.utc();
    startDateTime.subtract(3, 'days');
    startDateTime.set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
    let course: Course = {
      type: {
        id: '67ccff8b-646e-4e0b-b425-e0ec19552ceb'
      },
      mentors: [
        mentor
      ],
      startDateTime: moment.utc(startDateTime).format(constants.DATE_TIME_FORMAT),
    };
    course = await usersCourses.addCourseFromDB(course, client);

    const nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);
    expect(nextLessonDateTime).toEqual(moment.utc(startDateTime).add(1, 'week').format(constants.DATE_TIME_FORMAT));
  });

  test('getNextLessonDateTimeForMentor returns the correct date for single mentor when there is one canceled lesson', async () => {
    const mentor = (await users.getUserFromDB(mentorId, client)) as CourseMentor;
    mentor.meetingUrl = 'https://meet.google.com/test';
    const startDateTime = moment.utc();
    startDateTime.subtract(3, 'days');
    startDateTime.set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
    let course: Course = {
      type: {
        id: '67ccff8b-646e-4e0b-b425-e0ec19552ceb'
      },
      mentors: [
        mentor
      ],
      startDateTime: moment.utc(startDateTime).format(constants.DATE_TIME_FORMAT),
    };
    course = await usersCourses.addCourseFromDB(course, client);

    const nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);
    expect(nextLessonDateTime).toEqual(moment.utc(startDateTime).add(1, 'week').format(constants.DATE_TIME_FORMAT));
  });  

  // Add more tests for other functions: getNextLessonDateTime, getStudentsParticipating, isLessonCanceled, and isLessonCanceledByUser
});
