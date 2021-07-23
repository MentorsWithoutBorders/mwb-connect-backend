import User from "./user.model";
import Subfield from "./subfield.model";

export default interface LessonRequest {
  id?: string;
  student?: User;
  mentor?: User;
  subfield?: Subfield;
  sentDateTime?: string;
  lessonDateTime?: string;
  isCanceled?: boolean
  isRejected?: boolean
  isExpired?: boolean
  score?: number;
}