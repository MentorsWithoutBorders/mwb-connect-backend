export default interface NotificationsSettings {
	enabled?: boolean;
	time?: string;
  trainingRemindersEnabled: boolean;
  trainingRemindersTime: string;
	startCourseRemindersEnabled?: boolean;
	startCourseRemindersDate: string | null;
}