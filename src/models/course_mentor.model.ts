import User from "./user.model";

export default interface CourseMentor extends User {
  meetingUrl: string;
  isCanceled: string;
}