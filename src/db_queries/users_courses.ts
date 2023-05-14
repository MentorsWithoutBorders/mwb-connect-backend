import { Request, Response } from 'express';
import pg from 'pg';
import { createClient } from 'async-redis';
import moment from 'moment';
import 'moment-timezone';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Helpers } from '../utils/helpers';
import { Fields } from './fields';
import { FieldsGoals } from './fields_goals';
import { Users } from './users';
import { UsersAvailableMentors } from './users_available_mentors';
import { UsersPushNotifications } from './users_push_notifications';
import { UsersSendEmails } from './users_send_emails';
import Course from '../models/course.model';
import CourseMentor from '../models/course_mentor.model';
import CourseStudent from '../models/course_student.model';
import CourseType from '../models/course_type.model';
import Field from '../models/field.model';
import Subfield from '../models/subfield.model';
import Skill from '../models/skill.model';
import Availability from '../models/availability.model';
import AvailabilityTime from '../models/availability_time.model';
import CourseFilter from '../models/course_filter.model';
import MentorPartnershipScheduleItem from '../models/mentor_partnership_schedule_item.model';
import NextLessonMentor from '../models/next_lesson_mentor.model';
import NextLessonStudent from '../models/next_lesson_student.model';
import InAppMessage from '../models/in_app_message';

const conn = new Conn();
const pool = conn.pool;
const redisClient = createClient();
const helpers = new Helpers();
const fields = new Fields();
const fieldsGoals = new FieldsGoals();
const users = new Users();
const usersAvailableMentors = new UsersAvailableMentors();
const usersPushNotifications = new UsersPushNotifications();
const usersSendEmails = new UsersSendEmails();

export class UsersCourses {
  constructor() {
    helpers.autoBind(this);
  }

  async getAvailableCourses(request: Request, response: Response): Promise<void> {
    const page = request.query.page as string;
    const courseFilter: CourseFilter = request.body;    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let courses = await this.getAvailableCoursesFromDB(courseFilter, client);
      courses = this.getPaginatedCourses(courses, page);
      await client.query('COMMIT');
      response.status(200).json(courses);
    } catch (error) {
      await client.query('ROLLBACK');
      response.status(400).send(error);
    } finally {
      client.release();
    }
  }
  
  async getAvailableCoursesFromDB(courseFilter: CourseFilter, client: pg.PoolClient): Promise<Array<Course>> {
    const courses: Array<Course> = [];
    let getCoursesQuery = `SELECT uc.id, uc.start_date_time, ct.duration, ct.is_with_partner, ct.index
			FROM users_courses uc 
			JOIN course_types ct
				ON uc.course_type_id = ct.id
			WHERE uc.is_canceled IS DISTINCT FROM true
				AND (uc.has_started IS DISTINCT FROM true OR now() < uc.start_date_time + INTERVAL '3 weeks')`;
    const courseDuration = courseFilter?.courseType?.duration;
    const values: Array<string> = [];
    if (courseDuration) {
      getCoursesQuery += ` AND ct.duration = $1`;
      values.push(courseDuration.toString());
    }
    const { rows }: pg.QueryResult = await client.query(getCoursesQuery, values);
    if (rows && rows.length > 0) {
      for (const row of rows) {
        const courseType: CourseType = {
          duration: row.duration,
          isWithPartner: row.is_with_partner,
          index: row.index
        }
        const mentors = await this.getCourseMentors(row.id, client);
        const students = await this.getCourseStudents(row.id, client);
        const course = {
          id: row.id,
          type: courseType,
          startDateTime: moment.utc(row.start_date_time).format(constants.DATE_TIME_FORMAT),
          mentors: mentors,
          students: students
        }
        const courseCombinedMentor = this.getCourseCombinedMentor(mentors, course.startDateTime);
        if (usersAvailableMentors.isValidMentor(courseCombinedMentor, courseFilter?.field, courseFilter?.availabilities) && students.length < constants.MAX_STUDENTS_COURSE) {
          courses.push(course);
        }        
      }
    }
    return courses;
  }

  getCourseCombinedMentor(mentors: Array<CourseMentor>, courseStartDateTime: string): CourseMentor {
    const courseCombinedMentor: CourseMentor = {};
    mentors = JSON.parse(JSON.stringify(mentors));
    if (mentors && mentors.length > 0) {
      let mentor = mentors[0];
      mentor = JSON.parse(JSON.stringify(mentor));
      courseCombinedMentor.field = mentor.field || {};
      courseCombinedMentor.field.subfields = [];
      for (const mentor of mentors) {
        if (mentor.field?.subfields && mentor.field.subfields.length > 0) {
          for (const subfield of mentor.field.subfields) {
            courseCombinedMentor.field.subfields.push(subfield);
          }
        }
      }
      courseCombinedMentor.field.subfields = courseCombinedMentor.field.subfields.filter((subfield, index, self) =>
        index === self.findIndex((t) => (
          t.id === subfield.id
        ))
      );
      courseCombinedMentor.availabilities = [];
      const availabilityTime: AvailabilityTime = {
        from: moment.utc(courseStartDateTime).format('h:mma'),
        to: moment.utc(courseStartDateTime).add(1, 'h').format('h:mma')
      };    
      const availability: Availability = {
        dayOfWeek: moment.utc(courseStartDateTime).format(constants.DAY_OF_WEEK_FORMAT),
        time: availabilityTime
      };
      courseCombinedMentor.availabilities.push(availability);
    }
    return courseCombinedMentor;
  }

  getPaginatedCourses(courses: Array<Course>, page: string | undefined): Array<Course> {
    const paginatedCourses: Array<Course> = [];
    if (!page) {
      return courses;
    }
    for (let i = constants.AVAILABLE_COURSES_RESULTS_PER_PAGE * (parseInt(page) - 1); i < constants.AVAILABLE_COURSES_RESULTS_PER_PAGE * parseInt(page); i++) {
      if (courses[i]) {
        paginatedCourses.push(courses[i]);
      }
    }
    return paginatedCourses;
  }    

  async getCurrentCourse(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const client = await pool.connect();
    try {
      const course = await this.getCurrentCourseFromDB(userId, client);
      response.status(200).json(course);
    } catch (error) {
      response.status(400).send(error);
    } finally {
      client.release();
    }
  }

  async getCurrentCourseFromDB(userId: string, client: pg.PoolClient): Promise<Course> {
    const user = await users.getUserFromDB(userId, client);
    let course: Course = {};
    let getCourseQuery;
    if (user.isMentor) {
      getCourseQuery = `SELECT uc.id FROM users_courses uc
         JOIN users_courses_mentors ucm ON uc.id = ucm.course_id
				 JOIN course_types ct ON uc.course_type_id = ct.id
        WHERE ucm.mentor_id = $1
          AND uc.is_canceled IS DISTINCT FROM true
          AND ucm.is_canceled IS DISTINCT FROM true
					AND current_timestamp <= (uc.start_date_time + interval '1 month' * ct.duration + interval '3 days')
        ORDER BY uc.start_date_time DESC
        LIMIT 1`;
    } else {
      getCourseQuery = `SELECT uc.id FROM users_courses uc
         JOIN users_courses_students ucs ON uc.id = ucs.course_id
				 JOIN course_types ct ON uc.course_type_id = ct.id
        WHERE ucs.student_id = $1
          AND uc.is_canceled IS DISTINCT FROM true
          AND ucs.is_canceled IS DISTINCT FROM true
					AND current_timestamp <= (uc.start_date_time + interval '1 month' * ct.duration + interval '3 days')
        ORDER BY uc.start_date_time DESC
        LIMIT 1`;
    }
    const { rows }: pg.QueryResult = await client.query(getCourseQuery, [userId]);
    if (rows && rows.length > 0) {
      course = await this.getCourseById(rows[0].id, client);
    }
    return course;
  }

  async getPreviousCourse(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const client = await pool.connect();
    try {
      const course = await this.getPreviousCourseFromDB(userId, client);
      response.status(200).json(course);
    } catch (error) {
      response.status(400).send(error);
    } finally {
      client.release();
    }
  }

  async getPreviousCourseFromDB(userId: string, client: pg.PoolClient): Promise<Course> {
    let course: Course = {};
    const getCourseQuery = `SELECT uc.id FROM users_courses uc
			 JOIN users_courses_mentors ucm ON uc.id = ucm.course_id
			WHERE ucm.mentor_id = $1
			ORDER BY uc.start_date_time DESC`;
    const { rows }: pg.QueryResult = await client.query(getCourseQuery, [userId]);
    if (rows && rows.length > 0) {
			for (const row of rows) {
				course = await this.getCourseById(row.id, client);
				course.mentors = await this.getAllCourseMentors(row.id, client);
				const mentor = course.mentors?.find((mentor) => mentor.id === userId);
				if (mentor && mentor.meetingUrl) {
					break;
				}
			}
    }
    return course;
  }

  async getCourseById(courseId: string, client: pg.PoolClient): Promise<Course> {
    const getCourseQuery = `SELECT uc.id, uc.start_date_time, uc.whatsapp_group_url, uc.notes, uc.has_started, uc.is_canceled, ct.duration, ct.is_with_partner, ct.index
      FROM users_courses uc 
      JOIN course_types ct
        ON uc.course_type_id = ct.id
      WHERE uc.id = $1`;
    const { rows }: pg.QueryResult = await client.query(getCourseQuery, [courseId]);
    let course: Course = {};
    if (rows[0]) {
      const courseType: CourseType = {
        duration: rows[0].duration,
        isWithPartner: rows[0].is_with_partner,
        index: rows[0].index
      }
      const mentors = await this.getCourseMentors(courseId, client);
      const students = await this.getCourseStudents(courseId, client);
      course = {
        id: rows[0].id,
        type: courseType,
        startDateTime: moment.utc(rows[0].start_date_time).format(constants.DATE_TIME_FORMAT),
        mentors: mentors,
        students: students,
        whatsAppGroupUrl: rows[0].whatsapp_group_url,
        notes: rows[0].notes,
        hasStarted: rows[0].has_started,
				isCanceled: rows[0].is_canceled
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
		const allFields = await fields.getFieldsFromDB(client);
    const mentors: Array<CourseMentor> = [];
    if (rows && rows.length > 0) {
      for (const row of rows) {
        const mentor = (await users.getUserFromDB(row.mentor_id, client)) as CourseMentor;
				const courseField = allFields.find(field => field.subfields?.find(subfield => subfield.id == row.subfield_id));
				if (mentor && mentor.field && courseField) {
					mentor.field.subfields = mentor.field.subfields?.filter(subfield => subfield.id == row.subfield_id);
					if (!mentor.field.subfields || mentor.field.subfields.length == 0) {
						mentor.field = {...courseField};
						mentor.field.subfields = mentor.field.subfields?.filter(subfield => subfield.id == row.subfield_id);						
						mentor.field.subfields?.forEach(subfield => subfield.skills = []);
					}
				}
        mentor.meetingUrl = row.meeting_url;
        mentors.push(mentor);
      }
    }
    return mentors;
  }

  async getAllCourseMentors(courseId: string, client: pg.PoolClient): Promise<Array<CourseMentor>> {
    const getCourseMentorsQuery = `SELECT mentor_id, subfield_id, meeting_url
      FROM users_courses_mentors
      WHERE course_id = $1`;
    const { rows }: pg.QueryResult = await client.query(getCourseMentorsQuery, [courseId]);
		const mentors: Array<CourseMentor> = [];
    if (rows && rows.length > 0) {
      for (const row of rows) {
        const mentor = (await users.getUserFromDB(row.mentor_id, client)) as CourseMentor;
        mentor.meetingUrl = row.meeting_url;
        mentors.push(mentor);
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

  async getMentorPartnershipSchedule(request: Request, response: Response): Promise<void> {
    const courseId = request.params.id;  
    const client = await pool.connect();
    try {
      const mentorPartnershipSchedule = await this.getMentorPartnershipScheduleFromDB(courseId, client);
      response.status(200).json(mentorPartnershipSchedule);
    } catch (error) {
      response.status(400).send(error);
    } finally {
      client.release();
    }
  }

  async getMentorPartnershipScheduleFromDB(courseId: string, client: pg.PoolClient): Promise<Array<MentorPartnershipScheduleItem>> {
    const getMentorPartnershipScheduleQuery = `SELECT id, mentor_id, lesson_date_time
      FROM users_courses_partnership_schedule  
      WHERE course_id = $1
        AND lesson_date_time >= CURRENT_DATE
      ORDER BY lesson_date_time`;
    const { rows }: pg.QueryResult = await client.query(getMentorPartnershipScheduleQuery, [courseId]);
    const mentorPartnershipSchedule: Array<MentorPartnershipScheduleItem> = [];
    if (rows && rows.length > 0) {
      for (const row of rows) {
        const course: Course = {
          id: courseId
        }
        let mentor = await users.getUserFromDB(row.mentor_id, client);
        mentor = {
          id: mentor.id,
          name: mentor.name
        }
        const mentorPartnershipScheduleItem: MentorPartnershipScheduleItem = {
          id: row.id,
          course: course,
          mentor: mentor,
          lessonDateTime: moment.utc(row.lesson_date_time).format(constants.DATE_TIME_FORMAT)
        }
				const isLessonCanceled = await this.isLessonCanceled(mentor.id as string, courseId, row.lesson_date_time, client);
				const hasAtLeastOneStudentParticipating = await this.hasAtLeastOneStudentParticipating(courseId, row.lesson_date_time, client);
				if (!isLessonCanceled && hasAtLeastOneStudentParticipating) {
        	mentorPartnershipSchedule.push(mentorPartnershipScheduleItem);
				}
      }
    }
    return mentorPartnershipSchedule;
  }
  
  async getNextLesson(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;  
    const client = await pool.connect();
    try {
      const user = await users.getUserFromDB(userId, client);
			const course = await this.getCurrentCourseFromDB(userId, client);
      if (!course.id) {
				response.status(200).json({});
        return ;
      }
      const nextLessonDateTime = await this.getNextLessonDateTimeForUserFromDB(userId, course.id as string, client);
      if (nextLessonDateTime) {
        if (user.isMentor) {
					const students = await this.getCourseStudents(course.id as string, client);
					const studentsWithNextLesson = await this.getStudentsWithNextLesson(students, course, nextLessonDateTime, client);
          const nextLessonMentor: NextLessonMentor = {
            lessonDateTime: nextLessonDateTime,
						students: studentsWithNextLesson
          }
          response.status(200).json(nextLessonMentor);
        } else {
          const mentor = await this.getMentorForNextLesson(course.id as string, nextLessonDateTime, client);
          const nextLessonStudent: NextLessonStudent = {
            mentor: mentor,
            lessonDateTime: nextLessonDateTime
          }
          response.status(200).json(nextLessonStudent);
        }
      } else {
        response.status(200).json({});
      }
    } catch (error) {
      response.status(400).send(error);
    } finally {
      client.release();
    }
  }

	async getStudentsWithNextLesson(students: Array<CourseStudent>, course: Course, nextLessonDateTime: string, client: pg.PoolClient) {
		const cancellationStatuses = await Promise.all(
			students.map(student =>
				this.isLessonCanceled(student.id as string, course.id as string, nextLessonDateTime, client)
			)
		);
	
		const studentsWithNextLesson = students.filter(
			(student, index) => !cancellationStatuses[index]
		);
	
		return studentsWithNextLesson;
	}
	
  async getMentorForNextLesson(courseId: string, nextLessonDateTime: string | null, client: pg.PoolClient): Promise<CourseMentor | null> {
    let mentor: CourseMentor | null = null;
		const course = await this.getCourseById(courseId, client);

    // If the next lesson date/time is not provided, return null
    if (!nextLessonDateTime) {
      return null;
    }

		const mentors = course.mentors as Array<CourseMentor>;

    // If there is only one mentor, return that mentor
    if (mentors.length === 1) {
      mentor = mentors[0];
    }

    // If there are two mentors, find the mentor for the next lesson
    if (mentors.length === 2) {
      const { rows: partnershipSchedule } = await client.query(
        `
        SELECT *
        FROM users_courses_partnership_schedule
        WHERE course_id = $1 AND lesson_date_time = $2
        `,
        [courseId, nextLessonDateTime]
      );

      if (partnershipSchedule.length === 1) {
        const mentorId = partnershipSchedule[0].mentor_id;
				mentor = mentors.find((mentor) => mentor.id === mentorId) as CourseMentor;
      }
    }

		if (mentor) {
			const courseMentor = mentors.find((courseMentor) => courseMentor.id === mentor?.id);
			if (courseMentor) {
				mentor.meetingUrl = courseMentor.meetingUrl;
			}
		}
    return mentor;
  }	

  async getNextLessonDateTimeForUserFromDB(userId: string, courseId: string, client: pg.PoolClient): Promise<string | null> {
    const course = await this.getCourseById(courseId, client);

    let nextLessonDateTime: string | null = null;

    const user = await users.getUserFromDB(userId, client);
    if (user.isMentor) {
      nextLessonDateTime = await this.getNextLessonDateTimeForMentor(course, userId, client);
    } else {
      nextLessonDateTime = await this.getNextLessonDateTimeForStudent(course, userId, client);
    }
    return nextLessonDateTime;
  }
  
  async getNextLessonDateTimeForMentor(course: Course, mentorId: string, client: pg.PoolClient): Promise<string | null> {
    const nextLessonDateTime = await this.getNextLessonDatetime(course, mentorId, true, client);
    return nextLessonDateTime;
  }

  async getNextLessonDateTimeForStudent(course: Course, studentId: string, client: pg.PoolClient): Promise<string | null> {
    const nextLessonDateTime = await this.getNextLessonDatetime(course, studentId, false, client);
    return nextLessonDateTime;
  } 

  async getNextLessonDatetime(course: Course, userId: string, isMentor: boolean, client: pg.PoolClient): Promise<string | null> {
    if (!course || !course.mentors || course.mentors.length === 0 || !course.hasStarted) {
      return null;
    }

    const courseEndDateTime = this.getCourseEndDateTime(course);

    let nextLessonDatetime: string | null;
    if (course.mentors.length === 1) {
      nextLessonDatetime = await this.getNextLessonDatetimeSingleMentor(course, userId, isMentor, client);
    } else {
      nextLessonDatetime = await this.getNextLessonDatetimeMentorsPartnership(course, userId, isMentor, client);
			if (!nextLessonDatetime) {
				const cancelCourseMentorQuery = 'UPDATE users_courses_mentors SET is_canceled = true WHERE mentor_id = $1 AND course_id = $2';
				await client.query(cancelCourseMentorQuery, [userId, course.id]);
			}
    }

    if (nextLessonDatetime && moment.utc(nextLessonDatetime).isAfter(moment.utc(courseEndDateTime))) {
      return null;
    }

    return moment.utc(nextLessonDatetime).isValid() ? moment.utc(nextLessonDatetime).format(constants.DATE_TIME_FORMAT) : null;
  }

  getCourseEndDateTime(course: Course): string {
    const courseDurationInMonths = course.type != null ? course.type.duration : 3;
    const courseStartDate = moment.utc(course.startDateTime);
    const courseEndDateTime = courseStartDate
      .clone()
      .add(courseDurationInMonths, 'months')
      .add(3, 'days')
      .toISOString();
    return courseEndDateTime;
  }

  async getNextLessonDatetimeSingleMentor(course: Course, userId: string, isMentor: boolean, client: pg.PoolClient): Promise<string | null> {
    const courseEndDateTime = this.getCourseEndDateTime(course);
    const courseStartDate = moment.utc(course.startDateTime);
    const now = moment.utc();
    const nextLessonDatetime = courseStartDate.clone();
  
    while (nextLessonDatetime.isBefore(now) || nextLessonDatetime.isSame(now)) {
      nextLessonDatetime.add(1, 'week');
    }
  
    while (nextLessonDatetime.isBefore(courseEndDateTime)) {
      const lessonDateTimeStr = nextLessonDatetime.toISOString();
      const isLessonCanceled = await this.isLessonCanceled(userId, course.id as string, lessonDateTimeStr, client);
  
      if (!isLessonCanceled) {
        if (isMentor) {
          const hasAtLeastOneStudentParticipating = await this.hasAtLeastOneStudentParticipating(course.id as string, lessonDateTimeStr, client);
  
          if (hasAtLeastOneStudentParticipating) {
            return lessonDateTimeStr;
          }
        } else {
					const courseMentors = course.mentors as Array<CourseMentor>;
					const isLessonCanceledByMentor = await this.isLessonCanceled(courseMentors[0].id as string, course.id as string, lessonDateTimeStr, client);
					if (!isLessonCanceledByMentor) {
						return lessonDateTimeStr;
					}
        }
      }
  
      nextLessonDatetime.add(1, 'week');
    }
  
    return null;
  }

  async getNextLessonDatetimeMentorsPartnership(course: Course, userId: string, isMentor: boolean, client: pg.PoolClient): Promise<string | null> {
    const courseEndDateTime = this.getCourseEndDateTime(course);
    const now = moment.utc();
    let nextLessonDatetime: moment.Moment | null = null;
  
    const partnershipSchedule = await this.getMentorPartnershipScheduleFromDB(course.id as string, client);
  
    for (const scheduleItem of partnershipSchedule) {
      const lessonDatetime = moment.utc(scheduleItem.lessonDateTime);
  
      if (lessonDatetime.isAfter(now) && lessonDatetime.isBefore(courseEndDateTime)) {
        const isLessonCanceled = await this.isLessonCanceled(userId, course.id as string, lessonDatetime.toISOString(), client);
  
        if (!isLessonCanceled) {
          if (isMentor) {
            if (scheduleItem.mentor.id === userId) {
              const hasAtLeastOneStudentParticipating = await this.hasAtLeastOneStudentParticipating(course.id as string, lessonDatetime.toISOString(), client);
  
              if (hasAtLeastOneStudentParticipating) {
                nextLessonDatetime = lessonDatetime;
                break;
              }
            }
          } else {
						const isLessonCanceledByMentor = await this.isLessonCanceled(scheduleItem.mentor.id as string, course.id as string, lessonDatetime.toISOString(), client);
						if (!isLessonCanceledByMentor) {
							nextLessonDatetime = lessonDatetime;
							break;
						}
          }
        }
      }
    }
  
    return nextLessonDatetime ? nextLessonDatetime.toISOString() : null;
  }

  async isLessonCanceled(userId: string, courseId: string, lessonDatetime: string, client: pg.PoolClient): Promise<boolean> {
		if (!lessonDatetime) {
			return true;
		}
		const query = `
      SELECT COUNT(*) FROM users_courses_lessons_canceled
      WHERE user_id = $1 AND course_id = $2 AND lesson_date_time = $3;
    `;
    const values = [userId, courseId, moment.utc(lessonDatetime).format()];
    const result = await client.query(query, values);

    return parseInt(result.rows[0].count) > 0;
  }

  async hasAtLeastOneStudentParticipating(courseId: string, lessonDatetime: string, client: pg.PoolClient): Promise<boolean> {
    const query = `
      SELECT student_id FROM users_courses_students
      	WHERE course_id = $1 
				AND is_canceled IS DISTINCT FROM true
      EXCEPT
      SELECT user_id FROM users_courses_lessons_canceled
      	WHERE course_id = $1 AND lesson_date_time = $2;
    `;
    const values = [courseId, moment.utc(lessonDatetime).format()];
    const result = await client.query(query, values);

    return result.rows.length > 0;
  }

  async addCourse(request: Request, response: Response): Promise<void> {
    const mentorId = request.user.id as string;
    const { type, mentors, startDateTime }: Course = request.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
			if (mentors && mentors.length > 0) {
				mentors[0].id = mentorId;
			}
      let course: Course = {
        type: type,
        mentors: mentors,
        startDateTime: startDateTime
      }
      course = await this.addCourseFromDB(course, client);
      await client.query('COMMIT');
      response.status(200).json(course);
    } catch (error) {
      await client.query('ROLLBACK');
      response.status(400).send(error);
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
      const student = await users.getUserFromDB(studentId, client);
      let course = await this.getCourseById(courseId, client);
			const fieldId = course.mentors?.[0].field?.id;
			await this.updateStudentField(studentId, fieldId, client);
			await this.updateStudentGoal(studentId, fieldId, client);
			await this.updateStudentSubfields(studentId, course, client);
			let shouldNotifyOtherStudents = !course.hasStarted;
      const minStudentsCourse = constants.MIN_STUDENTS_COURSE;
      const maxStudentsCourse = constants.MAX_STUDENTS_COURSE;
      if (course.students && course.students.length >= maxStudentsCourse) {
        response.status(400).send({'message': `We're sorry, but there are already ${maxStudentsCourse} students in this course. Please join another course.`});
        return ;
      } else if (course.isCanceled) {
        response.status(400).send({'message': `We're sorry, but this course has been cancelled. Please join another course.`});
        return ;
      } else {
        await this.addCourseStudent(courseId, student, client);
        course = await this.getCourseById(courseId, client);
        course = await this.updateCourseStartDateTime(course, client);
        if (course.mentors && course.students && course.mentors.length > 1 && course.students.length >= minStudentsCourse && !course.hasStarted) {
          await this.addMentorPartnershipSchedule(course, client);
        }
        if (course.students && course.students.length >= minStudentsCourse) {
          course.hasStarted = true;
          await this.updateCourseHasStarted(courseId, course.hasStarted, client);
        }
      }
			if (!course.hasStarted) {
				shouldNotifyOtherStudents = false;
			}
      await client.query('COMMIT');
      response.status(200).json(course);
			await usersPushNotifications.sendPNStudentAddedToCourse(student, course, shouldNotifyOtherStudents, client);
			await usersSendEmails.sendEmailStudentAddedToCourse(student, course, shouldNotifyOtherStudents, client);
    } catch (error) {
      await client.query('ROLLBACK');
      response.status(400).send(error);
    } finally {
      client.release();
    }
  }

  async updateStudentGoal(studentId: string, fieldId: string | undefined, client: pg.PoolClient): Promise<void> {
    if (fieldId) {
			const fieldGoal = await fieldsGoals.getFieldGoal(fieldId, client);
			if (fieldId && fieldGoal && fieldGoal.goal) {
				const dateTime = moment.utc();
				const updateStudentGoalQuery = `UPDATE users_goals SET text = $1, date_time = $2 WHERE user_id = $3`;
				await client.query(updateStudentGoalQuery, [fieldGoal.goal, dateTime, studentId]);
			}
    }
  }  
  
  async updateStudentField(studentId: string, fieldId: string | undefined, client: pg.PoolClient): Promise<void> {
		if (fieldId) {
			await users.updateUserField(studentId, fieldId, client);
		}
  }
	
  async updateStudentSubfields(studentId: string, course: Course, client: pg.PoolClient): Promise<void> {
		await users.deleteUserSubfields(studentId, client);
		const courseSubfields = (course.mentors?.map(mentor => mentor.field?.subfields)
			.filter(subfieldArray => subfieldArray !== undefined) as Subfield[][])
			.flat();		
    if (courseSubfields) {
			const filteredSubfields = courseSubfields.filter(subfield => subfield !== undefined) as Subfield[];
			await users.insertUserSubfields(studentId, filteredSubfields, client);
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

  async updateCourseStartDateTime(course: Course, client: pg.PoolClient): Promise<Course> {
    let courseStartDateTime = moment.utc(course.startDateTime);
    while (courseStartDateTime.isBefore(moment.utc())) {
      courseStartDateTime = courseStartDateTime.add(1, 'week');
    }
    if (moment.utc(courseStartDateTime) !== moment.utc(course.startDateTime)) {
      const updateCourseStartDateTimeQuery = 'UPDATE users_courses SET start_date_time = $1 WHERE id = $2';
      await client.query(updateCourseStartDateTimeQuery, [courseStartDateTime, course.id]);
    }
    course.startDateTime = moment.utc(courseStartDateTime).format(constants.DATE_TIME_FORMAT);
    return course;
  }

  async updateCourseHasStarted(courseId: string, hasStarted: boolean, client: pg.PoolClient): Promise<void> {
    const updateCourseHasStartedQuery = 'UPDATE users_courses SET has_started = $1 WHERE id = $2';
    await client.query(updateCourseHasStartedQuery, [hasStarted, courseId]);
  }  

  async addMentorPartnershipSchedule(course: Course, client: pg.PoolClient): Promise<void> {
    const getMentorPartnershipScheduleQuery = `SELECT course_id FROM users_courses_partnership_schedule WHERE course_id = $1`
    const { rows }: pg.QueryResult = await client.query(getMentorPartnershipScheduleQuery, [course.id]);    
    const lessonDateTime = moment.utc(course.startDateTime);
    if (rows.length == 0 && course.type && course.type.duration && course.mentors && course.mentors.length > 1) {
      while (lessonDateTime.isBefore(moment.utc(course.startDateTime).add(course.type.duration, 'months').add(3, 'days'))) {
        const insertLessonDateTimeQuery = `INSERT INTO users_courses_partnership_schedule (course_id, mentor_id, lesson_date_time)
          VALUES ($1, $2, $3)`;
        const mentorId = lessonDateTime.isBefore(moment.utc(course.startDateTime).add(course.type.duration * 30 / 2, 'days')) ? course.mentors[0].id : course.mentors[1].id;
        const values = [course.id, mentorId, lessonDateTime];
        await client.query(insertLessonDateTimeQuery, values);
        lessonDateTime.add(1, 'week');
      }
    }
  }
  
  async updateMentorPartnershipSchedule(request: Request, response: Response): Promise<void> {
    const mentorPartnershipScheduleItem: MentorPartnershipScheduleItem = request.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await this.updateMentorPartnershipScheduleFromDB(mentorPartnershipScheduleItem, client);
      await client.query('COMMIT');
      response.status(200).send(`Mentor partnership schedule item ${mentorPartnershipScheduleItem.id} was update successfully`);
    } catch (error) {
      await client.query('ROLLBACK');
      response.status(400).send(error);
    } finally {
      client.release();
    }
  }
  
  async updateMentorPartnershipScheduleFromDB(mentorPartnershipScheduleItem: MentorPartnershipScheduleItem, client: pg.PoolClient): Promise<void> {
    const updateMentorPartnershipScheduleQuery = 'UPDATE users_courses_partnership_schedule SET mentor_id = $1 WHERE id = $2';
    await client.query(updateMentorPartnershipScheduleQuery, [mentorPartnershipScheduleItem.mentor.id, mentorPartnershipScheduleItem.id]);
  }

  async setWhatsAppGroupUrl(request: Request, response: Response): Promise<void> {
    const courseId = request.params.id;
    const { whatsAppGroupUrl }: Course = request.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const setWhatsAppGroupUrlQuery = 'UPDATE users_courses SET whatsapp_group_url = $1 WHERE id = $2';
      await client.query(setWhatsAppGroupUrlQuery, [whatsAppGroupUrl, courseId]);
      await client.query('COMMIT');
      response.status(200).send(`WhatsApp group url for course ${courseId} was set successfully`);
    } catch (error) {
      await client.query('ROLLBACK');
      response.status(400).send(error);
    } finally {
      client.release();
    }
  }

  async getNotes(request: Request, response: Response): Promise<void> {
    const courseId = request.params.id as string;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(constants.READ_ONLY_TRANSACTION);
      const getNotesQuery = `SELECT notes FROM users_courses WHERE id = $1`;
      const { rows }: pg.QueryResult = await client.query(getNotesQuery, [courseId]);
      const course: Course = {};
      if (rows && rows[0]) {
        course.notes = rows[0].notes;
      }
      await client.query('COMMIT');
      response.status(200).json(course);
    } catch (error) {
      await client.query('ROLLBACK');
      response.status(400).send(error);
    } finally {
      client.release();
    }
  }  
  
  async updateNotes(request: Request, response: Response): Promise<void> {
    const courseId = request.params.id;
    const { notes }: Course = request.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const updateNotesQuery = 'UPDATE users_courses SET notes = $1 WHERE id = $2';
      await client.query(updateNotesQuery, [notes, courseId]);
      await client.query('COMMIT');
      response.status(200).send(`Notes for course ${courseId} were updated successfully`);
    } catch (error) {
      await client.query('ROLLBACK');
      response.status(400).send(error);
    } finally {
      client.release();
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
			const course = await this.getCourseById(courseId, client);
      await this.cancelCourseFromDB(userId, courseId, client);
      await client.query('COMMIT');
      response.status(200).send(`Course ${courseId} was canceled successfully for user ${userId}`);
			usersPushNotifications.sendPNCourseCanceled(user, course);
			usersSendEmails.sendEmailCourseCanceled(user, course, text);
    } catch (error) {
      await client.query('ROLLBACK');
      response.status(400).send(error);
    } finally {
      client.release();
    }
  }

  async cancelCourseFromDB(userId: string, courseId: string, client: pg.PoolClient): Promise<void> {
    const user = await users.getUserFromDB(userId, client);
    let cancelCourseUserQuery;
    if (user.isMentor) {
      cancelCourseUserQuery = 'UPDATE users_courses_mentors SET is_canceled = true, canceled_date_time = $1 WHERE mentor_id = $2 AND course_id = $3';
    } else {
      cancelCourseUserQuery = 'UPDATE users_courses_students SET is_canceled = true, canceled_date_time = $1 WHERE student_id = $2 AND course_id = $3';
    }
    let mentors = await this.getCourseMentors(courseId, client);
		let course = await this.getCourseById(courseId, client);
		let isPartnerMentorCourseCanceled = false;
		if (mentors.length == 2 && course.hasStarted) {
			const partnerMentor = mentors.find((mentor: CourseMentor) => mentor.id != userId);
			const assignLessonsToPartnerMentorQuery = 'UPDATE users_courses_partnership_schedule SET mentor_id = $1 WHERE course_id = $2 AND mentor_id = $3 AND lesson_date_time > $4';
			await client.query(assignLessonsToPartnerMentorQuery, [partnerMentor?.id, courseId, userId, moment.utc()]);
			const nextLessonDateTime = await this.getNextLessonDateTimeForUserFromDB(partnerMentor?.id as string, courseId, client);
			if (!nextLessonDateTime) {
				isPartnerMentorCourseCanceled = true;
			}
		}		
    const canceledDateTime = moment.utc().format(constants.DATE_TIME_FORMAT);
    await client.query(cancelCourseUserQuery, [canceledDateTime, userId, courseId]);
		course = await this.getCourseById(courseId, client);
		mentors = course.mentors as Array<CourseMentor>;
    const students = course.students as Array<CourseStudent>;
		if ((user.isMentor || course.hasStarted) && (mentors.length == 0 || students.length == 0 || mentors.length == 1 && isPartnerMentorCourseCanceled)) {
      const cancelCourseQuery = 'UPDATE users_courses SET is_canceled = true, canceled_date_time = $1 WHERE id = $2';
      await client.query(cancelCourseQuery, [canceledDateTime, courseId]);
    }
  }

  async cancelNextLesson(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const courseId = request.params.id;
    const { text }: InAppMessage = request.body;    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const user = await users.getUserFromDB(userId, client);
			const course = await this.getCurrentCourseFromDB(userId, client);
      let nextLessonDateTime = await this.getNextLessonDateTimeForUserFromDB(userId, courseId, client);
			const mentorForCancelNextLesson = await this.getMentorForNextLesson(courseId, nextLessonDateTime, client);
      if (nextLessonDateTime) {
        await this.cancelNextLessonFromDB(userId, courseId, nextLessonDateTime, client);
      }
      nextLessonDateTime = await this.getNextLessonDateTimeForUserFromDB(userId, courseId, client);
			if (!nextLessonDateTime) {
				await this.cancelCourseFromDB(userId, courseId, client);
			}
      if (user.isMentor) {
				const students = await this.getCourseStudents(courseId, client);
				const studentsWithNextLesson = await this.getStudentsWithNextLesson(students, course, nextLessonDateTime as string, client);
        const nextLessonMentor: NextLessonMentor = {
          lessonDateTime: nextLessonDateTime,
					students: studentsWithNextLesson
        }
				await client.query('COMMIT');
        response.status(200).json(nextLessonMentor);
				usersPushNotifications.sendPNNextLessonCanceledByMentor(course);
				usersSendEmails.sendEmailNextLessonCanceledByMentor(course, text);				
      } else {
        const mentor = await this.getMentorForNextLesson(courseId, nextLessonDateTime, client);
        const nextLessonStudent: NextLessonStudent = {
          mentor: mentor,
          lessonDateTime: nextLessonDateTime
        }
				await client.query('COMMIT');
        response.status(200).json(nextLessonStudent);
				if (mentorForCancelNextLesson) {
					usersPushNotifications.sendPNNextLessonCanceledByStudent(user, mentorForCancelNextLesson);
					usersSendEmails.sendEmailNextLessonCanceledByStudent(user, mentorForCancelNextLesson, text);
				}
      }
    } catch (error) {
      await client.query('ROLLBACK');
      response.status(400).send(error);
    } finally {
      client.release();
    }
  }  

  async cancelNextLessonFromDB(userId: string, courseId: string, lessonDateTime: string, client: pg.PoolClient): Promise<void> {
    const user = await users.getUserFromDB(userId, client);
    const isLessonCanceled = await this.isLessonCanceled(userId, courseId, lessonDateTime, client);
    if (!isLessonCanceled) {
      const cancelLessonUserQuery = 'INSERT INTO users_courses_lessons_canceled (user_id, course_id, lesson_date_time, canceled_date_time) VALUES ($1, $2, $3, $4)';
      const canceledDateTime = moment.utc().format(constants.DATE_TIME_FORMAT);
      const values = [userId, courseId, lessonDateTime, canceledDateTime];
      await client.query(cancelLessonUserQuery, values);
      if (user.isMentor) {
        const students = await this.getCourseStudents(courseId, client);
        for (const student of students) {
          const isLessonCanceled = await this.isLessonCanceled(student.id as string, courseId, lessonDateTime, client);
          if (!isLessonCanceled) {
            const cancelLessonStudentQuery = 'INSERT INTO users_courses_lessons_canceled (user_id, course_id, lesson_date_time, canceled_date_time) VALUES ($1, $2, $3, $4)';
            const values = [student.id, courseId, lessonDateTime, canceledDateTime];
            await client.query(cancelLessonStudentQuery, values);        
          }
        }
      }
    }
  }  

  async setMeetingUrl(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const courseId = request.params.id;
    const { meetingUrl }: CourseMentor = request.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const setMeetingUrlQuery = 'UPDATE users_courses_mentors SET meeting_url = $1 WHERE mentor_id = $2 AND course_id = $3';
      await client.query(setMeetingUrlQuery, [meetingUrl, userId, courseId]);
      await client.query('COMMIT');
      response.status(200).send(`Meeting url for course ${courseId} was updated successfully for user ${userId}`);
    } catch (error) {
      await client.query('ROLLBACK');
      response.status(400).send(error);
    } finally {
      client.release();
    }
  }

  async setAvailableCoursesFieldsFromDB(): Promise<void> {
    const client = await pool.connect();    
    try {
      await client.query('BEGIN');
      const fields = await this.getAvailableCoursesFieldsFromDB(client);
      const server = process.env.SERVER as string;
      await redisClient.set(`available_courses_fields-${server}`, JSON.stringify(fields));
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }  
  }

  async getAvailableCoursesFields(request: Request, response: Response): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const fields = await this.getAvailableCoursesFieldsFromDB(client);
      await client.query('COMMIT');
      response.status(200).json(fields);
    } catch (error) {
      await client.query('ROLLBACK');
      response.status(400).send(error);
    } finally {
      client.release();
    }
  }  
  
  async getAvailableCoursesFieldsFromDB(client: pg.PoolClient): Promise<Array<Field>> {
    const courseFilter: CourseFilter = {};
    const availableCourses = await this.getAvailableCoursesFromDB(courseFilter, client);
    let fields = this.getFields(availableCourses);
    fields = this.getSubfields(fields, availableCourses);
    fields = this.getSkills(fields, availableCourses);
    return fields; 
  }

  getFields(availableCourses: Array<Course>): Array<Field> {
    const fields: Array<Field> = [];
    const fieldsIds = new Map<string, number>();
    for (const availableCourse of availableCourses) {
      const courseField = availableCourse.mentors != null && availableCourse.mentors.length > 0 ? availableCourse.mentors[0].field : {};
      if (fields.filter(field => field.id === courseField?.id).length == 0) {
        const field: Field = {
          id: courseField?.id,
          name: courseField?.name,
          subfields: []
        }
        fields.push(field);
        fieldsIds.set(field.id as string, 1);
      } else {
        const count = fieldsIds.get(courseField?.id as string) as number;
        fieldsIds.set(courseField?.id as string, count + 1);         
      }
    }
    fields.sort((a,b) => {
      const fieldACount = fieldsIds.get(a.id as string) as number;
      const fieldBCount = fieldsIds.get(b.id as string) as number;
      const reverseCompare = (fieldACount > fieldBCount) ? -1 : 0;
      return fieldACount < fieldBCount ? 1 : reverseCompare;
    });
    return fields;
  }
  

  getSubfields(fields: Array<Field>, availableCourses: Array<Course>): Array<Field> {
    for (let i = 0; i < fields.length; i++) {
      const subfieldsIds = new Map<string, number>();
      for (const availableCourse of availableCourses) {
        const courseField = availableCourse.mentors != null && availableCourse.mentors.length > 0 ? availableCourse.mentors[0].field : {};
        if (courseField?.id == fields[i].id) {
          fields[i] = this.groupSubfields(fields[i], availableCourse, subfieldsIds);
        }
      }
    }
    return fields;
  }
  
  groupSubfields(field: Field, availableCourse: Course, subfieldsIds: Map<string, number>): Field {
    const courseSubfields = this.getCourseSubfields(availableCourse);
    for (const courseSubfield of courseSubfields) {
      if (field.subfields?.filter(subfield => subfield.id === courseSubfield.id).length == 0) {
        const subfield: Subfield = {
          id: courseSubfield.id,
          name: courseSubfield.name,
          skills: []
        }
        field.subfields?.push(subfield);
        subfieldsIds.set(subfield.id as string, 1);
      } else {
        const count = subfieldsIds.get(courseSubfield.id as string) as number;
        subfieldsIds.set(courseSubfield.id as string, count + 1);
      }
    }
    field.subfields?.sort((a,b) => {
      const subfieldACount = subfieldsIds.get(a.id as string) as number;
      const subfieldBCount = subfieldsIds.get(b.id as string) as number;
      const reverseCompare = (subfieldACount > subfieldBCount) ? -1 : 0;
      return subfieldACount < subfieldBCount ? 1 : reverseCompare;
    }); 
    return field;
  }

  getCourseSubfields(availableCourse: Course): Array<Subfield> {
    const courseSubfields: Array<Subfield> = [];
    for (const mentor of availableCourse.mentors as Array<CourseMentor>) {
      for (const mentorSubfield of mentor.field?.subfields as Array<Subfield>) {
        if (courseSubfields.filter(subfield => subfield.id === mentorSubfield.id).length == 0) {
          courseSubfields.push(mentorSubfield);
        }
      }
    }
    return courseSubfields;
  }
  
  getSkills(fields: Array<Field>, availableCourses: Array<Course>): Array<Field> {
    for (let i = 0; i < fields.length; i++) {
      const subfields = fields[i].subfields as Array<Subfield>;
      for (const subfield of subfields) {
        const skillsIds = new Map<string, number>();
        for (const availableCourse of availableCourses) {
          const courseSubfields = this.getCourseSubfields(availableCourse);
          const mentorSubfields = courseSubfields as Array<Subfield>;
          for (const mentorSubfield of mentorSubfields) {
            if (mentorSubfield.id == subfield.id) {
              fields[i] = this.groupSkills(fields[i], subfield, mentorSubfield, skillsIds);
            }
          }
        }
      }
    }
    return fields;
  }
  
  groupSkills(field: Field, subfield: Subfield, mentorSubfield: Subfield, skillsIds: Map<string, number>): Field {
    const mentorSkills = mentorSubfield.skills || [];
    for (const mentorSkill of mentorSkills) {
      if (subfield.skills?.filter(skill => skill.id === mentorSkill.id).length == 0) {
        const skill: Skill = {
          id: mentorSkill.id,
          name: mentorSkill.name
        }
        subfield?.skills.push(skill);
        skillsIds.set(skill.id, 1);
      } else {
        const count = skillsIds.get(mentorSkill.id) as number;
        skillsIds.set(mentorSkill.id, count + 1);
      }
    }
    subfield.skills?.sort((a,b) => {
      const skillACount = skillsIds.get(a.id) as number;
      const skillBCount = skillsIds.get(b.id) as number;
      const reverseCompare = (skillACount > skillBCount) ? -1 : 0;
      return skillACount < skillBCount ? 1 : reverseCompare;
    }); 
    return field;
  } 
}
