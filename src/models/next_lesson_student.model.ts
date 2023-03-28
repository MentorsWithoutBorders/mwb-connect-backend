import CourseMentor from "./course_mentor.model";

export default interface NextLessonStudent {
  mentor: CourseMentor | null;
  lessonDateTime: string | null;
}