import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import moment from 'moment';
import { v4 as uuidv4 } from 'uuid';
import { constants } from '../utils/constants';
import User from '../models/user.model';
import Quiz from '../models/quiz.model';
import Course from '../models/course.model';
import CourseMentor from '../models/course_mentor.model';

dotenv.config();

export class Helpers {
  autoBind(self: any) {
    for (const key of Object.getOwnPropertyNames(self.constructor.prototype)) {
      const val = self[key];
  
      if (key !== "constructor" && typeof val === "function") {
        self[key] = val.bind(self);
      }
    }
  }

  hashPassword(password: string): string {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(8));
  }

  comparePassword(hashPassword: string, password: string): boolean {
    return bcrypt.compareSync(password, hashPassword);
  }

  isValidEmail(email:string ): boolean {
    return /\S+@\S+\.\S+/.test(email);
  }

  generateAccessToken(id: string): string {
    return jwt.sign({
      userId: id
    },
      process.env.JWT_SECRET_KEY as string, { expiresIn: '365d' }
    );
  }

  generateRefreshToken(): string {
    return uuidv4();
  }

  checkArraysEqual(a1: Array<string>, a2: Array<string>): boolean {
    return JSON.stringify(a1) == JSON.stringify(a2);
  }

  replaceAll(str: string, find: string, replace: string): string {
    return str.replace(new RegExp(this.escapeRegExp(find), 'g'), replace);
  }
  
  escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }  
  
  getNextDayOfWeek(dayOfWeek: string): string {
    let date = moment();
    while (constants.DAYS_OF_WEEK[date.isoWeekday() - 1] != dayOfWeek) {
      date = date.add(1, 'd');
    }
    return constants.DAYS_OF_WEEK[date.add(1, 'd').isoWeekday() - 1];
  }

  getUserFirstName(user: User): string {
    if (user.name != null) {
      if (user?.name?.indexOf(' ') > 0) {
        return user?.name?.substring(0, user?.name?.indexOf(' '))
      } else {
        return user?.name;
      }
    }
    return '';
  }
  
  getDSTAdjustedDifferenceInDays(differenceInMilliseconds: number): number {
    let differenceInHours = moment.duration(differenceInMilliseconds).asHours();
    let differenceInDays = moment.duration(differenceInMilliseconds).asDays();
    if (differenceInHours % 24 == 1) {
      differenceInHours -= 1;
      differenceInDays = differenceInHours / 24;
    } else if (differenceInHours % 24 == 23) {
      differenceInHours += 1;
      differenceInDays = differenceInHours / 24;
    }
    return differenceInDays;
  }

  getEndOfDay(time: string): string {
    if (time == '00:00') {
      return '24:00';
    } else {
      return time;
    }
  }

  getRemainingQuizzes(quizzes: Array<Quiz>): number {
    let remainingQuizzes = 0;
    for (const quiz of quizzes) {
      if (!quiz.isCorrect) {
        remainingQuizzes++;
      }
    }
    return remainingQuizzes;
  }

  getMentorsNames(mentors: Array<CourseMentor> | undefined): string {
    if (!mentors || mentors.length === 0) {
      return '';
    }
    const mentor = mentors[0] as CourseMentor;
    const partnerMentor = mentors.length > 1 ? mentors[1] : null;
    let mentorsNames = '';
    if (partnerMentor != null) {
      mentorsNames = `${mentor.name} and ${partnerMentor.name}`;
    } else {
      mentorsNames = mentor.name!;
    }
    return mentorsNames;
  }
  
  getMentorsSubfieldsNames(mentors: Array<CourseMentor> | undefined): string {
    if (!mentors || mentors.length === 0) {
      return '';
    }
    const mentor = mentors[0] as CourseMentor;
    const partnerMentor = mentors.length > 1 ? mentors[1] : null;
    let mentorsSubfields = '';
    if (partnerMentor != null) {
      mentorsSubfields = `${mentor.field!.subfields![0].name} and ${partnerMentor.field!.subfields![0].name}`;
    } else {
      mentorsSubfields = mentor.field!.subfields![0].name!;
    }
    return mentorsSubfields;
  }

  isLessonRecurrent(lessonDateTime: string, endRecurrenceDateTime: string | undefined): boolean {
    return endRecurrenceDateTime !== undefined && endRecurrenceDateTime !== null && moment.utc(lessonDateTime).format(constants.DATE_TIME_FORMAT) !== moment.utc(endRecurrenceDateTime).format(constants.DATE_TIME_FORMAT);
  }
}
