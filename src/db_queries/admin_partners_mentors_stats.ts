import { Request, Response } from "express";
import pg from "pg";
import "moment-timezone";
import { Conn } from "../db/conn";
import { Helpers } from "../utils/helpers";
import PartnerMentorsSearch from "../models/partner_mentors_search.model";
import { AdminPartnersMentors } from "./admin_partners_mentors";
import PartnerMentorStats from "../models/partner_mentor_stats.model";

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();

export class AdminPartnersMentorStats {
  constructor() {
    helpers.autoBind(this);
  }

  async getAllMentorsStatsOfOnePartner(
    request: Request,
    response: Response
  ): Promise<void> {
    const partnerId = request.params.partner_id;
    const searchParameters: PartnerMentorsSearch = request.body;
    const client = await pool.connect();
    try {
      const mentors = await this.getAllMentorStatsOfOnePartnerFromDB(
        partnerId,
        searchParameters,
        client
      );
      response.status(200).json(mentors);
    } catch (error) {
      response.status(400).send(error);
    } finally {
      client.release();
    }
  }

  async getAllMentorStatsOfOnePartnerFromDB(
    partnerId: string,
    searchParameters: PartnerMentorsSearch,
    client: pg.PoolClient
  ): Promise<PartnerMentorStats> {
    const mentors = new AdminPartnersMentors().getAllMentorsOfOnePartnerFromDB(
      partnerId,
      searchParameters,
      client
    );
    const mentorStats = (await mentors).reduce(
      (acc, curr) => {
        return {
          mentors: 0,
          courses: acc.courses + curr.courses,
          students: acc.students + curr.students,
          hours: acc.hours + curr.hours,
        };
      },
      {
        mentors: 0,
        courses: 0,
        students: 0,
        hours: 0,
      }
    );

    mentorStats.mentors = (await mentors).length;
    return mentorStats;
  }
}
