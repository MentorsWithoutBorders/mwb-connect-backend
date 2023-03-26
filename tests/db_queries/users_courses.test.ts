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
    course.startDateTime = moment.utc(course.startDateTime).subtract(13, 'week').format(constants.DATE_TIME_FORMAT);
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
    course.startDateTime = moment.utc(course.startDateTime).subtract(11, 'week').format(constants.DATE_TIME_FORMAT);
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
    course.startDateTime = moment.utc(course.startDateTime).subtract(11, 'week').format(constants.DATE_TIME_FORMAT);
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
});


describe('Next lesson datetime for mentor course functionality - ChatGPT', () => {
  
  test(`Ensure that the next lesson date/time is calculated correctly based on the start_date_time value and the weekly interval`, async () => {
    // Set up test data
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }    

    // Calculate expected next lesson date/time
    const expectedNextLessonDateTime = moment
      .utc(course.startDateTime)
      .add(1, 'week')
      .format(constants.DATE_TIME_FORMAT);

    // Calculate actual next lesson date/time
    const actualNextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);

    // Compare expected and actual values
    expect(actualNextLessonDateTime).toEqual(expectedNextLessonDateTime);
  });

  test(`Ensure that the next lesson date/time is calculated correctly based on the start_date_time value, the weekly interval, and the partnership schedule in the 'users_courses_partnership_schedule' table`, async () => {
    // Set up test data
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCoursesTestHelpers.addMentor(partnerMentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }   
    
    // Create partnership schedule
    await usersCourses.addMentorPartnershipSchedule(course, client);

    // Calculate expected next lesson date/time for mentor 1
    const expectedNextLessonDateTime1 = moment
      .utc(course.startDateTime)
      .add(1, 'week')
      .format(constants.DATE_TIME_FORMAT);

    // Calculate actual next lesson date/time for mentor 1
    const actualNextLessonDateTime1 = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);

    // Compare expected and actual values for mentor 1
    expect(actualNextLessonDateTime1).toEqual(expectedNextLessonDateTime1);

    // Calculate expected next lesson date/time for mentor 2
    const expectedNextLessonDateTime2 = moment
      .utc(course.startDateTime)
      .add(7, 'week')
      .format(constants.DATE_TIME_FORMAT);

    // Calculate actual next lesson date/time for mentor 2
    const actualNextLessonDateTime2 = await usersCourses.getNextLessonDateTimeForMentor(course, partnerMentorId, client);

    // Compare expected and actual values for mentor 2
    expect(actualNextLessonDateTime2).toEqual(expectedNextLessonDateTime2);
  });

  test(`Ensure that the system correctly identifies canceled lessons in the 'users_courses_lessons_canceled' table and skips them when calculating the next lesson date/time`, async () => {
    // Set up test data
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }

    // Calculate next lesson date/time
    let nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);
    if (!nextLessonDateTime) throw new Error('nextLessonDateTime is undefined');

    // Cancel the next lesson
    await usersCourses.cancelNextLessonFromDB(mentorId, course.id as string, nextLessonDateTime, client);

    // Calculate the next lesson date/time after canceling the current one
    const actualNextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);

    // Calculate expected next lesson date/time after skipping the canceled lesson
    const expectedNextLessonDateTime = moment
      .utc(nextLessonDateTime)
      .add(1, 'week')
      .format(constants.DATE_TIME_FORMAT);

    // Compare expected and actual values
    expect(actualNextLessonDateTime).toEqual(expectedNextLessonDateTime);
  });

  test(`Ensure that the system can identify the next lesson with at least one student participating, by checking the 'users_courses_lessons_canceled' table for students' cancellations`, async () => {
    // Set up test data
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }

    // Calculate next lesson date/time
    let nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);
    if (!nextLessonDateTime) throw new Error('nextLessonDateTime is undefined');

    // Cancel the next lesson for the first student
    await usersCourses.cancelNextLessonFromDB(studentId, course.id as string, nextLessonDateTime, client);

    // Calculate the next lesson date/time after canceling the current one for the first student
    const actualNextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);

    // Check if the next lesson date/time remains the same as at least one student is participating
    expect(actualNextLessonDateTime).toEqual(nextLessonDateTime);
  }); 

  test(`Ensure that the system calculates the correct end date for the course for the mentor and returns a null next lesson datetime if it's after the end of the course`, async () => {
    // Set up test data
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }
  
    // Update the course duration to 3 months
    course.type!.duration = 3;
    await usersCourses.addCourseFromDB(course, client);
  
    // Calculate the expected end date of the course
    const expectedEndDate = moment
      .utc(course.startDateTime)
      .add(course.type!.duration, 'months')
      .add(3, 'days')
      .format(constants.DATE_TIME_FORMAT);
  
    // Calculate the actual end date of the course
    let actualEndDate = await usersCourses.getCourseEndDateTime(course);
    actualEndDate = moment.utc(actualEndDate).format(constants.DATE_TIME_FORMAT);
  
    // Compare expected and actual end dates
    expect(actualEndDate).toEqual(expectedEndDate);
  
    // Change the course start date to simulate the scenario where the current date is after the end of the course
    course.startDateTime = moment
      .utc()
      .subtract(course.type!.duration + 1, 'months')
      .format(constants.DATE_TIME_FORMAT);
    await usersCourses.addCourseFromDB(course, client);
  
    // Get the next lesson datetime
    const actualNextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);
  
    // Check if next lesson datetime is null
    expect(actualNextLessonDateTime).toBeNull();
  });
  
  test(`Ensure that the next lesson datetime calculation is accurate for courses with different durations`, async () => {
    const durations = [3, 6];
  
    for (const duration of durations) {
      // Set up test data
      let course = usersCoursesTestHelpers.getTestCourse();
      course.type!.duration = duration;
      course = await usersCoursesTestHelpers.addMentor(mentorId, course);
      course = await usersCourses.addCourseFromDB(course, client);
      course = await usersCoursesTestHelpers.addStudent(studentId, course);
  
      // Get the next lesson datetime
      const nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);
  
      // Calculate the expected next lesson datetime
      const expectedNextLessonDateTime = moment
        .utc(course.startDateTime)
        .add(1, 'weeks')
        .format(constants.DATE_TIME_FORMAT);
  
      // Compare expected and actual next lesson datetime
      expect(nextLessonDateTime).toEqual(expectedNextLessonDateTime);
    }
  });

  test(`Ensure that the next lesson datetime calculation works correctly for both single-mentor and partnered courses`, async () => {
    const partnerStatuses = [true, false];

    for (const hasPartner of partnerStatuses) {
      // Set up test data
      let course = usersCoursesTestHelpers.getTestCourse();
      course = await usersCoursesTestHelpers.addMentor(mentorId, course);
      if (hasPartner) {
        course = await usersCoursesTestHelpers.addMentor(partnerMentorId, course);
      }
      course = await usersCourses.addCourseFromDB(course, client);
      course = await usersCoursesTestHelpers.addStudent(studentId, course);
      if (hasPartner) {
        await usersCourses.addMentorPartnershipSchedule(course, client);
        const mentorPartnershipSchedule = await usersCourses.getMentorPartnershipScheduleFromDB(course.id as string, client);
        mentorPartnershipSchedule[0].mentor.id = mentorId;
        await usersCourses.updateMentorPartnershipScheduleFromDB(mentorPartnershipSchedule[0], client);  
      }

      // Get the next lesson datetime for mentor
      const nextLessonDateTimeMentor = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);

      // Calculate the expected next lesson datetime for mentor
      const expectedNextLessonDateTimeMentor = moment
        .utc(course.startDateTime)
        .add(1, 'weeks')
        .format(constants.DATE_TIME_FORMAT);

      // Compare expected and actual next lesson datetime for mentor
      expect(nextLessonDateTimeMentor).toEqual(expectedNextLessonDateTimeMentor);

      if (hasPartner) {
        // Get the next lesson datetime for partner mentor
        const nextLessonDateTimePartner = await usersCourses.getNextLessonDateTimeForMentor(course, partnerMentorId, client);

        // Calculate the expected next lesson datetime for partner mentor
        const expectedNextLessonDateTimePartner = moment
          .utc(course.startDateTime)
          .add(7, 'weeks')
          .format(constants.DATE_TIME_FORMAT);

        // Compare expected and actual next lesson datetime for partner mentor
        expect(nextLessonDateTimePartner).toEqual(expectedNextLessonDateTimePartner);
      }
    }
  });  
    
  test(`Ensure that the system can handle consecutive canceled lessons and still correctly calculate the next lesson datetime`, async () => {
    // Set up test data
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
  
    // Cancel 3 consecutive lessons
    const numberOfCanceledLessons = 3;
    for (let i = 1; i <= numberOfCanceledLessons; i++) {
      const lessonDateTime = moment
        .utc(course.startDateTime)
        .add(i, 'weeks')
        .format(constants.DATE_TIME_FORMAT);
  
      await usersCourses.cancelNextLessonFromDB(mentorId, course.id as string, lessonDateTime, client);
    }
  
    // Get the next lesson datetime
    const nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);
  
    // Calculate the expected next lesson datetime
    const expectedNextLessonDateTime = moment
      .utc(course.startDateTime)
      .add(numberOfCanceledLessons + 1, 'weeks')
      .format(constants.DATE_TIME_FORMAT);
  
    // Compare expected and actual next lesson datetime
    expect(nextLessonDateTime).toEqual(expectedNextLessonDateTime);
  });
  
  test(`Ensure that the next lesson datetime calculation is accurate for courses with different numbers of students`, async () => {
    // Set up test data
    const course = usersCoursesTestHelpers.getTestCourse();

    // Add a mentor and students to the course
    const courseWithMentor = await usersCoursesTestHelpers.addMentor(mentorId, course);
    let courseWithStudents = await usersCourses.addCourseFromDB(courseWithMentor, client);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      courseWithStudents = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }    
  
    // Get the next lesson datetime
    const nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(courseWithStudents, mentorId, client);
  
    // Calculate the expected next lesson datetime
    const expectedNextLessonDateTime = moment
      .utc(course.startDateTime)
      .add(1, 'weeks')
      .format(constants.DATE_TIME_FORMAT);
  
    // Compare expected and actual next lesson datetime
    expect(nextLessonDateTime).toEqual(expectedNextLessonDateTime);
  });
  
  test(`Ensure that the system can identify the next lesson that hasn't been canceled by the mentor`, async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }
  
    // Cancel the next 3 lessons
    for (let i = 1; i <= 3; i++) {
      let canceledLessonDateTime = moment
        .utc(course.startDateTime)
        .add(i, 'week')
        .format(constants.DATE_TIME_FORMAT);
      await usersCourses.cancelNextLessonFromDB(mentorId, course.id as string, canceledLessonDateTime, client);
    }
  
    // Calculate the next lesson date/time after canceling the first 3 lessons
    const actualNextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);
  
    // Calculate expected next lesson date/time after skipping the canceled lessons
    const expectedNextLessonDateTime = moment
      .utc(course.startDateTime)
      .add(4, 'week')
      .format(constants.DATE_TIME_FORMAT);
  
    // Compare expected and actual values
    expect(actualNextLessonDateTime).toEqual(expectedNextLessonDateTime);
  });
});


describe('Next lesson datetime for second mentor in partnership course functionality - ChatGPT', () => {
  test('getNextLessonDateTimeForMentor returns the correct date for the second mentor when the course starts', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course.type!.duration = 6;
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCoursesTestHelpers.addMentor(partnerMentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }
    await usersCourses.addMentorPartnershipSchedule(course, client);
  
    let nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, partnerMentorId, client);
    expect(nextLessonDateTime).toEqual(moment.utc(course.startDateTime).add(13, 'week').format(constants.DATE_TIME_FORMAT));
  });
  
  test('getNextLessonDateTimeForMentor returns the correct date for the second mentor when the first mentor\'s lessons are completed', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course.type!.duration = 6;
    course.startDateTime = moment.utc(course.startDateTime).subtract(15, 'week').format(constants.DATE_TIME_FORMAT);
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCoursesTestHelpers.addMentor(partnerMentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }
    await usersCourses.addMentorPartnershipSchedule(course, client);
  
    let nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, partnerMentorId, client);
    expect(nextLessonDateTime).toEqual(moment.utc(course.startDateTime).add(16, 'week').format(constants.DATE_TIME_FORMAT));
  });
  
  test('getNextLessonDateTimeForMentor returns the correct date for the second mentor when some of the first mentor\'s lessons are canceled', async () => {
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
  
    nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, partnerMentorId, client);
    expect(nextLessonDateTime).toEqual(moment.utc(course.startDateTime).add(7, 'week').format(constants.DATE_TIME_FORMAT));
  });
  
  test('getNextLessonDateTimeForMentor returns the correct date for the second mentor when some of their lessons are canceled', async () => {
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
  
  test('getNextLessonDateTimeForMentor returns the correct date for the second mentor when some lessons from both mentors are canceled', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCoursesTestHelpers.addMentor(partnerMentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }
    await usersCourses.addMentorPartnershipSchedule(course, client);
  
    // Cancel a lesson for the first mentor
    let firstMentorLessonDateTime = moment.utc(course.startDateTime).add(1, 'week').format(constants.DATE_TIME_FORMAT);
    await usersCourses.cancelNextLessonFromDB(mentorId, course.id as string, firstMentorLessonDateTime, client);
  
    // Cancel a lesson for the second mentor
    let secondMentorLessonDateTime = moment.utc(course.startDateTime).add(7, 'week').format(constants.DATE_TIME_FORMAT);
    await usersCourses.cancelNextLessonFromDB(partnerMentorId, course.id as string, secondMentorLessonDateTime, client);
  
    let nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, partnerMentorId, client);
    expect(nextLessonDateTime).toEqual(moment.utc(course.startDateTime).add(8, 'week').format(constants.DATE_TIME_FORMAT));
  });

  test('getNextLessonDateTimeForMentor returns the correct date for the second mentor when there is a change in the partnership schedule', async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCoursesTestHelpers.addMentor(partnerMentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }
    await usersCourses.addMentorPartnershipSchedule(course, client);
  
    // Change partnership schedule
    const mentorPartnershipSchedule = await usersCourses.getMentorPartnershipScheduleFromDB(course.id as string, client);
    const updatedSchedule = mentorPartnershipSchedule.map((schedule, index) => {
      if (index % 2 === 0) {
        return { ...schedule, mentor: { ...schedule.mentor, id: partnerMentorId } };
      } else {
        return { ...schedule, mentor: { ...schedule.mentor, id: mentorId } };
      }
    });
    for (const schedule of updatedSchedule) {
      await usersCourses.updateMentorPartnershipScheduleFromDB(schedule, client);
    }
  
    let nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, partnerMentorId, client);
    expect(nextLessonDateTime).toEqual(moment.utc(course.startDateTime).add(1, 'week').format(constants.DATE_TIME_FORMAT));
  });

});


describe('Next lesson datetime for student course functionality - ChatGPT', () => {

  test(`Ensure that the system calculates the correct next lesson datetime with canceled lessons for both mentors and students`, async () => {
    // Set up test data
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }
  
    // Calculate next lesson date/time
    let nextLessonDateTime = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);
    if (!nextLessonDateTime) throw new Error('nextLessonDateTime is undefined');
  
    // Cancel the next lesson for the mentor
    await usersCourses.cancelNextLessonFromDB(mentorId, course.id as string, nextLessonDateTime, client);
  
    // Calculate next lesson date/time for the student
    const nextLessonDateTimeForStudent = await usersCourses.getNextLessonDateTimeForStudent(course, studentId, client);
  
    // Calculate expected next lesson date/time for the student after skipping the canceled lesson
    const expectedNextLessonDateTime = moment
      .utc(nextLessonDateTime)
      .add(1, 'week')
      .format(constants.DATE_TIME_FORMAT);
  
    // Compare expected and actual values for the student
    expect(nextLessonDateTimeForStudent).toEqual(expectedNextLessonDateTime);
  });

  test(`Ensure that the next lesson date/time is calculated correctly for the student based on the start_date_time value and the weekly interval`, async () => {
    // Set up test data
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
  
    // Calculate expected next lesson date/time for the student
    const expectedNextLessonDateTime = moment
      .utc(course.startDateTime)
      .add(1, 'week')
      .format(constants.DATE_TIME_FORMAT);
  
    // Calculate actual next lesson date/time for the student
    const actualNextLessonDateTime = await usersCourses.getNextLessonDateTimeForStudent(course, studentId, client);
  
    // Compare expected and actual values
    expect(actualNextLessonDateTime).toEqual(expectedNextLessonDateTime);
  });
  
  test(`Ensure that the next lesson date/time is calculated correctly for a student in a course with two mentors based on the start_date_time value, the weekly interval, and the mentor for the next lesson found in the 'users_courses_partnership_schedule' table`, async () => {
    // Set up test data
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCoursesTestHelpers.addMentor(partnerMentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }
  
    // Create partnership schedule
    await usersCourses.addMentorPartnershipSchedule(course, client);
  
    // Calculate expected next lesson date/time for the student
    const expectedNextLessonDateTime = moment
      .utc(course.startDateTime)
      .add(1, 'week')
      .format(constants.DATE_TIME_FORMAT);
  
    // Calculate actual next lesson date/time for the student
    const actualNextLessonDateTime = await usersCourses.getNextLessonDateTimeForStudent(course, studentId, client);
  
    // Compare expected and actual values
    expect(actualNextLessonDateTime).toEqual(expectedNextLessonDateTime);
  });
  
  test(`Ensure that the system correctly identifies canceled lessons for a student in the 'users_courses_lessons_canceled' table and skips them when calculating the next lesson date/time`, async () => {
    // Set up test data
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }
  
    // Calculate next lesson date/time
    let nextLessonDateTime = await usersCourses.getNextLessonDateTimeForStudent(course, studentId, client);
    if (!nextLessonDateTime) throw new Error('nextLessonDateTime is undefined');
  
    // Cancel the next lesson for the student
    await usersCourses.cancelNextLessonFromDB(studentId, course.id as string, nextLessonDateTime, client);
  
    // Calculate the next lesson date/time after canceling the current one
    const actualNextLessonDateTime = await usersCourses.getNextLessonDateTimeForStudent(course, studentId, client);
  
    // Calculate expected next lesson date/time after skipping the canceled lesson
    const expectedNextLessonDateTime = moment
      .utc(nextLessonDateTime)
      .add(1, 'week')
      .format(constants.DATE_TIME_FORMAT);
  
    // Compare expected and actual values
    expect(actualNextLessonDateTime).toEqual(expectedNextLessonDateTime);
  });

  test(`Ensure that the system calculates the correct end date for the course and the next lesson datetime should be null if it's after the end of the course for the student`, async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }
  
    // Calculate the end of the course
    const endDate = moment.utc(course.startDateTime).add(course.type?.duration as number, 'months').add(3, 'days');
  
    // Move the current time after the end of the course
    const afterEndDate = endDate.clone().add(1, 'week');
  
    // Mock the current time to be after the end of the course
    jest.spyOn(Date, 'now').mockImplementation(() => afterEndDate.toDate().getTime());
  
    // Calculate the next lesson date/time for the student
    const actualNextLessonDateTime = await usersCourses.getNextLessonDateTimeForStudent(course, studentId, client);
  
    // Compare expected and actual values
    expect(actualNextLessonDateTime).toBeNull();
  
    // Restore the Date.now() function
    jest.restoreAllMocks();
  });

  test(`Ensure that the system correctly identifies canceled lessons in the 'users_courses_lessons_canceled' table and skips them when calculating the next lesson date/time for students`, async () => {
    // Set up test data
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    for (let i = 0; i < otherStudentsIds.length; i++) {
      course = await usersCoursesTestHelpers.addStudent(otherStudentsIds[i], course);
    }
  
    // Calculate next lesson date/time
    let nextLessonDateTime = await usersCourses.getNextLessonDateTimeForStudent(course, studentId, client);
    if (!nextLessonDateTime) throw new Error('nextLessonDateTime is undefined');
  
    // Cancel the next lesson
    await usersCourses.cancelNextLessonFromDB(studentId, course.id as string, nextLessonDateTime, client);
  
    // Calculate the next lesson date/time after canceling the current one
    const actualNextLessonDateTime = await usersCourses.getNextLessonDateTimeForStudent(course, studentId, client);
  
    // Calculate expected next lesson date/time after skipping the canceled lesson
    const expectedNextLessonDateTime = moment
      .utc(nextLessonDateTime)
      .add(1, 'week')
      .format(constants.DATE_TIME_FORMAT);
  
    // Compare expected and actual values
    expect(actualNextLessonDateTime).toEqual(expectedNextLessonDateTime);
  });

  test(`Ensure that the next lesson datetime calculation is accurate for students in courses with different durations`, async () => {
    const durations = [3, 6];
    
    for (const duration of durations) {
      let course = usersCoursesTestHelpers.getTestCourse();
      course.type!.duration = duration;
      course = await usersCoursesTestHelpers.addMentor(mentorId, course);
      course = await usersCourses.addCourseFromDB(course, client);
      course = await usersCoursesTestHelpers.addStudent(studentId, course);
  
      const expectedNextLessonDateTime = moment
        .utc(course.startDateTime)
        .add(1, 'week')
        .format(constants.DATE_TIME_FORMAT);
  
      const actualNextLessonDateTime = await usersCourses.getNextLessonDateTimeForStudent(course, studentId, client);
  
      expect(actualNextLessonDateTime).toEqual(expectedNextLessonDateTime);
    }
  });
  
  test(`Ensure that the next lesson datetime calculation works correctly for students in courses with and without a partner mentor`, async () => {
    const partnerStatuses = [true, false];
  
    for (const hasPartner of partnerStatuses) {
      // Set up test data
      let course = usersCoursesTestHelpers.getTestCourse();
      course = await usersCoursesTestHelpers.addMentor(mentorId, course);
      if (hasPartner) {
        course = await usersCoursesTestHelpers.addMentor(partnerMentorId, course);
      }
      course = await usersCourses.addCourseFromDB(course, client);
      course = await usersCoursesTestHelpers.addStudent(studentId, course);
      if (hasPartner) {
        await usersCourses.addMentorPartnershipSchedule(course, client);
      }
  
      // Get the next lesson datetime for the student
      const nextLessonDateTime = await usersCourses.getNextLessonDateTimeForStudent(course, studentId, client);
  
      // Calculate the expected next lesson datetime
      const expectedNextLessonDateTime = moment
        .utc(course.startDateTime)
        .add(1, 'weeks')
        .format(constants.DATE_TIME_FORMAT);
  
      // Compare expected and actual next lesson datetime for the student
      expect(nextLessonDateTime).toEqual(expectedNextLessonDateTime);
    }
  });

  test(`Ensure that the next lesson date/time is correctly calculated for a student who joins a course in progress and hasn't missed any lessons yet`, async () => {
    // Set up test data
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
  
    // Fast forward the course by 3 weeks
    course.startDateTime = moment
      .utc(course.startDateTime)
      .add(3, 'weeks')
      .format(constants.DATE_TIME_FORMAT);
  
    // Add student to the course
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
  
    // Calculate expected next lesson date/time
    const expectedNextLessonDateTime = moment
      .utc(course.startDateTime)
      .format(constants.DATE_TIME_FORMAT);
  
    // Calculate actual next lesson date/time
    const actualNextLessonDateTime = await usersCourses.getNextLessonDateTimeForStudent(course, studentId, client);
  
    // Compare expected and actual values
    expect(actualNextLessonDateTime).toEqual(expectedNextLessonDateTime);
  });

  test(`Ensure that the next lesson date/time is calculated correctly when a student joins a course in progress`, async () => {
    // Set up test data
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);

    // Calculate expected next lesson datetime
    const expectedNextLessonDateTime = moment
      .utc(course.startDateTime)
      .add(1, 'week')
      .format(constants.DATE_TIME_FORMAT);

    // Add a student to the course after the course has started
    course = await usersCoursesTestHelpers.addStudent(studentId, course);

    // Calculate actual next lesson datetime for the student
    const actualNextLessonDateTime = await usersCourses.getNextLessonDateTimeForStudent(course, studentId, client);

    // Compare expected and actual values for the student
    expect(actualNextLessonDateTime).toEqual(expectedNextLessonDateTime);

    // Calculate actual next lesson datetime for the mentor
    const actualNextLessonDateTimeForMentor = await usersCourses.getNextLessonDateTimeForMentor(course, mentorId, client);

    // Compare expected and actual values for the mentor
    expect(actualNextLessonDateTimeForMentor).toEqual(expectedNextLessonDateTime);
  });
});


describe('Next lesson datetime unit tests - ChatGPT', () => {

  test(`Ensure that 'getCourseEndDateTime' returns the correct end date for a given course`, async () => {
    let course = usersCoursesTestHelpers.getTestCourse();
    const expectedCourseEndDateTime = moment
      .utc(course.startDateTime)
      .add(course.type!.duration, 'months')
      .add(3, 'days')
      .format(constants.DATE_TIME_FORMAT);
    let actualCourseEndDateTime = usersCourses.getCourseEndDateTime(course);
    actualCourseEndDateTime = moment.utc(actualCourseEndDateTime).format(constants.DATE_TIME_FORMAT);
    expect(actualCourseEndDateTime).toEqual(expectedCourseEndDateTime);
  });
  
  test(`Ensure that 'getNextLessonDatetime' returns the correct next lesson datetime for mentors and students`, async () => {
    const isMentorArray = [true, false];
  
    for (const isMentor of isMentorArray) {
      // Set up test data
      let course = usersCoursesTestHelpers.getTestCourse();
      course = await usersCoursesTestHelpers.addMentor(mentorId, course);
      course = await usersCourses.addCourseFromDB(course, client);
      course = await usersCoursesTestHelpers.addStudent(studentId, course);
  
      // Get the next lesson datetime
      const userId = isMentor ? mentorId : studentId;
      let actualNextLessonDatetime = await usersCourses.getNextLessonDatetime(course, userId, isMentor, client);
      actualNextLessonDatetime = moment.utc(actualNextLessonDatetime).format(constants.DATE_TIME_FORMAT);
  
      // Calculate the expected next lesson datetime
      const expectedNextLessonDatetime = moment
        .utc(course.startDateTime)
        .add(1, 'week')
        .format(constants.DATE_TIME_FORMAT);
  
      // Compare expected and actual next lesson datetime
      expect(actualNextLessonDatetime).toEqual(expectedNextLessonDatetime);
    }
  });

  test(`Ensure that 'getNextLessonDatetime' returns null if the next lesson is after the end of the course`, async () => {
    const isMentorArray = [true, false];
  
    for (const isMentor of isMentorArray) {
      // Set up test data
      let course = usersCoursesTestHelpers.getTestCourse();
      course.type!.duration = 0; // Setting course duration to 0 months to force next lesson to be after the end of the course
      course = await usersCoursesTestHelpers.addMentor(mentorId, course);
      course = await usersCourses.addCourseFromDB(course, client);
      course = await usersCoursesTestHelpers.addStudent(studentId, course);
  
      // Get the next lesson datetime
      const userId = isMentor ? mentorId : studentId;
      const actualNextLessonDatetime = await usersCourses.getNextLessonDatetime(course, userId, isMentor, client);
  
      // Expect next lesson datetime to be null
      expect(actualNextLessonDatetime).toBeNull();
    }
  });
  
  test(`Ensure that the next lesson datetime calculation works correctly for a single-mentor course for both mentor and student`, async () => {
    // Set up test data
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
  
    // Get the next lesson datetime for mentor
    let nextLessonDateTimeMentor = await usersCourses.getNextLessonDatetimeSingleMentor(course, mentorId, true, client);
    nextLessonDateTimeMentor = moment.utc(nextLessonDateTimeMentor).format(constants.DATE_TIME_FORMAT);
  
    // Get the next lesson datetime for student
    let nextLessonDateTimeStudent = await usersCourses.getNextLessonDatetimeSingleMentor(course, studentId, false, client);
    nextLessonDateTimeStudent = moment.utc(nextLessonDateTimeStudent).format(constants.DATE_TIME_FORMAT);
  
    // Calculate the expected next lesson datetime
    const expectedNextLessonDateTime = moment
      .utc(course.startDateTime)
      .add(1, 'weeks')
      .format(constants.DATE_TIME_FORMAT);
  
    // Compare expected and actual next lesson datetime for mentor and student
    expect(nextLessonDateTimeMentor).toEqual(expectedNextLessonDateTime);
    expect(nextLessonDateTimeStudent).toEqual(expectedNextLessonDateTime);
  });

  test(`Ensure that the function correctly finds the next lesson date/time for the first mentor in a partnership course`, async () => {
    // Set up test data
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCoursesTestHelpers.addMentor(partnerMentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    await usersCourses.addMentorPartnershipSchedule(course, client);
  
    // Call the function
    let nextLessonDatetime = await usersCourses.getNextLessonDatetimeMentorsPartnership(course, mentorId, true, client);
    nextLessonDatetime = moment.utc(nextLessonDatetime).format(constants.DATE_TIME_FORMAT);
  
    // Calculate expected next lesson date/time
    let expectedNextLessonDatetime = moment.utc(course.startDateTime).add(1, 'weeks').format(constants.DATE_TIME_FORMAT);
    expectedNextLessonDatetime = moment.utc(expectedNextLessonDatetime).format(constants.DATE_TIME_FORMAT);
  
    // Compare expected and actual values
    expect(nextLessonDatetime).toEqual(expectedNextLessonDatetime);
  });

  test(`Ensure that the function correctly finds the next lesson date/time for the second mentor in a partnership course`, async () => {
    // Set up test data
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCoursesTestHelpers.addMentor(partnerMentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    await usersCourses.addMentorPartnershipSchedule(course, client);
  
    // Call the function
    let nextLessonDatetime = await usersCourses.getNextLessonDatetimeMentorsPartnership(course, partnerMentorId, true, client);
    nextLessonDatetime = moment.utc(nextLessonDatetime).format(constants.DATE_TIME_FORMAT);
  
    // Calculate expected next lesson date/time
    let expectedNextLessonDatetime = moment.utc(course.startDateTime).add(7, 'weeks').format(constants.DATE_TIME_FORMAT);
    expectedNextLessonDatetime = moment.utc(expectedNextLessonDatetime).format(constants.DATE_TIME_FORMAT);
  
    // Compare expected and actual values
    expect(nextLessonDatetime).toEqual(expectedNextLessonDatetime);
  });  

  test(`Ensure that the function correctly finds the next lesson date/time for a student in a partnership course`, async () => {
    // Set up test data
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCoursesTestHelpers.addMentor(partnerMentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    await usersCourses.addMentorPartnershipSchedule(course, client);
  
    // Call the function
    let nextLessonDatetime = await usersCourses.getNextLessonDatetimeMentorsPartnership(course, studentId, false, client);
    nextLessonDatetime = moment.utc(nextLessonDatetime).format(constants.DATE_TIME_FORMAT);
  
    // Calculate expected next lesson date/time
    let expectedNextLessonDatetime = moment.utc(course.startDateTime).add(1, 'weeks').format(constants.DATE_TIME_FORMAT);
    expectedNextLessonDatetime = moment.utc(expectedNextLessonDatetime).format(constants.DATE_TIME_FORMAT);
  
    // Compare expected and actual values
    expect(nextLessonDatetime).toEqual(expectedNextLessonDatetime);
  });

  test(`Ensure that the function correctly skips a canceled lesson when finding the next lesson date/time for a mentor in a partnership course`, async () => {
    // Set up test data
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCoursesTestHelpers.addMentor(partnerMentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
    await usersCourses.addMentorPartnershipSchedule(course, client);
  
    // Calculate next lesson date/time for mentor
    let nextLessonDateTime = await usersCourses.getNextLessonDatetimeMentorsPartnership(course, mentorId, true, client);
    if (!nextLessonDateTime) throw new Error('nextLessonDateTime is undefined');
  
    // Cancel the next lesson
    await usersCourses.cancelNextLessonFromDB(mentorId, course.id as string, nextLessonDateTime, client);
  
    // Calculate the next lesson date/time after canceling the current one
    let actualNextLessonDateTime = await usersCourses.getNextLessonDatetimeMentorsPartnership(course, mentorId, true, client);
    actualNextLessonDateTime = moment.utc(actualNextLessonDateTime).format(constants.DATE_TIME_FORMAT);
  
    // Calculate expected next lesson date/time after skipping the canceled lesson
    const expectedNextLessonDateTime = moment
      .utc(nextLessonDateTime)
      .add(1, 'week')
      .format(constants.DATE_TIME_FORMAT);
  
    // Compare expected and actual values
    expect(actualNextLessonDateTime).toEqual(expectedNextLessonDateTime);
  });

  test('Ensure that the isLessonCanceled function correctly identifies if a lesson is canceled', async () => {
    // Set up test data
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
  
    const lessonDateTime = moment.utc(course.startDateTime).add(1, 'weeks').format(constants.DATE_TIME_FORMAT);
  
    // Cancel the lesson
    await usersCourses.cancelNextLessonFromDB(mentorId, course.id as string, lessonDateTime, client);
  
    // Call the isLessonCanceled function
    const isCanceled = await usersCourses.isLessonCanceled(mentorId, course.id as string, lessonDateTime, client);
  
    // Check if the returned value matches the expected value
    expect(isCanceled).toBeTruthy();
  });
  
  test('Ensure that the hasAtLeastOneStudentParticipating function correctly identifies if at least one student is participating in a lesson', async () => {
    // Set up test data
    let course = usersCoursesTestHelpers.getTestCourse();
    course = await usersCoursesTestHelpers.addMentor(mentorId, course);
    course = await usersCourses.addCourseFromDB(course, client);
    course = await usersCoursesTestHelpers.addStudent(studentId, course);
  
    const lessonDateTime = moment.utc(course.startDateTime).add(1, 'weeks').format(constants.DATE_TIME_FORMAT);
  
    // Call the hasAtLeastOneStudentParticipating function
    const hasParticipatingStudent = await usersCourses.hasAtLeastOneStudentParticipating(course.id as string, lessonDateTime, client);
  
    // Check if the returned value matches the expected value
    expect(hasParticipatingStudent).toBeTruthy();
  
    // Cancel the lesson for the student
    await usersCourses.cancelNextLessonFromDB(studentId, course.id as string, lessonDateTime, client);
  
    // Call the hasAtLeastOneStudentParticipating function again
    const hasParticipatingStudentAfterCancel = await usersCourses.hasAtLeastOneStudentParticipating(course.id as string, lessonDateTime, client);
  
    // Check if the returned value matches the expected value
    expect(hasParticipatingStudentAfterCancel).toBeFalsy();
  });  
});

