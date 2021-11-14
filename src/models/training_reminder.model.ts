export default interface TrainingReminder {
  userId?: string;
  isStepAdded?: boolean;
  remainingQuizzes?: number;
  lastReminderDateTime?: string;
  reminderToSend?: string;
}