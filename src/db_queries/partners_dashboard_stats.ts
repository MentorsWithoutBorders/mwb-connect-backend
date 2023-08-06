import { Request, Response } from "express";
import { PoolClient } from "pg";
import { Conn } from "../db/conn";
import { constants } from "../utils/constants";

const pool = new Conn().pool;

interface NgoStats {
  /** total students who have enrolled in at least one course and who haven't cancelled it */
  totalStudents: number;
  /** total courses in which the students have enrolled (completed + not completed) */
  totalCourses: number;
  /** total hours corresponding to the lessons that haven't been cancelled in the courses (1h per lesson) */
  totalHours: number;
}

async function getNgoStats(
  client: PoolClient,
  { orgId, year }: { orgId?: string; year?: number }
): Promise<NgoStats> {
  // We currently don't have orgId in courses table
  // so need to use JOIN (course_student.student_id -> user.id)

  const {
    rows: [
      {
        total_students: totalStudents,
        total_courses: totalCourses,
        total_hours: totalHours,
      },
    ],
  } = await client.query<{
    total_students: number;
    total_courses: number;
    total_hours: number;
  }>(`
      SELECT
        COUNT(DISTINCT ucs.student_id) total_students,
        COUNT(DISTINCT ucs.course_id) total_courses,
        COALESCE(SUM(CASE WHEN ct.duration = 3 THEN 14 WHEN ct.duration = 6 THEN 28 ELSE 0 END), 0) total_hours
      FROM
        users_courses_students ucs
        ${orgId ? "JOIN users u ON u.id = ucs.student_id" : ""}
        JOIN users_courses uc ON uc.id = ucs.course_id
        JOIN course_types ct ON ct.id = uc.course_type_id
      WHERE
        ucs.is_canceled IS NOT true
        ${year ? `AND date_part('year', uc.start_date_time) = ${year}` : ""}
        ${orgId ? `AND u.organization_id = '${orgId}'` : ""}
    `);

  return { totalStudents, totalCourses, totalHours };
}

export class PartnersDashboardStats {
  async getDashboardStats(
    request: Request,
    response: Response<{ ngoStats: NgoStats } | Error>
  ) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query(constants.READ_ONLY_TRANSACTION);

      if (!request.user.orgId) {
        throw new Error(
          "You need to be part of any organization to access the stats!"
        );
      }

      const ngoStats = await getNgoStats(client, {
        year: request.query.year ? +request.query.year : undefined,
      });
      response.status(200).json({ ngoStats });

      await client.query("COMMIT");
    } catch (err) {
      console.error(err);
      response.status(400).send(err as Error);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  }

  async getDashboardStatsByPartnerId(
    request: Request<{ partner_id: string }>,
    response: Response<{ ngoStats: NgoStats } | Error>
  ) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(constants.READ_ONLY_TRANSACTION);

      const orgId = request.params.partner_id;
      if (orgId !== request.user.orgId) {
        throw new Error("Only organization members can access it's stats");
      }

      const ngoStats = await getNgoStats(client, {
        orgId,
        year: request.query.year ? +request.query.year : undefined,
      });
      response.status(200).json({ ngoStats });

      await client.query("COMMIT");
    } catch (err) {
      console.error(err);
      response.status(400).send(err as Error);
      await client.query("ROLLBACK");
    }
  }
}
