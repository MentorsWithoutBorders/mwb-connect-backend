import { Request, Response } from "express";
import pg from "pg";
import { Conn } from "../db/conn";
import { Helpers } from "../utils/helpers";
import PartnerProject from "../models/partner_project.model";

const conn = new Conn();
const pool = conn.pool;
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
    const client = await pool.connect();
    try {
      const projects = await this.getAllProjectsOfOnePartnerFromDB(
        partnerId,
        client
      );
      response.status(200).json(projects);
    } catch (error) {
      response.status(400).send(error);
    } finally {
      client.release();
    }
  }

  async getAllProjectsOfOnePartnerFromDB(
    partnerId: string
    ,client: pg.PoolClient
  ): Promise<Array<PartnerProject>> {
    const getPartnerProjectsQuery =`
    select id, name
    from projects
    where organization_id =	'${partnerId}'`

    const { rows }: pg.QueryResult = await client.query(
      getPartnerProjectsQuery
    );

    const projects: Array<PartnerProject> = rows.map(row => {
      return {
      id: row.id,
      name: row.name
    }});

    return projects;
  }
}
