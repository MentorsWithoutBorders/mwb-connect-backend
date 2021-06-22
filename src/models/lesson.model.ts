import User from "./user.model";
import Subfield from "./subfield.model";

export default interface Lesson {
  id?: string;
  students?: Array<User>;
  mentor?: User;
  subfield?: Subfield;
  dateTime?: string;
  meetingUrl?: string;
  isMentorPresent?: boolean;
  isRecurrent?: boolean;
  endRecurrenceDate?: string;
  isCanceled?: boolean;
}