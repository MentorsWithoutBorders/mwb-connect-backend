import {Request, Response} from "express";
import pg from "pg";
import "moment-timezone";
import {Conn} from "../db/conn";
import {Helpers} from "../utils/helpers";
import {PartnerStudentSearch} from "../models/partner_student_search.model";
import {filterRowsBySearchParams} from "../models/partner_student.model.utils";
import {PartnerStudent, StudentCertificationStatus} from "../models/partner_student.model";

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();

export class AdminPartnersStudents {
  constructor() {
    helpers.autoBind(this);
  }

  async getAllStudentsOfOnePartner(
    request: Request,
    response: Response
  ): Promise<void> {
    const {partner_id: partnerId} = request.params;
    const searchParameters: PartnerStudentSearch = request.query;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const students = await this.getAllStudentsOfOnePartnerFromDB(
        partnerId,
        searchParameters,
        client
      );
      response.status(200).json(students);
      await client.query("COMMIT");
    } catch (error) {
      console.log("getAllStudentsOfOnePartner", error)
      response.status(400).send(error);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  }

  private async getAllStudentsOfOnePartnerFromDB(
    partnerId: string,
    searchParameters: PartnerStudentSearch,
    client: pg.PoolClient
  ) {
    const {
      courseFromDate,
      courseToDate,
    } = searchParameters;
    let whereFromToDateCondition = "";
    let fromToDateCondition = "";

    if (courseFromDate || courseToDate) {
      if (courseFromDate && courseToDate) {
        fromToDateCondition = `(
          (uc.start_date_time between '${courseFromDate}' AND '${courseToDate}')
          OR (uc.start_date_time + (ct.duration * INTERVAL '1 month') between '${courseFromDate}' and '${courseToDate}')
       )
      `;
      } else if (courseFromDate && !courseToDate) {
        // If only from date is provided, we will take all courses that end after that date
        fromToDateCondition = `(uc.start_date_time + (ct.duration * INTERVAL '1 month') > '${courseFromDate}')`;
      } else if (!courseFromDate && courseToDate) {
        // If only to date is provided, we will take all courses that begin before that date
        fromToDateCondition = `(uc.start_date_time < '${courseToDate}')`;
      }
      whereFromToDateCondition = ` WHERE ${fromToDateCondition} `;
    }
    const allStudentsOfOnePartnerQuery = `
      WITH
        student_courses AS
        (
          SELECT 
            ucs.student_id,
            COUNT(*) AS courses_count
          FROM users_courses_students ucs
          INNER JOIN
            users_courses uc ON uc.id = ucs.course_id
          INNER JOIN 
            course_types ct ON uc.course_type_id = ct.id
          INNER JOIN 
            users u ON ucs.student_id = u.id
          GROUP BY 
            ucs.student_id
        ),
        student_organization AS
        (
          SELECT 
            organizations.id,
            organizations.name
          FROM users
          INNER JOIN 
            organizations ON users.organization_id = organizations.id
        ),
        student_status AS
        (
          SELECT 
            users.id AS student_id,
            CASE
              WHEN admin_students_certificates.is_certificate_sent = true 
                THEN '${StudentCertificationStatus.Sent}'
              WHEN admin_students_certificates.is_certificate_sent = false 
                THEN '${StudentCertificationStatus.InProgress}'
              WHEN users_app_flags.is_training_enabled = false AND users_app_flags.is_mentoring_enabled = FALSE 
                THEN '${StudentCertificationStatus.Cancelled}'
              ELSE 
                '${StudentCertificationStatus.Unknown}'
            END AS status
          FROM users
          LEFT JOIN 
            admin_students_certificates ON users.id = admin_students_certificates.user_id
          LEFT JOIN 
            users_app_flags on users.id = users_app_flags.user_id
        ),
        testimonials AS
        (
          SELECT 
            users.id,
                CASE 
                  WHEN count(testimonial_objects) = 0 THEN '[]'::jsonb
                  ELSE jsonb_agg(testimonial_objects) 
                END AS testimonials
          FROM users
          LEFT JOIN (
            SELECT 
              students_testimonials.user_id,
              jsonb_build_object(
                'url', students_testimonials.url,
                'uploadedDateTime', students_testimonials.uploaded_date_time
              ) as testimonial_objects
            FROM students_testimonials
            WHERE students_testimonials IS NOT null
          ) AS testimonials_subquery on users.id = testimonials_subquery.user_id
          GROUP BY
            users.id
        )
      
      SELECT
        users.id,
        users.name,
        users.email,
        users.phone_number AS "phoneNumber",
        coalesce(sc.courses_count, 0) AS "totalCoursesAttended",
        coalesce(so.name, '') AS "organizationName",
        coalesce(ss.status, '${StudentCertificationStatus.Unknown}') AS "certificationStatus",
        coalesce(t.testimonials, '[]'::jsonb) AS testimonials
      FROM users 
      
      LEFT OUTER JOIN student_courses sc on users.id = sc.student_id
      LEFT OUTER JOIN student_status ss on users.id = ss.student_id
      LEFT OUTER JOIN student_organization so on users.organization_id = so.id
      LEFT OUTER JOIN testimonials t on users.id = t.id

      WHERE users.is_mentor = false
      AND users.organization_id = '${partnerId}'
      ${whereFromToDateCondition}
      GROUP BY
        users.id,
        sc.courses_count,
        so.name,
        ss.status,
        t.testimonials
    `;

    const {rows}: pg.QueryResult<PartnerStudent> = await client.query(
      allStudentsOfOnePartnerQuery
    );

    return filterRowsBySearchParams({rows, searchParameters});
  }
}
