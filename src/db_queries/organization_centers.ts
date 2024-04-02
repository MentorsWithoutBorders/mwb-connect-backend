import { Request, Response } from 'express';
import { UserType } from '../../@types/express';
import { dbClient } from '../db/conn';
import OrganizationCenter from '../models/organization_center.model';
import OrganizationCenterSearch from '../models/organization_center_search.model';
import { Helpers } from '../utils/helpers';

const helpers = new Helpers();

export class OrganizationCenters {
  constructor() {
    helpers.autoBind(this);
  }

  mountQuery(
    { searchString, page, limit }: OrganizationCenterSearch,
    user: UserType
  ): string {
    let query = `
      SELECT * FROM (
        SELECT 
          c.id as id,
          c.name as name,
          o.country as country,
          u.name AS manager,
          CASE
            WHEN COALESCE(SUM(p.total_amount_paid), 0) >= COALESCE(SUM(e.total_expenses), 0) THEN 'Up to date'
            ELSE 'In progress'
          END AS status
        FROM 
          organizations_centers c
        LEFT JOIN 
          organizations o ON c.organization_id = o.id
        LEFT JOIN 
          users u ON c.manager_id = u.id
        LEFT JOIN (
          SELECT
            center_id,
            SUM(amount) AS total_expenses
          FROM
            organizations_centers_expenses
          GROUP BY
            center_id) e ON c.id = e.center_id
        LEFT JOIN (
          SELECT
            center_id,
            SUM(amount) AS total_amount_paid
          FROM
            organizations_centers_expenses_paid
          GROUP BY
            center_id) p ON e.center_id = p.center_id
        ${user.isOrgManager ? ` WHERE c.organization_id = '${user.orgId}'` : ''}
        ${user.isCenterManager ? ` WHERE c.manager_id = '${user.id}'` : ''}
        GROUP BY c.id, o.country, u.name
      ) AS subquery`;

    if (searchString) {
      query += `
        WHERE 
          name ILIKE '%${searchString}%' OR 
          country ILIKE '%${searchString}%' OR 
          manager ILIKE '%${searchString}%' OR 
          status ILIKE '%${searchString}%'`;
    }

    query += ` ORDER BY name ASC`;

    if (page) {
      query += ` LIMIT ${limit ? limit : '10'} OFFSET ${(page - 1) * 10}`;
    }
    return query;
  }

  async getOrganizationCenters(
    request: Request,
    response: Response
  ): Promise<void> {
    const user = request.user;
    const searchParameters: OrganizationCenterSearch = request.query;

    try {
      const organization = await this.getOrganizationCentersFromDB(
        user,
        searchParameters
      );
      response.status(200).json(organization);
    } catch (error) {
      response.status(400).send(error);
    } finally {
    }
  }

  async getOrganizationCentersFromDB(
    user: UserType,
    searchParameters: OrganizationCenterSearch
  ): Promise<OrganizationCenter[]> {
    const organizationCenters: OrganizationCenter[] = [];

    if (
      !user ||
      (!user.isAdmin && !user.isOrgManager && !user.isCenterManager)
    ) {
      return organizationCenters;
    }

    try {
      const getOrganizationCenterQuery = this.mountQuery(
        searchParameters,
        user
      );
      const { rows } = await dbClient.query(getOrganizationCenterQuery);
      rows.forEach(function (row) {
        const center: OrganizationCenter = {
          id: row.id,
          name: row.name,
          country: row.country,
          manager: row.manager,
          status: row.status
        };

        organizationCenters.push(center);
      });
    } catch (error) {
      console.error(error);
    } finally {
      return organizationCenters;
    }
  }
}
