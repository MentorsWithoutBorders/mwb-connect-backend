import CourseType from "./course_type.model";
import User from "./user.model";

export default interface MentorPartnershipRequest {
  id?: string;
  mentor?: User;
  partnerMentor?: User;
  courseType?: CourseType;
  courseDayOfWeek?: string;
  courseStartTime?: string;
  sentDateTime?: string;
  isRejected?: boolean;
  isCanceled?: boolean;
  isExpired?: boolean;
  wasCanceledShown?: boolean;
  wasExpiredShown?: boolean;  
}