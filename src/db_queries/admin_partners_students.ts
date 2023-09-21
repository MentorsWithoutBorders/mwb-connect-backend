import { Request, Response } from "express";
import pg from "pg";
import "moment-timezone";
import { Conn } from "../db/conn";
import { Helpers } from "../utils/helpers";
import PartnerStudentsSearch from "../models/partner_mentors_search.model";
import PartnerStudent from "../models/partner_student.model";

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
    const partnerId = request.params.partner_id;
    const searchParameters: PartnerStudentsSearch =
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
    searchParameters: PartnerStudentsSearch,
    client: pg.PoolClient
  ): Promise<Array<PartnerStudent>> {
    const queryParams = [];
    let additionalWhereConditions = '';

    // TODO: Filter also by 'certificateStatus' (sent | in-progress | canceled).
    const { name, email }: PartnerStudentsSearch = searchParameters;
    if(name) {
      queryParams.push(`%${name}%`)
      additionalWhereConditions += ` AND u.name LIKE $${queryParams.length}`
    }
    if(email) {
      queryParams.push(`%${email}%`)
      additionalWhereConditions += ` AND u.email LIKE $${queryParams.length}`
    }

    queryParams.push(partnerId)
    additionalWhereConditions += ` AND u.organization_id = $${queryParams.length}`

    queryParams.push(name)
    const queryText = `
      SELECT
        u.id,
        u.name,
        u.email,
        u.phone_number,
        count(ucs.course_id) AS courses_count,
      FROM users u
      LEFT OUTER JOIN users_courses_students ucs ON u.id = ucs.student_id 
      
      WHERE NOT u.is_mentor 
      ${additionalWhereConditions}
      
      GROUP BY u.id 
      ORDER BY u.name ASC
    `;

    // TODO: Remove the following examples.
    // SELECT * FROM users u WHERE NOT u.is_mentor AND u.organization_id = '82360ca6-ce95-45f6-a0e3-1c846ee5616b'
    // SELECT u.*, count(ucs.course_id) as courses_count FROM users u LEFT JOIN users_courses_students ucs ON u.id = ucs.student_id WHERE NOT u.is_mentor GROUP BY u.id ORDER BY u.name ASC

    const { rows }: pg.QueryResult = await client.query(
      queryText, queryValues
    );

    const students: Array<PartnerStudent> = [];

    for (const row of rows) {
      const student: PartnerStudent = {
        id: row.id,
        name: row.name,
        email: row.email,
        phoneNumber: row.phone_number,
        coursesCount: row.courses_count,
      };

      students.push(student);
    }

    return students;
  }
}
