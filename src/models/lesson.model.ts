import User from "./user.model";
import Subfield from "./subfield.model";

export default interface Lesson {
  id?: string;
  mentor?: User;
  students?: Array<User>;
  subfield?: Subfield;
  dateTime?: string;
  endRecurrenceDateTime?: string;
  daysSinceStart?: number;
  meetingUrl?: string;
  isMentorPresent?: boolean;
  isCanceled?: boolean;
  reasonCanceled?: string;
  shouldStop?: boolean;
}