ALTER TABLE "public"."users_timezones" DROP CONSTRAINT IF EXISTS "users_timezones_user_id_fkey";
ALTER TABLE "public"."users_support_requests" DROP CONSTRAINT IF EXISTS "users_support_requests_user_id_fkey";
ALTER TABLE "public"."users_subfields" DROP CONSTRAINT IF EXISTS "users_subfields_user_id_fkey";
ALTER TABLE "public"."users_subfields" DROP CONSTRAINT IF EXISTS "users_subfields_subfield_id_fkey";
ALTER TABLE "public"."users_steps" DROP CONSTRAINT IF EXISTS "users_steps_goal_id_fkey";
ALTER TABLE "public"."users_steps" DROP CONSTRAINT IF EXISTS "users_steps_user_id_fkey";
ALTER TABLE "public"."users_skills" DROP CONSTRAINT IF EXISTS "users_skills_user_id_fkey";
ALTER TABLE "public"."users_skills" DROP CONSTRAINT IF EXISTS "users_skills_subfield_id_fkey";
ALTER TABLE "public"."users_skills" DROP CONSTRAINT IF EXISTS "users_skills_skill_id_fkey";
ALTER TABLE "public"."users_refresh_tokens" DROP CONSTRAINT IF EXISTS "users_refresh_tokens_user_id_fkey";
ALTER TABLE "public"."users_quizzes" DROP CONSTRAINT IF EXISTS "users_quizzes_user_id_fkey";
ALTER TABLE "public"."users_notifications_settings" DROP CONSTRAINT IF EXISTS "users_notifications_settings_user_id_fkey";
ALTER TABLE "public"."users_lessons_students" DROP CONSTRAINT IF EXISTS "users_lessons_students_student_id_fkey";
ALTER TABLE "public"."users_lessons_students" DROP CONSTRAINT IF EXISTS "users_lessons_students_lesson_id_fkey";
ALTER TABLE "public"."users_lessons_stopped" DROP CONSTRAINT IF EXISTS "users_lessons_stopped_student_id_fkey";
ALTER TABLE "public"."users_lessons_notes" DROP CONSTRAINT IF EXISTS "users_lessons_notes_student_id_fkey";
ALTER TABLE "public"."users_lessons_notes" DROP CONSTRAINT IF EXISTS "users_lessons_notes_lesson_id_fkey";
ALTER TABLE "public"."users_lessons_canceled" DROP CONSTRAINT IF EXISTS "users_lessons_canceled_lesson_id_fkey";
ALTER TABLE "public"."users_lessons_canceled" DROP CONSTRAINT IF EXISTS "users_lessons_canceled_user_id_fkey";
ALTER TABLE "public"."users_lessons_availabilities" DROP CONSTRAINT IF EXISTS "users_lessons_availabilities_user_id_fkey";
ALTER TABLE "public"."users_lessons" DROP CONSTRAINT IF EXISTS "users_lessons_mentor_id_fkey";
ALTER TABLE "public"."users_lessons" DROP CONSTRAINT IF EXISTS "users_lessons_subfield_id_fkey";
ALTER TABLE "public"."users_lessons_students" DROP CONSTRAINT IF EXISTS "users_lessons_students_student_id_fkey";
ALTER TABLE "public"."users_lessons_students" DROP CONSTRAINT IF EXISTS "users_lessons_students_lesson_id_fkey";
ALTER TABLE "public"."users_lessons_notes" DROP CONSTRAINT IF EXISTS "users_lessons_notes_lesson_id_fkey";
ALTER TABLE "public"."users_lessons_notes" DROP CONSTRAINT IF EXISTS "users_lessons_notes_student_id_fkey";
ALTER TABLE "public"."users_lessons_canceled" DROP CONSTRAINT IF EXISTS "users_lessons_canceled_user_id_fkey";
ALTER TABLE "public"."users_lessons_canceled" DROP CONSTRAINT IF EXISTS "users_lessons_canceled_lesson_id_fkey";
ALTER TABLE "public"."users_lessons_availabilities" DROP CONSTRAINT IF EXISTS "users_lessons_availabilities_user_id_fkey";
ALTER TABLE "public"."users_lessons" DROP CONSTRAINT IF EXISTS "users_lessons_mentor_id_fkey";
ALTER TABLE "public"."users_lessons" DROP CONSTRAINT IF EXISTS "users_lessons_subfield_id_fkey";
ALTER TABLE "public"."users_lesson_requests" DROP CONSTRAINT IF EXISTS "users_lesson_requests_student_id_fkey";
ALTER TABLE "public"."users_lesson_requests" DROP CONSTRAINT IF EXISTS "users_lesson_requests_subfield_id_fkey";
ALTER TABLE "public"."users_lesson_requests" DROP CONSTRAINT IF EXISTS "users_lesson_requests_mentor_id_fkey";
ALTER TABLE "public"."users_goals" DROP CONSTRAINT IF EXISTS "users_goals_user_id_fkey";
ALTER TABLE "public"."users_fcm_tokens" DROP CONSTRAINT IF EXISTS "users_fcm_tokens_user_id_fkey";
ALTER TABLE "public"."users_courses_students" DROP CONSTRAINT IF EXISTS "users_courses_students_student_id_fkey";
ALTER TABLE "public"."users_courses_students" DROP CONSTRAINT IF EXISTS "users_courses_students_course_id_fkey";
ALTER TABLE "public"."users_courses_partnership_schedule" DROP CONSTRAINT IF EXISTS "users_courses_partnership_schedule_course_id_fkey";
ALTER TABLE "public"."users_courses_partnership_schedule" DROP CONSTRAINT IF EXISTS "users_courses_partnership_schedule_mentor_id_fkey";
ALTER TABLE "public"."users_courses_mentors" DROP CONSTRAINT IF EXISTS "users_courses_mentors_mentor_id_fkey";
ALTER TABLE "public"."users_courses_mentors" DROP CONSTRAINT IF EXISTS "users_courses_mentors_course_id_fkey";
ALTER TABLE "public"."users_courses_mentors" DROP CONSTRAINT IF EXISTS "users_courses_mentors_subfield_id_fkey";
ALTER TABLE "public"."users_courses_lessons_canceled" DROP CONSTRAINT IF EXISTS "users_courses_lessons_canceled_course_id_fkey";
ALTER TABLE "public"."users_courses_mentors" DROP CONSTRAINT IF EXISTS "users_courses_mentors_course_id_fkey";
ALTER TABLE "public"."users_courses_mentors" DROP CONSTRAINT IF EXISTS "users_courses_mentors_mentor_id_fkey";
ALTER TABLE "public"."users_courses_mentors" DROP CONSTRAINT IF EXISTS "users_courses_mentors_subfield_id_fkey";
ALTER TABLE "public"."users_courses" DROP CONSTRAINT IF EXISTS "users_courses_course_type_id_fkey";
ALTER TABLE "public"."users_courses" DROP CONSTRAINT IF EXISTS "users_courses_course_id_fkey";
ALTER TABLE "public"."users_courses" DROP CONSTRAINT IF EXISTS "users_courses_user_id_fkey";
ALTER TABLE "public"."users_certificates_pauses" DROP CONSTRAINT IF EXISTS "users_certificates_pauses_user_id_fkey";
ALTER TABLE "public"."users_availabilities" DROP CONSTRAINT IF EXISTS "users_availabilities_user_id_fkey";
ALTER TABLE "public"."users_app_versions" DROP CONSTRAINT IF EXISTS "users_app_versions_user_id_fkey";
ALTER TABLE "public"."users_app_flags" DROP CONSTRAINT IF EXISTS "users_app_flags_user_id_fkey";
ALTER TABLE "public"."users" DROP CONSTRAINT IF EXISTS "users_organization_id_fkey";
ALTER TABLE "public"."users" DROP CONSTRAINT IF EXISTS "users_field_id_fkey";
ALTER TABLE "public"."users_lessons" DROP CONSTRAINT IF EXISTS "users_lessons_mentor_id_fkey";
ALTER TABLE "public"."users_lessons" DROP CONSTRAINT IF EXISTS "users_lessons_subfield_id_fkey";
ALTER TABLE "public"."users_lesson_requests" DROP CONSTRAINT IF EXISTS "users_lesson_requests_student_id_fkey";
ALTER TABLE "public"."users_lesson_requests" DROP CONSTRAINT IF EXISTS "users_lesson_requests_subfield_id_fkey";
ALTER TABLE "public"."users_lesson_requests" DROP CONSTRAINT IF EXISTS "users_lesson_requests_mentor_id_fkey";
ALTER TABLE "public"."users_in_app_messages" DROP CONSTRAINT IF EXISTS "users_in_app_messages_user_id_fkey";
ALTER TABLE "public"."users_goals" DROP CONSTRAINT IF EXISTS "users_goals_user_id_fkey";
ALTER TABLE "public"."users_fcm_tokens" DROP CONSTRAINT IF EXISTS "users_fcm_tokens_user_id_fkey";
ALTER TABLE "public"."users_courses_students" DROP CONSTRAINT IF EXISTS "users_courses_students_student_id_fkey";
ALTER TABLE "public"."users_courses_students" DROP CONSTRAINT IF EXISTS "users_courses_students_course_id_fkey";
ALTER TABLE "public"."users_courses_partnership_schedule" DROP CONSTRAINT IF EXISTS "users_courses_partnership_schedule_course_id_fkey";
ALTER TABLE "public"."users_courses_partnership_schedule" DROP CONSTRAINT IF EXISTS "users_courses_partnership_schedule_mentor_id_fkey";
ALTER TABLE "public"."users_courses_mentors" DROP CONSTRAINT IF EXISTS "users_courses_mentors_mentor_id_fkey";
ALTER TABLE "public"."users_courses_mentors" DROP CONSTRAINT IF EXISTS "users_courses_mentors_course_id_fkey";
ALTER TABLE "public"."users_courses_mentors" DROP CONSTRAINT IF EXISTS "users_courses_mentors_subfield_id_fkey";
ALTER TABLE "public"."users_courses_lessons_canceled" DROP CONSTRAINT IF EXISTS "users_courses_lessons_canceled_course_id_fkey";
ALTER TABLE "public"."users_courses_mentors" DROP CONSTRAINT IF EXISTS "users_courses_mentors_course_id_fkey";
ALTER TABLE "public"."users_courses_mentors" DROP CONSTRAINT IF EXISTS "users_courses_mentors_mentor_id_fkey";
ALTER TABLE "public"."users_courses_mentors" DROP CONSTRAINT IF EXISTS "users_courses_mentors_subfield_id_fkey";
ALTER TABLE "public"."users_courses" DROP CONSTRAINT IF EXISTS "users_courses_course_type_id_fkey";
ALTER TABLE "public"."users_courses" DROP CONSTRAINT IF EXISTS "users_courses_course_id_fkey";
ALTER TABLE "public"."users_courses" DROP CONSTRAINT IF EXISTS "users_courses_user_id_fkey";
ALTER TABLE "public"."users_certificates_pauses" DROP CONSTRAINT IF EXISTS "users_certificates_pauses_user_id_fkey";
ALTER TABLE "public"."users_availabilities" DROP CONSTRAINT IF EXISTS "users_availabilities_user_id_fkey";
ALTER TABLE "public"."users_app_versions" DROP CONSTRAINT IF EXISTS "users_app_versions_user_id_fkey";
ALTER TABLE "public"."users_app_flags" DROP CONSTRAINT IF EXISTS "users_app_flags_user_id_fkey";
ALTER TABLE "public"."users" DROP CONSTRAINT IF EXISTS "users_organization_id_fkey";
ALTER TABLE "public"."users" DROP CONSTRAINT IF EXISTS "users_field_id_fkey";
ALTER TABLE "public"."tutorials_sections" DROP CONSTRAINT IF EXISTS "tutorials_sections_tutorial_id_fkey";
ALTER TABLE "public"."subfields_tutorials" DROP CONSTRAINT IF EXISTS "subfields_tutorials_subfield_id_fkey";
ALTER TABLE "public"."subfields_tutorials" DROP CONSTRAINT IF EXISTS "subfields_tutorials_tutorial_id_fkey";
ALTER TABLE "public"."subfields_skills" DROP CONSTRAINT IF EXISTS "subfields_skills_subfield_id_fkey";
ALTER TABLE "public"."subfields_skills" DROP CONSTRAINT IF EXISTS "subfields_skills_skill_id_fkey";
ALTER TABLE "public"."skills_tutorials" DROP CONSTRAINT IF EXISTS "skills_tutorials_skill_id_fkey";
ALTER TABLE "public"."skills_tutorials" DROP CONSTRAINT IF EXISTS "skills_tutorials_tutorial_id_fkey";
ALTER TABLE "public"."projects_courses" DROP CONSTRAINT IF EXISTS "projects_courses_project_id_fkey";
ALTER TABLE "public"."projects_courses" DROP CONSTRAINT IF EXISTS "projects_courses_course_id_fkey";
ALTER TABLE "public"."projects" DROP CONSTRAINT IF EXISTS "projects_organization_id_fkey";
ALTER TABLE "public"."organizations_centers_expenses_paid" DROP CONSTRAINT IF EXISTS "organizations_centers_expenses_paid_center_id_fkey";
ALTER TABLE "public"."organizations_centers_expenses" DROP CONSTRAINT IF EXISTS "organizations_centers_expenses_center_id_fkey";
ALTER TABLE "public"."organizations_centers" DROP CONSTRAINT IF EXISTS "organizations_centers_manager_id_fkey";
ALTER TABLE "public"."organizations_centers" DROP CONSTRAINT IF EXISTS "organizations_centers_organization_id_fkey";
ALTER TABLE "public"."organizations" DROP CONSTRAINT IF EXISTS "organizations_manager_id_fkey";
ALTER TABLE "public"."mentors_waiting_requests" DROP CONSTRAINT IF EXISTS "mentors_waiting_requests_mentor_id_fkey";
ALTER TABLE "public"."mentors_partnership_requests" DROP CONSTRAINT IF EXISTS "mentors_partnership_requests_subfield_id_fkey";
ALTER TABLE "public"."mentors_partnership_requests" DROP CONSTRAINT IF EXISTS "mentors_partnership_requests_partner_subfield_id_fkey";
ALTER TABLE "public"."mentors_partnership_requests" DROP CONSTRAINT IF EXISTS "mentors_partnership_requests_mentor_id_fkey";
ALTER TABLE "public"."mentors_partnership_requests" DROP CONSTRAINT IF EXISTS "mentors_partnership_requests_course_type_id_fkey";
ALTER TABLE "public"."mentors_partnership_requests" DROP CONSTRAINT IF EXISTS "mentors_partnership_requests_partner_mentor_id_fkey";
ALTER TABLE "public"."logger" DROP CONSTRAINT IF EXISTS "logger_user_id_fkey";
ALTER TABLE "public"."guides_skills_tutorials" DROP CONSTRAINT IF EXISTS "guides_skills_tutorials_tutorial_id_fkey";
ALTER TABLE "public"."guides_skills_tutorials" DROP CONSTRAINT IF EXISTS "guides_skills_tutorials_skill_id_fkey";
ALTER TABLE "public"."guides_recommendations" DROP CONSTRAINT IF EXISTS "guides_recommendations_field_id_fkey";
ALTER TABLE "public"."guides_recommendations" DROP CONSTRAINT IF EXISTS "guides_recommendations_subfield_id_fkey";
ALTER TABLE "public"."fields_tutorials" DROP CONSTRAINT IF EXISTS "fields_tutorials_field_id_fkey";
ALTER TABLE "public"."fields_tutorials" DROP CONSTRAINT IF EXISTS "fields_tutorials_tutorial_id_fkey";
ALTER TABLE "public"."fields_subfields" DROP CONSTRAINT IF EXISTS "fields_subfields_field_id_fkey";
ALTER TABLE "public"."fields_subfields" DROP CONSTRAINT IF EXISTS "fields_subfields_subfield_id_fkey";
ALTER TABLE "public"."approved_users" DROP CONSTRAINT IF EXISTS "approved_users_field_id_fkey";
ALTER TABLE "public"."approved_users" DROP CONSTRAINT IF EXISTS "approved_users_organization_id_fkey";
ALTER TABLE "public"."admin_training_reminders" DROP CONSTRAINT IF EXISTS "admin_training_reminders_user_id_fkey";
ALTER TABLE "public"."admin_trainers_workdays" DROP CONSTRAINT IF EXISTS "admin_trainers_workdays_trainer_id_fkey";
ALTER TABLE "public"."admin_students_certificates" DROP CONSTRAINT IF EXISTS "admin_students_certificates_user_id_fkey";
ALTER TABLE "public"."admin_permissions" DROP CONSTRAINT IF EXISTS "admin_permissions_user_id_fkey";
ALTER TABLE "public"."admin_conversations" DROP CONSTRAINT IF EXISTS "admin_conversations_user_id_fkey";
ALTER TABLE "public"."admin_available_users" DROP CONSTRAINT IF EXISTS "admin_available_users_user_id_fkey";
ALTER TABLE "public"."admin_assigned_users" DROP CONSTRAINT IF EXISTS "admin_assigned_users_assigned_user_id_fkey";
ALTER TABLE "public"."admin_assigned_users" DROP CONSTRAINT IF EXISTS "admin_assigned_users_trainer_id_fkey";

DELETE FROM "public"."users_timezones";
DELETE FROM "public"."users_support_requests";
DELETE FROM "public"."users_subfields";
DELETE FROM "public"."users_steps";
DELETE FROM "public"."users_skills";
DELETE FROM "public"."users_refresh_tokens";
DELETE FROM "public"."users_quizzes";
DELETE FROM "public"."users_notifications_settings";
DELETE FROM "public"."users_lessons_students";
DELETE FROM "public"."users_lessons_stopped";
DELETE FROM "public"."users_lessons_notes";
DELETE FROM "public"."users_lessons_canceled";
DELETE FROM "public"."users_lessons_availabilities";
DELETE FROM "public"."users_lessons";
DELETE FROM "public"."users_lesson_requests";
DELETE FROM "public"."users_goals";
DELETE FROM "public"."users_fcm_tokens";
DELETE FROM "public"."users_courses_students";
DELETE FROM "public"."users_courses_partnership_schedule";
DELETE FROM "public"."users_courses_mentors";
DELETE FROM "public"."users_courses_lessons_canceled";
DELETE FROM "public"."users_courses";
DELETE FROM "public"."users_certificates_pauses";
DELETE FROM "public"."users_availabilities";
DELETE FROM "public"."users_app_versions";
DELETE FROM "public"."users_app_flags";
DELETE FROM "public"."users";
DELETE FROM "public"."tutorials_sections";
DELETE FROM "public"."subfields_tutorials";
DELETE FROM "public"."subfields_skills";
DELETE FROM "public"."skills_tutorials";
DELETE FROM "public"."projects_courses";
DELETE FROM "public"."projects";
DELETE FROM "public"."organizations_centers_expenses_paid";
DELETE FROM "public"."organizations_centers_expenses";
DELETE FROM "public"."organizations_centers";
DELETE FROM "public"."organizations";
DELETE FROM "public"."mentors_waiting_requests";
DELETE FROM "public"."mentors_partnership_requests";
DELETE FROM "public"."logger";
DELETE FROM "public"."guides_skills_tutorials";
DELETE FROM "public"."guides_recommendations";
DELETE FROM "public"."fields_tutorials";
DELETE FROM "public"."fields_subfields";
DELETE FROM "public"."approved_users";
DELETE FROM "public"."admin_training_reminders";
DELETE FROM "public"."admin_trainers_workdays";
DELETE FROM "public"."admin_students_certificates";
DELETE FROM "public"."admin_permissions";
DELETE FROM "public"."admin_conversations";
DELETE FROM "public"."admin_available_users";
DELETE FROM "public"."admin_assigned_users";

DROP TABLE IF EXISTS "public"."admin_assigned_users";
DROP TABLE IF EXISTS "public"."admin_available_users";
DROP TABLE IF EXISTS "public"."admin_conversations";
DROP TABLE IF EXISTS "public"."admin_permissions";
DROP TABLE IF EXISTS "public"."admin_students_certificates";
DROP TABLE IF EXISTS "public"."admin_trainers_workdays";
DROP TABLE IF EXISTS "public"."admin_training_reminders";
DROP TABLE IF EXISTS "public"."admin_training_reminders_texts";
DROP TABLE IF EXISTS "public"."approved_users";
DROP TABLE IF EXISTS "public"."course_types";
DROP TABLE IF EXISTS "public"."fields";
DROP TABLE IF EXISTS "public"."fields_goals";
DROP TABLE IF EXISTS "public"."fields_subfields";
DROP TABLE IF EXISTS "public"."fields_tutorials";
DROP TABLE IF EXISTS "public"."guides_recommendations";
DROP TABLE IF EXISTS "public"."guides_skills_tutorials";
DROP TABLE IF EXISTS "public"."guides_tutorials";
DROP TABLE IF EXISTS "public"."logger";
DROP TABLE IF EXISTS "public"."mentors_partnership_requests";
DROP TABLE IF EXISTS "public"."mentors_waiting_requests";
DROP TABLE IF EXISTS "public"."organizations";
DROP TABLE IF EXISTS "public"."organizations_centers";
DROP TABLE IF EXISTS "public"."organizations_centers_expenses";
DROP TABLE IF EXISTS "public"."organizations_centers_expenses_paid";
DROP TABLE IF EXISTS "public"."projects";
DROP TABLE IF EXISTS "public"."projects_courses";
DROP TABLE IF EXISTS "public"."quizzes_settings";
DROP TABLE IF EXISTS "public"."skills";
DROP TABLE IF EXISTS "public"."skills_tutorials";
DROP TABLE IF EXISTS "public"."students_testimonials";
DROP TABLE IF EXISTS "public"."subfields";
DROP TABLE IF EXISTS "public"."subfields_skills";
DROP TABLE IF EXISTS "public"."subfields_tutorials";
DROP TABLE IF EXISTS "public"."tutorials";
DROP TABLE IF EXISTS "public"."tutorials_lessons";
DROP TABLE IF EXISTS "public"."tutorials_sections";
DROP TABLE IF EXISTS "public"."updates";
DROP TABLE IF EXISTS "public"."user_default_profile";
DROP TABLE IF EXISTS "public"."users";
DROP TABLE IF EXISTS "public"."users_app_flags";
DROP TABLE IF EXISTS "public"."users_app_versions";
DROP TABLE IF EXISTS "public"."users_availabilities";
DROP TABLE IF EXISTS "public"."users_certificates_pauses";
DROP TABLE IF EXISTS "public"."users_courses";
DROP TABLE IF EXISTS "public"."users_courses_lessons_canceled";
DROP TABLE IF EXISTS "public"."users_courses_mentors";
DROP TABLE IF EXISTS "public"."users_courses_partnership_schedule";
DROP TABLE IF EXISTS "public"."users_courses_students";
DROP TABLE IF EXISTS "public"."users_fcm_tokens";
DROP TABLE IF EXISTS "public"."users_goals";
DROP TABLE IF EXISTS "public"."users_in_app_messages";
DROP TABLE IF EXISTS "public"."users_lesson_requests";
DROP TABLE IF EXISTS "public"."users_lessons";
DROP TABLE IF EXISTS "public"."users_lessons_availabilities";
DROP TABLE IF EXISTS "public"."users_lessons_canceled";
DROP TABLE IF EXISTS "public"."users_lessons_notes";
DROP TABLE IF EXISTS "public"."users_lessons_stopped";
DROP TABLE IF EXISTS "public"."users_lessons_students";
DROP TABLE IF EXISTS "public"."users_notifications_settings";
DROP TABLE IF EXISTS "public"."users_quizzes";
DROP TABLE IF EXISTS "public"."users_refresh_tokens";
DROP TABLE IF EXISTS "public"."users_reset_password";
DROP TABLE IF EXISTS "public"."users_skills";
DROP TABLE IF EXISTS "public"."users_steps";
DROP TABLE IF EXISTS "public"."users_subfields";
DROP TABLE IF EXISTS "public"."users_support_requests";
DROP TABLE IF EXISTS "public"."users_timezones";