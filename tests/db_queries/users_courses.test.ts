import { PoolClient } from 'pg';
import moment from 'moment';
import { Conn } from '../../src/db/conn';
import { constants } from '../../src/utils/constants';
import { UsersCourses } from '../../src/db_queries/users_courses';
import { UsersCoursesTestHelpers } from '../utils/users_courses_test_helpers';

const conn = new Conn();
const pool = conn.pool;
const usersCourses = new UsersCourses();
const usersCoursesTestHelpers = new UsersCoursesTestHelpers();
let client: PoolClient;
let mentorId: string;
let partnerMentorId: string;
let studentId: string;
let otherStudentsIds: Array<string>;

describe('Mentor and student lessons functionality', () => {
  beforeAll(async () => {
    client = await pool.connect();
    mentorId = 'd4c98320-22ee-4b77-9c2f-81337b94e885';
    partnerMentorId = 'dfffbad3-0cad-493e-a66d-cf3161616323';
    studentId = 'c9682d5f-a104-4229-b8b1-0ccfef35e5f6';
    otherStudentsIds = ['04e7ec49-bfbe-425b-8c58-e4f1f60e1735'];
  });

  beforeEach(async () => {
    await usersCoursesTestHelpers.deleteAllCoursesData();
  });

  afterAll(async () => {
    await client.release();
    await pool.end();
  });

  test('getNextLessonDateTimeForMentor returns the correct date for single mentor when there are no canceled lessons', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }

    const nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);
    if (!nextLessonDateTime) throw new Error('nextLessonDateTime is undefined');
    expect(nextLessonDateTime).toEqual(moment.utc(course.startDateTime).add(1, 'week').format(constants.DATE_TIME_FORMAT));
  });

  test('getNextLessonDateTimeForMentor returns the correct date for single mentor when the mentor has canceled the next lesson', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);    
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }

    let nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);
    if (!nextLessonDateTime) throw new Error('nextLessonDateTime is undefined');
    await usersCourses.cancelNextLessonFromDB(mentorId, course?.id as string, nextLessonDateTime, client);
    nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);
    if (!nextLessonDateTime) throw new Error('nextLessonDateTime is undefined');
    expect(nextLessonDateTime).toEqual(moment.utc(course.startDateTime).add(2, 'week').format(constants.DATE_TIME_FORMAT));
  });
  
  test('getNextLessonDateTimeForMentor returns the correct date for single mentor when the students have canceled the next lesson', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);    
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }

    let nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);
    if (!nextLessonDateTime) throw new Error('nextLessonDateTime is undefined');
    await usersCourses.cancelNextLessonFromDB(studentId, course?.id as string, nextLessonDateTime, client);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      await usersCourses.cancelNextLessonFromDB(otherStudentsIds[i], course?.id as string, nextLessonDateTime, client);
    }    
    nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);
    if (!nextLessonDateTime) throw new Error('nextLessonDateTime is undefined');
    expect(nextLessonDateTime).toEqual(moment.utc(course.startDateTime).add(2, 'week').format(constants.DATE_TIME_FORMAT));
  }, 1000000);   

  // test('getNextLessonDateTimeForMentor returns the correct date for single mentor when there is less than one week until the end of the course', async () => {
  //   let course = usersCoursesTestHelpers.getTestCourse();
  //   course.startDateTime = moment.utc(course.startDateTime).subtract(14, 'week').format(constants.DATE_TIME_FORMAT);
  //   course = await usersCoursesTestHelpers.addMentor(mentorId, course);
  //   course = await usersCourses.addCourseFromDB(course, client);
  //   course = await usersCoursesTestHelpers.addStudent(studentId, course);
  //   for (let i = 0; i < otherStudentsIds.length; i++) {
  //     course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
  //   }

  //   const nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);
  //   if (!nextLessonDateTime) throw new Error('nextLessonDateTime is undefined');
  //   expect(nextLessonDateTime).toEqual(moment.utc(course.startDateTime).add(1, 'week').format(constants.DATE_TIME_FORMAT));
  // }, 100000);


  // Add more tests for other functions: getNextLessonDateTime, getStudentsParticipating, isLessonCanceled, and isLessonCanceledByUser
});
