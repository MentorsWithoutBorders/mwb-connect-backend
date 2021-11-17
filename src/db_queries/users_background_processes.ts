import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import moment from 'moment';
import 'moment-timezone';
import pg from 'pg';
import os from 'os-utils';
import dotenv from 'dotenv';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Helpers } from '../utils/helpers';
import { Users } from './users';
import { UsersLessons } from './users_lessons';
import { UsersLessonRequests } from './users_lesson_requests';
import { UsersSteps } from './users_steps';
import { UsersQuizzes } from './users_quizzes';
import { UsersTimeZones } from './users_timezones';
import { UsersAppVersions } from './users_app_versions';
import { UsersPushNotifications } from './users_push_notifications';
import { UsersSendEmails } from './users_send_emails';
import { AdminTrainingReminders } from './admin_training_reminders';
import User from '../models/user.model';
import Subfield from '../models/subfield.model';
import LessonRequest from '../models/lesson_request.model';
import Lesson from '../models/lesson.model';
import Availability from '../models/availability.model';
import AvailableMentor from '../models/available_mentor.model';
import Email from '../models/email.model';

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();
const users = new Users();
const usersLessons = new UsersLessons();
const usersLessonRequests = new UsersLessonRequests();
const usersSteps = new UsersSteps();
const usersQuizzes = new UsersQuizzes();
const usersAppVersions = new UsersAppVersions();
const usersTimeZones = new UsersTimeZones();
const usersPushNotifications = new UsersPushNotifications();
const usersSendEmails = new UsersSendEmails();
const adminTrainingReminders = new AdminTrainingReminders();
dotenv.config();

export class UsersBackgroundProcesses {
  constructor() {
    autoBind(this);
  }

  async sendLessonRequests(request: Request, response: Response): Promise<void> {
    try {
      await this.sendLessonRequestsFromDB();
      response.status(200).send('Lesson request sent');
    } catch (error) {
      response.status(400).send(error);
    }    
  }

  async sendLessonRequestsFromDB(): Promise<void> {
    // -const getLessonRequestsQuery = `SELECT id, student_id, mentor_id, subfield_id, lesson_date_time, sent_date_time, is_rejected, is_canceled, is_expired, is_obsolete, is_allowed_last_mentor
    //   FROM users_lesson_requests
    //   WHERE (is_canceled IS DISTINCT FROM true
    //     AND is_expired IS DISTINCT FROM true
    //     AND (lesson_date_time IS NULL
    //       OR lesson_date_time IS DISTINCT FROM NULL AND EXTRACT(EPOCH FROM (now() - sent_date_time))/3600 > 1)
    //     OR is_rejected = true)
    //     AND is_obsolete IS DISTINCT FROM true
    //   ORDER BY sent_date_time`;
    const getLessonRequestsQuery = `SELECT id, student_id, mentor_id, subfield_id, lesson_date_time, sent_date_time, is_rejected, is_canceled, is_expired, is_obsolete, is_allowed_last_mentor
      FROM users_lesson_requests
      WHERE is_canceled IS DISTINCT FROM true
        AND lesson_date_time IS NULL
        AND is_obsolete IS DISTINCT FROM true
      ORDER BY sent_date_time`;
    const { rows }: pg.QueryResult = await pool.query(getLessonRequestsQuery);
    for (const rowRequest of rows) {
      const client: pg.PoolClient = await pool.connect();
      try {
        await client.query('BEGIN');
        const studentRequest: User = {
          id: rowRequest.student_id
        }        
        const mentorRequest: User = {
          id: rowRequest.mentor_id
        }
        const subfieldRequest: Subfield = {
          id: rowRequest.subfield_id
        }
        const lessonRequest: LessonRequest = {
          id: rowRequest.id,
          student: studentRequest, 
          mentor: mentorRequest,
          subfield: subfieldRequest,
          lessonDateTime: rowRequest.lesson_date_time,
          sentDateTime: rowRequest.sent_date_time,
          isCanceled: rowRequest.is_canceled,
          isRejected: rowRequest.is_rejected,
          isExpired: rowRequest.is_expired,
          isAllowedLastMentor: rowRequest.is_allowed_last_mentor
        }        
        const student = await users.getUserFromDB(lessonRequest.student?.id as string, client);
        const studentSubfields = student.field?.subfields;
        const studentSubfield = studentSubfields != null && studentSubfields.length > 0 ? studentSubfields[0] : null;
        const studentSkills = this.getStudentSkills(studentSubfields as Array<Subfield>);
        const preferredMentorId = await this.getPreferredMentorId(student?.id as string, client);
        const isAllowedLastMentor = lessonRequest.isAllowedLastMentor || false; 
        const lastMentorId = await this.getLastMentorId(student?.id as string, client);
        const availableLessons = await this.getAvailableLessonsFromDB(student, client);
        const availableLessonOptions = await this.getAvailableLessonOptions(availableLessons, preferredMentorId, isAllowedLastMentor, lastMentorId, student.registeredOn as string, studentSkills, client);
        if (availableLessonOptions.length > 0) {
          await this.addStudentToAvailableLesson(student, availableLessonOptions, client);
          await usersLessonRequests.deleteLessonRequest(lessonRequest.id as string, client);
        } else {
          const availableMentorsMap = await this.getAvailableMentors(student, preferredMentorId, isAllowedLastMentor, lastMentorId, client);
          const lessonRequestOptions = await this.getLessonRequestOptions(availableMentorsMap, studentSubfield as Subfield, studentSkills, client);
          await this.addNewLessonRequest(lessonRequest, lessonRequestOptions, client);
          usersPushNotifications.sendPNLessonRequest(student, lessonRequestOptions);
          usersSendEmails.sendEmailLessonRequest(student, lessonRequestOptions);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }  
    }
  }

  async getPreferredMentorId(userId: string, client: pg.PoolClient): Promise<string> {
    const getPreferredMentorIdQuery = `SELECT mentor_id FROM users_preferred_mentors
      WHERE student_id = $1`;
    const { rows }: pg.QueryResult = await client.query(getPreferredMentorIdQuery, [userId]);
    let preferredMentorId = '';
    if (rows[0]) {
      preferredMentorId = rows[0].mentor_id;    
    }
    return preferredMentorId;
  }  

  async getLastMentorId(userId: string, client: pg.PoolClient): Promise<string> {
    const getLastMentorIdQuery = `SELECT mentor_id FROM users_lessons ul
      JOIN users_lessons_students uls
        ON ul.id = uls.lesson_id
      WHERE uls.student_id = $1
      ORDER BY ul.date_time DESC
      LIMIT 1;`;
    const { rows }: pg.QueryResult = await client.query(getLastMentorIdQuery, [userId]);
    let lastMentorId = '';
    if (rows[0]) {
      lastMentorId = rows[0].mentor_id;
    }
    return lastMentorId;
  }

  async getAvailableLessonsFromDB(student: User, client: pg.PoolClient): Promise<Array<Lesson>> {
    const studentFieldId = student.field?.id;
    const studentSubfields = student.field?.subfields;
    const studentSubfieldId = studentSubfields != null && studentSubfields.length > 0 ? studentSubfields[0].id : null;    
    const queryWhereSubfield = studentSubfieldId != null ? `AND ul.subfield_id = '${studentSubfieldId}'` : '';
    const studentAvailabilities = student.availabilities != null ? student.availabilities : null; 
    let availableLessons: Array<Lesson> = [];
    let queryWhereAvailabilities = '';
    if (studentAvailabilities != null && studentAvailabilities.length > 0) {
      queryWhereAvailabilities = 'AND (';
      for (const availability of studentAvailabilities) {
        const timeFrom = moment(availability.time.from, 'h:ma').format('HH:mm');
        let timeTo = moment(availability.time.to, 'h:ma').format('HH:mm');
        timeTo = helpers.getEndOfDay(timeTo);
        queryWhereAvailabilities += `TRIM(TO_CHAR(ul.date_time, 'Day')) = '${availability.dayOfWeek}'
          AND '${timeFrom}'::TIME <= ul.date_time::TIME AND '${timeTo}'::TIME > ul.date_time::TIME OR `;
      }
      queryWhereAvailabilities = queryWhereAvailabilities.slice(0, -4) + ')';
      const getLessonsQuery = `SELECT ul.id, ul.mentor_id, ula.max_students, fs.field_id, ul.subfield_id, ul.date_time, ul.is_recurrent, ul.end_recurrence_date_time FROM users_lessons ul
        JOIN fields_subfields fs
          ON fs.subfield_id = ul.subfield_id
        JOIN users_lessons_availabilities ula
          ON ul.mentor_id = ula.user_id          
        WHERE ul.is_canceled IS DISTINCT FROM true
          AND fs.field_id = $1
          ${queryWhereSubfield}
          AND (ul.is_recurrent IS DISTINCT FROM true AND ul.date_time > now() 
              OR ul.is_recurrent IS true AND ul.end_recurrence_date_time > now())
          ${queryWhereAvailabilities}`;
      const { rows }: pg.QueryResult = await client.query(getLessonsQuery, [studentFieldId]);
      for (const rowLesson of rows) {
        const lessonStudentsNumber = await this.getLessonStudentsNumber(rowLesson.id, client);
        const mentor: User = {
          id: rowLesson.mentor_id
        }
        const subfield: Subfield = {
          id: rowLesson.subfield_id
        }          
        const availableLesson: Lesson = {
          id: rowLesson.id,
          mentor: mentor,
          subfield: subfield,
          dateTime: rowLesson.date_time,
          isRecurrent: rowLesson.is_recurrent,
          endRecurrenceDateTime: rowLesson.end_recurrence_date_time
        }
        const lessonDateTime = await usersLessons.getNextLessonDateTime(availableLesson, mentor.id as string, true, client); 
        if (lessonDateTime) {
          availableLesson.dateTime = lessonDateTime;
        }
        availableLessons = this.addAvailableLesson(lessonStudentsNumber, rowLesson.max_students, availableLesson, availableLessons);
      }
    }
    return availableLessons;
  }

  addAvailableLesson(lessonStudentsNumber: number, maxStudents: number, availableLesson: Lesson, availableLessons: Array<Lesson>): Array<Lesson> {
    if (lessonStudentsNumber < maxStudents) {
      availableLessons.push(availableLesson);
    }
    return availableLessons;
  }
  
  async getLessonStudentsNumber(lessonId: string, client: pg.PoolClient): Promise<number> {
    const getLessonStudentsQuery = `SELECT id, is_canceled FROM users_lessons_students
        WHERE is_canceled IS DISTINCT FROM true AND lesson_id = $1`;
    const { rows }: pg.QueryResult = await client.query(getLessonStudentsQuery, [lessonId]);
    return rows.length;
  }

  async getAvailableLessonOptions(availableLessons: Array<Lesson>, preferredMentorId: string, isAllowedLastMentor: boolean, lastMentorId: string, studentRegisteredOn: string, studentSkills: Array<string>, client: pg.PoolClient): Promise<Array<LessonRequest>> {
    let availableLessonOptions: Array<Lesson> = [];
    for (const availableLesson of availableLessons) {   
      const isLessonCompatible = await this.checkLessonCompatibility(availableLesson, studentRegisteredOn, client);
      if (isLessonCompatible) {
        const skillsScore = await this.getSkillsScore(studentSkills, availableLesson.mentor?.id as string, availableLesson.subfield as Subfield, client);
        const lessonDateScore = this.getLessonDateScore(availableLesson.dateTime as string);
        let lessonRecurrenceScore = 0;
        if (availableLesson.isRecurrent) {
          const endRecurrenceDateTime = moment.utc(availableLesson.endRecurrenceDateTime).format(constants.DATE_TIME_FORMAT)
          lessonRecurrenceScore = this.getLessonRecurrenceScore(availableLesson.dateTime as string, endRecurrenceDateTime);
        }
        availableLesson.score = skillsScore + lessonDateScore + lessonRecurrenceScore;
        availableLessonOptions.push(availableLesson);
      }
    }
    // Consider only preferred or last mentor if available
    if (preferredMentorId) {
      availableLessonOptions = availableLessonOptions.filter(function(el) { return el.mentor?.id == preferredMentorId; });
      if (availableLessonOptions.length > 0) {
        await this.deletePreferredMentorId(preferredMentorId, client);
      }
    } else {
      if (isAllowedLastMentor) {
        availableLessonOptions = availableLessonOptions.filter(function(el) { return el.mentor?.id == lastMentorId; });
      } else {
        availableLessonOptions = availableLessonOptions.filter(function(el) { return el.mentor?.id != lastMentorId; });
      }
    }
    return availableLessonOptions.sort(function(a,b) {return (b.score as number) - (a.score as number)});
  }

  async deletePreferredMentorId(preferredMentorId: string, client: pg.PoolClient): Promise<void> {
    const deletePreferredMentorIdQuery = `DELETE FROM users_preferred_mentors
      WHERE mentor_id = $1`;
    await client.query(deletePreferredMentorIdQuery, [preferredMentorId]);      
  }  

  async checkLessonCompatibility(availableLesson: Lesson, studentRegisteredOn: string, client: pg.PoolClient): Promise<boolean> {
    const lessonStudents = await usersLessons.getLessonStudents(availableLesson, true, client);
    let registeredDateTimeLow = lessonStudents.length > 0 ? moment.utc(lessonStudents[0].registeredOn) : moment.utc(studentRegisteredOn);
    let registeredDateTimeHigh = lessonStudents.length > 0 ? moment.utc(lessonStudents[0].registeredOn) : moment.utc(studentRegisteredOn);
    for (const lessonStudent of lessonStudents) {
      if (moment.utc(lessonStudent.registeredOn).isBefore(registeredDateTimeLow)) {
        registeredDateTimeLow = moment.utc(lessonStudent.registeredOn);
      }      
      if (moment.utc(lessonStudent.registeredOn).isAfter(registeredDateTimeHigh)) {
        registeredDateTimeHigh = moment.utc(lessonStudent.registeredOn);
      }
    }
    const differenceFromHigh = Math.round(moment.duration(moment.utc(registeredDateTimeHigh).diff(moment.utc(studentRegisteredOn))).asWeeks());
    const differenceFromLow = Math.round(moment.duration(moment.utc(studentRegisteredOn).diff(moment.utc(registeredDateTimeLow))).asWeeks());    
    return differenceFromHigh <= 4 && differenceFromLow <= 4;
  }

  async getSkillsScore(studentSkills: Array<string>, mentorId: string, mentorSubfield: Subfield, client: pg.PoolClient): Promise<number> {
    let skillsScore = 0;
    if (studentSkills != null && studentSkills.length > 0) {
      const getMentorSkillsQuery = `SELECT DISTINCT us.skill_id, ss.skill_index
        FROM users_skills us
        JOIN subfields_skills ss
          ON us.skill_id = ss.skill_id
        WHERE us.user_id = $1 AND ss.subfield_id = $2
        ORDER BY ss.skill_index`;
      const { rows } = await client.query(getMentorSkillsQuery, [mentorId, mentorSubfield.id]);
      const commonSkills = rows.filter(rowMentorSkill => studentSkills.includes(rowMentorSkill.skill_id));
      for (let i = 1; i <= commonSkills.length; i++) {
        skillsScore += i;
      }
    }
    skillsScore *= 2;
    return skillsScore;
  }

  getLessonDateScore(lessonDateTime: string): number {
    return Math.round(7 - moment.duration(moment.utc(lessonDateTime).diff(moment.utc())).asDays());    
  }

  getLessonRecurrenceScore(lessonDateTime: string, endRecurrenceDateTime: string): number {
    return Math.round(moment.duration(moment.utc(endRecurrenceDateTime).diff(moment.utc(lessonDateTime))).asWeeks());    
  }  

  getStudentSkills(studentSubfields: Array<Subfield>): Array<string> {
    const studentSkills: Array<string> = [];
    if (studentSubfields != null && studentSubfields.length > 0) {
      if (studentSubfields[0].skills != null) {
        for (const skill of studentSubfields[0].skills) {
          studentSkills.push(skill.id);
        }
      }
    }
    return studentSkills;    
  }

  async addStudentToAvailableLesson(student: User, availableLessonOptions: Array<Lesson>, client: pg.PoolClient): Promise<void> {
    const availableLesson = availableLessonOptions[0];
    const lessonId = availableLesson.id as string;
    await usersLessonRequests.addStudent(lessonId, student.id as string, client);
    await usersLessonRequests.addStudentSubfield(student.id as string, availableLesson.subfield?.id as string, client);    
    const mentor = await users.getUserFromDB(availableLesson.mentor?.id as string, client);
    availableLesson.mentor = mentor;
    const mentorSubfields = mentor.field?.subfields;
    if (mentorSubfields != null && mentorSubfields.length > 0) {
      for (const mentorSubfield of mentorSubfields) {
        if (availableLesson.subfield?.id == mentorSubfield.id) {
          availableLesson.subfield = mentorSubfield;
          break;
        }
      }
    }
    usersPushNotifications.sendPNStudentAddedToLesson(student, availableLesson);
    usersSendEmails.sendEmailStudentAddedToLesson(student, availableLesson);
  }  
  
  async getAvailableMentors(student: User, preferredMentorId: string, isAllowedLastMentor: boolean, lastMentorId: string, client: pg.PoolClient): Promise<Map<string, string>> {
    const studentSubfields = student.field?.subfields;
    const studentSubfieldId = studentSubfields != null && studentSubfields.length > 0 ? studentSubfields[0].id : null;
    const queryWhereSubfield = studentSubfieldId != null ? `AND us.subfield_id = '${studentSubfieldId}'` : '';
    const studentAvailabilities = student.availabilities != null ? student.availabilities : null; 
    let queryWhereAvailabilities = '';
    let availableMentorsMap: Map<string, string> = new Map();
    if (studentAvailabilities != null && studentAvailabilities.length > 0) {
      queryWhereAvailabilities = 'AND (';
      for (const availability of studentAvailabilities) {
        const timeFrom = moment(availability.time.from, 'h:ma').format('HH:mm');
        let timeTo = moment(availability.time.to, 'h:ma').format('HH:mm');
        timeTo = helpers.getEndOfDay(timeTo);
        queryWhereAvailabilities += `ua.utc_day_of_week = '${availability.dayOfWeek}'
          AND ('${timeFrom}'::TIME >= ua.utc_time_from AND '${timeFrom}'::TIME < ua.utc_time_to OR '${timeTo}'::TIME > ua.utc_time_from AND '${timeTo}'::TIME <= ua.utc_time_to 
              OR '${timeFrom}'::TIME < ua.utc_time_from AND '${timeTo}'::TIME > ua.utc_time_to) OR `;
      }
      queryWhereAvailabilities = queryWhereAvailabilities.slice(0, -4) + ')';
      const getAvailableMentorsQuery = `SELECT DISTINCT u.id, u.is_available, u.available_from, ula.min_interval_in_days, ua.utc_day_of_week, ua.utc_time_from, ua.utc_time_to, ul.date_time, ul.is_recurrent, ul.end_recurrence_date_time, ul.is_canceled
        FROM users u
        FULL OUTER JOIN users_availabilities ua
          ON u.id = ua.user_id
        FULL OUTER JOIN users_lessons_availabilities ula
          ON u.id = ula.user_id        
        FULL OUTER JOIN (
          SELECT *,
            row_number() over (PARTITION BY mentor_id ORDER BY date_time DESC) AS row_number_lessons
            FROM users_lessons 
        ) ul 
          ON u.id = ul.mentor_id
        FULL OUTER JOIN (
          SELECT *,
            row_number() over (PARTITION BY mentor_id ORDER BY sent_date_time DESC) AS row_number_lesson_requests
            FROM users_lesson_requests 
        ) ulr      
          ON u.id = ulr.mentor_id          
        FULL OUTER JOIN users_subfields us
          ON u.id = us.user_id
        WHERE u.is_mentor = true
          AND u.field_id = $1
          AND us.subfield_id IS NOT NULL
          ${queryWhereSubfield}
          AND ua.utc_day_of_week IS NOT NULL
          AND (ul.row_number_lessons = 1 AND (ul.is_recurrent IS DISTINCT FROM true AND ul.date_time < now() 
              OR ul.is_recurrent IS true AND ul.end_recurrence_date_time < now() 
              OR ul.is_canceled IS true AND EXTRACT(EPOCH FROM (now() - ul.canceled_date_time))/3600 > 168) 
              OR ul.id IS NULL)
          AND (ulr.row_number_lesson_requests = 1 AND (ulr.is_canceled IS true OR EXTRACT(EPOCH FROM (now() - ulr.sent_date_time))/3600 > 72)
              OR ulr.id IS NULL)                 
          ${queryWhereAvailabilities}`;
      const { rows } = await client.query(getAvailableMentorsQuery, [student.field?.id]);
      for (const rowMentor of rows) {
        const availableMentor: AvailableMentor = {
          id: rowMentor.id,
          isAvailable: rowMentor.is_available,
          availableFrom: rowMentor.available_from,
          minInterval: rowMentor.min_interval_in_days,
          dayOfWeek: rowMentor.utc_day_of_week,
          timeFrom: rowMentor.utc_time_from,
          timeTo: rowMentor.utc_time_to,
          dateTime: rowMentor.date_time,
          isRecurrent: rowMentor.is_recurrent,
          endRecurrenceDateTime: rowMentor.end_recurrence_date_time,
          isCanceled: rowMentor.is_canceled
        }
        availableMentorsMap = await this.setAvailableMentorsMap(availableMentor, availableMentorsMap, student, studentAvailabilities, client);
      }
    }
    availableMentorsMap = await this.setAvailableMentorsMapUpdated(availableMentorsMap, preferredMentorId, isAllowedLastMentor, lastMentorId, client);
    return availableMentorsMap;    
  }

  async setAvailableMentorsMapUpdated(availableMentorsMap: Map<string, string>, preferredMentorId: string, isAllowedLastMentor: boolean, lastMentorId: string, client: pg.PoolClient): Promise<Map<string, string>> {
    // Consider only preferred or last mentor if available
    if (preferredMentorId) {
      availableMentorsMap = this.setAvailableMentorsMapSingleMentor(availableMentorsMap, preferredMentorId);
      if (availableMentorsMap.size > 0) {
        await this.deletePreferredMentorId(preferredMentorId, client);
      }
    } else {
      if (isAllowedLastMentor) {
        availableMentorsMap = this.setAvailableMentorsMapSingleMentor(availableMentorsMap, lastMentorId);
      } else {
        availableMentorsMap.delete(lastMentorId);
      }
    }
    return availableMentorsMap;
  }

  setAvailableMentorsMapSingleMentor(availableMentorsMap: Map<string, string>, singleMentorId: string): Map<string, string> {
    const newAvailableMentorsMap = new Map();
    for (const [mentorId, lessonDateTime] of availableMentorsMap) {
      if (mentorId == singleMentorId) {
        newAvailableMentorsMap.set(mentorId, lessonDateTime);
        break;
      }
    }
    return newAvailableMentorsMap;
  }  

  async setAvailableMentorsMap(availableMentor: AvailableMentor, availableMentorsMap: Map<string, string>, student: User, studentAvailabilities: Array<Availability>, client: pg.PoolClient): Promise<Map<string, string>> {
    const lessonDateTime = await this.getLessonDateTime(student, availableMentor, studentAvailabilities, client);
    if (availableMentorsMap.has(availableMentor.id)) {
      if (moment.utc(availableMentorsMap.get(availableMentor.id)).isAfter(lessonDateTime)) {
        availableMentorsMap.set(availableMentor.id, lessonDateTime.format(constants.DATE_TIME_FORMAT));
      }
    } else {
      availableMentorsMap.set(availableMentor.id, lessonDateTime.format(constants.DATE_TIME_FORMAT));
    }
    return availableMentorsMap;
  }

  async getLessonDateTime(student: User, availableMentor: AvailableMentor, studentAvailabilities: Array<Availability>, client: pg.PoolClient): Promise<moment.Moment> {
    const studentPreviousLesson: Lesson = await usersLessons.getPreviousLessonFromDB(student.id as string, client);
    let lessonDateTime = moment.utc();
    if (availableMentor.endRecurrenceDateTime) {
      lessonDateTime = moment.utc(availableMentor.endRecurrenceDateTime).add(availableMentor.minInterval, 'd');
    } else if (availableMentor.dateTime) {
      lessonDateTime = moment.utc(availableMentor.dateTime).add(availableMentor.minInterval, 'd');
    }
    
    if (!availableMentor.isAvailable && lessonDateTime.isBefore(moment.utc(availableMentor.availableFrom))) {
      lessonDateTime = moment.utc(availableMentor.availableFrom);
    }
    if (lessonDateTime.isBefore(moment.utc().add(1, 'd'))) {
      lessonDateTime = moment.utc().add(1, 'd');
    }   
    
    if (Object.keys(studentPreviousLesson).length > 0 && 
          lessonDateTime.isBefore(moment.utc(studentPreviousLesson.dateTime).add(7, 'd'))) {
      lessonDateTime = moment.utc(studentPreviousLesson.dateTime).add(7, 'd');
    }
    while (constants.DAYS_OF_WEEK[moment.utc(lessonDateTime).isoWeekday() - 1] != availableMentor.dayOfWeek) {
      lessonDateTime = moment.utc(lessonDateTime).add(1, 'd');
    }
    const lessonTime = this.getLessonTime(studentAvailabilities, availableMentor);
    const lessonTimeArray = lessonTime?.split(':');
    if (lessonTimeArray != null) {
      lessonDateTime.set({
        hours: parseInt(lessonTimeArray[0]),
        minutes: parseInt(lessonTimeArray[1]),
        seconds: 0
      });
    }
    return lessonDateTime;
  }

  getLessonTime(studentAvailabilities: Array<Availability>, availableMentor: AvailableMentor): string {
    let lessonTime = '';
    for (const availability of studentAvailabilities) {
      const studentTimeFrom = moment(availability.time.from, 'h:ma');
      const studentTimeTo = moment(availability.time.to, 'h:ma');
      const mentorTimeFrom = moment(availableMentor.timeFrom, 'HH:mm');
      const mentorTimeTo = moment(availableMentor.timeTo, 'HH:mm');
      if (availability.dayOfWeek == availableMentor.dayOfWeek && 
          (studentTimeFrom.isSameOrAfter(mentorTimeFrom) && studentTimeFrom.isBefore(mentorTimeTo) ||
          studentTimeTo.isAfter(mentorTimeFrom) && studentTimeTo.isSameOrBefore(mentorTimeTo) ||
          studentTimeFrom.isBefore(mentorTimeFrom) && studentTimeTo.isAfter(mentorTimeTo))) {
        if (studentTimeFrom.isBefore(mentorTimeFrom)) {
          lessonTime = moment(mentorTimeFrom, 'HH:mm').format('HH:mm');
        } else {
          lessonTime = studentTimeFrom.format('HH:mm');
        }
        break;
      }
    }
    return lessonTime;
  }

  async getLessonRequestOptions(availableMentorsMap: Map<string, string>, studentSubfield: Subfield | null, studentSkills: Array<string>, client: pg.PoolClient): Promise<Array<LessonRequest>> {
    const lessonRequestOptions: Array<LessonRequest> = [];
    for (const [mentorId, lessonDateTime] of availableMentorsMap) {
      const mentor = await users.getUserFromDB(mentorId, client);
      let mentorSubfield = studentSubfield;
      if (studentSubfield == null) {
        const mentorSubfields = mentor.field?.subfields;
        if (mentorSubfields != null && mentorSubfields.length > 0) {
          mentorSubfield = mentorSubfields[0];
        }
      }          
      const skillsScore = await this.getSkillsScore(studentSkills, mentorId, mentorSubfield as Subfield, client);
      const lessonDateScore = this.getLessonDateScore(lessonDateTime);
      const lessonRequestScore = skillsScore + lessonDateScore;
      const subfield = mentorSubfield;
      const lessonRequestOption: LessonRequest = {
        mentor: mentor,
        subfield: subfield as Subfield,
        lessonDateTime: lessonDateTime,
        score: lessonRequestScore
      }
      lessonRequestOptions.push(lessonRequestOption);
    }
    return lessonRequestOptions.sort(function(a,b) {return (b.score as number) - (a.score as number)});
  }

  async addNewLessonRequest(lessonRequest: LessonRequest, lessonRequestOptions: Array<LessonRequest>, client: pg.PoolClient): Promise<void> {
    if (lessonRequestOptions.length > 0) {
      const mentorId = lessonRequestOptions[0].mentor?.id as string;
      const subfieldId = lessonRequestOptions[0].subfield?.id;
      const lessonDateTime = lessonRequestOptions[0].lessonDateTime;          
      if (lessonRequest.isRejected) {
        const insertLessonRequestQuery = `INSERT INTO 
          users_lesson_requests (student_id, mentor_id, subfield_id, lesson_date_time, sent_date_time) 
          VALUES ($1, $2, $3, $4, $5)`;
        const values: Array<string> = [
          lessonRequest.student?.id as string,
          mentorId,
          lessonRequest.subfield?.id as string,
          lessonDateTime as string,
          moment.utc().format(constants.DATE_TIME_FORMAT)
        ];
        await client.query(insertLessonRequestQuery, values);
      } else if (lessonRequest.lessonDateTime != null) {
        const updatePreviousLessonRequest = `UPDATE users_lesson_requests SET is_expired = true WHERE id = $1`;
        await client.query(updatePreviousLessonRequest, [lessonRequest.id]);            
        const insertLessonRequestQuery = `INSERT INTO users_lesson_requests 
          (student_id, mentor_id, subfield_id, lesson_date_time, sent_date_time) 
          VALUES ($1, $2, $3, $4, $5)`;
        const values: Array<string> = [
          lessonRequest.student?.id as string,
          mentorId,
          lessonRequest.subfield?.id as string,
          lessonDateTime as string,
          moment.utc().format(constants.DATE_TIME_FORMAT)
        ];
        await client.query(insertLessonRequestQuery, values);
      } else if (lessonRequest.lessonDateTime == null) {
        const sentDateTime = moment.utc().format(constants.DATE_TIME_FORMAT);
        const updateLessonRequest = `UPDATE users_lesson_requests 
          SET mentor_id = $1, subfield_id = $2, lesson_date_time = $3, sent_date_time = $4 WHERE id = $5`;
        await client.query(updateLessonRequest, [mentorId, subfieldId, lessonDateTime, sentDateTime, lessonRequest.id]);
      }
      await this.flagLessonRequestsObsolete(lessonRequest, client);
    }
  }

  async flagLessonRequestsObsolete(lessonRequest: LessonRequest, client: pg.PoolClient): Promise<void> {
    const updateLessonRequests = `UPDATE users_lesson_requests 
      SET is_obsolete = true WHERE student_id = $1 AND (is_rejected = true OR is_expired = true)`;
    await client.query(updateLessonRequests, [lessonRequest.student?.id]); 
  }

  async sendLessonReminders(request: Request, response: Response): Promise<void> {
    try {
      await this.sendLessonRemindersFromDB();
      response.status(200).send('Lesson reminders sent');
    } catch (error) {
      response.status(400).send(error);
    }    
  }
  
  async sendLessonRemindersFromDB(): Promise<void> {
    const getLessonsQuery = `SELECT * FROM
      (SELECT id, mentor_id, is_canceled, EXTRACT(EPOCH FROM (date_trunc('minute', now()) + interval '30 minutes' - date_time)) / 3600 / 24 / 7 AS diff_date_time
          FROM users_lessons) ul
      WHERE ul.is_canceled IS DISTINCT FROM true
          AND ul.diff_date_time = FLOOR(ul.diff_date_time)`;
    const { rows }: pg.QueryResult = await pool.query(getLessonsQuery);
    for (const row of rows) {
      const mentor: User = {
        id: row.mentor_id
      }
      const client: pg.PoolClient = await pool.connect();
      try {
        await client.query('BEGIN');
        const nextLesson = await usersLessons.getNextLessonFromDB(mentor.id as string, true, client);
        let difference = moment.duration(moment.utc(nextLesson.dateTime).diff(moment.utc().add(30, 'm')));
        if (moment.utc(nextLesson.dateTime).isBefore(moment.utc().add(30, 'm'))) {
          difference = moment.duration(moment.utc().add(30, 'm').diff(moment.utc(nextLesson.dateTime)));
        }
        if (difference.asSeconds() < 60) {
          nextLesson.mentor = mentor;
          const students = nextLesson.students;
          if (students != null && students.length > 0) {
            usersSendEmails.sendEmailLessonReminder(nextLesson, client);
            usersPushNotifications.sendPNLessonReminder(nextLesson);
          }
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }        
    }
  }  

  async sendAfterLesson(request: Request, response: Response): Promise<void> {
    try {
      await this.sendAfterLessonFromDB();
      response.status(200).send('After lesson sent');
    } catch (error) {
      response.status(400).send(error);
    }    
  }
  
  async sendAfterLessonFromDB(): Promise<void> {
    try {
      const getAfterLessonQuery = `SELECT * FROM
        (SELECT id, mentor_id, is_recurrent, EXTRACT(EPOCH FROM (now() - interval '3 hours' - end_recurrence_date_time)) AS diff_end_recurrence_date_time, ROUND(EXTRACT(EPOCH FROM (now() - interval '3 hours' - date_time))/60)/60/24/7 AS diff_date_time
            FROM users_lessons
            GROUP BY id) ul
        WHERE is_recurrent IS DISTINCT FROM true AND diff_date_time = 0
          OR is_recurrent = true AND diff_end_recurrence_date_time < 60 AND diff_date_time = FLOOR(diff_date_time)`;
      const { rows }: pg.QueryResult = await pool.query(getAfterLessonQuery);
      for (const row of rows) {
        const mentor: User = {
          id: row.mentor_id
        }
        const client: pg.PoolClient = await pool.connect();
        try {
          await client.query('BEGIN');
          const previousLesson = await usersLessons.getPreviousLessonFromDB(mentor.id as string, client);
          let difference = moment.duration(moment.utc(previousLesson.dateTime).diff(moment.utc().subtract(3, 'h')));
          if (moment.utc(previousLesson.dateTime).isBefore(moment.utc().subtract(3, 'h'))) {
            difference = moment.duration(moment.utc().subtract(3, 'h').diff(moment.utc(previousLesson.dateTime)));
          }
          if (difference.asSeconds() < 60) {
            previousLesson.mentor = mentor;
            const students = previousLesson.students;
            if (students != null && students.length > 0) {
              usersPushNotifications.sendPNAfterLesson(previousLesson);
            }
          }
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
        } finally {
          client.release();
        }        
      }
    } catch (error) {
      console.log(error);
    }
  }

  async sendTrainingReminders(request: Request, response: Response): Promise<void> {
    try {
      await this.sendTrainingRemindersFromDB(true);
      await this.sendTrainingRemindersFromDB(false);
      response.status(200).send('Training reminders sent');
    } catch (error) {
      response.status(400).send(error);
    }    
  }
  
  async sendTrainingRemindersFromDB(isFirst: boolean): Promise<void> {
    const days = isFirst ? 5 : 0;
    const getUsersForTrainingReminderQuery = `SELECT u.id, u.name, u.email, u.is_mentor, u.registered_on FROM users AS u
      JOIN users_notifications_settings AS uns
        ON u.id = uns.user_id
      JOIN users_timezones AS ut
        ON u.id = ut.user_id
      WHERE uns.enabled = true
        AND (date_trunc('day', now() AT TIME ZONE ut.name)::date - date_trunc('day', u.registered_on AT TIME ZONE ut.name)::date) % 7 = $1
        AND date_trunc('day', now() AT TIME ZONE ut.name)::date <> date_trunc('day', u.registered_on AT TIME ZONE ut.name)::date
        AND date_trunc('day', now() AT TIME ZONE ut.name) + uns.time = date_trunc('minute', now() AT TIME ZONE ut.name);`;
    const { rows }: pg.QueryResult = await pool.query(getUsersForTrainingReminderQuery, [days]);
    for (const row of rows) {
      const client: pg.PoolClient = await pool.connect();
      try {
        await client.query('BEGIN');
        const user: User = {
          id: row.id,
          name: row.name,
          email: row.email,
          isMentor: row.is_mentor,
          registeredOn: row.registered_on
        }
        const showStepReminder = await this.getShowStepReminder(user, client);
        let showQuizReminder = false;
        let remainingQuizzes = 0;
        const hasOldAppVersion = await this.hasOldAppVersion(user.id as string, client);
        if (user.isMentor && hasOldAppVersion) {
          const quizNumber = await usersQuizzes.getQuizNumberFromDB(user.id as string, client);
          remainingQuizzes = 3 - (quizNumber - 1) % 3;
          showQuizReminder = quizNumber > 0 ? true : false;
        } else {
          const quizzes = await usersQuizzes.getQuizzesFromDB(user.id as string, client);
          remainingQuizzes = helpers.getRemainingQuizzes(quizzes);
          showQuizReminder = remainingQuizzes > 0 ? true : false;
        }
        this.sendFirstAndSecondTrainingReminders(isFirst, user, showStepReminder, showQuizReminder, remainingQuizzes);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }        
    }
  }

  sendFirstAndSecondTrainingReminders(isFirst: boolean, user: User, showStepReminder: boolean, showQuizReminder: boolean, remainingQuizzes: number): void {
    if (isFirst) {
      usersPushNotifications.sendPNFirstTrainingReminder(user.id as string, showStepReminder, showQuizReminder, remainingQuizzes);
      usersSendEmails.sendEmailFirstTrainingReminder(user, showStepReminder, showQuizReminder, remainingQuizzes);
    } else {
      usersPushNotifications.sendPNSecondTrainingReminder(user.id as string, showStepReminder, showQuizReminder, remainingQuizzes);
      usersSendEmails.sendEmailSecondTrainingReminder(user, showStepReminder, showQuizReminder, remainingQuizzes);
      adminTrainingReminders.addTrainingReminder(user, !showStepReminder, remainingQuizzes);
    }
  }
  
  async hasOldAppVersion(userId: string, client: pg.PoolClient): Promise<boolean> {
    const appVersion = await usersAppVersions.getAppVersion(userId, client);
    return appVersion.major == 1 && appVersion.minor == 0 && 
      (appVersion.revision == 1 && appVersion.build == 3 ||
       appVersion.revision == 4 && (appVersion.build == 15 || appVersion.build == 23));
  }
  
  async getShowStepReminder(user: User, client: pg.PoolClient): Promise<boolean> {
    const userTimeZone = await usersTimeZones.getUserTimeZone(user.id as string, client);
    const lastStepAdded = await usersSteps.getLastStepAddedFromDB(user.id as string, client);
    let nextDeadline = moment.utc(user.registeredOn).tz(userTimeZone.name).startOf('day');
    while (nextDeadline.isBefore(moment.utc().tz(userTimeZone.name).startOf('day'))) {
      nextDeadline = nextDeadline.add(7, 'd');
    }
    const lastStepAddedDateTime = moment.utc(lastStepAdded.dateTime).tz(userTimeZone.name).startOf('day');    
    let showStepReminder = false;
    const timeSinceRegistration = moment.utc().tz(userTimeZone.name).startOf('day').diff(moment.utc(user.registeredOn).tz(userTimeZone.name).startOf('day'));
    const limit = helpers.getDSTAdjustedDifferenceInDays(timeSinceRegistration) > 7 ? 7 : 8;
    if (Object.keys(lastStepAdded).length == 0 || helpers.getDSTAdjustedDifferenceInDays(nextDeadline.diff(lastStepAddedDateTime)) >= limit) {
      showStepReminder = true;
    }
    return showStepReminder;
  }

  sendCPUUsage(): void {
    os.cpuUsage(function(v) {
      const server = process.env.SERVER;
      if (server == 'prod' && v >= 0.3) {
        const email: Email = {
          subject: 'High CPU alert',
          body: v.toString()
        }        
        usersSendEmails.sendEmail('edmondpr@gmail.com', email)
      }
    });       
  }
}

