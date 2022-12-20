import CourseType from "./course_type.model";
import User from "./user.model";

export default interface MentorPartnershipRequest {
  id?: string;
  courseType?: CourseType;
  mentor?: User;
  partnerMentor?: User;
  courseDayOfWeek?: string;
  courseStartTime?: string;
  sentDateTime?: string;
  isRejected?: boolean;
  isCanceled?: boolean;
  isExpired?: boolean;
  wasCanceledShown?: boolean;
  wasExpiredShown?: boolean;  
}