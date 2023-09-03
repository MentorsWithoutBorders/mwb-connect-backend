import { Request, Response } from "express";
import pg from "pg";
import "moment-timezone";
import { Conn } from "../db/conn";
import { Helpers } from "../utils/helpers";
import { PartnerCentersSearch } from "../models/partner_organization_centres.model";


const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();

const deriveQuery = ({ fromDate, toDate }: PartnerCentersSearch, partnerId?: string) => {
  let whereFromToDateCondition = "";
  const andPartnerIdCondition = partnerId ? ` AND oc.organization_id = '${partnerId}'` : "";

  if (fromDate || toDate) {
    if (fromDate && toDate) {
      whereFromToDateCondition = `(
          (uc.start_date_time between '${fromDate}' AND ${toDate}')
          OR (uc.start_date_time + (ct.duration * INTERVAL '1 month') between '${fromDate}' and '${toDate}')
       )
      `;
    } else if (fromDate && !toDate) {
      // If only from date is provided, we will take all courses that end after that date
      whereFromToDateCondition = `(uc.start_date_time + (ct.duration * INTERVAL '1 month') > '${fromDate}')`;
    } else if (!fromDate && toDate) {
      // If only to date is provided, we will take all courses that begin before that date
      whereFromToDateCondition = `(uc.start_date_time < '${toDate}')`;
    }
    whereFromToDateCondition = ` WHERE ${whereFromToDateCondition} `;
  }
  return `
    WITH student_courses AS (
      SELECT 
        ucs.student_id,
        COUNT(*) AS courses_count
      FROM users_courses_students ucs
      INNER JOIN users_courses uc ON uc.id = ucs.course_id
      INNER JOIN course_types ct ON uc.course_type_id = ct.id
      INNER JOIN users u ON ucs.student_id = u.id
      ${whereFromToDateCondition}
      GROUP BY 
        ucs.student_id
    )
    SELECT 
      oc.*,
      json_agg(json_build_object('id', u.id, 'name', u.name)) AS students
    FROM organizations_centres AS oc
    JOIN users AS u ON oc.organization_id = u.organization_id
    JOIN users_courses_students AS ucs ON ucs.student_id = u.id
    LEFT JOIN student_courses AS sc ON sc.student_id = u.id
    WHERE ucs.id IS NOT NULL
    ${andPartnerIdCondition}
    GROUP BY oc.id
    HAVING COUNT(sc.courses_count) >= 1;
    `;

}

export class AdminPartnersOrganizationCentres {
  constructor() {
    helpers.autoBind(this);
  }

  async getDashboardOrganizationCentres(
    request: Request,
    response: Response
  ): Promise<void> {
    const searchParameters: PartnerCentersSearch = request.query;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const students = await this.getDashboardOrganizationCentresFromDB(
        searchParameters,
        client
      );
      response.status(200).json(students);
      await client.query("COMMIT");
    } catch (error) {
      console.log("getDashboardOrganizationCentresFromDB", error)
      response.status(400).send(error);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  }

  async getDashboardOrganizationCentresByPartnerId(
    request: Request,
    response: Response
  ): Promise<void> {
    const { partner_id: partnerId } = request.params;
    const searchParameters: PartnerCentersSearch = request.body;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const students = await this.getDashboardOrganizationCentresByPartnerIdFromDB(
        partnerId,
        searchParameters,
        client
      );
      response.status(200).json(students);
      await client.query("COMMIT");
    } catch (error) {
      console.log("getDashboardOrganizationCentresByPartnerIdFromDB", error)
      response.status(400).send(error);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  }

  private async getDashboardOrganizationCentresFromDB(
    searchParameters: PartnerCentersSearch,
    client: pg.PoolClient
  ) {
    const { fromDate, toDate, } = searchParameters;
    const getAllOrganizationCentersWithOneStudentQuery = deriveQuery({ fromDate, toDate });

    const { rows }: pg.QueryResult = await client.query(getAllOrganizationCentersWithOneStudentQuery);
    return rows;
  }

  private async getDashboardOrganizationCentresByPartnerIdFromDB(
    partnerId: string,
    searchParameters: PartnerCentersSearch,
    client: pg.PoolClient
  ) {
    const { fromDate, toDate } = searchParameters;
    const getAllOrganizationCentersWithOneStudentQuery = deriveQuery({ fromDate, toDate }, partnerId);

    const { rows }: pg.QueryResult = await client.query(getAllOrganizationCentersWithOneStudentQuery);
    return rows;
  }
}
