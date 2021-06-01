export default interface Step {
  id: string;
  text: string;
  parent: string;
  level: number;
  index: number;
  dateTime: string;
}