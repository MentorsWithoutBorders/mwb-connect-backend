export default interface AvailableMentor {
  id: string;
  isAvailable: boolean;
  availableFrom: string;
  minInterval: number;
  dayOfWeek: string;
  timeFrom: string;
  timeTo: string;
  dateTime: string;
  endRecurrenceDateTime: string;
  isCanceled: boolean;
}