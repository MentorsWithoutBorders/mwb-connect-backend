export default interface AvailableMentor {
  id: string;
  isAvailable: boolean;
  availableFrom: string;
  minInterval: number;
  dayOfWeek: string;
  timeFrom: string;
  timeTo: string;
  dateTime: string;
  isRecurrent: boolean;
  endRecurrenceDateTime: string;
  isCanceled: boolean;
}