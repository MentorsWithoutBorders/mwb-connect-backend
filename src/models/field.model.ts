import Subfield from "./subfield.model";

export default interface Field {
  id?: string;
  name?: string;
  index?: number;
  subfields?: Array<Subfield>
}