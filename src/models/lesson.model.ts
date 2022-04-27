import User from "./user.model";
import Subfield from "./subfield.model";

export default interface Lesson {
  id?: string;
  mentor?: User;
  students?: Array<User>;
  subfield?: Subfield;
  dateTime?: string;
  meetingUrl?: string;
  isMentorPresent?: boolean;
  isRecurrent?: boolean;
  endRecurrenceDateTime?: string;
  isCanceled?: boolean;
  shouldStop?: boolean;
}