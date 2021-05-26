import Field from "./field.model";
import Subfield from "./subfield.model";

export default interface User {
  id?: string;
  name?: string;
  email?: string;
  password?: string;
  organization?: string;
  isMentor?: boolean;  
  field?: Field;
  subfields?: Array<Subfield>;
}