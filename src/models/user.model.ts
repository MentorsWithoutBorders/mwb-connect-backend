import Organization from "./organization.model";
import TimeZone from "./timezone.model";
import Field from "./field.model";
import Availability from "./availability.model";
import LessonsAvailability from "./lessons_availability";

export default interface User {
  id?: string;
  name?: string;
  email?: string;
  password?: string;
  phoneNumber?: string;
  organization?: Organization;
  timeZone?: TimeZone;
  field?: Field;
  isMentor?: boolean;
  isAvailable?: boolean;
  availableFrom?: string;
  availabilities?: Array<Availability>;
  lessonsAvailability?: LessonsAvailability;
  registeredOn?: string;
  shouldContact?: boolean;
  lastContactedDateTime?: string;
  isAdmin?: boolean;
  hasScheduledLesson?: boolean;
  workdays?: number;
  isOrgManager?: boolean;
  isCenterManager?: boolean;
}
