import Skill from "./skill.model";

export default interface Subfield {
  id: string;
  name?: string;
  skills?: Array<Skill>;
}