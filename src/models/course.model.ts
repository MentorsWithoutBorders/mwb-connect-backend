import CourseMentor from "./course_mentor.model";
import CourseStudent from "./course_student.model";
import CourseType from "./course_type.model";

export default interface Course {
  id?: string;
  type?: CourseType;
  mentors?: Array<CourseMentor>;
  students?: Array<CourseStudent>;
  whatsAppGroupUrl?: string;
  notes?: string;
  startDateTime?: string;
  hasStarted?: boolean;
  isCanceled?: boolean;
}