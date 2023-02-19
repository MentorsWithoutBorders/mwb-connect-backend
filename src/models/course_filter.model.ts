import CourseType from "./course_type.model";
import Field from "./field.model";
import Availability from "./availability.model";

export default interface CourseFilter {
  courseType?: CourseType;
  field?: Field;
  availabilities?: Array<Availability>;
}