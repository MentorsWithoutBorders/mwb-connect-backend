import autoBind from 'auto-bind';
import moment from 'moment';
import dotenv from 'dotenv';
import axios from 'axios';
import { createClient } from 'async-redis';
import { Helpers } from '../utils/helpers';
import { constants } from '../utils/constants';
import User from '../models/user.model';
import Lesson from '../models/lesson.model';

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
    let message = `Hi ${userFirstName},\n`;
    const quizzes = this.getRemainingQuizzesText(remainingQuizzes);
    if (showStepReminder && !showQuizReminder) {
      message += 'Kindly remember to add a new step to your plan in the MWB Connect app.';
    } else if (showStepReminder && showQuizReminder) {
      message += `Kindly remember to add a new step and solve the ${quizzes} in the MWB Connect app.`;
    } else if (!showStepReminder && showQuizReminder) {
      message += `Kindly remember to solve the ${quizzes} in the MWB Connect app.`;
    }
    message = this.getNotReplyMessage(message);
    if (showStepReminder || showQuizReminder) {    
      await this.sendWhatsAppMessage(user.phoneNumber, message);
    }
  }

  getNotReplyMessage(message: string): string {
    return `${message}\n\n_*(this is an automated message, please don't reply)*_`;
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

  async sendWMSecondTrainingReminder(user: User, showStepReminder: boolean, showQuizReminder: boolean, remainingQuizzes: number): Promise<void> {
    const userFirstName = helpers.getUserFirstName(user);
    let message = `Hi ${userFirstName},\n`;
    const quizzes = this.getRemainingQuizzesText(remainingQuizzes);
    if (showStepReminder && !showQuizReminder) {
      message += 'This is a gentle reminder that today is the last day for adding a new step to your plan in the MWB Connect app.';
    } else if (showStepReminder && showQuizReminder) {
      message += `This is a gentle reminder that today is the last day for adding a new step and solving the ${quizzes} in the MWB Connect app.`;
    } else if (!showStepReminder && showQuizReminder) {
      message += `This is a gentle reminder that today is the last day for solving the ${quizzes} in the MWB Connect app.`;
    }
    message = this.getNotReplyMessage(message);
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
    let message = `Hi ${studentFirstName},\n${mentorName} has scheduled a ${recurring}${fieldName} lesson with you. Please see the details in the MWB Connect app.`
    message = this.getNotReplyMessage(message);
    await this.sendWhatsAppMessage(student.phoneNumber, message);
  }

  async sendWMLessonRequestRejected(student: User, mentor: User): Promise<void> {
    const mentorName = mentor?.name;
    const studentFirstName = helpers.getUserFirstName(student);
    let message = `Hi ${studentFirstName},\nWe're sorry but ${mentorName} has rejected your lesson request. Please find a new mentor in the MWB Connect app.`;
    message = this.getNotReplyMessage(message);
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
    message = this.getNotReplyMessage(message);
    if (lesson.students != null) {
      for (const student of lesson.students) {
        const studentFirstName = helpers.getUserFirstName(student);
        const messageToSend = `Hi ${studentFirstName},\n${message}`;
        await this.sendWhatsAppMessage(student.phoneNumber, messageToSend);
      }
    }
  }
  
  async sendWMLessonRecurrenceUpdated(students: Array<User>): Promise<void> {  
    if (students != null && students.length > 0) {
      for (const student of students) {
        const studentFirstName = helpers.getUserFirstName(student);
        let message = `Hi ${studentFirstName},\nThe mentor has updated the lesson recurrence. Please see the new details in the MWB Connect app.`;
        message = this.getNotReplyMessage(message);
        await this.sendWhatsAppMessage(student.phoneNumber, message);
      }
    }
  }

  async sendWMLessonReminder(nextLesson: Lesson): Promise<void> {
    const students = nextLesson.students;
    if (students != null && students.length > 0) {
      for (const student of students) {
        const studentFirstName = helpers.getUserFirstName(student);
        let message = `Hi ${studentFirstName},\nKindly remember to attend the lesson in 30 mins from now.`;
        message = this.getNotReplyMessage(message);
        await this.sendWhatsAppMessage(student.phoneNumber, message);
      }
    }
  }  
}

