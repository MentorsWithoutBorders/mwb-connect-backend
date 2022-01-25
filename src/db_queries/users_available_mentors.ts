import { Request, Response } from 'express';
import autoBind from 'auto-bind';
import pg from 'pg';
import * as redis from 'redis';
import moment from 'moment';
import 'moment-timezone';
import { Conn } from '../db/conn';
import { constants } from '../utils/constants';
import { Helpers } from '../utils/helpers';
import { Users } from './users';
import User from '../models/user.model';
import Lesson from '../models/lesson.model';
import Field from '../models/field.model';
import Subfield from '../models/subfield.model';
import Availability from '../models/availability.model';
import AvailabilityTime from '../models/availability_time.model';
import Skill from '../models/skill.model';

const conn = new Conn();
const pool = conn.pool;
const redisClient = redis.createClient();
const helpers = new Helpers();
const users: Users = new Users();

export class UsersAvailableMentors {
  constructor() {
    autoBind(this);
  }

  async getAvailableMentors(request: Request, response: Response): Promise<void> {
    const page = request.query.page as string;
    const { field, availabilities }: User = request.body;
    const client = await pool.connect();    
    try {
      await client.query('BEGIN');
      console.log('before Redis');
      await redisClient.connect();      
      console.log('after Redis');
      const availableMentors = await this.getAvailableMentorsFromDB(field, availabilities, page, client);
      await redisClient.disconnect();      
      response.status(200).json(availableMentors);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');      
    } finally {
      client.release();
    }
  }

  async getAvailableMentorsFromDB(field: Field | undefined, availabilities: Array<Availability> | undefined, page: string | undefined, client: pg.PoolClient): Promise<Array<User>> {
    const lessons = await this.getAvailableMentorsLessons(field?.id, client);
    const mentors: Array<User> = [];
    for (const lesson of lessons) {
      const mentorString = await redisClient.get('user' + lesson.mentor?.id);
      if (!mentorString) {
        const mentor = await users.getUserFromDB(lesson.mentor?.id as string, client);
        await redisClient.set('user' + lesson.mentor?.id, JSON.stringify(mentor));
        if (this.isValidMentor(JSON.stringify(mentor), field, availabilities)) {
          mentors.push(mentor);
        }          
      } else {
        if (this.isValidMentor(mentorString, field, availabilities)) {
          mentors.push(JSON.parse(mentorString));
        }
      }
    }
    return this.getPaginatedMentors(mentors, page);
  }

  getPaginatedMentors(mentors: Array<User>, page: string | undefined): Array<User> {
    const paginatedMentors: Array<User> = [];
    if (!page) {
      return mentors;
    }
    for (let i = 20 * (parseInt(page) - 1); i < 20 * parseInt(page); i++) {
      if (mentors[i]) {
        paginatedMentors.push(mentors[i]);
      }
    }
    return paginatedMentors;
  }

  isValidMentor(mentorString: string, field: Field | undefined, filterAvailabilities: Array<Availability> | undefined): boolean {
    let subfields;
    if (field) {
      subfields = field.subfields;
    }
    if (this.isValidSubfieldsAndSkills(mentorString, subfields)) {
      return this.isValidAvailabilities(mentorString, filterAvailabilities);
    } else {
      return false;
    }
  }

  isValidSubfieldsAndSkills(mentorString: string, subfields: Array<Subfield> | undefined): boolean {
    let isValid = false;
    if (subfields) {
      const subfieldId = subfields[0].id as string;
      const skills = subfields[0].skills;
      const skillsIds: Array<string> = [];
      if (skills) {
        for (const skill of skills) {
          skillsIds.push(skill.id);
        }
      }
      if (skillsIds.length > 0) {
        isValid = mentorString.includes(subfieldId) && skillsIds.some(skillId => mentorString.includes(skillId));
      } else {
        isValid = mentorString.includes(subfieldId);
      }
    } else {
      isValid = true;
    }
    return isValid;
  }  

  isValidAvailabilities(mentorString: string, filterAvailabilities: Array<Availability> | undefined): boolean {
    let isValid = false;
    if (filterAvailabilities) {
      filterAvailabilities = this.getExpandedAvailabilities(filterAvailabilities);
      const mentor = JSON.parse(mentorString);
      mentor.availabilities = this.getExpandedAvailabilities(mentor.availabilities);
      for (const filterAvailability of filterAvailabilities) {
        for (const mentorAvailability of mentor.availabilities) {
          if (this.isAvailabilityValid(filterAvailability, mentorAvailability)) {
            isValid = true;
            break;
          }
        }
      }
    } else {
      isValid = true;
    }
    return isValid;
  }

  isAvailabilityValid(filterAvailability: Availability, mentorAvailability: Availability): boolean {
    const filterTimeFrom = moment(filterAvailability.time.from, 'h:mma');
    const filterTimeTo = moment(filterAvailability.time.to, 'h:mma');
    const mentorTimeFrom = moment(mentorAvailability.time.from, 'h:mma');
    const mentorTimeTo = moment(mentorAvailability.time.to, 'h:mma');
    if (filterAvailability.dayOfWeek == mentorAvailability.dayOfWeek && 
        (filterTimeFrom.isSameOrAfter(mentorTimeFrom) && filterTimeTo.isSameOrBefore(mentorTimeTo) ||
         filterTimeFrom.isSameOrBefore(mentorTimeFrom) && filterTimeTo.isAfter(mentorTimeFrom) ||
         filterTimeFrom.isBefore(mentorTimeTo) && filterTimeTo.isSameOrAfter(mentorTimeTo))) {
      return true;
    }
    return false;
  }

  getExpandedAvailabilities(availabilities: Array<Availability>): Array<Availability> {
    for (const availability of availabilities) {
      const timeFrom = moment(availability.time.from, 'h:mma');
      const timeTo = moment(availability.time.to, 'h:mma');
      if (timeTo.isBefore(timeFrom)) {
        availability.time.to = '11:59pm';
        const timeNextDay: AvailabilityTime = {
          from: '0:00am',
          to: timeTo.format('h:mma')
        };
        const nextDayAvailability: Availability = {
          dayOfWeek: helpers.getNextDayOfWeek(availability.dayOfWeek),
          time: timeNextDay
        };
        availabilities.push(nextDayAvailability);
      }
    }
    return availabilities;    
  }

  async getAvailableMentorsFields(request: Request, response: Response): Promise<void> {
    const client = await pool.connect();    
    try {
      await client.query('BEGIN');
      await redisClient.connect();
      const fieldsString = await redisClient.get('available_mentors_fields');
      let fields: Array<Field> = [];
      if (fieldsString && fieldsString != '{}') {
        fields = JSON.parse(fieldsString);
      } else {
        fields = await this.getAvailableMentorsFieldsFromDB(client);
        await redisClient.set('available_mentors_fields', JSON.stringify(fields));
      }
      await redisClient.disconnect();  
      response.status(200).json(fields);
      await client.query('COMMIT');
    } catch (error) {
      response.status(400).send(error);
      await client.query('ROLLBACK');      
    } finally {
      client.release();
    }  
  }

  async getAvailableMentorsFieldsFromDB(client: pg.PoolClient): Promise<Array<Field>> {
    const availableMentors = await this.getAvailableMentorsFromDB(undefined, undefined, undefined, client);
    let fields = this.getFields(availableMentors);
    fields = this.getSubfields(fields, availableMentors);
    fields = this.getSkills(fields, availableMentors);
    return fields; 
  }

  getFields(availableMentors: Array<User>): Array<Field> {
    const fields: Array<Field> = [];
    const fieldsIds = new Map<string, number>();
    for (const availableMentor of availableMentors) {
      if (fields.filter(field => field.id === availableMentor.field?.id).length == 0) {
        const field: Field = {
          id: availableMentor.field?.id,
          name: availableMentor.field?.name,
          subfields: []
        }
        fields.push(field);
        fieldsIds.set(field.id as string, 1);
      } else {
        const count = fieldsIds.get(availableMentor.field?.id as string) as number;
        fieldsIds.set(availableMentor.field?.id as string, count + 1);         
      }
    }
    fields.sort((a,b) => {
      const fieldACount = fieldsIds.get(a.id as string) as number;
      const fieldBCount = fieldsIds.get(b.id as string) as number;
      const reverseCompare = (fieldACount > fieldBCount) ? -1 : 0;
      return fieldACount < fieldBCount ? 1 : reverseCompare;
    });
    return fields;
  }

  getSubfields(fields: Array<Field>, availableMentors: Array<User>): Array<Field> {
    for (let i = 0; i < fields.length; i++) {
      const subfieldsIds = new Map<string, number>();
      for (const availableMentor of availableMentors) {
        if (availableMentor.field?.id == fields[i].id) {
          fields[i] = this.groupSubfields(fields[i], availableMentor, subfieldsIds);
        }
      }
    }
    return fields;
  }
  
  groupSubfields(field: Field, availableMentor: User, subfieldsIds: Map<string, number>): Field {
    const mentorSubfields = availableMentor.field?.subfields || [];
    for (const mentorSubfield of mentorSubfields) {
      if (field.subfields?.filter(subfield => subfield.id === mentorSubfield.id).length == 0) {
        const subfield: Subfield = {
          id: mentorSubfield.id,
          name: mentorSubfield.name,
          skills: []
        }
        field.subfields?.push(subfield);
        subfieldsIds.set(subfield.id as string, 1);
      } else {
        const count = subfieldsIds.get(mentorSubfield.id as string) as number;
        subfieldsIds.set(mentorSubfield.id as string, count + 1);
      }
    }
    field.subfields?.sort((a,b) => {
      const subfieldACount = subfieldsIds.get(a.id as string) as number;
      const subfieldBCount = subfieldsIds.get(b.id as string) as number;
      const reverseCompare = (subfieldACount > subfieldBCount) ? -1 : 0;
      return subfieldACount < subfieldBCount ? 1 : reverseCompare;
    }); 
    return field;
  }

  getSkills(fields: Array<Field>, availableMentors: Array<User>): Array<Field> {
    for (let i = 0; i < fields.length; i++) {
      const subfields = fields[i].subfields as Array<Subfield>;
      for (const subfield of subfields) {
        const skillsIds = new Map<string, number>();
        for (const availableMentor of availableMentors) {
          const mentorSubfields = availableMentor.field?.subfields as Array<Subfield>;
          for (const mentorSubfield of mentorSubfields) {
            if (mentorSubfield.id == subfield.id) {
              fields[i] = this.groupSkills(fields[i], subfield, mentorSubfield, skillsIds);
            }
          }
        }
      }
    }
    return fields;
  }
  
  groupSkills(field: Field, subfield: Subfield, mentorSubfield: Subfield, skillsIds: Map<string, number>): Field {
    const mentorSkills = mentorSubfield.skills || [];
    for (const mentorSkill of mentorSkills) {
      if (subfield.skills?.filter(skill => skill.id === mentorSkill.id).length == 0) {
        const skill: Skill = {
          id: mentorSkill.id,
          name: mentorSkill.name
        }
        subfield?.skills.push(skill);
        skillsIds.set(skill.id, 1);
      } else {
        const count = skillsIds.get(mentorSkill.id) as number;
        skillsIds.set(mentorSkill.id, count + 1);
      }
    }
    subfield.skills?.sort((a,b) => {
      const skillACount = skillsIds.get(a.id) as number;
      const skillBCount = skillsIds.get(b.id) as number;
      const reverseCompare = (skillACount > skillBCount) ? -1 : 0;
      return skillACount < skillBCount ? 1 : reverseCompare;
    }); 
    return field;
  }

  async setAvailableMentorsFieldsFromDB(): Promise<void> {
    const client = await pool.connect();    
    try {
      await client.query('BEGIN');
      await redisClient.connect();
      const fields = await this.getAvailableMentorsFieldsFromDB(client);
      await redisClient.set('available_mentors_fields', JSON.stringify(fields));
      await redisClient.disconnect(); 
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }  
  }  
  
  async getAvailableMentorsLessons(fieldId: string | undefined, client: pg.PoolClient): Promise<Array<Lesson>> {
    let getLessonsQuery = `SELECT l.mentor_id, l.mentor_name, l.available_from, l.lesson_id, l.field_id, f.name AS field_name, l.subfield_name, l.date_time, l.is_recurrent, l.end_recurrence_date_time, l.is_canceled, l.should_contact, l.last_contacted_date_time, l.is_inactive 
      FROM (SELECT u.id AS mentor_id, u.name AS mentor_name, u.field_id AS user_field_id, u.available_from, ul.id AS lesson_id, fs.field_id, s.name AS subfield_name, ul.date_time, ul.is_recurrent, ul.end_recurrence_date_time, ul.is_canceled, aau.should_contact, aau.last_contacted_date_time, aau.is_inactive 
        FROM users_lessons ul
        JOIN users u
          ON ul.mentor_id = u.id
        JOIN fields_subfields fs
          ON ul.subfield_id = fs.subfield_id 
        JOIN subfields s
          ON ul.subfield_id = s.id
        LEFT OUTER JOIN admin_available_users aau
          ON u.id = aau.user_id            
        WHERE u.available_from <= now()) l
      JOIN fields f
        ON l.field_id = f.id
      WHERE l.is_inactive IS DISTINCT FROM true`;
    let values: Array<string> = [];
    if (fieldId) {
      getLessonsQuery += ' AND l.user_field_id = $1';
      values = [fieldId];
    }
    const { rows }: pg.QueryResult = await client.query(getLessonsQuery, values);
    const group = rows.reduce((r, a) => {
      r[a.mentor_id] = [...r[a.mentor_id] || [], a];
      return r;
    }, {});

    let lessons: Array<Lesson> = [];
    for (const i in group) {
      const lessonItems = group[i];
      let mentorLessons = [];
      for (const row of lessonItems) {
        const field: Field = {
          id: row.field_id,
          name: row.field_name
        }
        const mentor: User = {
          id: row.mentor_id,
          name: row.mentor_name,
          field: field,
          availableFrom: moment.utc(row.available_from).format(constants.DATE_TIME_FORMAT),
          shouldContact: row.should_contact ?? true,
          lastContactedDateTime: this.getLastContactedDateTime(row.last_contacted_date_time)
        }
        const subfield: Subfield = {
          name: row.subfield_name
        }
        const lesson: Lesson = {
          id: row.lesson_id,
          mentor: mentor,
          subfield: subfield,
          dateTime: moment.utc(row.date_time).format(constants.DATE_TIME_FORMAT),
          isRecurrent: row.is_recurrent ?? false,
          isCanceled: row.is_canceled ?? false
        };
        if (lesson.isRecurrent) {
          lesson.endRecurrenceDateTime = moment.utc(row.end_recurrence_date_time).format(constants.DATE_TIME_FORMAT)            
        }
        mentorLessons.push(lesson);
      }
      mentorLessons = this.getSortedLessons(mentorLessons, false);
      if (this.getShouldAddLesson(mentorLessons)) {
        lessons.push(mentorLessons[0]);
      }
    }
    lessons = this.getSortedLessons(lessons, true);
    const mentorsWihoutLessons = await this.getMentorsWithoutLessons(fieldId, client);
    lessons = mentorsWihoutLessons.concat(lessons);
    return lessons.sort((a, b) => moment.utc(a.mentor?.availableFrom).diff(moment.utc(b.mentor?.availableFrom)));
  }

  getLastContactedDateTime(lastContactedDateTime?: string): string | undefined {
    if (lastContactedDateTime) {
      return moment.utc(lastContactedDateTime).format(constants.DATE_TIME_FORMAT);
    } else {
      return undefined;
    }
  }

  getShouldAddLesson(sortedLessons: Array<Lesson>): boolean {
    let shouldAddLesson = true;
    const lastLessonDateTime = !sortedLessons[0].isRecurrent ? moment.utc(sortedLessons[0].dateTime) : moment.utc(sortedLessons[0].endRecurrenceDateTime);
    const isLastLessonCanceled = sortedLessons[0].isCanceled;
    if (lastLessonDateTime.isAfter(moment.utc()) && !isLastLessonCanceled) {
      shouldAddLesson = false;
    }
    return shouldAddLesson;
  }

  getSortedLessons(lessons: Array<Lesson>, isAscending: boolean): Array<Lesson> {
    let lessonDates = new Map();
    for (let i = 0; i < lessons.length; i++) {
      if (!lessons[i].isRecurrent) {
        lessonDates.set(i, moment.utc(lessons[i].dateTime));
      } else {
        lessonDates.set(i, moment.utc(lessons[i].endRecurrenceDateTime));
      }
    }
    if (isAscending) {
      lessonDates = new Map([...lessonDates.entries()].sort((a, b) => a[1].diff(b[1])));
    } else {
      lessonDates = new Map([...lessonDates.entries()].sort((a, b) => b[1].diff(a[1])));
    }
    const keys = Array.from(lessonDates.keys());
    const sortedLessons = [];
    for (const key of keys) {
      sortedLessons.push(lessons[key]);
    }
    return sortedLessons; 
  }

  async getMentorsWithoutLessons(fieldId: string | undefined, client: pg.PoolClient): Promise<Array<Lesson>> {
    let getMentorsQuery = `SELECT u.id AS mentor_id, u.name AS mentor_name, u.available_from, u.field_id, f.name AS field_name, aau.should_contact, aau.last_contacted_date_time, aau.is_inactive 
      FROM users u
      JOIN fields f
        ON u.field_id = f.id
      LEFT OUTER JOIN admin_available_users aau
        ON u.id = aau.user_id
      WHERE u.is_mentor IS true
        AND u.id NOT IN (
          SELECT DISTINCT mentor_id FROM users_lessons
        )
        AND aau.is_inactive IS DISTINCT FROM true`;
    let values: Array<string> = [];
    if (fieldId) {
      getMentorsQuery += ' AND u.field_id = $1';
      values = [fieldId];
    }        
    const { rows }: pg.QueryResult = await client.query(getMentorsQuery, values);
    const lessons: Array<Lesson> = [];
    for (const row of rows) {
      const field: Field = {
        id: row.field_id,
        name: row.field_name
      }
      const mentor: User = {
        id: row.mentor_id,
        name: row.mentor_name,
        field: field,
        availableFrom: moment.utc(row.available_from).format(constants.DATE_TIME_FORMAT),
        shouldContact: row.should_contact ?? true,
        lastContactedDateTime: this.getLastContactedDateTime(row.last_contacted_date_time)
      }     
      const lesson: Lesson = {
        mentor: mentor
      };
      lessons.push(lesson);
    }
    return lessons;    
  }
}