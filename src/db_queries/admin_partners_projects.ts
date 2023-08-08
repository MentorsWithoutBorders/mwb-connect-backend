import { Request, Response } from "express";
import pg from "pg";
import "moment-timezone";
import { Conn } from "../db/conn";
import { Helpers } from "../utils/helpers";
import PartnerMentorsSearch from "../models/partner_mentors_search.model";
import PartnerMentor from "../models/partner_mentor.model";
import PartnerProject from "../models/partner_project.model";

// const conn = new Conn();
// const pool = conn.pool;
const helpers = new Helpers();

export class AdminPartnersProjects {
  constructor() {
    helpers.autoBind(this);
  }

  async getAllProjectsOfOnePartner(
    request: Request,
    response: Response
  ): Promise<void> {
    const partnerId = request.params.partner_id;
    // const client = await pool.connect();
    try {
      // await client.query("BEGIN");
      const mentors = await this.getAllProjectsOfOnePartnerFromDB(
        partnerId
        // client
      );
      response.status(200).json(mentors);
      // await client.query("COMMIT");
    } catch (error) {
      response.status(400).send(error);
      // await client.query("ROLLBACK");
    } finally {
      // client.release();
    }
  }

  async getAllProjectsOfOnePartnerFromDB(
    partnerId: string
    // ,client: pg.PoolClient
  ): Promise<Array<PartnerProject>> {
    const projects = [
      { id: 1, name: "Project Spring 2023" },
      { id: 2, name: "Project Fall 2022" },
      { id: 3, name: "Project Spring 2022" },
    ];

    return projects;
  }
}
