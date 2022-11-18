import CourseMentor from "./course_mentor.model";
import CourseType from "./course_type.model";

export default interface MentorWaitinRequest {
  id: string;
  mentor: CourseMentor;
  courseType: CourseType
}