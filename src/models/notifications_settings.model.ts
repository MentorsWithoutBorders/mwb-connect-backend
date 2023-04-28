export default interface NotificationsSettings {
  trainingRemindersEnabled: boolean;
  trainingRemindersTime: string;
	startCourseRemindersEnabled?: boolean;
	startCourseRemindersDate: string | null;
}