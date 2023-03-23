import { PoolClient } from 'pg';
import moment from 'moment';
import { createClient } from 'async-redis';
import { Conn } from '../../src/db/conn';
import { constants } from '../../src/utils/constants';
import { UsersCourses } from '../../src/db_queries/users_courses';
import { UsersCoursesTestHelpers } from '../utils/users_courses_test_helpers';

const conn = new Conn();
const pool = conn.pool;
const usersCourses = new UsersCourses();
const usersCoursesTestHelpers = new UsersCoursesTestHelpers();
const redisClient = createClient();
let client: PoolClient;
let mentorId: string;
let partnerMentorId: string;
let studentId: string;
let otherStudentsIds: Array<string>;

beforeAll(async () => {
  mentorId = 'd4c98320-22ee-4b77-9c2f-81337b94e885';
  partnerMentorId = 'dfffbad3-0cad-493e-a66d-cf3161616323';
  studentId = 'c9682d5f-a104-4229-b8b1-0ccfef35e5f6';
  otherStudentsIds = ['04e7ec49-bfbe-425b-8c58-e4f1f60e1735'];
});

beforeEach(async () => {
  client = await pool.connect();
  await usersCoursesTestHelpers.deleteAllCoursesData();
});

afterEach(async () => {
  await client.release();
  await redisClient.quit();
});

afterAll(async () => {
  await pool.end();
});

describe('Next lesson datetime for single mentor course functionality', () => {
  test('getNextLessonDateTimeForMentor returns the correct date for single mentor when there are no canceled lessons', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }

    const nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);
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
    expect(nextLessonDateTime).toEqual(moment.utc(course.startDateTime).add(2, 'week').format(constants.DATE_TIME_FORMAT));
  });

  test('getNextLessonDateTimeForMentor returns the correct date for single mentor when there are no lessons left in the course', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course.startDateTime = moment.utc(course.startDateTime).subtract(13, 'week').format(constants.DATE_TIME_FORMAT);
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }

    let nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);
    expect(nextLessonDateTime).toBeNull();
  });

  test('getNextLessonDateTimeForMentor returns the correct date for single mentor when there is less than one week until the end of the course and the last lesson was canceled by the mentor', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course.startDateTime = moment.utc(course.startDateTime).subtract(12, 'week').format(constants.DATE_TIME_FORMAT);
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
    expect(nextLessonDateTime).toBeNull();
  });

  test('getNextLessonDateTimeForMentor returns the correct date for single mentor when there are less than 2 weeks until the end of the course and the last 2 lessons were canceled by the mentor', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course.startDateTime = moment.utc(course.startDateTime).subtract(11, 'week').format(constants.DATE_TIME_FORMAT);
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
    await usersCourses.cancelNextLessonFromDB(mentorId, course?.id as string, nextLessonDateTime, client);
    nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);    
    expect(nextLessonDateTime).toBeNull();
  });

  test('getNextLessonDateTimeForMentor returns the correct date for single mentor when there is less than one week until the end of the course and the last lesson was canceled by the students', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course.startDateTime = moment.utc(course.startDateTime).subtract(12, 'week').format(constants.DATE_TIME_FORMAT);
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
    expect(nextLessonDateTime).toBeNull();
  });

  test('getNextLessonDateTimeForMentor returns the correct date for single mentor when there are less than 2 weeks until the end of the course and the last lessons were canceled by the students', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course.startDateTime = moment.utc(course.startDateTime).subtract(11, 'week').format(constants.DATE_TIME_FORMAT);
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
    await usersCourses.cancelNextLessonFromDB(studentId, course?.id as string, nextLessonDateTime, client);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      await usersCourses.cancelNextLessonFromDB(otherStudentsIds[i], course?.id as string, nextLessonDateTime, client);
    }    
    nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);    
    expect(nextLessonDateTime).toBeNull();
  });
});


describe('Next lesson datetime for mentor partnership course functionality (first mentor)', () => {
  test('getNextLessonDateTimeForMentor returns the correct date for the first mentor in partnership when there are no canceled lessons', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCoursesTestHelpers.addMentor(partnerMentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }
    await usersCourses.addMentorPartnershipSchedule(course, client);

    const nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);
    expect(nextLessonDateTime).toEqual(moment.utc(course.startDateTime).add(1, 'week').format(constants.DATE_TIME_FORMAT));
  });

  test('getNextLessonDateTimeForMentor returns the correct date for the first mentor in partnership when there are no canceled lessons and the next lesson is assigned to the second mentor', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCoursesTestHelpers.addMentor(partnerMentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }
    await usersCourses.addMentorPartnershipSchedule(course, client);
    const mentorPartnershipSchedule = await usersCourses.getMentorPartnershipScheduleFromDB(course.id as string, client);
    mentorPartnershipSchedule[0].mentor.id = partnerMentorId;
    await usersCourses.updateMentorPartnershipScheduleFromDB(mentorPartnershipSchedule[0], client);

    const nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);
    expect(nextLessonDateTime).toEqual(moment.utc(course.startDateTime).add(2, 'week').format(constants.DATE_TIME_FORMAT));
  });

  test('getNextLessonDateTimeForMentor returns the correct date for the first mentor in partnership when the mentor has canceled the next lesson', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCoursesTestHelpers.addMentor(partnerMentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }
    await usersCourses.addMentorPartnershipSchedule(course, client);

    let nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);
    if (!nextLessonDateTime) throw new Error('nextLessonDateTime is undefined');
    await usersCourses.cancelNextLessonFromDB(mentorId, course?.id as string, nextLessonDateTime, client);
    nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);
    expect(nextLessonDateTime).toEqual(moment.utc(course.startDateTime).add(2, 'week').format(constants.DATE_TIME_FORMAT));
  });
  
  test('getNextLessonDateTimeForMentor returns the correct date for the first mentor in partnership when the students have canceled the next lesson', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCoursesTestHelpers.addMentor(partnerMentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);    
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }
    await usersCourses.addMentorPartnershipSchedule(course, client);

    let nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);
    if (!nextLessonDateTime) throw new Error('nextLessonDateTime is undefined');
    await usersCourses.cancelNextLessonFromDB(studentId, course?.id as string, nextLessonDateTime, client);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      await usersCourses.cancelNextLessonFromDB(otherStudentsIds[i], course?.id as string, nextLessonDateTime, client);
    }    
    nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);
    expect(nextLessonDateTime).toEqual(moment.utc(course.startDateTime).add(2, 'week').format(constants.DATE_TIME_FORMAT));
  });

  test('getNextLessonDateTimeForMentor returns the correct date for the first mentor in partnership when there are no lessons left in the course', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course.startDateTime = moment.utc(course.startDateTime).subtract(6, 'week').format(constants.DATE_TIME_FORMAT);
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCoursesTestHelpers.addMentor(partnerMentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }
    await usersCourses.addMentorPartnershipSchedule(course, client);

    let nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);
    expect(nextLessonDateTime).toBeNull();
  });
  
  test('getNextLessonDateTimeForMentor returns the correct date for the first mentor in partnership when the last lesson has replaced one of the lessons of the second mentor and was canceled', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course.startDateTime = moment.utc(course.startDateTime).subtract(8, 'week').format(constants.DATE_TIME_FORMAT);
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCoursesTestHelpers.addMentor(partnerMentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }
    await usersCourses.addMentorPartnershipSchedule(course, client);
    const mentorPartnershipSchedule = await usersCourses.getMentorPartnershipScheduleFromDB(course.id as string, client);
    mentorPartnershipSchedule[0].mentor.id = mentorId;
    await usersCourses.updateMentorPartnershipScheduleFromDB(mentorPartnershipSchedule[0], client);    

    let nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);
    if (!nextLessonDateTime) throw new Error('nextLessonDateTime is undefined');
    await usersCourses.cancelNextLessonFromDB(mentorId, course?.id as string, nextLessonDateTime, client);
    nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);
    expect(nextLessonDateTime).toBeNull();
  });   

  test('getNextLessonDateTimeForMentor returns the correct date for the first mentor in partnership when there are less than 2 weeks until the last 2 lessons and they were both canceled by the mentor', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course.startDateTime = moment.utc(course.startDateTime).subtract(4, 'week').format(constants.DATE_TIME_FORMAT);
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCoursesTestHelpers.addMentor(partnerMentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }
    await usersCourses.addMentorPartnershipSchedule(course, client);

    let nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);
    if (!nextLessonDateTime) throw new Error('nextLessonDateTime is undefined');
    await usersCourses.cancelNextLessonFromDB(mentorId, course?.id as string, nextLessonDateTime, client);
    nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);
    if (!nextLessonDateTime) throw new Error('nextLessonDateTime is undefined');    
    await usersCourses.cancelNextLessonFromDB(mentorId, course?.id as string, nextLessonDateTime, client);
    nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);    
    expect(nextLessonDateTime).toBeNull();
  });

  test('getNextLessonDateTimeForMentor returns the correct date for the first mentor in partnership when there are less than 2 weeks until the last 2 lessons and one was canceled by the mentor and the other one was canceled by the students', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course.startDateTime = moment.utc(course.startDateTime).subtract(4, 'week').format(constants.DATE_TIME_FORMAT);
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCoursesTestHelpers.addMentor(partnerMentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }
    await usersCourses.addMentorPartnershipSchedule(course, client);

    let nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);
    if (!nextLessonDateTime) throw new Error('nextLessonDateTime is undefined');
    await usersCourses.cancelNextLessonFromDB(mentorId, course?.id as string, nextLessonDateTime, client);
    nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);
    if (!nextLessonDateTime) throw new Error('nextLessonDateTime is undefined');
    await usersCourses.cancelNextLessonFromDB(studentId, course?.id as string, nextLessonDateTime, client);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      await usersCourses.cancelNextLessonFromDB(otherStudentsIds[i], course?.id as string, nextLessonDateTime, client);
    }
    nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);    
    expect(nextLessonDateTime).toBeNull();
  });  
});


describe('Next lesson datetime for mentor partnership course functionality (second mentor)', () => {

  test('getNextLessonDateTimeForMentor returns the correct date for the second mentor in partnership when there are no canceled lessons', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCoursesTestHelpers.addMentor(partnerMentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }
    await usersCourses.addMentorPartnershipSchedule(course, client);

    const nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, partnerMentorId, client);
    expect(nextLessonDateTime).toEqual(moment.utc(course.startDateTime).add(7, 'week').format(constants.DATE_TIME_FORMAT));
  });

  test('getNextLessonDateTimeForMentor returns the correct date for the second mentor in partnership when there are no canceled lessons and the next lesson is assigned to the first mentor', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCoursesTestHelpers.addMentor(partnerMentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }
    await usersCourses.addMentorPartnershipSchedule(course, client);
    const mentorPartnershipSchedule = await usersCourses.getMentorPartnershipScheduleFromDB(course.id as string, client);
    mentorPartnershipSchedule[6].mentor.id = mentorId;
    await usersCourses.updateMentorPartnershipScheduleFromDB(mentorPartnershipSchedule[6], client);

    const nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, partnerMentorId, client);
    expect(nextLessonDateTime).toEqual(moment.utc(course.startDateTime).add(8, 'week').format(constants.DATE_TIME_FORMAT));
  });
  
  test('getNextLessonDateTimeForMentor returns the correct date for the second mentor in partnership when the mentor has canceled the next lesson', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCoursesTestHelpers.addMentor(partnerMentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }
    await usersCourses.addMentorPartnershipSchedule(course, client);

    let nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, partnerMentorId, client);
    if (!nextLessonDateTime) throw new Error('nextLessonDateTime is undefined');
    await usersCourses.cancelNextLessonFromDB(partnerMentorId, course?.id as string, nextLessonDateTime, client);
    nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, partnerMentorId, client);    
    expect(nextLessonDateTime).toEqual(moment.utc(course.startDateTime).add(8, 'week').format(constants.DATE_TIME_FORMAT));
  });

  test('getNextLessonDateTimeForMentor returns the correct date for the second mentor in partnership when the students have canceled the next lesson', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCoursesTestHelpers.addMentor(partnerMentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);    
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }
    await usersCourses.addMentorPartnershipSchedule(course, client);

    let nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, partnerMentorId, client);
    if (!nextLessonDateTime) throw new Error('nextLessonDateTime is undefined');
    await usersCourses.cancelNextLessonFromDB(studentId, course?.id as string, nextLessonDateTime, client);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      await usersCourses.cancelNextLessonFromDB(otherStudentsIds[i], course?.id as string, nextLessonDateTime, client);
    }    
    nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, partnerMentorId, client);
    expect(nextLessonDateTime).toEqual(moment.utc(course.startDateTime).add(8, 'week').format(constants.DATE_TIME_FORMAT));
  });  

  test('getNextLessonDateTimeForMentor returns the correct date for the second mentor in partnership when there are no lessons left in the course', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course.startDateTime = moment.utc(course.startDateTime).subtract(12, 'week').format(constants.DATE_TIME_FORMAT);
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCoursesTestHelpers.addMentor(partnerMentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }
    await usersCourses.addMentorPartnershipSchedule(course, client);

    let nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, partnerMentorId, client);
    expect(nextLessonDateTime).toBeNull();
  });

  test('getNextLessonDateTimeForMentor returns the correct date for the second mentor in partnership when there are less than 2 weeks until the end of the course and both lessons were canceled by the mentor', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course.startDateTime = moment.utc(course.startDateTime).subtract(10, 'week').format(constants.DATE_TIME_FORMAT);
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCoursesTestHelpers.addMentor(partnerMentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }
    await usersCourses.addMentorPartnershipSchedule(course, client);

    let nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, partnerMentorId, client);
    if (!nextLessonDateTime) throw new Error('nextLessonDateTime is undefined');
    await usersCourses.cancelNextLessonFromDB(partnerMentorId, course?.id as string, nextLessonDateTime, client);
    nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, partnerMentorId, client);
    if (!nextLessonDateTime) throw new Error('nextLessonDateTime is undefined');    
    await usersCourses.cancelNextLessonFromDB(partnerMentorId, course?.id as string, nextLessonDateTime, client);
    nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, partnerMentorId, client);    
    expect(nextLessonDateTime).toBeNull();
  });  

  test('getNextLessonDateTimeForMentor returns the correct date for the first mentor in partnership when there are less than 2 weeks until the end of the course and one of the lessons was canceled by the mentor and the other one was canceled by the students', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course.startDateTime = moment.utc(course.startDateTime).subtract(10, 'week').format(constants.DATE_TIME_FORMAT);
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCoursesTestHelpers.addMentor(partnerMentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }
    await usersCourses.addMentorPartnershipSchedule(course, client);

    let nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, partnerMentorId, client);
    if (!nextLessonDateTime) throw new Error('nextLessonDateTime is undefined');
    await usersCourses.cancelNextLessonFromDB(partnerMentorId, course?.id as string, nextLessonDateTime, client);
    nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, partnerMentorId, client);
    if (!nextLessonDateTime) throw new Error('nextLessonDateTime is undefined');
    await usersCourses.cancelNextLessonFromDB(studentId, course?.id as string, nextLessonDateTime, client);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      await usersCourses.cancelNextLessonFromDB(otherStudentsIds[i], course?.id as string, nextLessonDateTime, client);
    }
    nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, partnerMentorId, client);    
    expect(nextLessonDateTime).toBeNull();
  });  
});

describe('Next lesson datetime for student course functionality', () => {
  test('getNextLessonDateTimeForStudent returns the correct date when there are no canceled lessons', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }

    const nextLessonDateTime = await usersCourses.getNextLessonDateTimeForStudent(course, studentId, client);
    expect(nextLessonDateTime).toEqual(moment.utc(course.startDateTime).add(1, 'week').format(constants.DATE_TIME_FORMAT));
  });

  test('getNextLessonDateTimeForStudent returns the correct date when the student has canceled the next lesson', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);    
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }

    let nextLessonDateTime = await usersCourses.getNextLessonDateTimeForStudent(course, studentId, client);
    if (!nextLessonDateTime) throw new Error('nextLessonDateTime is undefined');
    await usersCourses.cancelNextLessonFromDB(studentId, course?.id as string, nextLessonDateTime, client);
    nextLessonDateTime = await usersCourses.getNextLessonDateTimeForStudent(course, studentId, client);
    expect(nextLessonDateTime).toEqual(moment.utc(course.startDateTime).add(2, 'week').format(constants.DATE_TIME_FORMAT));
  });

  test('getNextLessonDateTimeForStudent returns the correct date when the single mentor has canceled the next lesson', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);    
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }

    let nextLessonDateTime = await usersCourses.getNextLessonDateTimeForStudent(course, studentId, client);
    if (!nextLessonDateTime) throw new Error('nextLessonDateTime is undefined');
    await usersCourses.cancelNextLessonFromDB(mentorId, course?.id as string, nextLessonDateTime, client); 
    nextLessonDateTime = await usersCourses.getNextLessonDateTimeForStudent(course, studentId, client);
    expect(nextLessonDateTime).toEqual(moment.utc(course.startDateTime).add(2, 'week').format(constants.DATE_TIME_FORMAT));
  });
  
  test('getNextLessonDateTimeForStudent returns the correct date when there are no lessons left in the course', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course.startDateTime = moment.utc(course.startDateTime).subtract(13, 'week').format(constants.DATE_TIME_FORMAT);
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }

    let nextLessonDateTime = await usersCourses.getNextLessonDateTimeForStudent(course, studentId, client);
    expect(nextLessonDateTime).toBeNull();
  });
  
  test('getNextLessonDateTimeForStudent returns the correct date when the first mentor in partnership has canceled the next lesson', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCoursesTestHelpers.addMentor(partnerMentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }
    await usersCourses.addMentorPartnershipSchedule(course, client);

    let nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);
    if (!nextLessonDateTime) throw new Error('nextLessonDateTime is undefined');
    await usersCourses.cancelNextLessonFromDB(mentorId, course?.id as string, nextLessonDateTime, client);
    nextLessonDateTime = await usersCourses.getNextLessonDateTimeForStudent(course, studentId, client);
    expect(nextLessonDateTime).toEqual(moment.utc(course.startDateTime).add(2, 'week').format(constants.DATE_TIME_FORMAT));
  });
  
  test('getNextLessonDateTimeForStudent returns the correct date when the second mentor in partnership has canceled the next lesson', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course.startDateTime = moment.utc(course.startDateTime).subtract(5, 'week').format(constants.DATE_TIME_FORMAT);
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCoursesTestHelpers.addMentor(partnerMentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }
    await usersCourses.addMentorPartnershipSchedule(course, client);

    let nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, partnerMentorId, client);
    if (!nextLessonDateTime) throw new Error('nextLessonDateTime is undefined');
    await usersCourses.cancelNextLessonFromDB(partnerMentorId, course?.id as string, nextLessonDateTime, client);
    nextLessonDateTime = await usersCourses.getNextLessonDateTimeForStudent(course, studentId, client);
    expect(nextLessonDateTime).toEqual(moment.utc(course.startDateTime).add(6, 'week').format(constants.DATE_TIME_FORMAT));
  });  

  // Add more tests for other functions: getNextLessonDateTime, getStudentsParticipating, isLessonCanceled, and isLessonCanceledByUser
});
