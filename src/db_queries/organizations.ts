import { Request, Response } from 'express';
import pg from 'pg';
import { Conn } from '../db/conn';
import { Helpers } from '../utils/helpers';
import Organization from '../models/organization.model';
import OrganizationCenter from "../models/organizationcenter.model";

const conn = new Conn();
const pool = conn.pool;
const helpers = new Helpers();

export class Organizations {
  constructor() {
    helpers.autoBind(this);
  }

  async getOrganizationCentersByOrganizationId(request: Request, response: Response): Promise<void> {
    const organizationId = request.params.id;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const organization = await this.getOrganizationCentersByOrganizationIdFromDB(organizationId, client);
      response.status(200).json(organization);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  }

  async getOrganizationCentersByOrganizationIdFromDB(id: string, client: pg.PoolClient): Promise<OrganizationCenter[]> {
    const organizationCenters: OrganizationCenter[] = [];
    const getOrganizationCenterQuery = 'SELECT * FROM organizations_centers WHERE organization_id = $1';
    const { rows } = await client.query(getOrganizationCenterQuery, [id]);

    rows.forEach(function (row){
      const center: OrganizationCenter = {
        id:  row.id,
        name:  row.name,
        organization_id:  row.organization_id,
        address:  row.address,
      }

      organizationCenters.push(center)
    })
    return organizationCenters;
  }

  async getOrganizationById(request: Request, response: Response): Promise<void> {
    const organizationId = request.params.id;   
    const client = await pool.connect();    
    try {
      await client.query('BEGIN');
      const organization = await this.getOrganizationByIdFromDB(organizationId, client);
      response.status(200).json(organization);
      await client.query('COMMIT');      
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');      
    } finally {
      client.release();
    }
  }

  async getOrganizationByIdFromDB(id: string, client: pg.PoolClient): Promise<Organization> {
    const organization: Organization = {};
    const getOrganizationQuery = 'SELECT name, has_mentors FROM organizations WHERE id = $1';
    const { rows } = await client.query(getOrganizationQuery, [id]);
    if (rows[0]) {
      organization.id = id;
      organization.name = rows[0].name;
      organization.hasMentors = rows[0].has_mentors;
    }
    return organization;
  }

  async getOrganizationByName(request: Request, response: Response): Promise<void> {
    const organizationName = request.params.name;   
    const client = await pool.connect();    
    try {
      await client.query('BEGIN');
      const organization = await this.getOrganizationByNameFromDB(organizationName, client);
      response.status(200).json(organization);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');      
    } finally {
      client.release();
    }
  }

  async getOrganizationByNameFromDB(name: string, client: pg.PoolClient): Promise<Organization> {
    const organization: Organization = {};
    const getOrganizationQuery = 'SELECT id, name, has_mentors FROM organizations WHERE name = $1';
    const { rows } = await client.query(getOrganizationQuery, [helpers.replaceAll(name, '-', ' ')]);
    if (rows[0]) {
      organization.id = rows[0].id;
      organization.name = rows[0].name;
      organization.hasMentors = rows[0].has_mentors;
    }
    return organization;
  }  
}

