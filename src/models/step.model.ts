export default interface Step {
  id?: string;
  goalId?: string;
  text?: string;
  level?: number;
  position?: number;
  index?: number;
  parentId?: string;
  dateTime?: string;
}