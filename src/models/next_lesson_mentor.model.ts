import CourseStudent from "./course_student.model";

export default interface NextLessonMentor {
  lessonDateTime: string | null;
	students?: Array<CourseStudent>;
}