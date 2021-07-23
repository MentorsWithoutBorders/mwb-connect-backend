export default interface AvailableMentor {
  id: string;
  availableFrom: string;
  minInterval: number;
  dayOfWeek: string;
  timeFrom: string;
  timeTo: string;
  dateTime: string;
  isRecurrent: boolean;
  endRecurrenceDateTime: string;
}