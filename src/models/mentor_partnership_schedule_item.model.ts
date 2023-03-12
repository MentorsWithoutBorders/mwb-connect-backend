import CourseMentor from "./course_mentor.model";

export default interface MentorPartnershipScheduleItem {
  id: string;
  courseId: string;
  mentor: CourseMentor;
  lessonDateTime: string;
}