import User from "./user.model";

export default interface TrainingReminder {
  id?: string;
  user?: User;
  certificateDate?: string;
  firstReminderDate?: string;
  lastReminderDate?: string;
  isStepAdded?: boolean;
  remainingQuizzes?: number;  
  reminderToSend?: string;
  conversations?: string;
  lastContactedDateTime?: string;
  lastConversationDateTime?: string;
  isOverdue?: boolean;
}