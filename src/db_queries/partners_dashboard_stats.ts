import { Request, Response } from "express";
import { PoolClient } from "pg";
import moment, { Moment } from "moment";
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

function getStartEndOfYear(year?: number) {
  if (!year) return [undefined, undefined];
  return [
    moment(year, "YYYY").startOf("year"),
    moment(year, "YYYY").endOf("year"),
  ] satisfies [Moment, Moment];
}

async function getNgoStats(
  client: PoolClient,
  {
    orgId,
    startDate,
    endDate,
  }: {
    orgId?: string;
    startDate?: number | Date | Moment;
    endDate?: number | Date | Moment;
  }
): Promise<NgoStats> {
  // We currently don't have orgId in courses table
  // so need to use JOIN (course_student.student_id -> user.id)

  const endDateIso =
    endDate && moment.min(moment(endDate), moment()).toISOString(); // shouldn't be more than current time

  const endDateQuery = `
    LEAST(
      uclc.canceled_date_time,
      uc.start_date_time + INTERVAL '1 month' * ct.duration
      ${endDateIso ? `, '${endDateIso}'` : ""}
    )
  `;

  const startDateQuery = `
    GREATEST(
      uc.start_date_time
      ${startDate ? `, '${moment(startDate).toISOString()}'` : ""}
    )
  `;

  // 1 week = 1 hour
  // using GREATEST to cap at 0 bcz if endDateQuery result is less than provided startDate input, difference would be negative
  const noOfWeeksQuery = `
    GREATEST(CEIL(EXTRACT(days FROM (${endDateQuery} - ${startDateQuery})) / 7), 0)
  `;

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
        COALESCE(SUM(${noOfWeeksQuery}), 0) total_hours
      FROM
        users_courses_students ucs
        ${orgId ? "JOIN users u ON u.id = ucs.student_id" : ""}
        JOIN users_courses uc ON uc.id = ucs.course_id
        JOIN course_types ct ON ct.id = uc.course_type_id
        LEFT JOIN users_courses_lessons_canceled uclc ON uclc.course_id = ucs.course_id
      WHERE
        ucs.is_canceled IS NOT true
        ${orgId ? `AND u.organization_id = '${orgId}'` : ""}
        ${
          startDate
            ? `AND uc.start_date_time >= '${moment(startDate).toISOString()}'`
            : ""
        }
        ${
          endDateIso
            ? `AND uc.start_date_time + INTERVAL '1 month' * ct.duration <= '${endDateIso}'`
            : ""
        }
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

      const [startDate, endDate] = getStartEndOfYear(
        request.query.year ? +request.query.year : undefined
      );
      const ngoStats = await getNgoStats(client, { startDate, endDate });
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

      const [startDate, endDate] = getStartEndOfYear(
        request.query.year ? +request.query.year : undefined
      );
      const ngoStats = await getNgoStats(client, { orgId, startDate, endDate });
      response.status(200).json({ ngoStats });

      await client.query("COMMIT");
    } catch (err) {
      console.error(err);
      response.status(400).send(err as Error);
      await client.query("ROLLBACK");
    }
  }
}
