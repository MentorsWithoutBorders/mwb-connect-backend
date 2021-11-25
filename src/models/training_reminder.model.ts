import User from "./user.model";

export default interface TrainingReminder {
  id?: string;
  user?: User;
  isStepAdded?: boolean;
  remainingQuizzes?: number;
  firstReminderDate?: string;
  lastReminderDate?: string;
  reminderToSend?: string;
  conversations?: string;
  lastContactedDateTime?: string;
  lastConversationDateTime?: string;
}