import User from "./user.model";
import Subfield from "./subfield.model";

export default interface LessonRequest {
  id: string;
  student?: User;
  mentor?: User;
  subfield?: Subfield;
  sentDateTime?: string;
  isCanceled?: boolean
}