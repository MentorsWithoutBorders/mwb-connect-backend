import AvailabilityTime from "./availability_time.model";

export default interface Availability {
  dayOfWeek: string;
  time: AvailabilityTime;
  isPreferred?: boolean;
}