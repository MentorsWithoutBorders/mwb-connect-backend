import User from "./user.model";
import Subfield from "./subfield.model";

export default interface Lesson {
  id?: string;
  student?: User;
  mentor?: User;
  subfield?: Subfield;
  dateTime?: string;
  meetingUrl?: string;
  isStudentPresent?: boolean;
  isMentorPresent?: boolean;
  isCanceled?: boolean;
}