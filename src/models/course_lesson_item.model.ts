import Course from "./course.model";
import CourseMentor from "./course_mentor.model";

export default interface CourseLessonItem {
  id: string;
  course: Course;
  mentor: CourseMentor;
  lessonDateTime: string;
}