import express, { NextFunction, Request, Response } from 'express';
import cron from 'node-cron';
import dotenv from 'dotenv';
import cors from 'cors';
import { Auth } from './src/db_queries/auth';
import { ApprovedUsers } from './src/db_queries/approved_users';
import { Users } from './src/db_queries/users';
import { UsersResetPassword } from './src/db_queries/users_reset_password';
import { UsersTimeZones } from './src/db_queries/users_timezones';
import { UsersGoals } from './src/db_queries/users_goals';
import { UsersSteps } from './src/db_queries/users_steps';
import { UsersQuizzes } from './src/db_queries/users_quizzes';
import { UsersCourses } from './src/db_queries/users_courses';
import { UsersAvailableMentors } from './src/db_queries/users_available_mentors';
import { UsersLessonRequests } from './src/db_queries/users_lesson_requests';
import { UsersLessons } from './src/db_queries/users_lessons';
import { UsersInAppMessages } from './src/db_queries/users_in_app_messages';
import { UsersCertificatesPauses } from './src/db_queries/users_certificates_pauses';
import { UsersSkills } from './src/db_queries/users_skills';
import { UsersNotificationsSettings } from './src/db_queries/users_notifications_settings';
import { UsersSupportRequests } from './src/db_queries/users_support_requests';
import { UsersPushNotifications } from './src/db_queries/users_push_notifications';
import { UsersSendEmails } from './src/db_queries/users_send_emails';
import { UsersAppVersions } from './src/db_queries/users_app_versions';
import { UsersAppFlags } from './src/db_queries/users_app_flags';
import { UsersBackgroundProcesses } from './src/db_queries/users_background_processes';
import { MentorsWaitingRequests } from './src/db_queries/mentors_waiting_requests';
import { MentorsPartnershipRequests } from './src/db_queries/mentors_partnership_requests';
import { Organizations } from './src/db_queries/organizations';
import { PartnersDashboardStats } from './src/db_queries/partners_dashboard_stats'
import { Fields } from './src/db_queries/fields';
import { Subfields } from './src/db_queries/subfields';
import { Skills } from './src/db_queries/skills';
import { FieldsGoals } from './src/db_queries/fields_goals';
import { FieldsTutorials } from './src/db_queries/fields_tutorials';
import { SubfieldsTutorials } from './src/db_queries/subfields_tutorials';
import { SkillsTutorials } from './src/db_queries/skills_tutorials';
import { TutorialsLessons } from './src/db_queries/tutorials_lessons';
import { Tutorials } from './src/db_queries/tutorials';
import { QuizzesSettings } from './src/db_queries/quizzes_settings';
import { CourseTypes } from './src/db_queries/course_types';
import { Updates } from './src/db_queries/updates';
import { Logger } from './src/db_queries/logger';
import { AdminStudentsCertificates } from './src/db_queries/admin_students_certificates';
import { AdminTrainingReminders } from './src/db_queries/admin_training_reminders';
import { AdminLessons } from './src/db_queries/admin_lessons';
import { AdminAvailableMentors } from './src/db_queries/admin_available_mentors';
import { AdminAvailableStudents } from './src/db_queries/admin_available_students';
import { AdminPartnersMentors } from './src/db_queries/admin_partners_mentors';
import { AdminPartnersMentorStats } from './src/db_queries/admin_partners_mentors_stats';
import { AdminPartnersProjects } from './src/db_queries/admin_partners_projects'
import { AdminPartnersStudents } from "./src/db_queries/admin_partners_students";
import {
  AdminPartnersOrganizationCentres
} from "./src/db_queries/admin_partners_organization_centres";

dotenv.config();
const port = process.env.PORT;
const app = express();
const auth = new Auth();
const users = new Users();
const approvedUsers = new ApprovedUsers();
const usersTimeZones = new UsersTimeZones();
const usersResetPassword = new UsersResetPassword();
const usersPushNotifications = new UsersPushNotifications();
const usersSendEmails = new UsersSendEmails();
const usersGoals = new UsersGoals();
const usersSteps = new UsersSteps();
const usersQuizzes = new UsersQuizzes();
const usersAvailableMentors = new UsersAvailableMentors();
const usersCourses = new UsersCourses();
const usersLessonRequests = new UsersLessonRequests();
const usersLessons = new UsersLessons();
const usersInAppMessages = new UsersInAppMessages();
const usersCertificatesPauses = new UsersCertificatesPauses();
const usersSkills = new UsersSkills();
const usersNotificationsSettings = new UsersNotificationsSettings();
const usersSupportRequests = new UsersSupportRequests();
const usersAppVersions = new UsersAppVersions();
const usersAppFlags = new UsersAppFlags();
const usersBackgroundProcesses = new UsersBackgroundProcesses();
const mentorsWaitingRequests = new MentorsWaitingRequests();
const mentorsPartnershipRequests = new MentorsPartnershipRequests();
const organizations = new Organizations();
const partnersDashboardStats = new PartnersDashboardStats();
const fields = new Fields();
const subfields = new Subfields();
const skills = new Skills();
const fieldsGoals = new FieldsGoals();
const fieldsTutorials = new FieldsTutorials();
const subfieldsTutorials = new SubfieldsTutorials();
const skillsTutorials = new SkillsTutorials();
const tutorialsLessons = new TutorialsLessons();
const tutorials = new Tutorials();
const quizzesSettings = new QuizzesSettings();
const courseTypes = new CourseTypes();
const updates = new Updates();
const logger = new Logger();
const adminStudentsCertificates = new AdminStudentsCertificates();
const adminTrainingReminders = new AdminTrainingReminders();
const adminLessons = new AdminLessons();
const adminAvailableMentors = new AdminAvailableMentors();
const adminAvailableStudents = new AdminAvailableStudents();
const adminPartnersMentors = new AdminPartnersMentors();
const adminPartnersMentorStats = new AdminPartnersMentorStats();
const adminPartnersProjects = new AdminPartnersProjects();
const adminPartnersStudents = new AdminPartnersStudents();
const adminPartnersCentres = new AdminPartnersOrganizationCentres();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

app.get("/", (request: express.Request, response: express.Response): void => {
  response.json({ info: "Node.js, Express, and Postgres API" });
});

const verifyAccessTokenFilter = function (
  request: Request,
  response: Response,
  next: NextFunction
): void {
  if (request.originalUrl.includes("/logger")) {
    if (request.headers.authorization) {
      auth.verifyAccessToken(request, response, next);
    } else {
      next();
    }
  } else if (
    [
      "/approved_user",
      "/organizations",
      "/signup",
      "/login",
      "/access_token",
      "/send_reset_password",
      "/reset_password",
      "/tutorials",
      "/quizzes_settings",
    ].some((route) => request.originalUrl.includes(route))
  ) {
    next();
  } else {
    auth.verifyAccessToken(request, response, next);
  }
};

app.use(verifyAccessTokenFilter);

// Approved users
app.post("/api/v1/approved_user", approvedUsers.addApprovedUser);

// Authentication
app.post("/api/v1/signup", auth.signUp);
app.post("/api/v1/login", auth.login);
app.post("/api/v1/logout", auth.logout);
app.get("/api/v1/users/:id/access_token", auth.getAccessToken);

// Users reset password
app.post(
  "/api/v1/send_reset_password/:email",
  usersResetPassword.addUserResetPassword
);
app.post("/api/v1/reset_password", usersResetPassword.resetPassword);

// Users
app.get("/api/v1/user", users.getUser);
app.put("/api/v1/user", users.updateUser);
app.delete("/api/v1/user", users.deleteUser);

// Users FCM tokens
app.post("/api/v1/fcm_tokens", usersPushNotifications.addFCMToken);

// Users timezones
app.put("/api/v1/timezones", usersTimeZones.updateTimeZone);

// Users goals
app.get("/api/v1/goals", usersGoals.getGoals);
app.get("/api/v1/goals/:id", usersGoals.getGoalById);
app.post("/api/v1/goals", usersGoals.addGoal);
app.put("/api/v1/goals/:id", usersGoals.updateGoal);
app.delete("/api/v1/goals/:id", usersGoals.deleteGoal);
app.delete("/api/v1/goals", usersGoals.deleteGoals);

// Users steps
app.get("/api/v1/goals/:id/steps", usersSteps.getSteps);
app.get("/api/v1/steps/all", usersSteps.getAllSteps);
app.get("/api/v1/steps/:id", usersSteps.getStepById);
app.post("/api/v1/goals/:id/steps", usersSteps.addStep);
app.put("/api/v1/steps/:id", usersSteps.updateStep);
app.delete("/api/v1/steps/:id", usersSteps.deleteStep);
app.delete("/api/v1/goals/:id/steps", usersSteps.deleteSteps);
app.get("/api/v1/last_step_added", usersSteps.getLastStepAdded);

// Users quizzes
app.get("/api/v1/quizzes", usersQuizzes.getQuizzes);
app.get("/api/v1/quiz_number", usersQuizzes.getQuizNumber);
app.post("/api/v1/quizzes", usersQuizzes.addQuiz);

// Users courses
app.post("/api/v1/courses", usersCourses.getAvailableCourses);
app.get("/api/v1/courses/fields", usersCourses.getAvailableCoursesFields);
app.get("/api/v1/courses/current", usersCourses.getCurrentCourse);
app.get("/api/v1/courses/previous", usersCourses.getPreviousCourse);
app.get("/api/v1/courses/next_lesson", usersCourses.getNextLesson);
app.get(
  "/api/v1/courses/:id/mentor_partnership_schedule",
  usersCourses.getMentorPartnershipSchedule
);
app.get("/api/v1/courses/:id/notes", usersCourses.getNotes);
app.post("/api/v1/courses/add", usersCourses.addCourse);
app.put("/api/v1/courses/:id/join", usersCourses.joinCourse);
app.put("/api/v1/courses/:id/meeting_url", usersCourses.setMeetingUrl);
app.put(
  "/api/v1/courses/:id/whatsapp_group_url",
  usersCourses.setWhatsAppGroupUrl
);
app.put("/api/v1/courses/:id/notes", usersCourses.updateNotes);
app.put("/api/v1/courses/:id/cancel", usersCourses.cancelCourse);
app.put(
  "/api/v1/courses/:id/cancel_next_lesson",
  usersCourses.cancelNextLesson
);
app.put(
  "/api/v1/mentor_partnership_schedule",
  usersCourses.updateMentorPartnershipSchedule
);

// Users available mentors
app.post(
  "/api/v1/available_mentors",
  usersAvailableMentors.getAvailableMentors
);
app.get(
  "/api/v1/available_mentors/fields",
  usersAvailableMentors.getAvailableMentorsFields
);

// Users lesson requests
app.post("/api/v1/lesson_requests", usersLessonRequests.addLessonRequest);
app.get("/api/v1/lesson_request", usersLessonRequests.getLessonRequest);
app.post(
  "/api/v1/lesson_requests/send_custom_lesson_request",
  usersLessonRequests.sendCustomLessonRequest
);
app.post(
  "/api/v1/lesson_requests/:id/accept_lesson_request",
  usersLessonRequests.acceptLessonRequest
);
app.put(
  "/api/v1/lesson_requests/:id/reject_lesson_request",
  usersLessonRequests.rejectLessonRequest
);
app.put(
  "/api/v1/lesson_requests/:id/cancel_lesson_request",
  usersLessonRequests.cancelLessonRequest
);
app.put(
  "/api/v1/lesson_requests/:id/update_lesson_request",
  usersLessonRequests.updateLessonRequest
);

// Users lessons
app.get("/api/v1/next_lesson", usersLessons.getNextLesson);
app.get("/api/v1/previous_lesson", usersLessons.getPreviousLesson);
app.put("/api/v1/lessons/:id/cancel_lesson", usersLessons.cancelLesson);
app.put("/api/v1/lessons/:id/meeting_url", usersLessons.setLessonUrl);
app.put("/api/v1/lessons/:id/recurrence", usersLessons.setLessonRecurrence);
app.put("/api/v1/lessons/:id/skills", usersLessons.addStudentsSkills);
app.post("/api/v1/lessons/:id/notes", usersLessons.addStudentsLessonNotes);
app.get("/api/v1/users/:id/lessons_notes", usersLessons.getStudentLessonNotes);
app.get(
  "/api/v1/lessons/:id/guide_tutorials",
  usersLessons.getLessonGuideTutorials
);
app.get(
  "/api/v1/lessons/:id/guide_recommendations",
  usersLessons.getLessonGuideRecommendations
);
app.put(
  "/api/v1/lessons/:id/mentor_presence",
  usersLessons.setLessonPresenceMentor
);

// Users certificates pauses
app.get(
  "/api/v1/certificate_pause",
  usersCertificatesPauses.getUserCertificatePause
);
app.post(
  "/api/v1/certificate_pause",
  usersCertificatesPauses.addUserCertificatePause
);

// Users in-app messages
app.get("/api/v1/in_app_messages", usersInAppMessages.getUserInAppMessage);
app.post("/api/v1/in_app_messages", usersInAppMessages.addUserInAppMessage);
app.delete(
  "/api/v1/in_app_messages",
  usersInAppMessages.deleteUserInAppMessage
);

// Users skills
app.get(
  "/api/v1/users/:user_id/subfields/:subfield_id/skills",
  usersSkills.getUserSkills
);
app.post("/api/v1/user/subfields/:id/skills", usersSkills.addUserSkills);

// Users notifications settings
app.get(
  "/api/v1/notifications_settings",
  usersNotificationsSettings.getNotificationsSettings
);
app.put(
  "/api/v1/notifications_settings",
  usersNotificationsSettings.updateNotificationsSettings
);

// Users support requests
app.post("/api/v1/support_requests", usersSupportRequests.addSupportRequest);

// Users app flags
app.get("/api/v1/app_flags", usersAppFlags.getAppFlags);

// Mentors waiting requests
app.post(
  "/api/v1/mentors_waiting_requests",
  mentorsWaitingRequests.getMentorsWaitingRequests
);
app.get(
  "/api/v1/mentors_waiting_requests/current",
  mentorsWaitingRequests.getCurrentMentorWaitingRequest
);
app.post(
  "/api/v1/mentors_waiting_requests/add",
  mentorsWaitingRequests.addMentorWaitingRequest
);
app.put(
  "/api/v1/mentors_waiting_requests/cancel",
  mentorsWaitingRequests.cancelMentorWaitingRequest
);

// Mentors partnership requests
app.get(
  "/api/v1/mentors_partnership_requests/current",
  mentorsPartnershipRequests.getCurrentMentorPartnershipRequest
);
app.post(
  "/api/v1/mentors_partnership_requests",
  mentorsPartnershipRequests.sendMentorPartnershipRequest
);
app.post(
  "/api/v1/mentors_partnership_requests/:id/accept",
  mentorsPartnershipRequests.acceptMentorPartnershipRequest
);
app.put(
  "/api/v1/mentors_partnership_requests/:id/reject",
  mentorsPartnershipRequests.rejectMentorPartnershipRequest
);
app.put(
  "/api/v1/mentors_partnership_requests/:id/cancel",
  mentorsPartnershipRequests.cancelMentorPartnershipRequest
);
app.put(
  "/api/v1/mentors_partnership_requests/:id/update",
  mentorsPartnershipRequests.updateMentorPartnershipRequest
);

// Organizations
app.get("/api/v1/organizations/id/:id", organizations.getOrganizationById);
app.get(
  "/api/v1/organizations/name/:name",
  organizations.getOrganizationByName
);

// Organizations Centres
app.get(
  "/api/v1/organizations/:id/centres",
  organizations.getOrganizationCentresByOrganizationId
);

// Partners
app.get('/api/v1/partners/dashboard/stats', partnersDashboardStats.getDashboardStats);
app.get('/api/v1/partners/:partner_id/dashboard/stats', partnersDashboardStats.getDashboardStatsByPartnerId);
// Returns the location of the org centres of _all_ the partners
// that have had at least one active student.
// Filtering by date is possible.
app.get(
  '/api/v1/partners/dashboard/organization-centres',
  adminPartnersCentres.getDashboardOrganizationCentres
);
// Returns the location of the org centres of _a specific_ partner
// that have had at least one active student.
// Filtering by date is possible.
app.get(
  '/api/v1/partners/:partner_id/dashboard/organization-centres',
  adminPartnersCentres.getDashboardOrganizationCentresByPartnerId
);

// Fields
app.get("/api/v1/fields", fields.getFields);
app.get("/api/v1/fields_goals", fieldsGoals.getFieldsGoals);
app.get("/api/v1/fields/:id", fields.getFieldById);
app.post("/api/v1/fields", fields.addField);
app.put("/api/v1/fields/:id", fields.updateField);
app.delete("/api/v1/fields/:id", fields.deleteField);

// Subfields
app.get("/api/v1/fields/:id/subfields", subfields.getSubfields);
app.get("/api/v1/subfields/:id", subfields.getSubfieldById);
app.post("/api/v1/fields/:id/subfields", subfields.addSubfield);
app.put("/api/v1/subfields/:id", subfields.updateSubfield);
app.delete("/api/v1/subfields/:id", subfields.deleteSubfield);

// Skills
app.get("/api/v1/subfields/:id/skills", skills.getSkills);
app.get("/api/v1/skills/:id", skills.getSkillById);
app.post("/api/v1/subfields/:id/skills", skills.addSkill);
app.put("/api/v1/skills/:id", skills.updateSkill);
app.delete("/api/v1/skills/:id", skills.deleteSkill);

// Fields tutorials
app.get("/api/v1/fields_tutorials", fieldsTutorials.getFieldsTutorials);
app.get("/api/v1/fields_tutorials/:id", fieldsTutorials.getFieldTutorialById);
app.post("/api/v1/fields_tutorials", fieldsTutorials.addFieldTutorial);
app.put("/api/v1/fields_tutorials/:id", fieldsTutorials.updateFieldTutorial);
app.delete("/api/v1/fields_tutorials/:id", fieldsTutorials.deleteFieldTutorial);

// Subfields tutorials
app.get(
  "/api/v1/subfields_tutorials",
  subfieldsTutorials.getSubfieldsTutorials
);
app.get(
  "/api/v1/subfields_tutorials/:id",
  subfieldsTutorials.getSubfieldTutorialById
);
app.post("/api/v1/subfields_tutorials", subfieldsTutorials.addSubfieldTutorial);
app.put(
  "/api/v1/subfields_tutorials/:id",
  subfieldsTutorials.updateSubfieldTutorial
);
app.delete(
  "/api/v1/subfields_tutorials/:id",
  subfieldsTutorials.deleteSubfieldTutorial
);

// Skills tutorials
app.get("/api/v1/skills_tutorials", skillsTutorials.getSkillsTutorials);
app.get("/api/v1/skills_tutorials/:id", skillsTutorials.getSkillTutorialById);
app.post("/api/v1/skills_tutorials", skillsTutorials.addSkillTutorial);
app.put("/api/v1/skills_tutorials/:id", skillsTutorials.updateSkillTutorial);
app.delete("/api/v1/skills_tutorials/:id", skillsTutorials.deleteSkillTutorial);

// Tutorials lessons
app.get("/api/v1/tutorials_lessons", tutorialsLessons.getTutorialsLessons);

// Tutorials
app.get("/api/v1/tutorials", tutorials.getTutorials);

// Quizzes settings
app.get("/api/v1/quizzes_settings", quizzesSettings.getQuizzesSettings);

// Courses types
app.get("/api/v1/course_types", courseTypes.getCourseTypes);

// Updates
app.get("/api/v1/updates", updates.getUpdates);

// Users app versions
app.post("/api/v1/app_versions", usersAppVersions.addAppVersion);

// Logger
app.post("/api/v1/logger", logger.addLogEntry);

// Users background processes
app.post(
  "/api/v1/send_training_reminders",
  usersBackgroundProcesses.sendAllTrainingReminders
);
app.post(
  "/api/v1/send_course_lesson_reminders",
  usersBackgroundProcesses.sendNextCourseLessonReminders
);
app.post(
  "/api/v1/send_lesson_request_reminders",
  usersBackgroundProcesses.sendAllLessonRequestReminders
);
app.post(
  "/api/v1/send_lesson_reminders",
  usersBackgroundProcesses.sendAllLessonReminders
);
app.post(
  "/api/v1/available_courses/fields",
  usersBackgroundProcesses.setAvailableCoursesFields
);
app.post(
  "/api/v1/available_mentors/fields",
  usersBackgroundProcesses.setAvailableMentorsFields
);

cron.schedule("* * * * *", async () => {
  await usersBackgroundProcesses.sendAllTrainingRemindersFromDB();
  await usersBackgroundProcesses.sendNextCourseLessonRemindersFromDB();
  await usersBackgroundProcesses.sendAllLessonRequestRemindersFromDB();
  await usersBackgroundProcesses.sendAllLessonRemindersFromDB();
  usersBackgroundProcesses.sendCPUUsage();
});

cron.schedule("*/5 * * * *", function () {
  usersCourses.setAvailableCoursesFieldsFromDB();
  usersAvailableMentors.setAvailableMentorsFieldsFromDB();
});

// Admin students certificates
app.get(
  "/api/v1/admin/students_certificates",
  adminStudentsCertificates.getStudentsCertificates
);
app.get(
  "/api/v1/admin/students_certificates/certificate_sent",
  adminStudentsCertificates.getCertificateSent
);
app.put(
  "/api/v1/admin/students_certificates/:student_id/certificate_sent",
  adminStudentsCertificates.updateCertificateSent
);

// Admin training reminders
app.get(
  "/api/v1/admin/training_reminders",
  adminTrainingReminders.getTrainingReminders
);
app.get(
  "/api/v1/admin/all_training_reminders",
  adminTrainingReminders.getAllTrainingReminders
);
app.get(
  "/api/v1/admin/:trainer_id/training_reminders",
  adminTrainingReminders.getTrainingReminders
);
app.get(
  "/api/v1/admin/:trainer_id/all_training_reminders",
  adminTrainingReminders.getAllTrainingReminders
);
app.get("/api/v1/admin/trainers", adminTrainingReminders.getTrainers);
app.post("/api/v1/admin/conversations", adminTrainingReminders.addConversation);
app.put(
  "/api/v1/admin/training_reminders/:id/last_contacted",
  adminTrainingReminders.updateLastContacted
);

// Admin partners' mentors
app.get(
  "/api/v1/partners/:partner_id/mentors",
  adminPartnersMentors.getAllMentorsOfOnePartner
);
// Admin partners' mentor stats
app.get(
  '/api/v1/partners/:partner_id/mentors/stats',
  adminPartnersMentorStats.getAllMentorsStatsOfOnePartner
);
// Mentor details
app.get(
  "/api/v1/partners/:partner_id/mentors/:mentor_id",
  adminPartnersMentors.getMentorDetails
);
// Admin partners' students
app.get(
  '/api/v1/partners/:partner_id/students',
  adminPartnersStudents.getAllStudentsOfOnePartner
);

// Admin - Get partner projects
app.get(
  "/api/v1/partners/:partner_id/projects",
  adminPartnersProjects.getAllProjectsOfOnePartner
);

// Admin - Create partner project
app.post(
  "/api/v1/partners/:partner_id/projects",
  adminPartnersProjects.createProjectOfOnePartner
);

// Admin lessons
app.get("/api/v1/admin/lessons", adminLessons.getLessons);

// Admin available mentors
app.get(
  "/api/v1/admin/available_mentors_lessons",
  adminAvailableMentors.getAvailableMentorsLessons
);
app.put(
  "/api/v1/admin/available_mentors/:mentor_id/should_contact",
  adminAvailableMentors.updateShouldContact
);

// Admin available students
app.get(
  "/api/v1/admin/available_students_lessons",
  adminAvailableStudents.getAvailableStudentsLessons
);
app.put(
  "/api/v1/admin/available_students/:student_id/should_contact",
  adminAvailableStudents.updateShouldContact
);

// Tests notifications
app.post(
  "/api/v1/test/:user_id/send_push_notification",
  usersPushNotifications.sendPNTest
);
app.post("/api/v1/test/:user_id/send_email", usersSendEmails.sendEmailTest);

app.listen(port, () => {
  console.log(`App running on port ${port}.`);
});
