import { Request, Response } from "express";
import pg from "pg";
import "moment-timezone";
import { Conn } from "../db/conn";
import { Helpers } from "../utils/helpers";
import PartnerMentorsSearch from "../models/partner_mentors_search.model";
import PartnerMentor from "../models/partner_mentor.model";

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();

export class AdminPartnersMentors {
  constructor() {
    helpers.autoBind(this);
  }

  async getAllMentorsOfOnePartner(
    request: Request,
    response: Response
  ): Promise<void> {
    const partnerId = request.params.partner_id;
    const searchParameters: PartnerMentorsSearch =
      request.body;
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
    const { searchString, courseFromDate, courseToDate, searchByName, searchByEmail, searchByStudent, searchByStudentOrganization }: PartnerMentorsSearch = searchParameters;
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

    let allMentorsOfOnePartnerQuery = `
      with
        mentor_courses as
        (
          select ucm.mentor_id, count(*) as courses_count
          from users_courses_mentors ucm
          inner join users_courses uc on uc.id = ucm.course_id
          inner join course_types ct on uc.course_type_id = ct.id
          ${whereFromToCondition}
          group by 1
        ),
        mentor_courses_students as
        (
          select ucm.mentor_id, count(*) as students_count, string_agg(distinct u.name, ', ') as student_names, string_agg(distinct o.name, ', ') as student_organization_names
          from users_courses_mentors ucm
          inner join users_courses uc on uc.id = ucm.course_id
          inner join users_courses_students ucs on uc.id = ucs.course_id
          inner join users u on ucs.student_id = u.id
          inner join organizations o on u.organization_id = o.id
          inner join course_types ct on uc.course_type_id = ct.id
          where (ucs.course_id, ucs.student_id) not in (select course_id, user_id from users_courses_lessons_canceled where course_id = uc.id)
          and (ucs.is_canceled is null or ucs.is_canceled = false)
          ${andFromToCondition}
          group by 1
        ),
        mentor_courses_lessons as
        (
          select ucm.mentor_id, sum(round(ct.duration*30.0/7)) as lessons_count
          from users_courses_mentors ucm
          inner join users_courses uc on uc.id = ucm.course_id
          inner join course_types ct on ct.id = uc.course_type_id
          ${whereFromToCondition}
          group by 1
        ),
        mentor_courses_lessons_cancelled as
        (
          select ucm.mentor_id, count(*) as cancelled_lessons_count
          from users_courses_mentors ucm
          inner join users_courses uc on uc.id = ucm.course_id
          inner join course_types ct on ct.id = uc.course_type_id
          inner join users_courses_lessons_canceled uclc on uc.id = uclc.course_id
          where not exists
          (
            select 1
            from users_courses_students
            where (course_id, student_id) not in (select course_id, user_id from users_courses_lessons_canceled where course_id = uclc.course_id and lesson_date_time = uclc.lesson_date_time)
          )
          ${andFromToCondition}
          group by 1
        )
      select
        u.name as full_name,
        u.email,
        coalesce(mc.courses_count, 0) as number_of_courses,
        coalesce(mcs.students_count, 0) as number_of_students,
        coalesce(mcs.student_names, '') as student_names,
        coalesce(mcs.student_organization_names, '') as student_organization_names,
        coalesce(mcl.lessons_count, 0) - coalesce(mclc.cancelled_lessons_count, 0) as number_of_lessons
      from users u
      left outer join mentor_courses mc on u.id = mc.mentor_id
      left outer join mentor_courses_students mcs on u.id = mcs.mentor_id
      left outer join mentor_courses_lessons mcl on u.id = mcl.mentor_id
      left outer join mentor_courses_lessons_cancelled mclc on u.id = mclc.mentor_id
      where u.is_mentor
      and u.organization_id = '${partnerId}'
    `;

    allMentorsOfOnePartnerQuery += " order by u.name";

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