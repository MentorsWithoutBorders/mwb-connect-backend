import Skill from "./skill.model";

export default interface Subfield {
  id?: string;
  name?: string;
  index?: number;
  skills?: Array<Skill>;
}