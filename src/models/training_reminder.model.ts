import User from "./user.model";

export default interface TrainingReminder {
  user?: User;
  isStepAdded?: boolean;
  remainingQuizzes?: number;
  lastReminderDateTime?: string;
  reminderToSend?: string;
}