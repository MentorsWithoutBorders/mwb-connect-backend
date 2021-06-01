import Step from "./step.model";

export default interface Goal {
  id: string;
  text: string;
  steps?: Array<Step>;
}