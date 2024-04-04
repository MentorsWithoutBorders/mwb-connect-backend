import { Request, Response } from 'express';
import pg from 'pg';
import 'moment-timezone';
import { Conn } from '../db/conn';
import { Helpers, getCourseCompletedWeeks } from '../utils/helpers';
import {
  MentorDetailsWithProjectsDbRawResult,
  MentorDetailsWithProjectsResponse
} from '../models/partner_mentor.model';

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();

export class AdminPartnersMentorsProjects {
  constructor() {
    helpers.autoBind(this);
  }

  async getMentorProjectDetails(
    req: Request<{ partner_id: string; mentor_id: string }>,
    res: Response<MentorDetailsWithProjectsResponse | Error>
  ) {
    const { partner_id: orgId, mentor_id: mentorId } = req.params;

    if (orgId !== req.user.orgId) {
      throw new Error(
        "Only organization members can access it's mentors' details"
      );
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { rows }: pg.QueryResult<MentorDetailsWithProjectsDbRawResult> =
        await client.query(`
        SELECT
          u.id,
          u.name,
          u.email,
          CASE
            WHEN bool_or(mentor_course_details.id IS NOT NULL)
            THEN jsonb_agg(mentor_course_details)
            ELSE '[]'
          END AS courses
        FROM users u
        LEFT JOIN users_courses_mentors ucm ON u.id = ucm.mentor_id
        LEFT JOIN (
          SELECT
            uc.id,
            uc.start_date_time,
            ct.duration,
            uclc.canceled_date_time,
            CASE
              WHEN bool_or(course_student_details.id IS NOT NULL)
              THEN jsonb_agg(course_student_details)
              ELSE '[]'
            END AS students,
            CASE
              WHEN p.id IS NOT NULL THEN jsonb_build_object('id', p.id, 'name', p.name)
              ELSE NULL
            END AS project
          FROM users_courses uc
          LEFT JOIN users_courses_students ucs ON uc.id = ucs.course_id
          LEFT JOIN users_courses_lessons_canceled uclc ON uclc.course_id = ucs.course_id
          LEFT JOIN (
            SELECT
              s.id,
              s.name,
              s.email,
              CASE
                WHEN bool_or(st.id IS NOT NULL)
                THEN jsonb_agg(st)
                ELSE '[]'
              END AS testimonials
            FROM users s
            LEFT JOIN students_testimonials st ON s.id = st.user_id
            GROUP BY s.id, s.name, s.email
          ) AS course_student_details ON ucs.student_id = course_student_details.id
          LEFT JOIN course_types ct ON uc.course_type_id = ct.id
          LEFT JOIN projects_courses pc ON uc.id = pc.course_id
          LEFT JOIN projects p ON pc.project_id = p.id
          GROUP BY uc.id, uc.start_date_time, ct.duration, uclc.canceled_date_time, p.id, p.name
        ) AS mentor_course_details ON ucm.course_id = mentor_course_details.id
        LEFT JOIN (
          SELECT id, name
          FROM projects
          WHERE organization_id =	${orgId}
        )
        WHERE u.id='${mentorId}' AND u.organization_id='${orgId}'
        GROUP BY u.id, u.name, u.email;
      `);

      if (!rows[0]) {
        throw new Error('Record not found!');
      }

      const formattedResponse: MentorDetailsWithProjectsResponse = {
        ...rows[0],
        courses: rows[0].courses.map(
          ({ start_date_time, canceled_date_time, ...course }) => ({
            ...course,
            completedHours: getCourseCompletedWeeks(
              start_date_time,
              course.duration,
              canceled_date_time
            ),
            startDate: start_date_time,
            canceledDate: canceled_date_time,
            students: course.students.map(({ testimonials, ...student }) => ({
              ...student,
              testimonials: testimonials.map(
                ({ uploaded_date_time, ...testimonial }) => ({
                  ...testimonial,
                  uploadDate: uploaded_date_time
                })
              )
            }))
          })
        ),
        projects: rows[0].projects
      };

      res.status(200).json(formattedResponse);
      await client.query('COMMIT');
    } catch (error) {
      console.error(error);
      res.status(400).send(error as Error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }
}
