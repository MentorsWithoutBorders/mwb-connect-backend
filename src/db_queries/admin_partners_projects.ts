// @ts-nocheck

import { Request, Response } from 'express';
import pg from 'pg';
import { Conn } from '../db/conn';
import { Helpers } from '../utils/helpers';
import PartnerProject from '../models/partner_project.model';
import { Organizations } from '../db_queries/organizations';

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();
const organizations = new Organizations();

export class AdminPartnersProjects {
  constructor() {
    helpers.autoBind(this);
  }

  async createProjectOfOnePartner(
    request: Request,
    response: Response
  ): Promise<void> {
    const partnerId = request.params.partner_id;
    const project: PartnerProject = request.body;
    const client = await pool.connect();
    try {
      const organization = await organizations.getOrganizationByIdFromDB(
        partnerId,
        client
      );
      if (!helpers.isEmptyObject(organization)) {
        await this.createProjectInDB(partnerId, client, project);
        response.status(201).send('New project created');
      } else {
        response.status(400).send('Invalid organization id');
      }
    } catch (error) {
      await client.query('ROLLBACK');
      response.status(400).send(error);
    } finally {
      client.release();
    }
  }

  async createProjectInDB(
    partnerId: string,
    client: pg.PoolClient,
    project: PartnerProject
  ): Promise<void> {
    const insertProjectQuery = `
    INSERT INTO projects (name, start_date, duration, organization_id)
    VALUES ($1, $2, $3, $4)`;
    const values = [
      project.name,
      project.startDate,
      project.duration,
      partnerId
    ];
    await client.query('BEGIN');
    await client.query(insertProjectQuery, values);
    await client.query('COMMIT');
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
    partnerId: string,
    client: pg.PoolClient
  ): Promise<Array<PartnerProject>> {
    const getPartnerProjectsQuery = `
    SELECT id, name
    FROM projects
    WHERE organization_id =	'${partnerId}'`;

    const { rows }: pg.QueryResult = await client.query(
      getPartnerProjectsQuery
    );

    const projects: Array<PartnerProject> = rows.map((row) => {
      return {
        id: row.id,
        name: row.name
      };
    });

    return projects;
  }
}
