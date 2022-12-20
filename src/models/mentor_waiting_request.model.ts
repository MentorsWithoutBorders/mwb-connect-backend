import User from "./user.model";
import CourseType from "./course_type.model";

export default interface MentorWaitingRequest {
  id?: string;
  courseType?: CourseType;
  mentor?: User;
}