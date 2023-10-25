import { Request, Response } from "express";
import pg from "pg";
import "moment-timezone";
import { Conn } from "../db/conn";
import { Helpers, getCourseCompletedWeeks } from "../utils/helpers";
import PartnerMentorsSearch from "../models/partner_mentors_search.model";
import PartnerMentor, {
  MentorDetailsDbRawResult,
  MentorDetailsResponse,
} from "../models/partner_mentor.model";

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();

export class AdminPartnersMentors {
  constructor() {
    helpers.autoBind(this);
  }

  async getMentorDetails(
    req: Request<{ partner_id: string; mentor_id: string }>,
    res: Response<MentorDetailsResponse | Error>
  ) {
    const { partner_id: orgId, mentor_id: mentorId } = req.params;

    if (orgId !== req.user.orgId) {
      throw new Error(
        "Only organization members can access it's mentors' details"
      );
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows }: pg.QueryResult<MentorDetailsDbRawResult> =
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
        WHERE u.id='${mentorId}' AND u.organization_id='${orgId}'
        GROUP BY u.id, u.name, u.email;
      `);

      if (!rows[0]) {
        throw new Error("Record not found!");
      }

      const formattedResponse: MentorDetailsResponse = {
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
                  uploadDate: uploaded_date_time,
                })
              ),
            })),
          })
        ),
      };

      res.status(200).json(formattedResponse);
      await client.query("COMMIT");
    } catch (error) {
      console.error(error);
      res.status(400).send(error as Error);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  }

  async getAllMentorsOfOnePartner(
    request: Request,
    response: Response
  ): Promise<void> {
    const partnerId = request.params.partner_id;
    const searchParameters: PartnerMentorsSearch = request.query;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const mentors = await this.getAllMentorsOfOnePartnerFromDB(
        partnerId,
        searchParameters,
        client
      );
      response.status(200).json(mentors);
      await client.query("COMMIT");
    } catch (error) {
      response.status(400).send(error);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  }

  async getAllMentorsOfOnePartnerFromDB(
    partnerId: string,
    searchParameters: PartnerMentorsSearch,
    client: pg.PoolClient
  ): Promise<Array<PartnerMentor>> {
    const { searchString, courseFromDate, courseToDate }: PartnerMentorsSearch =
      searchParameters;
    const searchByName = searchParameters.searchByName === "true";
    const searchByEmail = searchParameters.searchByEmail === "true";
    const searchByStudent = searchParameters.searchByStudent === "true";
    const searchByStudentOrganization =
      searchParameters.searchByStudentOrganization === "true";

    let andFromToCondition = "";
    let whereFromToCondition = "";
    let fromToCondition = "";

    if (courseFromDate || courseToDate) {
      if (courseFromDate && courseToDate) {
        fromToCondition = `(
          (uc.start_date_time BETWEEN '${courseFromDate}' AND '${courseToDate}')
          OR (uc.start_date_time + (ct.duration * INTERVAL '1 month') BETWEEN '${courseFromDate}' AND '${courseToDate}')
       )
      `;
      } else if (courseFromDate && !courseToDate) {
        // If only from date is provided, we will take all courses that end after that date
        fromToCondition = `(uc.start_date_time + (ct.duration * INTERVAL '1 month') > '${courseFromDate}')`;
      } else if (!courseFromDate && courseToDate) {
        // If only to date is provided, we will take all courses that begin before that date
        fromToCondition = `(uc.start_date_time < '${courseToDate}')`;
      }
      andFromToCondition = ` AND ${fromToCondition} `;
      whereFromToCondition = ` WHERE ${fromToCondition} `;
    }

    let allMentorsOfOnePartnerQuery = `
      WITH
        mentor_courses AS
        (
          SELECT ucm.mentor_id, count(*) AS courses_count
          FROM users_courses_mentors ucm
          INNER JOIN users_courses uc ON uc.id = ucm.course_id
          INNER JOIN course_types ct ON uc.course_type_id = ct.id
          ${whereFromToCondition}
          GROUP BY 1
        ),
        mentor_courses_students AS
        (
          SELECT ucm.mentor_id, COUNT(*) AS students_count, STRING_AGG(DISTINCT u.name, ', ') AS student_names, STRING_AGG(DISTINCT o.name, ', ') AS student_organization_names
          FROM users_courses_mentors ucm
          INNER JOIN users_courses uc ON uc.id = ucm.course_id
          INNER JOIN users_courses_students ucs ON uc.id = ucs.course_id
          INNER JOIN users u ON ucs.student_id = u.id
          INNER JOIN organizations o ON u.organization_id = o.id
          INNER JOIN course_types ct ON uc.course_type_id = ct.id
          WHERE (ucs.course_id, ucs.student_id) NOT IN (SELECT course_id, user_id FROM users_courses_lessons_canceled WHERE course_id = uc.id)
          AND (ucs.is_canceled IS NULL or ucs.is_canceled = false)
          ${andFromToCondition}
          GROUP BY 1
        ),
        mentor_courses_lessons AS
        (
          SELECT ucm.mentor_id, sum(round((ct.duration*30)/7) + (ct.duration)/3 + 1) AS lessons_count
          FROM users_courses_mentors ucm
          INNER JOIN users_courses uc ON uc.id = ucm.course_id
          INNER JOIN course_types ct ON ct.id = uc.course_type_id
          ${whereFromToCondition}
          GROUP BY 1
        ),
        mentor_courses_lessons_cancelled AS
        (
          SELECT ucm.mentor_id, COUNT(*) AS cancelled_lessons_count
          FROM users_courses_mentors ucm
          INNER JOIN users_courses uc ON uc.id = ucm.course_id
          INNER JOIN course_types ct ON ct.id = uc.course_type_id
          INNER JOIN users_courses_lessons_canceled uclc ON uc.id = uclc.course_id
          WHERE NOT EXISTS
          (
            SELECT 1
            FROM users_courses_students
            WHERE (course_id, student_id) NOT IN (SELECT course_id, user_id FROM users_courses_lessons_canceled WHERE course_id = uclc.course_id AND lesson_date_time = uclc.lesson_date_time)
          )
          ${andFromToCondition}
          GROUP BY 1
        )
      SELECT
        u.id,
        u.name AS full_name,
        u.email,
        COALESCE(mc.courses_count, 0) AS number_of_courses,
        COALESCE(mcs.students_count, 0) AS number_of_students,
        COALESCE(mcs.student_names, '') AS student_names,
        COALESCE(mcs.student_organization_names, '') AS student_organization_names,
        COALESCE(mcl.lessons_count, 0) - COALESCE(mclc.cancelled_lessons_count, 0) AS number_of_lessons
      FROM users u
      LEFT OUTER JOIN mentor_courses mc ON u.id = mc.mentor_id
      LEFT OUTER JOIN mentor_courses_students mcs ON u.id = mcs.mentor_id
      LEFT OUTER JOIN mentor_courses_lessons mcl ON u.id = mcl.mentor_id
      LEFT OUTER JOIN mentor_courses_lessons_cancelled mclc ON u.id = mclc.mentor_id
      WHERE u.is_mentor
      AND u.organization_id = '${partnerId}'
    `;

    allMentorsOfOnePartnerQuery += " ORDER BY u.name";

    const { rows }: pg.QueryResult = await client.query(
      allMentorsOfOnePartnerQuery
    );

    const mentors: Array<PartnerMentor> = [];

    const lowerSearchString = searchString ? searchString.toLowerCase() : null;

    for (const row of rows) {
      if (searchString) {
        let shouldIncludeRow = false;

        // If none of the 4 parameters are passed, search by name only
        if (!searchByName && !searchByEmail && !searchByStudent && !searchByStudentOrganization) {
          shouldIncludeRow = row.full_name.toLowerCase().includes(lowerSearchString);
        } else {
          if (searchByName && row.full_name.toLowerCase().includes(lowerSearchString)) {
            shouldIncludeRow = true;
          }
          if (searchByEmail && row.email.toLowerCase().includes(lowerSearchString)) {
            shouldIncludeRow = true;
          }
          if (searchByStudent && row.student_names.toLowerCase().includes(lowerSearchString)) {
            shouldIncludeRow = true;
          }
          if (searchByStudentOrganization && row.student_organization_names.toLowerCase().includes(lowerSearchString)) {
            shouldIncludeRow = true;
          }
        }

        if (!shouldIncludeRow) {
          continue; // Skip to next iteration if row does not match search criteria
        }
      }

      const mentor: PartnerMentor = {
        id: row.id,
        name: row.full_name,
        email: row.email,
        courses: row.number_of_courses,
        students: row.number_of_students,
        hours: row.number_of_lessons,
      };

      mentors.push(mentor);
    }

    return mentors;
  }
}
