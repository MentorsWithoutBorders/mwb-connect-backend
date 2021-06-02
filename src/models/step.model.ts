export default interface Step {
  id: string;
  text: string;
  level?: number;
  index?: number;
  parentId?: string;
}