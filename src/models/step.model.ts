export default interface Step {
  id?: string;
  userId?: string;
  text?: string;
  level?: number;
  index?: number;
  parentId?: string;
  dateTime?: string;
}