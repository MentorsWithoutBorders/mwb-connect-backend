import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import moment from 'moment';
import 'moment-timezone';
import pg from 'pg';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Users } from './users';
import { UsersLessons } from './users_lessons';
import { UsersSteps } from './users_steps';
import { UsersQuizzes } from './users_quizzes';
import { UsersTimeZones } from './users_timezones';
import { UsersPushNotifications } from './users_push_notifications';
import User from '../models/user.model';
import Subfield from '../models/subfield.model';
import LessonRequest from '../models/lesson_request.model';
import Lesson from '../models/lesson.model';
import AvailableMentor from '../models/available_mentor.model';
import Availability from '../models/availability.model';

const conn: Conn = new Conn();
const pool = conn.pool;
const users: Users = new Users();
const usersLessons: UsersLessons = new UsersLessons();
const usersSteps: UsersSteps = new UsersSteps();
const usersQuizzes: UsersQuizzes = new UsersQuizzes();
const usersTimeZones: UsersTimeZones = new UsersTimeZones();
const usersPushNotifications: UsersPushNotifications = new UsersPushNotifications();

export class UsersBackgroundProcesses {
  constructor() {
    autoBind(this);
  }

  async sendLessonRequest(request: Request, response: Response): Promise<void> {
    try {
      await this.sendLessonRequestFromDB();
      response.status(200).send('Lesson request sent');
    } catch (error) {
      response.status(400).send(error);
    }    
  }

  async sendLessonRequestFromDB(): Promise<void> {
    const getLessonRequestsQuery = `SELECT id, student_id, mentor_id, subfield_id, lesson_date_time, sent_date_time, is_rejected, is_canceled, is_expired, is_obsolete
      FROM users_lesson_requests
      WHERE (is_canceled IS DISTINCT FROM true
        AND is_expired IS DISTINCT FROM true
        AND (lesson_date_time IS NULL
          OR lesson_date_time IS DISTINCT FROM NULL AND EXTRACT(EPOCH FROM (now() - sent_date_time))/3600 > 1)
        OR is_rejected = true)
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
          isExpired: rowRequest.is_expired
        }        
        const student: User = await users.getUserFromDB(lessonRequest.student?.id as string, client);
        const studentSubfields = student.field?.subfields;
        const studentSubfield = studentSubfields != null && studentSubfields.length > 0 ? studentSubfields[0] : null;
        const studentSkills = this.getStudentSkills(studentSubfields as Array<Subfield>);
        const availableMentorsMap = await this.getAvailableMentors(student, client);
        const lessonRequestOptions = await this.getLessonRequestOptions(availableMentorsMap, studentSubfield as Subfield, studentSkills, client);
        await this.addNewLessonRequest(lessonRequest, lessonRequestOptions, client);
        await client.query('COMMIT');
        usersPushNotifications.sendPNLessonRequest(student, lessonRequestOptions);
      } catch (error) {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }  
    }
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
  
  async getAvailableMentors(student: User, client: pg.PoolClient): Promise<Map<string, string>> {
    const studentSubfields = student.field?.subfields;
    const studentSubfieldId = studentSubfields != null && studentSubfields.length > 0 ? studentSubfields[0].id : null;
    const queryWhereSubfield = studentSubfieldId != null ? `AND us.subfield_id = '${studentSubfieldId}'` : '';
    const studentAvailabilities = student.availabilities != null ? student.availabilities : null; 
    let queryWhereAvailabilities = '';
    if (studentAvailabilities != null && studentAvailabilities.length > 0) {
      queryWhereAvailabilities = 'AND (';
      for (const availability of studentAvailabilities) {
        const timeFrom = moment(availability.time.from, 'h:ma').format('HH:mm');
        const timeTo = moment(availability.time.to, 'h:ma').format('HH:mm');
        queryWhereAvailabilities += `ua.utc_day_of_week = '${availability.dayOfWeek}'
          AND ('${timeFrom}'::TIME >= ua.utc_time_from AND '${timeFrom}'::TIME < ua.utc_time_to OR '${timeTo}'::TIME > ua.utc_time_from AND '${timeTo}'::TIME <= ua.utc_time_to 
              OR '${timeFrom}'::TIME < ua.utc_time_from AND '${timeTo}'::TIME > ua.utc_time_to) OR `;
      }
      queryWhereAvailabilities = queryWhereAvailabilities.slice(0, -4) + ')';
    }
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
        AND (ul.row_number_lessons = 1 AND (ul.is_recurrent IS DISTINCT FROM true AND ul.date_time < now() 
            OR ul.is_recurrent IS true AND ul.end_recurrence_date_time < now() 
            OR ul.is_canceled IS true AND EXTRACT(EPOCH FROM (now() - ul.canceled_date_time))/3600 > 168) 
            OR ul.id IS NULL)
        AND (ulr.row_number_lesson_requests = 1 AND (ulr.is_canceled IS true OR EXTRACT(EPOCH FROM (now() - ulr.sent_date_time))/3600 > 72)
            OR ulr.id IS NULL)                 
        ${queryWhereAvailabilities}`;
    const { rows } = await client.query(getAvailableMentorsQuery, [student.field?.id]);
    const availableMentorsMap: Map<string, string> = new Map();
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
      const lessonDateTime = await this.getLessonDateTime(student, availableMentor, studentAvailabilities as Array<Availability>, client);
      if (availableMentorsMap.has(availableMentor.id)) {
        if (moment.utc(availableMentorsMap.get(availableMentor.id)).isAfter(lessonDateTime)) {
          availableMentorsMap.set(availableMentor.id, lessonDateTime.format(constants.DATE_TIME_FORMAT));
        }
      } else {
        availableMentorsMap.set(availableMentor.id, lessonDateTime.format(constants.DATE_TIME_FORMAT));
      }
    }
    return availableMentorsMap;    
  }

  async getLessonDateTime(student: User, availableMentor: AvailableMentor, studentAvailabilities: Array<Availability>, client: pg.PoolClient): Promise<moment.Moment> {
    const studentPreviousLesson: Lesson = await usersLessons.getPreviousLessonFromDB(student.id as string, client);
    let lessonDateTime;
    if (availableMentor.isCanceled) {
      lessonDateTime = moment.utc();
    } else if (availableMentor.endRecurrenceDateTime) {
      lessonDateTime = moment.utc(availableMentor.endRecurrenceDateTime).add(availableMentor.minInterval, 'd');
    } else if (availableMentor.dateTime) {
      lessonDateTime = moment.utc(availableMentor.dateTime).add(availableMentor.minInterval, 'd');
    } else {
      lessonDateTime = moment.utc(availableMentor.availableFrom);
    }
    
    // if (!availableMentor.isAvailable && lessonDateTime.isBefore(moment.utc(availableMentor.availableFrom))) {
    //   lessonDateTime = moment.utc(availableMentor.availableFrom);
    // }
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
    if (studentAvailabilities != null && studentAvailabilities.length > 0) {
      for (const availability of studentAvailabilities) {
        if (availability.dayOfWeek == availableMentor.dayOfWeek) {
          const studentTimeFrom = moment(availability.time.from, 'h:ma');
          const mentorTimeFrom = moment(availableMentor.timeFrom, 'HH:mm');
          if (studentTimeFrom.isBefore(mentorTimeFrom)) {
            lessonTime = moment(mentorTimeFrom, 'HH:mm').format('HH:mm');
          } else {
            lessonTime = studentTimeFrom.format('HH:mm');
          }
          break;
        }
      }
    }
    return lessonTime;
  }

  async getLessonRequestOptions(availableMentorsMap: Map<string, string>, studentSubfield: Subfield | null, studentSkills: Array<string>, client: pg.PoolClient): Promise<Array<LessonRequest>> {
    const lessonRequestOptions: Array<LessonRequest> = [];
    for (const [mentorId, lessonDateTime] of availableMentorsMap) {
      let mentorSubfield = studentSubfield;
      if (studentSubfield == null) {
        const mentorSubfields = await users.getUserSubfields(mentorId, client);
        if (mentorSubfields != null && mentorSubfields.length > 0) {
          mentorSubfield = mentorSubfields[0];
        }
      }          
      let skillsScore = 0;
      if (studentSkills.length > 0) {
        const getMentorSkillsQuery = `SELECT DISTINCT us.skill_id, ss.skill_index
          FROM users_skills us
          JOIN subfields_skills ss
          ON us.skill_id = ss.skill_id
          WHERE us.user_id = $1 AND ss.subfield_id = $2
          ORDER BY ss.skill_index`;
        const { rows } = await client.query(getMentorSkillsQuery, [mentorId, mentorSubfield?.id]);
        const commonSkills = rows.filter(rowMentorSkill => studentSkills.includes(rowMentorSkill.skill_id));
        for (let i = 1; i <= commonSkills.length; i++) {
          skillsScore += i;
        }
      }
      const lessonDateScore = Math.round(7 - moment.duration(moment.utc(lessonDateTime).diff(moment.utc())).asDays());
      const lessonRequestScore = lessonDateScore + skillsScore;
      const mentor: User = {
        id: mentorId
      }
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
        const updateLessonRequest = `UPDATE users_lesson_requests 
          SET mentor_id = $1, subfield_id = $2, lesson_date_time = $3 WHERE id = $4`;
        await client.query(updateLessonRequest, [mentorId, subfieldId, lessonDateTime, lessonRequest.id]);
      }
      await this.flagLessonRequestsObsolete(lessonRequest, client);
    }
  }

  async flagLessonRequestsObsolete(lessonRequest: LessonRequest, client: pg.PoolClient): Promise<void> {
    const updateLessonRequests = `UPDATE users_lesson_requests 
      SET is_obsolete = true WHERE student_id = $1 AND (is_rejected = true OR is_expired = true)`;
    await client.query(updateLessonRequests, [lessonRequest.student?.id]); 
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
    const getUsersForTrainingReminderQuery = `SELECT u.id, u.name, u.registered_on FROM users AS u
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
          registeredOn: row.registered_on
        }
        const showStepReminder = await this.getShowStepReminder(user, client);
        const quizNumber = await usersQuizzes.getQuizNumberFromDB(user.id as string, client);
        const remainingQuizzes = 3 - (quizNumber - 1) % 3;
        const showQuizReminder = await usersQuizzes.getQuizNumberFromDB(user.id as string, client) > 0 ? true : false;
        if (isFirst) {
          usersPushNotifications.sendPNFirstTrainingReminder(user.id as string, showStepReminder, showQuizReminder, remainingQuizzes);
        } else {
          usersPushNotifications.sendPNSecondTrainingReminder(user.id as string, showStepReminder, showQuizReminder, remainingQuizzes);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }        
    }
  } 
  
  async getShowStepReminder(user: User, client: pg.PoolClient): Promise<boolean> {
    const userTimeZone = await usersTimeZones.getUserTimeZone(user.id as string, client);         
    const lastStepAdded = await usersSteps.getLastStepAddedFromDB(user.id as string, client);
    let nextDeadLine = moment.utc(user.registeredOn).tz(userTimeZone.name).startOf('day');
    while (nextDeadLine.isBefore(moment.utc().tz(userTimeZone.name).startOf('day'))) {
      nextDeadLine = nextDeadLine.add(7, 'd');
    }
    const lastStepAddedDateTime = moment.utc(lastStepAdded.dateTime).tz(userTimeZone.name).startOf('day');    
    let showStepReminder = false;
    const limit = moment.duration(moment.utc().tz(userTimeZone.name).startOf('day').diff(moment.utc(user.registeredOn).tz(userTimeZone.name).startOf('day'))).asDays() > 7 ? 7 : 8;
    if (Object.keys(lastStepAdded).length == 0 || moment.duration(nextDeadLine.diff(lastStepAddedDateTime)).asDays() >= limit) {
      showStepReminder = true;
    }
    return showStepReminder;
  }
}

