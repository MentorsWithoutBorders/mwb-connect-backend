import User from "./user.model";

export default interface TrainingReminder {
  user?: User;
  isStepAdded?: boolean;
  remainingQuizzes?: number;
  firstReminderDateTime?: string;
  lastReminderDateTime?: string;
  reminderToSend?: string;
}