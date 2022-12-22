import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import moment from 'moment';
import pg from 'pg';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Users } from './users';
import { UsersCourses } from './users_courses';
import { MentorsWaitingRequests } from './mentors_waiting_requests';
import { UsersPushNotifications } from './users_push_notifications';
import { UsersSendEmails } from './users_send_emails';
import MentorPartnershipRequest from '../models/mentor_partnership_request.model';
import CourseType from '../models/course_type.model';
import Course from '../models/course.model';
import CourseMentor from '../models/course_mentor.model';
import InAppMessage from '../models/in_app_message';

const conn = new Conn();
const pool = conn.pool;
const users = new Users();
const usersCourses = new UsersCourses();
const mentorsWaitingRequests = new MentorsWaitingRequests();
const usersPushNotifications = new UsersPushNotifications();
const usersSendEmails = new UsersSendEmails();

export class MentorsPartnershipRequests {
  constructor() {
    autoBind(this);
  }

  async getCurrentMentorPartnershipRequest(request: Request, response: Response): Promise<void> {
    const userId = request.user.id as string;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(constants.READ_ONLY_TRANSACTION);
      const mentorPartnershipRequest = await this.getCurrentMentorPartnershipRequestFromDB(userId, undefined, client);
      response.status(200).json(mentorPartnershipRequest);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async getCurrentMentorPartnershipRequestFromDB(userId: string | undefined, mentorPartnershipRequestId: string | undefined, client: pg.PoolClient): Promise<MentorPartnershipRequest> {
    const getMentorPartnershipRequestQuery = `SELECT mpr.id, mpr.mentor_id, mpr.partner_mentor_id, mpr.subfield_id, mpr.partner_subfield_id, mpr.course_type_id, ct.duration AS course_duration, ct.is_with_partner, ct.index, mpr.course_utc_day_of_week, mpr.course_utc_start_time, mpr.is_canceled, mpr.is_rejected, mpr.is_expired, mpr.was_canceled_shown, mpr.was_expired_shown
      FROM mentors_partnership_requests mpr
      JOIN courses_types ct
        ON mpr.course_type_id = ct.id
      WHERE mpr.id = $1 
         OR mpr.mentor_id = $2
         OR mpr.partner_mentor_id = $2
      ORDER BY mpr.sent_date_time DESC LIMIT 1`;
    const { rows }: pg.QueryResult = await client.query(getMentorPartnershipRequestQuery, [mentorPartnershipRequestId, userId]);
    let mentorPartnershipRequest: MentorPartnershipRequest = {};
    if (rows[0]) {
      const mentor = await users.getUserFromDB(rows[0].mentor_id, client);
      const mentorSubfields = mentor?.field?.subfields;
      if (mentor && mentor.field && mentorSubfields && mentorSubfields.length > 0) {
        mentor.field.subfields = mentorSubfields.filter(subfield => subfield.id == rows[0].subfield_id);
      }        
      const partnerMentor = await users.getUserFromDB(rows[0].partner_mentor_id, client);
      const partnerMentorSubfields = partnerMentor?.field?.subfields;
      if (partnerMentor && partnerMentor.field && partnerMentorSubfields && partnerMentorSubfields.length > 0) {
        partnerMentor.field.subfields = partnerMentorSubfields.filter(subfield => subfield.id == rows[0].subfield_id);
      }          
      const courseType: CourseType = {
        id: rows[0].course_type_id,
        duration: rows[0].course_duration,
        isWithPartner: rows[0].is_with_partner,
        index: rows[0].index
      };
      mentorPartnershipRequest = {
        id: rows[0].id,
        mentor: mentor,
        partnerMentor: partnerMentor,
        courseType: courseType,
        courseDayOfWeek: rows[0].course_utc_day_of_week,
        courseStartTime: rows[0].course_utc_start_time,
        sentDateTime: moment.utc(rows[0].sent_date_time).format(constants.DATE_TIME_FORMAT),
        isRejected: rows[0].is_rejected,
        isCanceled: rows[0].is_canceled,
        isExpired: rows[0].is_expired,
        wasCanceledShown: rows[0].was_canceled_shown,
        wasExpiredShown: rows[0].was_expired_shown
      }
    }
    return mentorPartnershipRequest;
  }
  
  async sendMentorPartnershipRequest(request: Request, response: Response): Promise<void> {
    const { mentor, partnerMentor, courseType, courseDayOfWeek, courseStartTime }: MentorPartnershipRequest = request.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const mentorSubfields = mentor?.field?.subfields;
      const mentorSubfield = mentorSubfields && mentorSubfields.length > 0 ? mentorSubfields[0] : {};
      const partnerMentorSubfields = partnerMentor?.field?.subfields;
      const partnerMentorSubfield = partnerMentorSubfields && partnerMentorSubfields.length > 0 ? partnerMentorSubfields[0] : {};
      const insertMentorPartnershipRequestQuery = `INSERT INTO mentors_partnership_requests 
        (mentor_id, partner_mentor_id, subfield_id, partner_subfield_id, course_type_id, course_utc_day_of_week, course_utc_start_time, sent_date_time) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;
      const values = [
        mentor?.id,
        partnerMentor?.id,
        mentorSubfield.id,
        partnerMentorSubfield.id,
        courseType?.id,
        courseDayOfWeek,
        moment(courseStartTime, 'h:ma').format('HH:mm'),
        moment.utc().format(constants.DATE_TIME_FORMAT)
      ];
      await client.query(insertMentorPartnershipRequestQuery, values);
      await mentorsWaitingRequests.deleteMentorWaitingRequest(mentor?.id as string, client);
      await mentorsWaitingRequests.deleteMentorWaitingRequest(partnerMentor?.id as string, client);
      // usersPushNotifications.sendPNPartnershipRequest(mentorPartnershipRequest);
      // usersSendEmails.sendEmailPartnershipRequest(mentorPartnershipRequest, client);
      response.status(200).send(`Mentor partnership request successfully sent`);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async acceptMentorPartnershipRequest(request: Request, response: Response): Promise<void> {
    const mentorPartnershipRequestId = request.params.id;
    const { meetingUrl }: CourseMentor = request.body
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const mentorPartnershipRequest = await this.getCurrentMentorPartnershipRequestFromDB(undefined, mentorPartnershipRequestId, client);
      const courseType = mentorPartnershipRequest?.courseType;
      const partnerMentor = mentorPartnershipRequest?.partnerMentor as CourseMentor;
      partnerMentor.meetingUrl = meetingUrl;
      const mentors = [mentorPartnershipRequest?.mentor as CourseMentor, partnerMentor];
      let courseStartDateTime = moment.utc().add(2, 'd');
      while (courseStartDateTime.format('dddd') != mentorPartnershipRequest.courseDayOfWeek) {
        courseStartDateTime = courseStartDateTime.add(1, 'd');
      }
      const hours = moment(mentorPartnershipRequest.courseStartTime, ['h:mma']).format("HH");
      const minutes = moment(mentorPartnershipRequest.courseStartTime, ['h:mma']).format("mm");
      courseStartDateTime = courseStartDateTime.set('hour', parseInt(hours)).set('minute', parseInt(minutes)).set('second', 0);      
      let course: Course = {
        type: courseType,
        mentors: mentors,
        startDateTime: courseStartDateTime.format(constants.DATE_TIME_FORMAT)
      }
      course = await usersCourses.addCourseFromDB(course, client);
      await this.deleteMentorPartnershipRequest(mentorPartnershipRequestId, client);
      response.status(200).json(course);
      await client.query('COMMIT');
      // usersPushNotifications.sendPNMentorPartnershipRequestAccepted(course);
      // usersSendEmails.sendEmailCourseScheduled(course, client);
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async deleteMentorPartnershipRequest(mentorPartnershipRequestId: string, client: pg.PoolClient): Promise<void> {
    const deleteMentorPartnershipRequestQuery = 'DELETE FROM mentors_partnership_requests WHERE id = $1';
    await client.query(deleteMentorPartnershipRequestQuery, [mentorPartnershipRequestId]);
  }
  
  async rejectMentorPartnershipRequest(request: Request, response: Response): Promise<void> {
    const mentorPartnershipRequestId = request.params.id;
    const { text }: InAppMessage = request.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const mentorPartnershipRequest = await this.getCurrentMentorPartnershipRequestFromDB(undefined, mentorPartnershipRequestId, client);
      if (!mentorPartnershipRequest.isCanceled) {
        const updateMentorPartnershipRequestQuery = 'UPDATE mentors_partnership_requests SET is_rejected = true WHERE id = $1';
        await client.query(updateMentorPartnershipRequestQuery, [mentorPartnershipRequestId]);
        await mentorsWaitingRequests.addMentorWaitingRequestFromDB(mentorPartnershipRequest.mentor?.id as string, mentorPartnershipRequest.courseType, client);
        await mentorsWaitingRequests.addMentorWaitingRequestFromDB(mentorPartnershipRequest.partnerMentor?.id as string, mentorPartnershipRequest.courseType, client);
        // usersPushNotifications.sendPNMentorPartnershipRequestRejected(mentorPartnershipRequest, text);
        // usersSendEmails.sendEmailMentorPartnershipRequestRejected(mentorPartnershipRequest, text);
      }
      response.status(200).send(`Mentor partnership request modified with ID: ${mentorPartnershipRequestId}`);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async cancelMentorPartnershipRequest(request: Request, response: Response): Promise<void> {
    const mentorPartnershipRequestId = request.params.id;
    try {
      const updateMentorPartnershipRequestQuery = 'UPDATE mentors_partnership_requests SET is_canceled = true WHERE id = $1';
      await pool.query(updateMentorPartnershipRequestQuery, [mentorPartnershipRequestId]);
      response.status(200).send(`Mentor partnership request modified with ID: ${mentorPartnershipRequestId}`);
    } catch (error) {
      response.status(400).send(error);
    }
  }

  async updateMentorPartnershipRequest(request: Request, response: Response): Promise<void> {
    const mentorPartnershipRequestId = request.params.id;
    const { wasCanceledShown, wasExpiredShown }: MentorPartnershipRequest = request.body;
    try {
      const updateMentorPartnershipRequestQuery = `UPDATE mentors_partnership_requests SET was_canceled_shown = $1, was_expired_shown = $2
        WHERE id = $3`;
      await pool.query(updateMentorPartnershipRequestQuery, [wasCanceledShown, wasExpiredShown, mentorPartnershipRequestId]);
      response.status(200).send(`Mentor partnership request modified with ID: ${mentorPartnershipRequestId}`);
    } catch (error) {
      response.status(400).send(error);
    }
  }
}

