import Subfield from "./subfield.model";

export default interface Lesson {
  id: string;
  student?: string;
  mentor?: string;
  organization?: string;
  subfield?: Subfield;
  dateTime?: string;
  meetingUrl?: string;
  isStudentPresent?: boolean;
  isMentorPresent?: boolean;
  isCanceled?: boolean;
}