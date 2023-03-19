import { PoolClient } from 'pg';
import { Conn } from '../../src/db/conn';

const conn = new Conn();
const pool = conn.pool;
let client: PoolClient;

export async function deleteAllCoursesData() {
  client = await pool.connect();
  await client.query('DELETE FROM mentors_waiting_requests');
  await client.query('DELETE FROM mentors_partnership_requests');
  await client.query('DELETE FROM users_courses_partnership_schedule');
  await client.query('DELETE FROM users_courses_lessons_canceled');
  await client.query('DELETE FROM users_courses_mentors');
  await client.query('DELETE FROM users_courses_students');
  await client.query('DELETE FROM users_courses');
}