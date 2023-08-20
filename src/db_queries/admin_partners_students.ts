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
    const searchParameters: PartnerStudentSearch = request.body;

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
    let andFromToCondition = "";
    let whereFromToCondition = "";
    let fromToCondition = "";

    if (courseFromDate || courseToDate) {
      if (courseFromDate && courseToDate) {
        fromToCondition = `(
          (uc.start_date_time between '${courseFromDate}' and '${courseToDate}')
          or (uc.start_date_time + (ct.duration * INTERVAL '1 month') between '${courseFromDate}' and '${courseToDate}')
       )
      `;
      } else if (courseFromDate && !courseToDate) {
        // If only from date is provided, we will take all courses that end after that date
        fromToCondition = `(uc.start_date_time + (ct.duration * INTERVAL '1 month') > '${courseFromDate}')`;
      } else if (!courseFromDate && courseToDate) {
        // If only to date is provided, we will take all courses that begin before that date
        fromToCondition = `(uc.start_date_time < '${courseToDate}')`;
      }
      andFromToCondition = ` and ${fromToCondition} `;
      whereFromToCondition = ` where ${fromToCondition} `;
    }
    const allStudentsOfOnePartnerQuery = `
      with
        student_courses as
        (
          select 
            ucs.student_id,
            COUNT(*) as courses_count,
            orgs.name as student_organization_name
          from users_courses_students ucs
          inner join 
            users_courses uc on uc.id = ucs.course_id
          inner join 
            course_types ct on uc.course_type_id = ct.id
          inner join 
            users u ON ucs.student_id = u.id
          inner join 
            organizations orgs on u.organization_id = orgs.id
          group by 
            ucs.student_id,
            orgs.name
        ),
        student_status as
        (
          select 
            users.id as student_id,
            case
              when admin_students_certificates.is_certificate_sent = true 
                then '${StudentCertificationStatus.Sent}'
              when admin_students_certificates.is_certificate_sent = false 
                then '${StudentCertificationStatus.InProgress}'
              when users_app_flags.is_training_enabled = false and users_app_flags.is_mentoring_enabled = FALSE 
                then '${StudentCertificationStatus.Cancelled}'
              else 
                '${StudentCertificationStatus.Unknown}'
            end as status
          from users
          left join 
            admin_students_certificates on users.id = admin_students_certificates.user_id
          left join 
            users_app_flags on users.id = users_app_flags.user_id
        ),
        testimonials as
        (
          select 
            users.id,
                case 
                  when count(testimonial_objects) = 0 then '[]'::jsonb
                  else jsonb_agg(testimonial_objects) 
                end as testimonials
          from users
          left join (
            select 
              students_testimonials.user_id,
              jsonb_build_object(
                'url', students_testimonials.url,
                'uploadedDateTime', students_testimonials.uploaded_date_time
              ) as testimonial_objects
            from students_testimonials
            where students_testimonials is not null
          ) as testimonials_subquery on users.id = testimonials_subquery.user_id
          group by
            users.id
        )
      select
        users.name,
        users.email,
        users.phone_number as "phoneNumber",
        coalesce(sc.courses_count, 0) as "totalCoursesAttended",
        coalesce(ss.status, '${StudentCertificationStatus.Unknown}'}) as "certificationStatus",
        coalesce(sc.student_organization_name, '') AS "organizationName",
        coalesce(t.testimonials, '[]'::jsonb) as testimonials
        
      from users 
      
      left outer join student_courses sc on users.id = sc.student_id
      left outer join student_status ss on users.id = ss.student_id
      left outer join testimonials t on users.id = t.id

      where users.is_mentor = false
      and users.organization_id = '${partnerId}'
    `;

    const {rows}: pg.QueryResult<PartnerStudent> = await client.query(
      allStudentsOfOnePartnerQuery
    );

    return filterRowsBySearchParams({rows, searchParameters});
  }
}
