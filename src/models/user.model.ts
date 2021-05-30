import Availability from "./availability.model";
import Field from "./field.model";
import Organization from "./organization.model";

export default interface User {
  id?: string;
  name?: string;
  email?: string;
  password?: string;
  organization?: Organization;
  field?: Field;
  isMentor?: boolean;
  isAvailable?: boolean;
  availableFrom?: string;
  availabilities?: Array<Availability>;
}