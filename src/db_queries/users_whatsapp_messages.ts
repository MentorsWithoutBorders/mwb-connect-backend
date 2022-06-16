import autoBind from 'auto-bind';
import moment from 'moment';
import pg from 'pg';
import dotenv from 'dotenv';
import axios from 'axios';
import { createClient } from 'async-redis';
import { UsersTimeZones } from './users_timezones';
import { Helpers } from '../utils/helpers';
import { constants } from '../utils/constants';
import User from '../models/user.model';
import Lesson from '../models/lesson.model';
import LessonRequest from '../models/lesson_request.model';

const usersTimeZones = new UsersTimeZones();
const helpers = new Helpers();
const redisClient = createClient();
dotenv.config();

export class UsersWhatsAppMessages {
  constructor() {
    autoBind(this);
  }

  async sendWhatsAppMessage(phoneNumber: string | undefined, message: string): Promise<void> {
    if (phoneNumber) {
      const lastWMDateTime = await redisClient.get('lastWMDateTime');
      let delay = 0;
      if (lastWMDateTime) {
        if (moment.utc(lastWMDateTime).isAfter(moment.utc())) {
          await redisClient.set('lastWMDateTime', moment.utc(lastWMDateTime).add(3, 'seconds').format(constants.DATE_TIME_FORMAT));
          delay = moment.duration(moment.utc(lastWMDateTime).diff(moment.utc())).asMilliseconds() + 3000;
        } else {
          await redisClient.set('lastWMDateTime', moment.utc().add(3, 'seconds').format(constants.DATE_TIME_FORMAT));
        }
      } else {
        await redisClient.set('lastWMDateTime', moment.utc().format(constants.DATE_TIME_FORMAT));
      }
      setTimeout(() => {
        const payload = {
          phoneNumber: phoneNumber,
          message: message,
          accessToken: process.env.ACCESS_TOKEN_WHATSAPP
        };
        axios.post('https://mwbtraining.co/whatsapp/send_message', payload).then(({data}) => console.log(data));
      }, delay);
    }
  }

  async sendWMFirstTrainingReminder(user: User, showStepReminder: boolean, showQuizReminder: boolean, remainingQuizzes: number): Promise<void> {
    const userFirstName = helpers.getUserFirstName(user);
    let message = '';
    const quizzes = this.getRemainingQuizzesText(remainingQuizzes);
    if (showStepReminder && !showQuizReminder) {
      message += 'Kindly remember to add a new step to your plan in the MWB Connect app.';
    } else if (showStepReminder && showQuizReminder) {
      message += `Kindly remember to add a new step and solve the ${quizzes} in the MWB Connect app.`;
    } else if (!showStepReminder && showQuizReminder) {
      message += `Kindly remember to solve the ${quizzes} in the MWB Connect app.`;
    }
    message = this.getNotReplyMessage(userFirstName, message);
    if (showStepReminder || showQuizReminder) {    
      await this.sendWhatsAppMessage(user.phoneNumber, message);
    }
  }

  getNotReplyMessage(userFirstName: string, message: string): string {
    return `Hi ${userFirstName},\n${message}\n\n_*(this is an automated message, please don't reply)*_`;
  }
  
  getRemainingQuizzesText(remainingQuizzes: number): string {
    let quizzes = '';
    switch(remainingQuizzes) {
      case 1:
        quizzes = 'remaining quiz';
        break;
      case 3:
        quizzes = 'training quizzes';
        break;
      default:
        quizzes = `remaining ${remainingQuizzes} quizzes`;
    }
    return quizzes;    
  }

  async sendWMLastTrainingReminder(user: User, showStepReminder: boolean, showQuizReminder: boolean, remainingQuizzes: number): Promise<void> {
    const userFirstName = helpers.getUserFirstName(user);
    let message = '';
    const quizzes = this.getRemainingQuizzesText(remainingQuizzes);
    if (showStepReminder && !showQuizReminder) {
      message += 'This is a gentle reminder that today is the last day for adding a new step to your plan in the MWB Connect app.';
    } else if (showStepReminder && showQuizReminder) {
      message += `This is a gentle reminder that today is the last day for adding a new step and solving the ${quizzes} in the MWB Connect app.`;
    } else if (!showStepReminder && showQuizReminder) {
      message += `This is a gentle reminder that today is the last day for solving the ${quizzes} in the MWB Connect app.`;
    }
    message = this.getNotReplyMessage(userFirstName, message);
    if (showStepReminder || showQuizReminder) { 
      await this.sendWhatsAppMessage(user.phoneNumber, message);
    }
  }    

  async sendWMLessonRequestAccepted(lesson: Lesson): Promise<void> {
    const isLessonRecurrent = helpers.isLessonRecurrent(lesson.dateTime as string, lesson.endRecurrenceDateTime);
    const recurring = isLessonRecurrent ? 'recurring ' : '';
    const mentorName = lesson.mentor?.name;
    const students = lesson.students;
    const student = students != null ? students[0] : {};
    const studentFirstName = helpers.getUserFirstName(student);
    const fieldName = student.field?.name?.toLowerCase();
    let message = `${mentorName} has scheduled a ${recurring}${fieldName} lesson with you. Please see the details in the MWB Connect app.`
    message = this.getNotReplyMessage(studentFirstName, message);
    await this.sendWhatsAppMessage(student.phoneNumber, message);
  }

  async sendWMLessonRequestRejected(lessonRequest: LessonRequest): Promise<void> {
    const mentor = lessonRequest.mentor as User;
    const student = lessonRequest.student as User;    
    const mentorName = mentor?.name;
    const studentFirstName = helpers.getUserFirstName(student);
    let message = `We're sorry but ${mentorName} has rejected your lesson request. Please find a new mentor in the MWB Connect app.`;
    message = this.getNotReplyMessage(studentFirstName, message);
    await this.sendWhatsAppMessage(student.phoneNumber, message);
  }

  async sendWMLessonRequestExpired(lessonRequest: LessonRequest): Promise<void> {
    const mentor = lessonRequest.mentor as User;
    const student = lessonRequest.student as User;
    const mentorFirstName = helpers.getUserFirstName(mentor);
    const studentFirstName = helpers.getUserFirstName(student);
    let message = `We're sorry but your lesson request has expired due to ${mentorFirstName}'s unavailability. Please find a new mentor in the MWB Connect app.`;
    message = this.getNotReplyMessage(studentFirstName, message);
    await this.sendWhatsAppMessage(student.phoneNumber, message);
  }  
  
  async sendWMLessonCanceled(lesson: Lesson, isCancelAll: boolean): Promise<void> {
    let message = '';
    const isLessonRecurrent = helpers.isLessonRecurrent(lesson.dateTime as string, lesson.endRecurrenceDateTime);
    if (isLessonRecurrent && isCancelAll) {
      message = `We're sorry but the mentor has canceled the lesson recurrence. Please feel free to use the MWB Connect app in order to find a new mentor.`;
    } else {
      message = `We're sorry but the mentor has canceled the next lesson. If there aren't any other lessons scheduled, please feel free to use the MWB Connect app in order to find a new mentor.`;
    } 
    if (lesson.students != null) {
      for (const student of lesson.students) {
        const studentFirstName = helpers.getUserFirstName(student);
        const messageToSend = this.getNotReplyMessage(studentFirstName, message);
        await this.sendWhatsAppMessage(student.phoneNumber, messageToSend);
      }
    }
  }
  
  async sendWMLessonRecurrenceUpdated(students: Array<User>): Promise<void> {  
    if (students != null && students.length > 0) {
      for (const student of students) {
        const studentFirstName = helpers.getUserFirstName(student);
        let message = `The mentor has updated the lesson recurrence. Please see the new details in the MWB Connect app.`;
        message = this.getNotReplyMessage(studentFirstName, message);
        await this.sendWhatsAppMessage(student.phoneNumber, message);
      }
    }
  }

  async sendWMLessonReminder(nextLesson: Lesson, client: pg.PoolClient): Promise<void> {
    const mentor = nextLesson.mentor;
    const students = nextLesson.students;
    const meetingUrl = nextLesson.meetingUrl;
    if (students != null && students.length > 0) {
      for (const student of students) {
        const studentFirstName = helpers.getUserFirstName(student);
        const userTimeZone = await usersTimeZones.getUserTimeZone(student.id as string, client);
        const lessonTime = moment.utc(nextLesson.dateTime).tz(userTimeZone.name).format(constants.TIME_FORMAT_LESSON) + ' ' + userTimeZone.abbreviation;
        let message = `Kindly remember to attend the lesson at ${lessonTime}.\n\n`;
        message += `The meeting link is: ${meetingUrl}\n\n`;
        message += `If you aren't able to join the session, please notify your mentor, ${mentor?.name}, at: ${mentor?.email}`;        
        message = this.getNotReplyMessage(studentFirstName, message);
        await this.sendWhatsAppMessage(student.phoneNumber, message);
      }
    }
  }
  
  async sendWMNoMoreLessonsAdded(mentor: User, student: User): Promise<void> {
    const mentorFirstName = helpers.getUserFirstName(mentor);
    const studentFirstName = helpers.getUserFirstName(student);
    let message = `We're sorry but ${mentorFirstName} couldn't schedule more lessons. Please find a new mentor in the MWB Connect app.`;
    message = this.getNotReplyMessage(studentFirstName, message);
    await this.sendWhatsAppMessage(student.phoneNumber, message);
  }   
}

