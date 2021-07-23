import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import moment from 'moment';
import pg from 'pg';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Users } from './users';
import { UsersLessons } from './users_lessons';
import User from '../models/user.model';
import Subfield from '../models/subfield.model';
import LessonRequest from '../models/lesson_request.model';
import Lesson from '../models/lesson.model';
import Organization from '../models/organization.model';
import AvailableMentor from '../models/available_mentor.model';
import Availability from '../models/availability.model';

const conn: Conn = new Conn();
const pool = conn.pool;
const users: Users = new Users();
const usersLessons: UsersLessons = new UsersLessons();

export class UsersLessonRequests {
  constructor() {
    autoBind(this);
  }

  async addLessonRequest(request: Request, response: Response): Promise<void> {
    const studentId: string = request.user.id as string;
    try {
      const insertLessonRequestQuery = `INSERT INTO users_lesson_requests (student_id, sent_date_time)
        VALUES ($1, $2) RETURNING *`;
      const sentDateTime = moment.utc();
      const values = [studentId, sentDateTime];
      const { rows }: pg.QueryResult = await pool.query(insertLessonRequestQuery, values);
      const lessonRequest: LessonRequest = {
        id: rows[0].id
      }
      response.status(200).send(lessonRequest);
    } catch (error) {
      response.status(400).send(error);
    }
  }
  
  async getLessonRequest(request: Request, response: Response): Promise<void> {
    const userId: string = request.user.id as string;
    const client: pg.PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(constants.READ_ONLY_TRANSACTION);
      const isMentor = await this.getIsMentor(userId, client);
      const userTypeId = isMentor ? 'ulr.mentor_id' : 'ulr.student_id';
      const getLessonRequestQuery = `SELECT ulr.id, ulr.student_id, ulr.subfield_id, ulr.sent_date_time, ulr.lesson_date_time, s.name AS subfield_name, ulr.is_canceled
        FROM users_lesson_requests ulr
        LEFT OUTER JOIN subfields s
        ON ulr.subfield_id = s.id
        WHERE ${userTypeId} = $1
        ORDER BY ulr.sent_date_time DESC LIMIT 1`;
      const { rows }: pg.QueryResult = await client.query(getLessonRequestQuery, [userId]);
      let lessonRequest: LessonRequest = {};
      if (rows[0]) {
        const subfield: Subfield = {
          id: rows[0].subfield_id,
          name: rows[0].subfield_name
        }
        let lessonDateTime;
        if (rows[0].lesson_date_time != null) {
          lessonDateTime = moment.utc(rows[0].lesson_date_time).format(constants.DATE_TIME_FORMAT);
        }
        lessonRequest = {
          id: rows[0].id,
          subfield: subfield,
          sentDateTime: moment.utc(rows[0].sent_date_time).format(constants.DATE_TIME_FORMAT),
          lessonDateTime: lessonDateTime as string,
          isCanceled: rows[0].is_canceled,
        }
        if (isMentor) {
          const user: User = await users.getUserFromDB(rows[0].student_id, client);
          const student: User = {
            id: user.id as string,
            name: user.name as string,
            organization: user.organization as Organization
          }
          lessonRequest.student = student;
        } 
      }   
      response.status(200).json(lessonRequest);
      await client.query('COMMIT');
    } catch (error) {
      response.status(500).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async getIsMentor(userId: string, client: pg.PoolClient): Promise<boolean> {
    const getUserQuery = 'SELECT is_mentor FROM users WHERE id = $1';
    const { rows }: pg.QueryResult = await client.query(getUserQuery, [userId]);
    return rows[0].is_mentor;
  }  

  async acceptLessonRequest(request: Request, response: Response): Promise<void> {
    const mentorId: string = request.user.id as string;
    const lessonRequestId: string = request.params.id;
    const { meetingUrl, isRecurrent, endRecurrenceDateTime, isRecurrenceDateSelected }: Lesson = request.body
    const client: pg.PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      const getLessonRequestQuery = 'SELECT id, student_id, subfield_id, lesson_date_time FROM users_lesson_requests WHERE mentor_id = $1 AND id = $2';
      const { rows }: pg.QueryResult = await client.query(getLessonRequestQuery, [mentorId, lessonRequestId]);
      const student: User = {
        id: rows[0].student_id
      };
      const mentor: User = {
        id: mentorId
      };
      const subfield: Subfield = {
        id: rows[0].subfield_id
      };        
      let lesson: Lesson = {
        id: rows[0].id,
        students: [student],
        mentor: mentor,
        subfield: subfield,
        dateTime: rows[0].lesson_date_time,
        meetingUrl: meetingUrl,
        isRecurrent: isRecurrent,
        endRecurrenceDateTime: endRecurrenceDateTime,
        isRecurrenceDateSelected: isRecurrenceDateSelected
      }
      lesson = await this.addLesson(lesson, client);
      await this.addStudentSubfield(student.id as string, subfield.id as string, client);
      await this.deleteLessonRequest(mentorId, lessonRequestId, client);
      response.status(200).send(lesson);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }
  
  async addLesson(lesson: Lesson, client: pg.PoolClient): Promise<Lesson> {
    const insertLessonQuery = `INSERT INTO users_lessons (mentor_id, subfield_id, date_time, meeting_url, is_recurrent, end_recurrence_date_time, is_recurrence_date_selected)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`;
    const dateTime = moment.utc(lesson.dateTime);
    const endRecurrence = lesson.isRecurrent && lesson.endRecurrenceDateTime != undefined ? moment.utc(lesson.endRecurrenceDateTime) : null;
    const values = [lesson.mentor?.id, lesson.subfield?.id, dateTime, lesson.meetingUrl, lesson.isRecurrent, endRecurrence, lesson.isRecurrenceDateSelected];
    const { rows }: pg.QueryResult = await client.query(insertLessonQuery, values);
    const addedLesson = {
      id: rows[0].id
    }
    let student: User = {};
    if (lesson.students != null) {
      student = lesson.students[0];
    }
    await this.addStudent(addedLesson.id as string, student.id as string, client);
    return usersLessons.getNextLessonFromDB(lesson.mentor?.id as string, true, client);
  }

  async addStudent(lessonId: string, studentId: string, client: pg.PoolClient): Promise<void> {
    const insertStudentQuery = `INSERT INTO users_lessons_students (lesson_id, student_id)
      VALUES ($1, $2)`;
    const values = [lessonId, studentId];
    await client.query(insertStudentQuery, values);          
  }  

  async addStudentSubfield(studentId: string, subfieldId: string, client: pg.PoolClient): Promise<void> {
    const getSubfieldQuery = 'SELECT user_id FROM users_subfields WHERE user_id = $1';
    const { rows }: pg.QueryResult = await client.query(getSubfieldQuery, [studentId]);
    if (!rows[0]) {
      const insertSubfieldQuery = `INSERT INTO users_subfields (user_id, subfield_id)
        VALUES ($1, $2)`;
      const values = [studentId, subfieldId];
      await client.query(insertSubfieldQuery, values);          
    }
  }

  async deleteLessonRequest(mentorId: string, lessonId: string, client: pg.PoolClient): Promise<void> {
    const deleteLessonRequestQuery = 'DELETE FROM users_lesson_requests WHERE mentor_id = $1 AND id = $2';
    await client.query(deleteLessonRequestQuery, [mentorId, lessonId]);
  }
  
  async rejectLessonRequest(request: Request, response: Response): Promise<void> {
    const mentorId: string = request.user.id as string;
    const lessonRequestId: string = request.params.id;
    try {
      const updateLessonRequestQuery = 'UPDATE users_lesson_requests SET is_rejected = true WHERE mentor_id = $1 AND id = $2';
      await pool.query(updateLessonRequestQuery, [mentorId, lessonRequestId]);
      response.status(200).send(`Lesson request modified with ID: ${lessonRequestId}`);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async cancelLessonRequest(request: Request, response: Response): Promise<void> {
    const studentId: string = request.user.id as string;
    const lessonRequestId: string = request.params.id;
    try {
      const updateLessonRequestQuery = 'UPDATE users_lesson_requests SET is_canceled = true WHERE student_id = $1 AND id = $2';
      await pool.query(updateLessonRequestQuery, [studentId, lessonRequestId]);
      response.status(200).send(`Lesson request modified with ID: ${lessonRequestId}`);
    } catch (error) {
      response.status(400).send(error);
    }
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
    const getLessonRequestsQuery = `SELECT id, student_id, mentor_id, subfield_id, lesson_date_time, sent_date_time, is_rejected, is_canceled, is_expired
      FROM users_lesson_requests
      WHERE is_canceled IS DISTINCT FROM true
        AND is_expired IS DISTINCT FROM true
        AND (lesson_date_time IS NULL
          OR lesson_date_time IS DISTINCT FROM NULL AND EXTRACT(EPOCH FROM (NOW() - sent_date_time))/3600 > 1)
        OR is_rejected = true
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
        const studentSubfield = studentSubfields != null && studentSubfields.length > 0 ? studentSubfields[0].id : null;
        const studentSkills = this.getStudentSkills(studentSubfields as Array<Subfield>);
        const availableMentorsMap = await this.getAvailableMentors(student, client);
        const lessonRequestOptions = await this.getLessonRequestOptions(availableMentorsMap, studentSubfield as string, studentSkills, client);
        await this.addNewLessonRequest(lessonRequest, lessonRequestOptions, client);
        await client.query('COMMIT');
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
    const studentSubfield = studentSubfields != null && studentSubfields.length > 0 ? studentSubfields[0].id : null;
    const queryWhereSubfield = studentSubfield != null ? `AND us.subfield_id = '${studentSubfield}'` : '';
    const studentAvailabilities = student.availabilities != null ? student.availabilities : null; 
    let queryWhereAvailabilities = '';
    if (studentAvailabilities != null && studentAvailabilities.length > 0) {
      queryWhereAvailabilities = 'AND (';
      for (const availability of studentAvailabilities) {
        const timeFrom = moment(availability.time.from, 'ha').format('HH:mm');
        const timeTo = moment(availability.time.to, 'ha').format('HH:mm');
        queryWhereAvailabilities += `ua.utc_day_of_week = '${availability.dayOfWeek}'
          AND ('${timeFrom}'::TIME >= ua.utc_time_from AND '${timeFrom}'::TIME < ua.utc_time_to OR '${timeTo}'::TIME > ua.utc_time_from AND '${timeTo}'::TIME <= ua.utc_time_to 
              OR '${timeFrom}'::TIME < ua.utc_time_from AND '${timeTo}'::TIME > ua.utc_time_to) OR `;
      }
      queryWhereAvailabilities = queryWhereAvailabilities.slice(0, -4) + ')';
    }
    const getAvailableMentorsQuery = `SELECT DISTINCT u.id, u.available_from, ula.min_interval_in_days, ua.utc_day_of_week, ua.utc_time_from, ua.utc_time_to, ul.date_time, ul.is_recurrent, ul.end_recurrence_date_time
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
        AND (ul.row_number_lessons = 1 AND (ul.is_recurrent IS DISTINCT FROM true AND ul.date_time < now() OR ul.is_recurrent IS true AND ul.end_recurrence_date_time < now() OR ul.is_canceled IS true) 
            OR ul.id IS NULL)
        AND (ulr.row_number_lesson_requests = 1 AND (ulr.is_canceled IS true OR EXTRACT(EPOCH FROM (NOW() - ulr.sent_date_time))/3600 > 72)
            OR ulr.id IS NULL)                 
        ${queryWhereAvailabilities}`;
    const { rows } = await client.query(getAvailableMentorsQuery, [student.field?.id]);
    const availableMentorsMap: Map<string, string> = new Map();
    for (const rowMentor of rows) {
      const availableMentor: AvailableMentor = {
        id: rowMentor.id,
        availableFrom: rowMentor.available_from,
        minInterval: rowMentor.min_interval_in_days,
        dayOfWeek: rowMentor.utc_day_of_week,
        timeFrom: rowMentor.utc_time_from,
        timeTo: rowMentor.utc_time_to,
        dateTime: rowMentor.date_time,
        isRecurrent: rowMentor.is_recurrent,
        endRecurrenceDateTime: rowMentor.end_recurrence_date_time
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
    if (availableMentor.endRecurrenceDateTime) {
      lessonDateTime = moment.utc(availableMentor.endRecurrenceDateTime).add(availableMentor.minInterval, 'd');
      if (lessonDateTime.isBefore(moment.utc(availableMentor.availableFrom))) {
        lessonDateTime = moment.utc(availableMentor.availableFrom);
      }             
    } else if (availableMentor.dateTime) {
      lessonDateTime = moment.utc(availableMentor.dateTime).add(availableMentor.minInterval, 'd');
      if (lessonDateTime.isBefore(moment.utc(availableMentor.availableFrom))) {
        lessonDateTime = moment.utc(availableMentor.availableFrom);
      }
    } else {
      lessonDateTime = moment.utc(availableMentor.availableFrom);
      if (lessonDateTime.isBefore(moment.utc())) {
        lessonDateTime = moment.utc();
      }            
    }
    if (lessonDateTime.isBefore(moment.utc(studentPreviousLesson.dateTime).add(7, 'd'))) {
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
        minutes: parseInt(lessonTimeArray[1])
      });
    }
    return lessonDateTime;
  }

  getLessonTime(studentAvailabilities: Array<Availability>, availableMentor: AvailableMentor): string {
    let lessonTime = '';
    if (studentAvailabilities != null && studentAvailabilities.length > 0) {
      for (const availability of studentAvailabilities) {
        if (availability.dayOfWeek == availableMentor.dayOfWeek) {
          const studentTimeFrom = moment(availability.time.from, 'ha');
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

  async getLessonRequestOptions(availableMentorsMap: Map<string, string>, studentSubfield: string, studentSkills: Array<string>, client: pg.PoolClient): Promise<Array<LessonRequest>> {
    const lessonRequestOptions: Array<LessonRequest> = [];
    for (const [mentorId, lessonDateTime] of availableMentorsMap) {
      let mentorSubfield = studentSubfield;
      if (studentSubfield == null) {
        const mentorSubfields = await users.getUserSubfields(mentorId, client);
        if (mentorSubfields != null && mentorSubfields.length > 0) {
          mentorSubfield = mentorSubfields[0].id as string;
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
        const { rows } = await client.query(getMentorSkillsQuery, [mentorId, mentorSubfield]);
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
      const subfield: Subfield = {
        id: mentorSubfield
      }
      const lessonRequestOption: LessonRequest = {
        mentor: mentor,
        subfield: subfield,
        lessonDateTime: lessonDateTime,
        score: lessonRequestScore
      }
      lessonRequestOptions.push(lessonRequestOption);
    }
    return lessonRequestOptions.sort(function(a,b) {return (b.score as number) - (a.score as number)});
  }

  async addNewLessonRequest(lessonRequest: LessonRequest, lessonRequestOptions: Array<LessonRequest>, client: pg.PoolClient): Promise<void> {
    if (lessonRequestOptions.length > 0) {
      const mentorId = lessonRequestOptions[0].mentor?.id;
      const subfieldId = lessonRequestOptions[0].subfield?.id;
      const lessonDateTime = lessonRequestOptions[0].lessonDateTime;          
      if (lessonRequest.isRejected) {
        const insertLessonRequestQuery = `INSERT INTO 
          users_lesson_requests (student_id, mentor_id, subfield_id, lesson_date_time, sent_date_time) 
          VALUES ($1, $2, $3, $4, $5)`;
        const values: Array<string> = [
          lessonRequest.student?.id as string,
          mentorId as string,
          lessonRequest.subfield?.id as string,
          lessonDateTime as string,
          moment.utc().format(constants.DATE_TIME_FORMAT)
        ];
        await client.query(insertLessonRequestQuery, values);
      } else if (lessonRequest.lessonDateTime != null) {
        const updatePreviousLessonRequest = `UPDATE users_lesson_requests SET is_expired = true WHERE id = $1`;
        await client.query(updatePreviousLessonRequest, [lessonRequest.id]);            
        const insertLessonRequestQuery = `INSERT INTO 
          users_lesson_requests (student_id, mentor_id, subfield_id, lesson_date_time, sent_date_time) 
          VALUES ($1, $2, $3, $4, $5)`;
        const values: Array<string> = [
          lessonRequest.student?.id as string,
          mentorId as string,
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
    }    
  }
}

