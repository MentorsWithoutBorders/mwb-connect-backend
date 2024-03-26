-- -------------------------------------------------------------
-- TablePlus 5.4.2(506)
--
-- https://tableplus.com/
--
-- Database: mwbconnect_db
-- Generation Time: 2023-10-15 00:01:39.7390
-- -------------------------------------------------------------


-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."admin_assigned_users" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "trainer_id" uuid,
    "assigned_user_id" uuid,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."admin_available_users" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid,
    "should_contact" bool,
    "last_contacted_date_time" timestamptz,
    "is_inactive" bool,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."admin_conversations" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid,
    "conversations" text,
    "last_conversation_date_time" timestamptz,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."admin_permissions" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL,
    "is_mentor" bool,
    "is_org_manager" bool,
    "is_centre_manager" bool,
    "is_admin" bool,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."admin_students_certificates" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid,
    "is_certificate_sent" bool,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."admin_trainers_workdays" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "trainer_id" uuid,
    "workdays" int2 NOT NULL,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."admin_training_reminders" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid,
    "is_step_added" bool,
    "remaining_quizzes" int2,
    "last_reminder_date_time" timestamptz,
    "reminder_to_send" varchar,
    "last_contacted_date_time" timestamptz,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."admin_training_reminders_texts" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "serial_number" varchar,
    "text" text,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."approved_users" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "name" varchar(255),
    "email" varchar(255) NOT NULL,
    "phone_number" varchar(255),
    "field_id" uuid NOT NULL,
    "organization_id" uuid NOT NULL,
    "is_mentor" bool,
    "is_org_manager" bool,
    "is_centre_manager" bool,
    "goal" varchar(255),
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."course_types" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "duration" int4 NOT NULL,
    "is_with_partner" bool NOT NULL,
    "index" int2 NOT NULL,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."fields" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "name" varchar(255) NOT NULL,
    "index" int4,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."fields_goals" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "field_id" uuid,
    "goal" text,
    "why_choose_url" text,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."fields_subfields" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "field_id" uuid NOT NULL,
    "subfield_index" int4 NOT NULL,
    "subfield_id" uuid NOT NULL,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."fields_tutorials" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "field_id" uuid NOT NULL,
    "tutorial_id" uuid NOT NULL,
    "times_used" int4 NOT NULL,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."guides_recommendations" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "field_id" uuid,
    "subfield_id" uuid,
    "text" text NOT NULL,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."guides_skills_tutorials" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "skill_id" uuid NOT NULL,
    "tutorial_index" int4 NOT NULL,
    "tutorial_id" uuid NOT NULL,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."guides_tutorials" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "tutorial_url" varchar(255) NOT NULL,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."logger" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid,
    "log_entry" text NOT NULL,
    "date_time" timestamptz NOT NULL,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."mentors_partnership_requests" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "mentor_id" uuid NOT NULL,
    "partner_mentor_id" uuid NOT NULL,
    "subfield_id" uuid NOT NULL,
    "partner_subfield_id" uuid NOT NULL,
    "course_type_id" uuid NOT NULL,
    "course_utc_day_of_week" varchar(100) NOT NULL,
    "course_utc_start_time" time NOT NULL,
    "sent_date_time" timestamptz NOT NULL,
    "is_rejected" bool,
    "is_canceled" bool,
    "is_expired" bool,
    "was_canceled_shown" bool,
    "was_expired_shown" bool,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."mentors_waiting_requests" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "mentor_id" uuid NOT NULL,
    "course_type_id" uuid NOT NULL,
    "is_canceled" bool,
    "canceled_date_time" timestamptz,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."organizations" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "name" varchar(255) NOT NULL,
    "country" varchar(255),
    "has_mentors" bool,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."organizations_centres" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "name" varchar NOT NULL,
    "address" text NOT NULL,
    "organization_id" uuid NOT NULL,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."projects" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "name" varchar(255) NOT NULL,
    "duration" int4,
    "start_date" timestamptz,
    "organization_id" uuid NOT NULL,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."projects_courses" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "project_id" uuid,
    "course_id" uuid,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."quizzes_settings" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "student_weekly_count" int4,
    "mentor_weekly_count" int4,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."skills" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "name" varchar(255) NOT NULL,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."skills_tutorials" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "skill_id" uuid,
    "tutorial_id" uuid,
    "times_used" int4
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."students_testimonials" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL,
    "url" varchar(255),
    "uploaded_date_time" timestamptz,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."subfields" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "name" varchar(255) NOT NULL,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."subfields_skills" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "subfield_id" uuid NOT NULL,
    "skill_index" int4 NOT NULL,
    "skill_id" uuid NOT NULL,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."subfields_tutorials" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "subfield_id" uuid,
    "tutorial_id" uuid,
    "times_used" int4
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."tutorials" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "index" int4,
    "type" varchar(255) NOT NULL,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."tutorials_lessons" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "name" varchar(255) NOT NULL,
    "first_lesson_url" text NOT NULL,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."tutorials_sections" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "tutorial_id" uuid NOT NULL,
    "index" int4,
    "type" varchar(255) NOT NULL,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."updates" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "major" int4,
    "minor" int4,
    "revision" int4,
    "build" int4,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."user_default_profile" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "is_available" bool NOT NULL,
    "lessons_availability_min_interval_in_days" int4 NOT NULL,
    "lessons_availability_min_interval_unit" varchar(50) NOT NULL,
    "lessons_availability_max_students" int4 NOT NULL,
    "training_reminders_enabled" bool NOT NULL,
    "training_reminders_time" time NOT NULL,
    "start_course_reminders_enabled" bool NOT NULL,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."users" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "name" varchar(255) NOT NULL,
    "email" varchar(255) NOT NULL,
    "password" varchar(255) NOT NULL,
    "phone_number" varchar(255),
    "field_id" uuid NOT NULL,
    "organization_id" uuid NOT NULL,
    "is_mentor" bool NOT NULL,
    "is_available" bool,
    "available_from" timestamptz,
    "registered_on" timestamptz,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."users_app_flags" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid,
    "is_training_enabled" bool NOT NULL,
    "is_mentoring_enabled" bool NOT NULL,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."users_app_versions" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid,
    "major" int4,
    "minor" int4,
    "revision" int4,
    "build" int4,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."users_availabilities" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL,
    "utc_day_of_week" varchar(50) NOT NULL,
    "utc_time_from" time NOT NULL,
    "utc_time_to" time NOT NULL,
    "connected_to" uuid,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."users_certificates_pauses" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL,
    "pause_datetime" timestamptz,
    "is_resuming" bool,
    "resume_datetime" timestamptz,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."users_courses" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "start_date_time" timestamptz NOT NULL,
    "course_type_id" uuid NOT NULL,
    "whatsapp_group_url" varchar(255),
    "notes" text,
    "has_started" bool,
    "is_canceled" bool,
    "canceled_date_time" timestamptz,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."users_courses_lessons_canceled" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid,
    "course_id" uuid,
    "lesson_date_time" timestamptz,
    "canceled_date_time" timestamptz
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."users_courses_mentors" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "course_id" uuid NOT NULL,
    "mentor_id" uuid NOT NULL,
    "subfield_id" uuid NOT NULL,
    "meeting_url" varchar(255),
    "is_canceled" bool,
    "canceled_date_time" timestamptz,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."users_courses_partnership_schedule" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "course_id" uuid NOT NULL,
    "mentor_id" uuid NOT NULL,
    "lesson_date_time" timestamptz NOT NULL,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."users_courses_students" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "course_id" uuid NOT NULL,
    "student_id" uuid NOT NULL,
    "is_canceled" bool,
    "canceled_date_time" timestamptz
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."users_fcm_tokens" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL,
    "fcm_token" varchar(255),
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."users_goals" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL,
    "text" text NOT NULL,
    "index" int4 NOT NULL,
    "date_time" timestamptz,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."users_in_app_messages" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL,
    "text" text NOT NULL,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."users_lesson_requests" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "student_id" uuid NOT NULL,
    "mentor_id" uuid,
    "subfield_id" uuid,
    "lesson_date_time" timestamptz,
    "sent_date_time" timestamptz,
    "is_rejected" bool,
    "is_canceled" bool,
    "is_expired" bool,
    "is_previous_mentor" bool,
    "was_canceled_shown" bool,
    "was_expired_shown" bool
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."users_lessons" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "mentor_id" uuid NOT NULL,
    "subfield_id" uuid NOT NULL,
    "date_time" timestamptz NOT NULL,
    "meeting_url" varchar(255) NOT NULL,
    "is_mentor_present" bool,
    "end_recurrence_date_time" timestamptz,
    "is_canceled" bool,
    "canceled_date_time" timestamptz,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."users_lessons_availabilities" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL,
    "min_interval_in_days" int4,
    "min_interval_unit" varchar(50),
    "max_students" int4 NOT NULL,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."users_lessons_canceled" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL,
    "lesson_id" uuid NOT NULL,
    "lesson_date_time" timestamptz NOT NULL,
    "canceled_date_time" timestamptz,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."users_lessons_notes" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "student_id" uuid NOT NULL,
    "lesson_id" uuid NOT NULL,
    "text" text NOT NULL,
    "date_time" timestamptz NOT NULL,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."users_lessons_stopped" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "student_id" uuid NOT NULL,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."users_lessons_students" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "lesson_id" uuid NOT NULL,
    "student_id" uuid NOT NULL,
    "is_canceled" bool,
    "canceled_date_time" timestamptz,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."users_notifications_settings" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL,
    "training_reminders_enabled" bool NOT NULL,
    "training_reminders_time" time NOT NULL,
    "start_course_reminders_enabled" bool,
    "start_course_reminders_date" date,
    "enabled" bool,
    "time" time,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."users_quizzes" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL,
    "number" int4 NOT NULL,
    "is_correct" bool,
    "is_closed" bool,
    "date_time" timestamptz NOT NULL,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."users_refresh_tokens" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL,
    "refresh_token" varchar(255) NOT NULL,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."users_reset_password" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "email" varchar(255),
    "date_time" timestamptz,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."users_skills" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL,
    "subfield_id" uuid NOT NULL,
    "skill_index" int4 NOT NULL,
    "skill_id" uuid NOT NULL,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."users_steps" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL,
    "goal_id" uuid NOT NULL,
    "text" text NOT NULL,
    "index" int4 NOT NULL,
    "level" int4 NOT NULL,
    "parent_id" uuid,
    "date_time" timestamptz NOT NULL,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."users_subfields" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL,
    "subfield_index" int4,
    "subfield_id" uuid NOT NULL,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."users_support_requests" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL,
    "text" text,
    "date_time" timestamp NOT NULL,
    PRIMARY KEY ("id")
);

-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: indices, triggers. Do not use it as a backup.

-- Table Definition
CREATE TABLE "public"."users_timezones" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL,
    "name" varchar(255),
    "abbreviation" varchar(50),
    "utc_offset" varchar(50),
    PRIMARY KEY ("id")
);

INSERT INTO "public"."admin_available_users" ("id", "user_id", "should_contact", "last_contacted_date_time", "is_inactive") VALUES
('a6b7307d-2ee0-472d-a243-be296fee98bd', 'dfffbad3-0cad-493e-a66d-cf3161616323', 't', '2021-11-29 12:17:49+00', NULL);

INSERT INTO "public"."admin_permissions" ("id", "user_id", "is_mentor", "is_org_manager", "is_centre_manager", "is_admin") VALUES
('0de8a621-8576-43fe-ac64-0bc2e3a03116', 'a67df461-e05b-42fc-ba70-1e79a8a25a40', 't', 't', 't', 'f'),
('1007bbdc-cc3d-4572-a117-814d47fa0bb1', '16648dec-350e-4091-8256-9b78788a4a90', 'f', 'f', 'f', 'f'),
('38727fe7-649e-47e8-b3d1-76a38663a925', 'd4c98320-22ee-4b77-9c2f-81337b94e885', 't', 'f', 'f', 'f'),
('4d711696-4984-4450-bee8-0da125997dc2', '725a0e8d-d712-4542-affb-e66a93cb16c5', 't', 'f', 'f', 'f'),
('51a83b38-d5ae-48a9-bd2e-292fc2c45a3f', '04e7ec49-bfbe-425b-8c58-e4f1f60e1735', 'f', 'f', 'f', 'f'),
('5f31bce2-dce5-4fed-8d7e-e228b6c538be', 'eab5a0d4-3fc0-4915-8a7e-df771c9a9975', 't', 'f', 'f', 'f'),
('692fddf3-8c76-47b5-9a4f-5222bfd89280', 'd8827495-376a-4bf1-93f5-6f93e1b38453', 't', 'f', 'f', 'f'),
('82da8310-0d5d-4e10-aab2-be6b3d2e5357', '24f7f19c-5262-45bb-8ab5-bae9df67ab66', 'f', 'f', 'f', 'f'),
('8f0f0b5a-930b-43be-bb4a-1434aa19f659', 'dfffbad3-0cad-493e-a66d-cf3161616323', 't', 'f', 'f', 'f'),
('a0715e70-3ee2-4149-8da2-ef14404be676', '9590839b-b450-40f2-b1cc-b9a677711489', 't', 'f', 'f', 'f'),
('a79f90be-720a-44d8-8a1a-fa6e18e502c5', '063842ae-799b-4171-990f-397029d2647f', 'f', 'f', 'f', 'f'),
('b2f86136-b950-4e07-ba50-154a1f6770cc', '7af316a9-ce4b-4036-9b9e-d7f127b6b252', 'f', 'f', 'f', 'f'),
('d1944539-cf33-47f1-9963-7e6a594eef7c', 'c9682d5f-a104-4229-b8b1-0ccfef35e5f6', 'f', 'f', 'f', 'f'),
('d32f93a6-7293-4ac2-a64d-b34e4a8c4042', 'b2e9059b-fb54-41d6-ae28-18162073787a', 't', 'f', 'f', 'f');

INSERT INTO "public"."admin_training_reminders" ("id", "user_id", "is_step_added", "remaining_quizzes", "last_reminder_date_time", "reminder_to_send", "last_contacted_date_time") VALUES
('306f9c8c-57a7-4d96-8eb8-2fa8d5e8bf12', '24f7f19c-5262-45bb-8ab5-bae9df67ab66', 'f', 3, '2023-10-08 18:00:00+00', 's1', NULL),
('44037c81-af2a-4dd6-94ed-8d865d765a24', '7af316a9-ce4b-4036-9b9e-d7f127b6b252', 't', 12, '2023-10-08 18:00:00+00', 's1', NULL),
('4d3f7fa1-7494-4856-a49b-47943d1b8530', '16648dec-350e-4091-8256-9b78788a4a90', 't', 12, '2023-10-08 18:00:00+00', 's1', NULL),
('51e3a656-868e-44a3-b82e-1715d06f592b', 'a67df461-e05b-42fc-ba70-1e79a8a25a40', 'f', 3, '2023-07-23 15:30:00+00', 'm1', NULL),
('59778ea9-b0ea-41ab-8448-f9a2e7b5bf6c', '063842ae-799b-4171-990f-397029d2647f', 't', 12, '2023-10-13 18:02:00+00', 's1', NULL),
('8ee09250-72f4-45f8-9a33-09bea75524c6', 'd4c98320-22ee-4b77-9c2f-81337b94e885', 't', 0, '2021-12-19 19:50:00+00', 'm1', NULL),
('b56c97a3-6260-4f7c-ac99-3a3adbc5467f', 'd8827495-376a-4bf1-93f5-6f93e1b38453', 'f', 3, '2023-07-23 15:30:00+00', 'm1', NULL),
('b7565cd5-aa05-4e2e-9434-9727ff4d5c0e', 'b2e9059b-fb54-41d6-ae28-18162073787a', 'f', 3, '2023-05-07 18:10:00+00', 'm1', NULL),
('bd8ca0b2-e3fd-4bbe-a4d0-29e7efc09325', '04e7ec49-bfbe-425b-8c58-e4f1f60e1735', 't', 12, '2023-10-10 17:00:00+00', 's1', NULL),
('be9b9df8-0ce9-4196-b634-791878574220', 'eab5a0d4-3fc0-4915-8a7e-df771c9a9975', 'f', 3, '2023-05-14 18:00:00+00', 'm1', NULL),
('e0a57f36-0028-475e-8e4a-1156903fc85c', '9590839b-b450-40f2-b1cc-b9a677711489', 'f', 3, '2023-05-12 18:00:00+00', 'm1', NULL),
('fbee67bc-dcec-4d42-9fc9-c3d36a526e9f', 'c9682d5f-a104-4229-b8b1-0ccfef35e5f6', 't', 12, '2023-10-13 06:34:00+00', 's1', NULL),
('fc54f11c-5aa9-420f-8c6f-c7d1275d983f', '725a0e8d-d712-4542-affb-e66a93cb16c5', 'f', 3, '2023-07-20 15:30:01+00', 'm1', NULL),
('fd13f1d1-0b09-4ad6-bc32-fc34d5b0961e', 'dfffbad3-0cad-493e-a66d-cf3161616323', 't', 3, '2021-12-20 19:00:00+00', 'm1', NULL);

INSERT INTO "public"."admin_training_reminders_texts" ("id", "serial_number", "text") VALUES
('00c53fbb-da3c-4d7d-8a4f-b63b8c66fe1d', 's3', '<title></title>
<text>Hi {student_name}, I hope you''re doing well.

As mentioned before, please always take into consideration the emails with the subject "Training reminder" because we will only be able to send you the MWB certificate on {certificate_date} if you add at least one step to your plan and solve the 3 quizzes each week in the MWB Connect app. I''m always happy to assist if you''re experiencing any difficulties with these tasks.

If the reminder emails are arriving in your Promotions or Spam folders, please move them to your Inbox and if you''re not receiving the Gmail notifications when your phone is closed, please follow this guide:
https://support.google.com/mail/answer/1075549?hl=en&co=GENIE.Platform%3DAndroid</text>'),
('851f7c67-6b0e-4c97-a2e9-cef5d5c16204', 's4', '<title></title>
<text>Hi {student_name}, are you experiencing any difficulties {step_quizzes_doing} in the MWB Connect app?

Kindly keep in mind that the reminder email you''ll receive {last_reminder_day} will be the last one and unfortunately we won''t be able to send you the MWB certificate if you won''t {step_quizzes_to_do} by the end of the day {last_reminder_day}.

Thank you for your understanding.</text>'),
('dc1a0296-3762-46db-8094-f883c54cea09', 's2', '<title></title>
<text>Hi {student_name}, I''ve noticed that you still haven''t {step_quizzes_not_done} in the MWB Connect app. Are you experiencing any difficulties?

I also have to inform you that the reminder email you''ll receive {last_reminder_day} will be the last one and unfortunately we won''t be able to send you the MWB certificate if you won''t {step_quizzes_to_do} by the end of the day {last_reminder_day}.

Thank you for your understanding.</text>'),
('e22efdb2-70ae-46d8-9078-6e498daf1c4b', 's1', '<title></title>
<text>Hi {student_name},
My name is {trainer_name} and I will assist you with the MWB training.
Did you receive the emails with the subject "Training reminder" on {first_reminder_date} and {last_reminder_date}?</text>

<title>If the student has received the emails:</title>
<text>Great, please always take these email reminders into consideration because we will only be able to send you the MWB certificate on {certificate_date} if you add at least one step to your plan and solve the {weekly_quizzes} each week in the MWB Connect app.
I''m always happy to assist if you''re experiencing any difficulties with these tasks.</text>

<title>Final message:</title>
<text>Also, please follow this guide if you''re not receiving the Gmail notifications when your phone is closed:
https://support.google.com/mail/answer/1075549?hl=en&co=GENIE.Platform%3DAndroid</text>

<title>If the student hasn''t received the emails:</title>
<text>Could you please check your Promotions and Spam folders as well?</text>

<title>If the emails are in the Promotions or Spam folder:</title>
<text>Great, please move these emails to your Inbox and always take them into consideration because we will only be able to send you the MWB certificate on {certificate_date} if you add at least one step to your plan and solve the {weekly_quizzes} each week in the MWB Connect app.
I''m always happy to assist if you''re experiencing any difficulties with these tasks.</text>

<title>Final message:</title>
<text>Also, please follow this guide if you''re not receiving the Gmail notifications when your phone is closed:
https://support.google.com/mail/answer/1075549?hl=en&co=GENIE.Platform%3DAndroid</text>

<title>If the emails aren''t in the Promotions or Spam folder:</title>
<text>Thanks for letting me know and we apologize for this issue, we''ll get back to you as soon as we find a solution. 
In the meantime, please remember to add at least one step to your plan and solve the {weekly_quizzes} each week because this is the only way to receive the MWB certificate on {certificate_date}.</text>

<title>If the student stops replying at some point:</title>
<text>Please always take these email reminders into consideration because we will only be able to send you the MWB certificate on {certificate_date} if you add at least one step to your plan and solve the {weekly_quizzes} each week in the MWB Connect app.
I''m always happy to assist if you''re experiencing any difficulties with these tasks.</text>');

INSERT INTO "public"."approved_users" ("id", "name", "email", "phone_number", "field_id", "organization_id", "is_mentor", "is_org_manager", "is_centre_manager", "goal") VALUES
('00eaadb4-d709-4794-b177-02b519ae81dd', 'Mentor 3', 'm3@test.fake', NULL, 'b021984a-c02c-4fd4-87a7-1aec84c68d6b', 'aac344ee-6cdf-4acd-8e60-609bfbc589b7', 't', NULL, NULL, NULL),
('2aa1be96-7d13-42bf-ac08-131d10f2a753', 'Student 3', 's3@test.fake', NULL, 'b021984a-c02c-4fd4-87a7-1aec84c68d6b', '82360ca6-ce95-45f6-a0e3-1c846ee5616b', 'f', NULL, NULL, 'I want to work as a programmer (freelancer or in a company) and have an income of at least $1000 USD per month.'),
('2f7345b8-9317-49c4-8640-e1129bebb654', 'Student 2', 's2@test.fake', NULL, 'b021984a-c02c-4fd4-87a7-1aec84c68d6b', '82360ca6-ce95-45f6-a0e3-1c846ee5616b', 'f', NULL, NULL, 'I want to work as a programmer (freelancer or in a company) and have an income of at least $1000 USD per month.'),
('3f71f4da-6f80-4bfc-8312-4e9686773346', 'Edmond MWB', 'edmond@mentorswithoutborders.net', '+40 742805665', 'b021984a-c02c-4fd4-87a7-1aec84c68d6b', 'aac344ee-6cdf-4acd-8e60-609bfbc589b7', 'f', NULL, NULL, ''),
('482f73cc-a174-4652-977d-270f585d47ad', 'Mentor 2', 'm2@test.fake', NULL, 'b021984a-c02c-4fd4-87a7-1aec84c68d6b', 'aac344ee-6cdf-4acd-8e60-609bfbc589b7', 't', NULL, NULL, NULL),
('5a8dd900-5162-4680-bbfb-782bca86ed90', 'Student 4', 's4@test.fake', NULL, 'b021984a-c02c-4fd4-87a7-1aec84c68d6b', '82360ca6-ce95-45f6-a0e3-1c846ee5616b', 'f', NULL, NULL, 'I want to work as a programmer (freelancer or in a company) and have an income of at least $1000 USD per month.'),
('782ce6a1-faf1-4d8d-aea3-90751174614f', 'Edmond Pruteanu', 'edmondpr@gmail.com', '+40 742805664', 'b021984a-c02c-4fd4-87a7-1aec84c68d6b', 'aac344ee-6cdf-4acd-8e60-609bfbc589b7', 't', NULL, NULL, NULL),
('8ac9afb5-5dff-4f03-893f-61a568122554', 'Student 5', 's5@test.fake', NULL, 'b021984a-c02c-4fd4-87a7-1aec84c68d6b', '82360ca6-ce95-45f6-a0e3-1c846ee5616b', 'f', NULL, NULL, 'I want to work as a programmer (freelancer or in a company) and have an income of at least $1000 USD per month.'),
('8d575c17-1c8d-4494-a6f9-891a1fb019e1', 'Mentor 1', 'm1@test.fake', NULL, 'b021984a-c02c-4fd4-87a7-1aec84c68d6b', 'aac344ee-6cdf-4acd-8e60-609bfbc589b7', 't', NULL, NULL, NULL),
('b18b845d-cf7d-4751-b3fb-dfa0b85ce0d4', NULL, 'mb3@test.fake', NULL, 'b021984a-c02c-4fd4-87a7-1aec84c68d6b', 'd4a4f7c2-3257-40c3-8ea7-771a83355990', 't', 't', 't', NULL),
('c0e4986d-eb50-4c82-9824-898dd678c509', NULL, 'mb1@test.fake', NULL, 'b021984a-c02c-4fd4-87a7-1aec84c68d6b', 'd4a4f7c2-3257-40c3-8ea7-771a83355990', 't', NULL, NULL, NULL),
('cc92e17c-4d70-4535-89d4-857e498804d9', NULL, 'mb2@test.fake', NULL, 'b021984a-c02c-4fd4-87a7-1aec84c68d6b', 'd4a4f7c2-3257-40c3-8ea7-771a83355990', 't', 't', 't', NULL),
('d97d8b20-dcde-4bd2-8f66-a73a7ccbd65e', 'Student 1', 's1@test.fake', NULL, 'b021984a-c02c-4fd4-87a7-1aec84c68d6b', '82360ca6-ce95-45f6-a0e3-1c846ee5616b', 'f', NULL, NULL, 'I want to work as a programmer (freelancer or in a company) and have an income of at least $1000 USD per month.');

INSERT INTO "public"."course_types" ("id", "duration", "is_with_partner", "index") VALUES
('07dbf071-96d1-4947-811d-df9bbc8cb352', 6, 't', 4),
('5a64abf0-eaa2-48b4-be48-d0708f010526', 3, 't', 2),
('67ccff8b-646e-4e0b-b425-e0ec19552ceb', 3, 'f', 1),
('c72ac14b-4258-4e53-89ca-7401317f54c4', 6, 'f', 3);

INSERT INTO "public"."fields" ("id", "name", "index") VALUES
('281c2f07-b3fa-4d91-9c25-9e38524e5836', 'Project Management', 4),
('39297445-cb62-4f38-8a62-25b96dbea8ce', 'Business Analysis', 8),
('62a9dce6-2e92-45cc-a580-035d64a65b5b', 'Other', 1),
('87677250-2753-47e4-9798-f25ec621ec8f', 'Product Management', 7),
('b021984a-c02c-4fd4-87a7-1aec84c68d6b', 'Programming', 2),
('c90c53f8-20dc-4260-b589-885bd79071ef', 'Design', 3),
('dbf77b14-96d4-48e4-b071-0c0c3be4378e', 'Customer Support', 5),
('fd7d7763-7fa6-49d9-9fbb-c635696ce5cc', 'Human Resources', 6);

INSERT INTO "public"."fields_goals" ("id", "field_id", "goal", "why_choose_url") VALUES
('1ee99b3f-e599-41ee-a856-3dd4d56b554e', 'c90c53f8-20dc-4260-b589-885bd79071ef', 'I want to work as a designer and have an income of at least $1000 USD per month.', 'https://justcreative.com/9-reasons-to-choose-graphic-design-as-a-career/'),
('263e0982-1fc7-445e-a700-0d08e0bdfd02', '87677250-2753-47e4-9798-f25ec621ec8f', 'I want to work as a product manager and have an income of at least $1000 USD per month.', 'https://medium.com/unboxing-product-management/why-i-love-being-a-product-manager-3ffcc8eb6155'),
('7e0fbd8f-d167-4503-b29c-58588776f1f5', 'b021984a-c02c-4fd4-87a7-1aec84c68d6b', 'I want to work as a programmer and have an income of at least $1000 USD per month.', 'https://cloudemployee.co.uk/blog/productivity/10-reasons-to-become-a-programmer'),
('9ddddf45-1a19-4c1d-9555-c84378dc0429', '281c2f07-b3fa-4d91-9c25-9e38524e5836', 'I want to work as a project manager and have an income of at least $1000 USD per month.', 'https://monday.com/blog/project-management/7-reasons-to-choose-project-management-as-a-career-path/'),
('b163ad57-2c14-4796-b7a2-0c728aa3f861', 'dbf77b14-96d4-48e4-b071-0c0c3be4378e', 'I want to work in customer support and have an income of at least $1000 USD per month.', 'https://blog.hubspot.com/service/customer-support-job'),
('d4de78dc-a8a8-40ea-86d0-3120789ba44c', '39297445-cb62-4f38-8a62-25b96dbea8ce', 'I want to work as a business analyst and have an income of at least $1000 USD per month.', 'https://www.indeed.com/career-advice/finding-a-job/reasons-to-become-business-analyst'),
('e47b3f7f-49a6-43ce-a019-2cdae5a1f716', 'fd7d7763-7fa6-49d9-9fbb-c635696ce5cc', 'I want to work in human resources and have an income of at least $1000 USD per month.', 'https://www.indeed.com/career-advice/finding-a-job/why-work-in-hr');

INSERT INTO "public"."fields_subfields" ("id", "field_id", "subfield_index", "subfield_id") VALUES
('207908c6-91d0-4588-8600-44fd2e9e1f38', 'c90c53f8-20dc-4260-b589-885bd79071ef', 7, '8af48039-1517-4e1b-9e97-f9a99f3ef8b7'),
('463b097b-eb7a-4ac6-988e-90924e310431', '39297445-cb62-4f38-8a62-25b96dbea8ce', 2, '4c962a78-c253-440d-89e0-faf7be7187e6'),
('597969e4-81a6-490a-a74b-9c65213551aa', 'b021984a-c02c-4fd4-87a7-1aec84c68d6b', 8, '3691f807-90dd-4715-a74c-4ea21bd642a2'),
('5c49329e-ecd1-4f1d-a258-a1bc292a7928', 'c90c53f8-20dc-4260-b589-885bd79071ef', 5, '71ffadb3-4115-41c6-8599-f73ca94072d8'),
('67b01def-5ce8-4b05-a0eb-39bccfef8f10', 'b021984a-c02c-4fd4-87a7-1aec84c68d6b', 2, 'd0a76ab3-93a6-4c3c-bb80-7aad85fa071d'),
('6cb172a8-9ccd-4acc-b5e9-ebba82f78225', 'c90c53f8-20dc-4260-b589-885bd79071ef', 2, '1b087dc6-df78-40b7-a814-0090303038d1'),
('9141b62d-995c-47f6-be1f-334d091813cd', '39297445-cb62-4f38-8a62-25b96dbea8ce', 1, '51b0d446-ac2c-4c96-bd4c-a9b72fe6ba7b'),
('9caaf7cc-a214-4064-9aa0-f1eed3354014', 'c90c53f8-20dc-4260-b589-885bd79071ef', 6, 'b3747dcb-5bc9-49de-8e38-cce68c7a2919'),
('b0a441a1-5b96-4eaf-9522-d72082383319', 'b021984a-c02c-4fd4-87a7-1aec84c68d6b', 7, '5fcc21e1-570d-442f-9a68-ca23d12d69f4'),
('b4b0738a-5068-4ed2-a78b-629e6df70498', 'b021984a-c02c-4fd4-87a7-1aec84c68d6b', 5, '413c149a-ca8c-48c5-82ce-67af2c403d52'),
('c07cd198-35c7-48fe-b2e1-cdf25a2153ae', 'c90c53f8-20dc-4260-b589-885bd79071ef', 3, '459d9ede-24f2-4169-b22f-031001c67c6f'),
('d16b9dbb-bd35-4125-80e7-1e5ff0cd8048', 'b021984a-c02c-4fd4-87a7-1aec84c68d6b', 9, 'e7193774-3310-4c71-a85e-409d3e213fac'),
('d6cad0a0-d9a5-4af6-b190-18cb8b18a855', 'c90c53f8-20dc-4260-b589-885bd79071ef', 8, '9c237ccf-8dd2-44a9-96ba-dd9c3a364533'),
('e3636e66-cea9-4c15-b034-72ebf645e324', 'b021984a-c02c-4fd4-87a7-1aec84c68d6b', 1, 'ef1e8355-7abe-457a-93e5-ca877d133c20'),
('e68e17cb-1564-4638-b374-859472549a4d', '39297445-cb62-4f38-8a62-25b96dbea8ce', 3, 'fa8221d7-9bd8-43b2-bdd0-5e52bbd1f464'),
('e94bd64b-db25-45f3-8e0a-91b26810e3fe', 'c90c53f8-20dc-4260-b589-885bd79071ef', 1, '94734828-d235-44bd-860f-9948562bd4bc'),
('eccb0be6-ceb8-4d9b-97d8-76859fa52723', 'b021984a-c02c-4fd4-87a7-1aec84c68d6b', 4, 'b4af2e6c-1bb0-4fb2-9134-bba28c652348'),
('ef973760-6e4f-4134-8ba6-90aa23599bc3', 'b021984a-c02c-4fd4-87a7-1aec84c68d6b', 6, 'e9a7b096-7adc-422f-9023-f9c68190487b'),
('f2232eef-9bb5-4e32-b678-bef8b5f9040e', 'b021984a-c02c-4fd4-87a7-1aec84c68d6b', 3, '54857cae-a17d-43a3-abbb-c3bdf79a1dd6'),
('f26695d0-f880-40ae-9c6c-8338f7d11e6a', '281c2f07-b3fa-4d91-9c25-9e38524e5836', 1, 'c9df554a-c2c1-435c-bc4c-5c5ac95b60ab'),
('f423928d-eb8a-4507-80d3-164299d6189a', 'c90c53f8-20dc-4260-b589-885bd79071ef', 4, '7b589ba7-8ca3-4875-93f6-7bc1d865383a');

INSERT INTO "public"."guides_recommendations" ("id", "field_id", "subfield_id", "text") VALUES
('579406dc-8011-4c13-bb34-17cd8f3a08be', NULL, NULL, 'each lesson can be 1/1.5 hrs long
some of the chapters from the recommended tutorials can be covered during the lessons and others can be left as homework for the students
it''s best to remind the students that they should think about the steps for achieving their final goals in the same way that they are solving smaller tasks during the lessons');

INSERT INTO "public"."guides_skills_tutorials" ("id", "skill_id", "tutorial_index", "tutorial_id") VALUES
('0ae141ff-ec29-4000-923e-b0361ac46a27', '21e61c28-6751-44f9-a204-610db29ee4c5', 2, 'c4132e1e-941c-4650-a31d-4f443e9e870f'),
('6ef97bbd-d046-4d2f-8a28-8e164eddef7c', '775f5002-3ce4-4dd7-9cc3-94082c6b9da2', 3, 'c890bbd6-b614-48fa-a488-2ab661c9cd82'),
('8575d360-6900-4013-968a-a566f1dbba23', '775f5002-3ce4-4dd7-9cc3-94082c6b9da2', 2, '7f96eef9-37c6-486f-946a-6fb42eb0876b'),
('89718a65-eb26-403e-ab42-337bf842f8e3', '76b92441-3c8e-4c5a-869f-ba995e45caa2', 3, 'c890bbd6-b614-48fa-a488-2ab661c9cd82'),
('a5cd3084-d5b5-4345-b484-00954ec8833d', '304a4f4f-eebd-467a-9eec-375450034095', 2, '7f96eef9-37c6-486f-946a-6fb42eb0876b'),
('bf8e9832-7bbc-46d8-91be-551197ecb3bc', '304a4f4f-eebd-467a-9eec-375450034095', 1, 'dccb7a86-ed3a-45a5-8800-8c14938a3e5a'),
('d52c294c-5bd6-4a8a-9908-3df4a42a54d7', '76b92441-3c8e-4c5a-869f-ba995e45caa2', 2, '7f96eef9-37c6-486f-946a-6fb42eb0876b'),
('d6a9f77f-7f61-42bd-9cbd-7443cee76839', '775f5002-3ce4-4dd7-9cc3-94082c6b9da2', 1, 'dccb7a86-ed3a-45a5-8800-8c14938a3e5a'),
('d762056e-42d5-4dcb-8c07-5935e8d91e1e', '304a4f4f-eebd-467a-9eec-375450034095', 3, 'c890bbd6-b614-48fa-a488-2ab661c9cd82'),
('ecca6eab-5c1f-4a91-a3aa-f7388cbd1bfa', '76b92441-3c8e-4c5a-869f-ba995e45caa2', 1, 'dccb7a86-ed3a-45a5-8800-8c14938a3e5a'),
('f48157cd-f029-414a-9962-2a05d956be7a', '21e61c28-6751-44f9-a204-610db29ee4c5', 1, '03343e79-1f44-475a-b896-45c4a99a6a48');

INSERT INTO "public"."guides_tutorials" ("id", "tutorial_url") VALUES
('03343e79-1f44-475a-b896-45c4a99a6a48', 'https://www.learnpython.org/'),
('7f96eef9-37c6-486f-946a-6fb42eb0876b', 'https://www.sololearn.com/'),
('c4132e1e-941c-4650-a31d-4f443e9e870f', 'https://www.w3schools.com/python/'),
('c890bbd6-b614-48fa-a488-2ab661c9cd82', 'https://www.w3schools.com/'),
('dccb7a86-ed3a-45a5-8800-8c14938a3e5a', 'https://www.freecodecamp.org/');

INSERT INTO "public"."organizations" ("id", "name", "country", "has_mentors") VALUES
('572f4822-bccd-4b44-b48b-1b958bf1e052', 'Literacy', 'India', 'f'),
('82360ca6-ce95-45f6-a0e3-1c846ee5616b', 'Education for All Children', 'Kenya', 'f'),
('aac344ee-6cdf-4acd-8e60-609bfbc589b7', 'MWB', NULL, 'f'),
('ca920041-e697-4588-a47b-1bdb2cd60528', 'Anchor of Hope', 'Ghana', 'f'),
('d0b45a28-3640-4867-ad68-faf1c09b3983', 'FundLife', 'Philippines', 'f'),
('d4a4f7c2-3257-40c3-8ea7-771a83355990', 'Toptal', NULL, 't'),
('d8bdf3eb-faf1-4247-880b-68e5c5560f7c', 'Atlassian', NULL, 't');

INSERT INTO "public"."organizations_centres" ("id", "name", "address", "organization_id") VALUES
('00a6fa25-df29-4701-9077-557932591766', 'Leon Testing', 'Testing', 'd0b45a28-3640-4867-ad68-faf1c09b3983');

INSERT INTO "public"."projects" ("id", "name", "duration", "start_date", "organization_id") VALUES
('19ac3dfe-0415-424d-bd5d-c5cacd030619', 'Project 1', 3, '2023-07-10 15:55:00.008824+00', '82360ca6-ce95-45f6-a0e3-1c846ee5616b'),
('74d3fa7c-958d-4c7e-93c6-f97b9bb66665', 'Project 2', 3, '2023-06-18 15:55:00.008824+00', '82360ca6-ce95-45f6-a0e3-1c846ee5616b'),
('c30cf686-2a8b-4cb9-a9fa-5580e6f3c0f6', 'Project 3', 3, '2023-08-21 15:55:00+00', '572f4822-bccd-4b44-b48b-1b958bf1e052');

INSERT INTO "public"."projects_courses" ("id", "project_id", "course_id") VALUES
('0327c5cb-a4a9-4fdf-9c7e-930330ba5ee1', '19ac3dfe-0415-424d-bd5d-c5cacd030619', '61836523-40ce-4044-b071-e0e2b3eced09'),
('b3bf82d8-7ddb-4ecf-83cc-94e3153e4a97', '74d3fa7c-958d-4c7e-93c6-f97b9bb66665', 'a27389b0-1a84-4545-873f-55657d4dc7eb');

INSERT INTO "public"."quizzes_settings" ("id", "student_weekly_count", "mentor_weekly_count") VALUES
('77778dcb-93f3-4ac5-892c-0ae7befe456b', 3, 3);

INSERT INTO "public"."skills" ("id", "name") VALUES
('03ca64db-1467-48f6-a210-809ea4486267', 'Cryptography'),
('044e2dd5-8569-4196-bdc7-be48f1148fc3', 'Adobe Photoshop'),
('1cc0f516-733e-4106-9ef3-bda2fac0d3d2', 'ReactJS'),
('21e61c28-6751-44f9-a204-610db29ee4c5', 'Python'),
('2253d0a2-02ee-4026-bfe6-dad7470b2be7', 'Ruby'),
('304a4f4f-eebd-467a-9eec-375450034095', 'HTML'),
('35a2bd70-cb81-4c42-b913-c2a9073c7a82', 'Adobe InDesign'),
('3be67d44-4f9a-4926-bd32-112442b8733b', 'Java'),
('3ef185f5-15ba-4934-b602-a35d52c957cc', 'Spring'),
('439a9c99-995b-4d78-a923-76c17d49b890', 'MySQL'),
('4830539e-23b8-4398-9063-c67229a9b822', 'Microsoft Azure'),
('4f993192-d647-4f04-8213-a43399908d78', 'Flask'),
('59d95e35-5d97-4bd6-8ec0-6cf011b85a70', 'Ionic'),
('5bb3a496-d930-47e6-8c4f-f8f263e83e36', 'Flutter'),
('641ca1dc-48cd-4029-bc83-8de48d934e27', 'AngularJS'),
('6b0602a1-c832-4f75-87a9-303284526a4e', 'Cinema 4D'),
('6f505ad3-7ab8-4e04-9759-0479cfdf72a0', 'Sketch'),
('74c646bb-19bf-40d3-82f4-c725feecbdf0', 'MS SQL'),
('76b92441-3c8e-4c5a-869f-ba995e45caa2', 'JavaScript'),
('775f5002-3ce4-4dd7-9cc3-94082c6b9da2', 'CSS'),
('85130968-2226-4e22-8204-9a6a4408519d', 'Django'),
('8d016f2d-65a9-46d5-abe2-67e3a2219908', 'C#'),
('99718ef8-0b09-4452-a4ee-5d93d7f4f142', 'Android'),
('9efc4088-931e-4e22-9277-0cad1d6ea23a', 'Adobe Premiere'),
('a4e57aee-8c86-435f-b786-63a1c8b41122', 'Oracle'),
('ac8e6491-0d1b-4420-adbd-e8804fbeb13d', 'Adobe Illustrator'),
('b9160097-e027-4f66-b0a5-8f6023c8acc1', 'AWS'),
('bb5d42a6-5ad9-49d1-ab17-1c3cfd8ee57c', 'Hibernate'),
('c1bbe60b-e54e-47cd-8665-cd926f243f85', 'C++'),
('ce450664-1314-49c1-99fb-c8f3c566f946', 'iOS'),
('e51adee0-26fa-45be-a2a7-b2d5f7dc3880', 'React Native'),
('e9f484d1-2fa2-41bc-ba81-6a9aa6256776', 'Node.js');

INSERT INTO "public"."students_testimonials" ("id", "user_id", "url", "uploaded_date_time") VALUES
('3deaddf6-f668-472c-852a-3cd57d3fac88', '04e7ec49-bfbe-425b-8c58-e4f1f60e1735', 'https://www.youtube.com/watch?v=-1AF_qOyXOU', '2023-06-15 15:10:35.554481+00'),
('a2c66b0c-4585-4d6e-8b15-b1cfbb0a763b', 'c9682d5f-a104-4229-b8b1-0ccfef35e5f6', 'https://www.youtube.com/watch?v=Q77ikiTIAS0&t=2s', '2023-07-10 18:18:35.554481+00');

INSERT INTO "public"."subfields" ("id", "name") VALUES
('1b087dc6-df78-40b7-a814-0090303038d1', 'Marketing & Advertising'),
('3691f807-90dd-4715-a74c-4ea21bd642a2', 'Cryptography'),
('413c149a-ca8c-48c5-82ce-67af2c403d52', 'Artificial Intelligence / Machine Learning'),
('459d9ede-24f2-4169-b22f-031001c67c6f', 'User Interface'),
('4c962a78-c253-440d-89e0-faf7be7187e6', 'Elicitation and Collaboration '),
('51b0d446-ac2c-4c96-bd4c-a9b72fe6ba7b', 'Business Analysis Planning and Monitoring '),
('54857cae-a17d-43a3-abbb-c3bdf79a1dd6', 'Game Development'),
('5fcc21e1-570d-442f-9a68-ca23d12d69f4', 'Database Management'),
('71ffadb3-4115-41c6-8599-f73ca94072d8', 'Packaging'),
('7b589ba7-8ca3-4875-93f6-7bc1d865383a', 'Publication'),
('8af48039-1517-4e1b-9e97-f9a99f3ef8b7', 'Art & Illustration'),
('94734828-d235-44bd-860f-9948562bd4bc', 'Visual Identity'),
('9c237ccf-8dd2-44a9-96ba-dd9c3a364533', 'Environmental'),
('b3747dcb-5bc9-49de-8e38-cce68c7a2919', 'Motion'),
('b4af2e6c-1bb0-4fb2-9134-bba28c652348', 'Desktop Application Development'),
('c9df554a-c2c1-435c-bc4c-5c5ac95b60ab', 'Project Integration Management'),
('d0a76ab3-93a6-4c3c-bb80-7aad85fa071d', 'Mobile Development'),
('e7193774-3310-4c71-a85e-409d3e213fac', 'Test Automation'),
('e9a7b096-7adc-422f-9023-f9c68190487b', 'Embedded Systems'),
('ef1e8355-7abe-457a-93e5-ca877d133c20', 'Web Development'),
('fa8221d7-9bd8-43b2-bdd0-5e52bbd1f464', 'Requirements Life Cycle Management');

INSERT INTO "public"."subfields_skills" ("id", "subfield_id", "skill_index", "skill_id") VALUES
('102579b4-b1e9-40ac-a47b-40ff238ae053', 'b4af2e6c-1bb0-4fb2-9134-bba28c652348', 1, 'c1bbe60b-e54e-47cd-8665-cd926f243f85'),
('124af8b0-1b98-487e-9f73-866e8ec21c8b', 'ef1e8355-7abe-457a-93e5-ca877d133c20', 7, '21e61c28-6751-44f9-a204-610db29ee4c5'),
('13260bec-544c-4776-b158-fd94d0ba40a8', '7b589ba7-8ca3-4875-93f6-7bc1d865383a', 2, 'ac8e6491-0d1b-4420-adbd-e8804fbeb13d'),
('13cdc42a-bb4c-4354-9b3c-646828cc759a', 'e7193774-3310-4c71-a85e-409d3e213fac', 2, '76b92441-3c8e-4c5a-869f-ba995e45caa2'),
('183aa390-55d9-4f4f-aad0-1d8fb9423214', '459d9ede-24f2-4169-b22f-031001c67c6f', 3, '6f505ad3-7ab8-4e04-9759-0479cfdf72a0'),
('1ea3c6a9-b6a6-4b24-b465-b97e2ea39d46', 'ef1e8355-7abe-457a-93e5-ca877d133c20', 3, '76b92441-3c8e-4c5a-869f-ba995e45caa2'),
('2132fcfa-5623-40b9-82f3-db3a2de3edc1', '413c149a-ca8c-48c5-82ce-67af2c403d52', 1, '21e61c28-6751-44f9-a204-610db29ee4c5'),
('23ac5fff-f263-4120-82cb-de6aa9d6e2ca', 'ef1e8355-7abe-457a-93e5-ca877d133c20', 6, 'e9f484d1-2fa2-41bc-ba81-6a9aa6256776'),
('24987754-a197-4b8c-92cf-da687374d550', 'ef1e8355-7abe-457a-93e5-ca877d133c20', 1, '304a4f4f-eebd-467a-9eec-375450034095'),
('2a24768a-3469-40a8-b9bb-9e3b8d9ba15a', 'd0a76ab3-93a6-4c3c-bb80-7aad85fa071d', 5, '59d95e35-5d97-4bd6-8ec0-6cf011b85a70'),
('33f22481-d46d-4d91-9578-905842e73df1', 'd0a76ab3-93a6-4c3c-bb80-7aad85fa071d', 3, 'e51adee0-26fa-45be-a2a7-b2d5f7dc3880'),
('35547bc7-cea5-4e73-9c88-f931084778ce', 'd0a76ab3-93a6-4c3c-bb80-7aad85fa071d', 1, '99718ef8-0b09-4452-a4ee-5d93d7f4f142'),
('39c53892-4fa7-4d49-b442-a86075724b43', '459d9ede-24f2-4169-b22f-031001c67c6f', 2, 'ac8e6491-0d1b-4420-adbd-e8804fbeb13d'),
('3c8587db-3e7b-44ba-974b-558fea39aef6', 'ef1e8355-7abe-457a-93e5-ca877d133c20', 8, '3be67d44-4f9a-4926-bd32-112442b8733b'),
('4220af22-3727-4ede-9c36-d6bb1f2bb269', '5fcc21e1-570d-442f-9a68-ca23d12d69f4', 1, '439a9c99-995b-4d78-a923-76c17d49b890'),
('46b33196-6227-4542-8851-ca86e93ce353', 'b3747dcb-5bc9-49de-8e38-cce68c7a2919', 1, '044e2dd5-8569-4196-bdc7-be48f1148fc3'),
('4e90de4d-35d4-4b93-ac47-7a273e144bc3', '94734828-d235-44bd-860f-9948562bd4bc', 2, 'ac8e6491-0d1b-4420-adbd-e8804fbeb13d'),
('52aa3026-bef4-4f63-9500-999062e306ff', '459d9ede-24f2-4169-b22f-031001c67c6f', 1, '044e2dd5-8569-4196-bdc7-be48f1148fc3'),
('5d38417a-d5ed-4e5e-8b61-1679299620ed', 'b3747dcb-5bc9-49de-8e38-cce68c7a2919', 3, '9efc4088-931e-4e22-9277-0cad1d6ea23a'),
('5df60e79-2bb5-4edd-b882-e602093201d0', '8af48039-1517-4e1b-9e97-f9a99f3ef8b7', 2, 'ac8e6491-0d1b-4420-adbd-e8804fbeb13d'),
('5ea93844-72c8-4efd-a1cc-070275065c08', 'ef1e8355-7abe-457a-93e5-ca877d133c20', 10, '85130968-2226-4e22-8204-9a6a4408519d'),
('612546f4-c898-4c7e-a634-d2532d6d7039', 'ef1e8355-7abe-457a-93e5-ca877d133c20', 2, '775f5002-3ce4-4dd7-9cc3-94082c6b9da2'),
('626396a3-949d-4f4f-92d6-20b2a6491efc', 'ef1e8355-7abe-457a-93e5-ca877d133c20', 5, '641ca1dc-48cd-4029-bc83-8de48d934e27'),
('69f53dd5-79ba-4489-bd0b-5d0f8acb295a', '7b589ba7-8ca3-4875-93f6-7bc1d865383a', 1, '044e2dd5-8569-4196-bdc7-be48f1148fc3'),
('72ef3ebe-34b9-4928-ada6-605b3879df31', 'e9a7b096-7adc-422f-9023-f9c68190487b', 1, 'c1bbe60b-e54e-47cd-8665-cd926f243f85'),
('796a4db5-a48d-49aa-98af-a100b699d1f5', 'e7193774-3310-4c71-a85e-409d3e213fac', 5, '2253d0a2-02ee-4026-bfe6-dad7470b2be7'),
('8537634b-681f-4dde-87d8-be42d63d43c4', 'e7193774-3310-4c71-a85e-409d3e213fac', 4, '21e61c28-6751-44f9-a204-610db29ee4c5'),
('91afa8c0-7a19-448b-9695-1035f263666f', 'e7193774-3310-4c71-a85e-409d3e213fac', 3, '8d016f2d-65a9-46d5-abe2-67e3a2219908'),
('953f5c30-a77a-4949-b8bb-ebf79bfec73b', '8af48039-1517-4e1b-9e97-f9a99f3ef8b7', 1, '044e2dd5-8569-4196-bdc7-be48f1148fc3'),
('9c3552cb-54f1-430b-828e-6f98dff7baa5', 'ef1e8355-7abe-457a-93e5-ca877d133c20', 11, '2253d0a2-02ee-4026-bfe6-dad7470b2be7'),
('a1bd4ea1-1972-4f9c-873a-1ff7a4f12ffd', '1b087dc6-df78-40b7-a814-0090303038d1', 1, '044e2dd5-8569-4196-bdc7-be48f1148fc3'),
('a9727260-033e-4a65-ae1d-d014e04158fe', 'ef1e8355-7abe-457a-93e5-ca877d133c20', 12, '3ef185f5-15ba-4934-b602-a35d52c957cc'),
('b0a45f13-5e26-4f3e-86dd-99d9bc0f1edb', 'ef1e8355-7abe-457a-93e5-ca877d133c20', 4, '1cc0f516-733e-4106-9ef3-bda2fac0d3d2'),
('b399476c-ca89-4c6e-8d80-104fdb1c43d1', '54857cae-a17d-43a3-abbb-c3bdf79a1dd6', 2, '76b92441-3c8e-4c5a-869f-ba995e45caa2'),
('b3e18ddb-9f5d-402e-9ecb-a4a51d07a8a9', '9c237ccf-8dd2-44a9-96ba-dd9c3a364533', 1, '044e2dd5-8569-4196-bdc7-be48f1148fc3'),
('b5bf7615-ce8d-4eb0-ba11-214ebbb5139f', 'b3747dcb-5bc9-49de-8e38-cce68c7a2919', 4, '6b0602a1-c832-4f75-87a9-303284526a4e'),
('b77d9196-7bdf-442b-a745-f6d1f2034499', '71ffadb3-4115-41c6-8599-f73ca94072d8', 3, '35a2bd70-cb81-4c42-b913-c2a9073c7a82'),
('c0eb2a13-b9d1-4fb3-8542-16132da95506', '94734828-d235-44bd-860f-9948562bd4bc', 1, '044e2dd5-8569-4196-bdc7-be48f1148fc3'),
('ca3fa7fd-009b-4604-bc61-2e7cc541086b', '94734828-d235-44bd-860f-9948562bd4bc', 3, '6f505ad3-7ab8-4e04-9759-0479cfdf72a0'),
('cef602cf-a9b8-4e0b-97ff-75d651b51ce6', '54857cae-a17d-43a3-abbb-c3bdf79a1dd6', 1, 'c1bbe60b-e54e-47cd-8665-cd926f243f85'),
('d4bd9d47-c4ed-460d-8627-8acd5e16a777', '1b087dc6-df78-40b7-a814-0090303038d1', 3, '35a2bd70-cb81-4c42-b913-c2a9073c7a82'),
('d8d398f1-f934-476e-9029-de7e62b3955e', 'ef1e8355-7abe-457a-93e5-ca877d133c20', 9, '4f993192-d647-4f04-8213-a43399908d78'),
('dc6d2d05-bbd3-4325-a1dd-8590dcdbce02', '3691f807-90dd-4715-a74c-4ea21bd642a2', 1, 'c1bbe60b-e54e-47cd-8665-cd926f243f85'),
('e2109208-7fba-4427-aaca-d5756477767b', 'd0a76ab3-93a6-4c3c-bb80-7aad85fa071d', 2, 'ce450664-1314-49c1-99fb-c8f3c566f946'),
('e233f7f1-1809-4830-a186-98dd58ae804e', '71ffadb3-4115-41c6-8599-f73ca94072d8', 2, 'ac8e6491-0d1b-4420-adbd-e8804fbeb13d'),
('e49cc418-1062-4f75-b7d7-22a01f7e37a5', 'e7193774-3310-4c71-a85e-409d3e213fac', 1, '3be67d44-4f9a-4926-bd32-112442b8733b'),
('e570fcbd-ac96-48dd-a238-08b085d679c7', '5fcc21e1-570d-442f-9a68-ca23d12d69f4', 5, '4830539e-23b8-4398-9063-c67229a9b822'),
('e6060304-a63e-4a2e-a1ed-4fd2b51b12bd', '71ffadb3-4115-41c6-8599-f73ca94072d8', 1, '044e2dd5-8569-4196-bdc7-be48f1148fc3'),
('e6d6665e-daa2-4806-a94d-a6f8c1739460', 'b3747dcb-5bc9-49de-8e38-cce68c7a2919', 2, 'ac8e6491-0d1b-4420-adbd-e8804fbeb13d'),
('f3fb9fff-08aa-423b-9c6c-d97eeb88cd88', 'd0a76ab3-93a6-4c3c-bb80-7aad85fa071d', 4, '5bb3a496-d930-47e6-8c4f-f8f263e83e36'),
('f4a99899-201c-4e4e-b9e3-43f07a1060ed', 'ef1e8355-7abe-457a-93e5-ca877d133c20', 14, '8d016f2d-65a9-46d5-abe2-67e3a2219908'),
('f4f7ca34-f7e0-44f0-80b1-dcb40ddaa085', 'ef1e8355-7abe-457a-93e5-ca877d133c20', 13, 'bb5d42a6-5ad9-49d1-ab17-1c3cfd8ee57c'),
('f75e696a-0a7b-4bee-990a-9c35b68dc5a4', '7b589ba7-8ca3-4875-93f6-7bc1d865383a', 3, '35a2bd70-cb81-4c42-b913-c2a9073c7a82'),
('f868617d-53dc-4a60-a006-5bc3d3690b3f', '413c149a-ca8c-48c5-82ce-67af2c403d52', 2, 'c1bbe60b-e54e-47cd-8665-cd926f243f85'),
('f97c46a8-0b8f-4351-8007-d0b2c541f946', '5fcc21e1-570d-442f-9a68-ca23d12d69f4', 3, '74c646bb-19bf-40d3-82f4-c725feecbdf0'),
('fd0baee1-6de0-48e1-8b6c-55544c0471b4', '1b087dc6-df78-40b7-a814-0090303038d1', 2, 'ac8e6491-0d1b-4420-adbd-e8804fbeb13d'),
('fd409c15-018b-447c-819e-bd8ad3b95c34', '5fcc21e1-570d-442f-9a68-ca23d12d69f4', 2, 'a4e57aee-8c86-435f-b786-63a1c8b41122'),
('fe185881-bb80-4cb1-b6d3-d7ce422051d4', '9c237ccf-8dd2-44a9-96ba-dd9c3a364533', 2, 'ac8e6491-0d1b-4420-adbd-e8804fbeb13d'),
('ff279466-904b-4323-9baf-e0a5a44770a0', '5fcc21e1-570d-442f-9a68-ca23d12d69f4', 4, 'b9160097-e027-4f66-b0a5-8f6023c8acc1');

INSERT INTO "public"."tutorials" ("id", "index", "type") VALUES
('19caa1fb-e850-436d-b532-3adb5d2e77f5', 3, 'super_focus_method'),
('6f77e372-c923-46c1-8d8c-db154b6cb63b', 2, 'relaxation_method'),
('e68294aa-de29-4e7e-862c-810d8edfe97e', 1, 'mental_process_goal_steps');

INSERT INTO "public"."tutorials_lessons" ("id", "name", "first_lesson_url") VALUES
('4e4183fb-6d75-488f-93a8-d9e0a044186b', 'learnpython.org', 'https://www.learnpython.org/en/Hello%2C_World%21'),
('a132f464-37a5-4d12-bd5d-0139b8e17e2d', 'freeCodeCamp', 'https://www.freecodecamp.org/learn/responsive-web-design/basic-html-and-html5/say-hello-to-html-elements'),
('f9e15635-b22a-4cac-9858-42478a93b6f3', 'learnsqlonline.org', 'https://www.learnsqlonline.org/en/Hello%2C_World%21');

INSERT INTO "public"."tutorials_sections" ("id", "tutorial_id", "index", "type") VALUES
('17771d33-7d0a-499b-865c-c48c17384bf7', 'e68294aa-de29-4e7e-862c-810d8edfe97e', 1, 'main'),
('1df3fe68-33d8-4acb-a335-9d1a021818c0', '6f77e372-c923-46c1-8d8c-db154b6cb63b', 2, 'how_to_relax'),
('3bafc874-a9c8-4784-97c6-26e20ecb9419', 'e68294aa-de29-4e7e-862c-810d8edfe97e', 4, 'confidence'),
('53887f20-1db8-4ff4-8f39-de60d86c4d73', '6f77e372-c923-46c1-8d8c-db154b6cb63b', 1, 'main'),
('7f035a6c-3793-40ce-9965-1ce92ace876b', 'e68294aa-de29-4e7e-862c-810d8edfe97e', 3, 'energy'),
('a8046ac3-2c62-46da-8699-7e37a54b0397', '19caa1fb-e850-436d-b532-3adb5d2e77f5', 2, 'joyful_productivity'),
('a9973830-6ecc-4e6f-9457-aac62408dc54', 'e68294aa-de29-4e7e-862c-810d8edfe97e', 5, 'extra_benefits'),
('c07dee05-454c-4730-bbeb-e2da48c03dca', 'e68294aa-de29-4e7e-862c-810d8edfe97e', 2, 'ideas'),
('e6124b37-a152-4e8b-a2c5-dda66eec0b0c', '19caa1fb-e850-436d-b532-3adb5d2e77f5', 1, 'main');

INSERT INTO "public"."updates" ("id", "major", "minor", "revision", "build") VALUES
('bfe5e4d6-6fb6-4c02-a875-1a7a543c65b8', 1, 0, 3, 15);

INSERT INTO "public"."user_default_profile" ("id", "is_available", "lessons_availability_min_interval_in_days", "lessons_availability_min_interval_unit", "lessons_availability_max_students", "training_reminders_enabled", "training_reminders_time", "start_course_reminders_enabled") VALUES
('f11d5c47-61ed-4b8b-ac7d-7175e62dae9e', 't', 7, 'week', 2, 't', '21:00:00', 't');

INSERT INTO "public"."users" ("id", "name", "email", "password", "phone_number", "field_id", "organization_id", "is_mentor", "is_available", "available_from", "registered_on") VALUES
('04e7ec49-bfbe-425b-8c58-e4f1f60e1735', 'Student 2', 's2@test.fake', '$2b$08$/3Qfip6Gg7WSaYoxrT/lguTGAfX/geiYuQv7NpFRvm1RT9Eysuo4C', NULL, 'b021984a-c02c-4fd4-87a7-1aec84c68d6b', '82360ca6-ce95-45f6-a0e3-1c846ee5616b', 'f', 't', '2021-11-29 20:57:50+00', '2023-04-25 18:15:00+00'),
('063842ae-799b-4171-990f-397029d2647f', 'Student 3', 's3@test.fake', '$2b$08$gETEMpUNNST/2MfsBKGxoewcLPWdqMaDC8AXBZLbMzNG.4wIpw4/6', NULL, 'b021984a-c02c-4fd4-87a7-1aec84c68d6b', '82360ca6-ce95-45f6-a0e3-1c846ee5616b', 'f', 't', '2023-04-28 14:16:09+00', '2023-04-28 14:16:09+00'),
('16648dec-350e-4091-8256-9b78788a4a90', 'Edmond MWT', 'edmond@mwbtraining.net', '$2b$08$pDlJHpzAR2dyGZeBFaFk0OHASZOSw1PMdrviP2fm2wlcltJvC/.l.', '+40 742805666', 'b021984a-c02c-4fd4-87a7-1aec84c68d6b', 'aac344ee-6cdf-4acd-8e60-609bfbc589b7', 'f', 't', '2023-05-07 01:03:17+00', '2023-05-07 01:03:17+00'),
('24f7f19c-5262-45bb-8ab5-bae9df67ab66', 'Student 5', 's5@test.fake', '$2b$08$UgwVnKf.dyYPihdbsTBMxenhT50Q.HmjWOehrqtnbw8nVX7PnT/L6', NULL, 'b021984a-c02c-4fd4-87a7-1aec84c68d6b', '82360ca6-ce95-45f6-a0e3-1c846ee5616b', 'f', 't', '2023-08-20 12:34:10+00', '2023-08-20 12:34:10+00'),
('725a0e8d-d712-4542-affb-e66a93cb16c5', 'Mentor mb1', 'mb1@test.fake', '$2b$08$DcRo1xjmrkITcEDWqLPCpOIuDH2B.Ycy4PFuOyycK./cYJIlulOgm', NULL, 'b021984a-c02c-4fd4-87a7-1aec84c68d6b', 'aac344ee-6cdf-4acd-8e60-609bfbc589b7', 't', 't', '2023-07-13 06:16:20+00', '2023-07-13 06:16:20+00'),
('7af316a9-ce4b-4036-9b9e-d7f127b6b252', 'Student 4', 's4@test.fake', '$2b$08$VIaVELmfCxNwPMSVcIODduhRGc6GhlieIjZwnWsC5DN3QJjL1pGu.', NULL, 'b021984a-c02c-4fd4-87a7-1aec84c68d6b', '82360ca6-ce95-45f6-a0e3-1c846ee5616b', 'f', 't', '2023-04-30 15:24:02+00', '2023-04-30 15:24:02+00'),
('9590839b-b450-40f2-b1cc-b9a677711489', 'Mentor 3', 'm3@test.fake', '$2b$08$Ad3JcNwTzDOAVvSUUQR6puaD9BYhpj94MFaDIBV9mDduQCKlZIwgG', NULL, 'b021984a-c02c-4fd4-87a7-1aec84c68d6b', 'aac344ee-6cdf-4acd-8e60-609bfbc589b7', 't', 't', '2023-04-28 14:15:00+00', '2023-04-28 14:15:00+00'),
('a67df461-e05b-42fc-ba70-1e79a8a25a40', 'Mentor mb2', 'mb2@test.fake', '$2b$08$kiwQc31fKwUVwNV.JlG/BOQ9LV/aEe12Jgp1D9llxsYDXo2EmLnqa', NULL, 'b021984a-c02c-4fd4-87a7-1aec84c68d6b', 'd4a4f7c2-3257-40c3-8ea7-771a83355990', 't', 't', '2023-07-16 05:06:04+00', '2023-07-16 05:06:04+00'),
('b2e9059b-fb54-41d6-ae28-18162073787a', 'Edmond MWB', 'edmond@mentorswithoutborders.net', '$2b$08$.D.HOR/8Aq5bwAwsaOY3H.CsvXLE.TK8qDswAqzkqbMX1uDSNc1tC', '+40 742805665', '281c2f07-b3fa-4d91-9c25-9e38524e5836', 'aac344ee-6cdf-4acd-8e60-609bfbc589b7', 't', 't', '2023-04-30 15:45:55+00', '2023-04-30 15:45:55+00'),
('c9682d5f-a104-4229-b8b1-0ccfef35e5f6', 'Student 1', 's1@test.fake', '$2b$08$evxCx.5nEH8j/rTdFPlrWu8W2QrAm/xAmPb0wagrnxRU5ixP53CnK', NULL, 'b021984a-c02c-4fd4-87a7-1aec84c68d6b', '82360ca6-ce95-45f6-a0e3-1c846ee5616b', 'f', 't', '2021-08-29 18:05:48+00', '2023-04-07 18:15:00+00'),
('d4c98320-22ee-4b77-9c2f-81337b94e885', 'Mentor 1', 'm1@test.fake', '$2b$08$s/oUWnN.p.s.taN.kLilOuKCjfkpRao7D8v9/UpgbXrTkyQhdTT/y', NULL, '39297445-cb62-4f38-8a62-25b96dbea8ce', 'aac344ee-6cdf-4acd-8e60-609bfbc589b7', 't', 't', '2023-04-27 17:10:28+00', '2023-04-28 18:15:00+00'),
('d8827495-376a-4bf1-93f5-6f93e1b38453', 'Mentor mb2', 'mb3@test.fake', '$2b$08$w8Rhigp/ycQvGcKUgyB2GOVmKQGr4nM1YutXrIPJ1tCEjNxQlT.la', NULL, 'b021984a-c02c-4fd4-87a7-1aec84c68d6b', 'd4a4f7c2-3257-40c3-8ea7-771a83355990', 't', 't', '2023-07-16 05:10:35+00', '2023-07-16 05:10:35+00'),
('dfffbad3-0cad-493e-a66d-cf3161616323', 'Mentor 2', 'm2@test.fake', '$2b$08$xepPjzhh972n6tcuYm7thu7d.V1WIjRs1hw..A6QYYgQLhEROe1dy', NULL, 'c90c53f8-20dc-4260-b589-885bd79071ef', 'aac344ee-6cdf-4acd-8e60-609bfbc589b7', 't', 't', '2023-04-27 21:03:29+00', '2023-04-25 18:15:00+00'),
('eab5a0d4-3fc0-4915-8a7e-df771c9a9975', 'Edmond Pruteanu', 'edmondpr@gmail.com', '$2b$08$/3PptRIAqoDpf6jhzYSMkemGAGN8AqWroDOGKx/b.HhCPfS82PQn.', '+40 742805664', 'c90c53f8-20dc-4260-b589-885bd79071ef', 'aac344ee-6cdf-4acd-8e60-609bfbc589b7', 't', 't', '2023-05-07 01:02:31+00', '2023-05-07 01:02:31+00');

INSERT INTO "public"."users_app_flags" ("id", "user_id", "is_training_enabled", "is_mentoring_enabled") VALUES
('0625b5e6-24d7-4603-998c-f0c6fdd2668c', 'dfffbad3-0cad-493e-a66d-cf3161616323', 't', 't'),
('0ec3b8dc-d429-4c72-9993-3ed3c1625f8b', '24f7f19c-5262-45bb-8ab5-bae9df67ab66', 't', 't'),
('1513c872-6113-407d-81c8-545b7409b5f3', '725a0e8d-d712-4542-affb-e66a93cb16c5', 't', 't'),
('1b3aae86-e7ce-4ecc-bf04-ec5e18238580', '063842ae-799b-4171-990f-397029d2647f', 't', 't'),
('1b475a65-e974-4a10-902e-c6870eef29eb', '9590839b-b450-40f2-b1cc-b9a677711489', 't', 't'),
('2b49a13a-ff76-4b79-893e-3e1c86d046f9', 'b2e9059b-fb54-41d6-ae28-18162073787a', 't', 't'),
('30bc5723-5706-46e5-8e58-b3aa850395fe', 'c9682d5f-a104-4229-b8b1-0ccfef35e5f6', 't', 't'),
('4daa6cc2-ab62-4c70-a0ce-93c2609f1c56', 'a67df461-e05b-42fc-ba70-1e79a8a25a40', 't', 't'),
('539db694-7e19-4d21-bfb5-8f5675dd23fe', 'eab5a0d4-3fc0-4915-8a7e-df771c9a9975', 't', 't'),
('54c2ec8c-0fa8-46dd-8597-0dfcc633a3bc', 'd4c98320-22ee-4b77-9c2f-81337b94e885', 't', 't'),
('6f362eae-dc48-4790-bf75-6b0a7d21f213', '16648dec-350e-4091-8256-9b78788a4a90', 't', 't'),
('911e5e45-1445-4592-8e4f-c89c637acf2c', '04e7ec49-bfbe-425b-8c58-e4f1f60e1735', 't', 't'),
('b5f2fb6c-035a-4aa1-914a-d62ec6a23bce', '7af316a9-ce4b-4036-9b9e-d7f127b6b252', 't', 't'),
('e146a84e-e94d-4850-a059-9926bb7cc226', 'd8827495-376a-4bf1-93f5-6f93e1b38453', 't', 't');

INSERT INTO "public"."users_app_versions" ("id", "user_id", "major", "minor", "revision", "build") VALUES
('160ecb31-128a-4b8f-8b7a-302300f57c5f', 'dfffbad3-0cad-493e-a66d-cf3161616323', 2, 0, 1, 43),
('5169ce21-599a-4390-a6e5-600d06bd00d8', 'd4c98320-22ee-4b77-9c2f-81337b94e885', 2, 0, 1, 44),
('59306491-282b-421e-b100-14b65205cd9e', '7af316a9-ce4b-4036-9b9e-d7f127b6b252', 2, 0, 1, 43),
('5caeb08d-362c-4b4e-9b11-06c7876595e9', '04e7ec49-bfbe-425b-8c58-e4f1f60e1735', 1, 6, 0, 43),
('7652e48c-a4c6-4267-b89f-eed8928061c9', 'eab5a0d4-3fc0-4915-8a7e-df771c9a9975', 2, 0, 1, 43),
('8549025b-a0e9-4e9d-b290-503a37c7059c', 'c9682d5f-a104-4229-b8b1-0ccfef35e5f6', 1, 6, 0, 43),
('cd45379e-a75b-461b-949e-e21646c310b0', 'b2e9059b-fb54-41d6-ae28-18162073787a', 2, 0, 1, 43),
('ff091d9f-0b72-487a-8c22-2a57862d59cb', '16648dec-350e-4091-8256-9b78788a4a90', 2, 0, 1, 43);

INSERT INTO "public"."users_availabilities" ("id", "user_id", "utc_day_of_week", "utc_time_from", "utc_time_to", "connected_to") VALUES
('090a6ec6-c7ff-40b3-a89a-b9b21d50c12b', 'dfffbad3-0cad-493e-a66d-cf3161616323', 'Monday', '09:00:00', '14:00:00', NULL),
('105215ac-63fd-4e1b-af3e-ef2413e6abd9', 'eab5a0d4-3fc0-4915-8a7e-df771c9a9975', 'Saturday', '07:00:00', '11:00:00', NULL),
('22730245-9a40-43c6-a6e8-53cb18f7f3ed', 'dfffbad3-0cad-493e-a66d-cf3161616323', 'Wednesday', '08:00:00', '19:00:00', NULL),
('2c0231ed-a2ef-4b28-8330-51abdf187639', 'dfffbad3-0cad-493e-a66d-cf3161616323', 'Tuesday', '06:00:00', '17:00:00', NULL),
('33833b11-af2b-4f0b-b673-bf8fa0777259', 'b2e9059b-fb54-41d6-ae28-18162073787a', 'Friday', '04:00:00', '14:00:00', NULL),
('3a13fc7c-682d-43b9-afde-e4661ecc6a27', 'd4c98320-22ee-4b77-9c2f-81337b94e885', 'Saturday', '07:00:00', '11:00:00', NULL),
('68108b49-2e31-43c9-b237-c5bcc94012c6', 'c9682d5f-a104-4229-b8b1-0ccfef35e5f6', 'Monday', '10:00:00', '17:00:00', NULL),
('88aae6b3-d44a-46e7-9625-aaf0e676b968', '04e7ec49-bfbe-425b-8c58-e4f1f60e1735', 'Saturday', '08:00:00', '12:00:00', NULL),
('9aa7b85c-dfc5-4214-88e7-e3fe09500250', 'dfffbad3-0cad-493e-a66d-cf3161616323', 'Friday', '04:00:00', '14:00:00', NULL);

INSERT INTO "public"."users_courses" ("id", "start_date_time", "course_type_id", "whatsapp_group_url", "notes", "has_started", "is_canceled", "canceled_date_time") VALUES
('16fd0ec9-1645-4bf6-8c25-e338c0b09528', '2023-02-27 07:00:00+00', '67ccff8b-646e-4e0b-b425-e0ec19552ceb', NULL, NULL, 't', NULL, NULL),
('61836523-40ce-4044-b071-e0e2b3eced09', '2023-07-02 09:00:00+00', 'c72ac14b-4258-4e53-89ca-7401317f54c4', NULL, NULL, 't', NULL, NULL),
('a27389b0-1a84-4545-873f-55657d4dc7eb', '2022-09-17 12:00:00+00', '5a64abf0-eaa2-48b4-be48-d0708f010526', NULL, NULL, 't', NULL, NULL);

INSERT INTO "public"."users_courses_lessons_canceled" ("id", "user_id", "course_id", "lesson_date_time", "canceled_date_time") VALUES
('1a71bc41-1a0f-4098-890a-b59228e48bac', '063842ae-799b-4171-990f-397029d2647f', '16fd0ec9-1645-4bf6-8c25-e338c0b09528', '2023-02-27 07:00:00+00', NULL);

INSERT INTO "public"."users_courses_mentors" ("id", "course_id", "mentor_id", "subfield_id", "meeting_url", "is_canceled", "canceled_date_time") VALUES
('00c99ab4-b4b1-4472-a61f-e9eec5d0a45d', '61836523-40ce-4044-b071-e0e2b3eced09', 'd4c98320-22ee-4b77-9c2f-81337b94e885', '51b0d446-ac2c-4c96-bd4c-a9b72fe6ba7b', 'https://meet.google.com/mentor1', NULL, NULL),
('4c5df55c-77ac-420b-9ceb-b30ba2c8faee', '16fd0ec9-1645-4bf6-8c25-e338c0b09528', 'd4c98320-22ee-4b77-9c2f-81337b94e885', '94734828-d235-44bd-860f-9948562bd4bc', 'https://meet.google.com/mentor1', NULL, NULL),
('517a4e80-bdfa-4d2d-a463-3ecc14a09d8f', 'a27389b0-1a84-4545-873f-55657d4dc7eb', 'd4c98320-22ee-4b77-9c2f-81337b94e885', '51b0d446-ac2c-4c96-bd4c-a9b72fe6ba7b', 'https://meet.google.com/mentor1', NULL, NULL),
('e1486184-c747-428e-9af5-16a60c891803', 'a27389b0-1a84-4545-873f-55657d4dc7eb', 'dfffbad3-0cad-493e-a66d-cf3161616323', '94734828-d235-44bd-860f-9948562bd4bc', 'https://meet.google.com/mentor2', NULL, NULL);

INSERT INTO "public"."users_courses_partnership_schedule" ("id", "course_id", "mentor_id", "lesson_date_time") VALUES
('025e9ea0-d191-40a9-9a28-fe2e945c086d', 'a27389b0-1a84-4545-873f-55657d4dc7eb', 'dfffbad3-0cad-493e-a66d-cf3161616323', '2022-11-18 12:00:00+00'),
('0d70f8c3-584a-49c1-99aa-58bdd244da1c', 'a27389b0-1a84-4545-873f-55657d4dc7eb', 'd4c98320-22ee-4b77-9c2f-81337b94e885', '2022-09-24 12:00:00+00'),
('2a0522d5-98fb-4b05-a36e-a8bdb5599e3f', 'a27389b0-1a84-4545-873f-55657d4dc7eb', 'd4c98320-22ee-4b77-9c2f-81337b94e885', '2022-10-07 12:00:00+00'),
('387c9b3d-2b35-465c-8229-0b7338adf809', 'a27389b0-1a84-4545-873f-55657d4dc7eb', 'dfffbad3-0cad-493e-a66d-cf3161616323', '2022-11-11 12:00:00+00'),
('3e440197-4796-41f6-89dd-ce4ca5eaa046', 'a27389b0-1a84-4545-873f-55657d4dc7eb', 'd4c98320-22ee-4b77-9c2f-81337b94e885', '2022-10-21 12:00:00+00'),
('412c8389-2343-42aa-892d-1b332d8126a5', 'a27389b0-1a84-4545-873f-55657d4dc7eb', 'dfffbad3-0cad-493e-a66d-cf3161616323', '2022-11-04 12:00:00+00'),
('4273c041-59d4-4bc9-bb53-ed4d979e6e15', 'a27389b0-1a84-4545-873f-55657d4dc7eb', 'd4c98320-22ee-4b77-9c2f-81337b94e885', '2022-10-14 12:00:00+00'),
('5240376c-78e7-41b6-bd2b-b2346df76a2e', 'a27389b0-1a84-4545-873f-55657d4dc7eb', 'dfffbad3-0cad-493e-a66d-cf3161616323', '2022-12-09 12:00:00+00'),
('66b7075c-f016-446e-83e4-285783cbdfa4', 'a27389b0-1a84-4545-873f-55657d4dc7eb', 'd4c98320-22ee-4b77-9c2f-81337b94e885', '2022-10-28 12:00:00+00'),
('765b7c56-6e40-47bc-973f-829b9fc0187d', 'a27389b0-1a84-4545-873f-55657d4dc7eb', 'd4c98320-22ee-4b77-9c2f-81337b94e885', '2022-09-30 12:00:00+00'),
('8c39481b-3e1d-40fe-b008-70d88d86f9c0', 'a27389b0-1a84-4545-873f-55657d4dc7eb', 'dfffbad3-0cad-493e-a66d-cf3161616323', '2022-11-25 12:00:00+00'),
('97ac28c5-f22e-4e84-b833-828b0d15d388', 'a27389b0-1a84-4545-873f-55657d4dc7eb', 'dfffbad3-0cad-493e-a66d-cf3161616323', '2022-12-02 12:00:00+00'),
('c5dc677f-5824-44ae-98d2-89c79708dffd', 'a27389b0-1a84-4545-873f-55657d4dc7eb', 'd4c98320-22ee-4b77-9c2f-81337b94e885', '2022-09-17 12:00:00+00'),
('ff4226ea-3c43-4412-a355-44be3b48bef9', 'a27389b0-1a84-4545-873f-55657d4dc7eb', 'dfffbad3-0cad-493e-a66d-cf3161616323', '2022-12-16 12:00:00+00');

INSERT INTO "public"."users_courses_students" ("id", "course_id", "student_id", "is_canceled", "canceled_date_time") VALUES
('53af09c1-73f3-47e1-944e-d3b08b32b421', '61836523-40ce-4044-b071-e0e2b3eced09', 'c9682d5f-a104-4229-b8b1-0ccfef35e5f6', NULL, NULL),
('04cc4502-b5d9-4ee7-bb20-3752132a00d8', '61836523-40ce-4044-b071-e0e2b3eced09', '04e7ec49-bfbe-425b-8c58-e4f1f60e1735', NULL, NULL),
('ad65ba5d-4a3d-4d7f-ad1f-b5a8eb3be9ee', '16fd0ec9-1645-4bf6-8c25-e338c0b09528', '063842ae-799b-4171-990f-397029d2647f', NULL, NULL),
('d90972f2-1d22-4fb8-8a36-140a86a695ce', 'a27389b0-1a84-4545-873f-55657d4dc7eb', '063842ae-799b-4171-990f-397029d2647f', NULL, NULL),
('aa666bc7-40c8-4671-812d-4f9282623104', 'a27389b0-1a84-4545-873f-55657d4dc7eb', 'c9682d5f-a104-4229-b8b1-0ccfef35e5f6', NULL, NULL),
('baa5513d-ae2f-4aef-8ca8-ff47d7e1b0be', 'a27389b0-1a84-4545-873f-55657d4dc7eb', '04e7ec49-bfbe-425b-8c58-e4f1f60e1735', NULL, NULL),
('60c1e349-6925-4ed1-aa0f-4ecb26219b38', '16fd0ec9-1645-4bf6-8c25-e338c0b09528', '7af316a9-ce4b-4036-9b9e-d7f127b6b252', 't', NULL),
('6aab7b19-9aa5-40bc-a7a5-1b1a300b6bf7', 'a27389b0-1a84-4545-873f-55657d4dc7eb', '7af316a9-ce4b-4036-9b9e-d7f127b6b252', 't', NULL);

INSERT INTO "public"."users_fcm_tokens" ("id", "user_id", "fcm_token") VALUES
('06ebdbc3-ee1b-40dc-9607-915ddaa7dbc2', 'd4c98320-22ee-4b77-9c2f-81337b94e885', 'cBLkLWfkzEdrnGBwCvmh2n:APA91bHQfMCfiNsWs_qoHTALkuwpQLzoTokh_iXnEplOCaPmWyrmnYx-hkfSrcB7jsIAbnagUF7TU1i49hKbEbQBYREZqsGKHHjjlJs7rjINaslOIxaHHG2dIer3Ho3SPk3-ZzfHoUM-'),
('4d086ec3-3c1b-4a6b-9bbe-7b2bb2697358', 'c9682d5f-a104-4229-b8b1-0ccfef35e5f6', 'dfI8fyO0TJao9zpVjkwFY1:APA91bE2duzKZTDYwBPUzB1kPtCQqxj17mCfanabTSh79OU2jsg_P8FtvA7bzYOJqMh12cdgg7qz7xn5LC3SuVELSxZmiMmEGdHHfX1J9zJisA_8hTD5zkLCF9q3YVinX3-DpWyHoF4k'),
('4e3d6df7-8b24-4f8e-b488-a34414fe2295', '7af316a9-ce4b-4036-9b9e-d7f127b6b252', 'erGFxuV3_UpimclYkyblkr:APA91bEPTWiKqOX8V9oClYmM0IWNZ6-Q15qyCun3KdkTRut3wpmwefTsU5Fev6xPFWA22nn-70boYi_XeEZgihbAzJeI7uUPI4znAHxTMLKmS93rzVu6HkFZ6SA3rozOVYu9cQL-eP8v');

INSERT INTO "public"."users_goals" ("id", "user_id", "text", "index", "date_time") VALUES
('2dbbd639-89e3-4306-a440-47abc89a0083', '04e7ec49-bfbe-425b-8c58-e4f1f60e1735', 'I want to work as a programmer and have an income of at least $1000 USD per month.', 0, '2021-11-29 20:57:50.789+00'),
('8c7a6dd7-2287-4fd9-9ab4-ab83f410464f', 'dfffbad3-0cad-493e-a66d-cf3161616323', 'My goal', 0, '2021-11-07 22:52:10.994+00'),
('916b1f87-f50b-48d1-8b93-a48bcdaf5729', '24f7f19c-5262-45bb-8ab5-bae9df67ab66', 'I want to work as a programmer (freelancer or in a company) and have an income of at least $1000 USD per month.', 0, '2023-08-20 12:34:10.618+00'),
('a01ef71f-f9ea-4b1f-9f0f-c1bf097fdeb7', '7af316a9-ce4b-4036-9b9e-d7f127b6b252', 'I want to work as a programmer (freelancer or in a company) and have an income of at least $1000 USD per month.', 0, '2023-04-30 15:24:02.439+00'),
('a5a6554c-8249-4653-bfb0-a04bc353b05e', '16648dec-350e-4091-8256-9b78788a4a90', 'I want to work as a programmer (freelancer or in a company) and have an income of at least $1000 USD per month.', 0, '2023-05-07 01:03:17.126+00'),
('b192b53b-7157-4aea-9a86-c2544b162a44', 'd4c98320-22ee-4b77-9c2f-81337b94e885', 'My goal', 0, '2021-10-21 17:05:23.192+00'),
('db1c4105-ade4-4ac7-8637-23dc2cdb2906', '063842ae-799b-4171-990f-397029d2647f', 'I want to work as a programmer (freelancer or in a company) and have an income of at least $1000 USD per month.', 0, '2023-04-28 14:16:09.021+00'),
('e3475418-46f2-43b8-b235-300913d308da', 'c9682d5f-a104-4229-b8b1-0ccfef35e5f6', 'I want to work as a programmer and have an income of at least $1000 USD per month.', 0, '2021-08-29 18:05:48.359+00');

INSERT INTO "public"."users_lesson_requests" ("id", "student_id", "mentor_id", "subfield_id", "lesson_date_time", "sent_date_time", "is_rejected", "is_canceled", "is_expired", "is_previous_mentor", "was_canceled_shown", "was_expired_shown") VALUES
('f19a7dd3-a809-4eb3-b3d0-d7a35dff5a3d', 'c9682d5f-a104-4229-b8b1-0ccfef35e5f6', 'dfffbad3-0cad-493e-a66d-cf3161616323', 'ef1e8355-7abe-457a-93e5-ca877d133c20', '2022-08-09 15:00:00+00', '2022-07-31 19:44:19+00', NULL, 't', NULL, 'f', NULL, NULL);

INSERT INTO "public"."users_lessons" ("id", "mentor_id", "subfield_id", "date_time", "meeting_url", "is_mentor_present", "end_recurrence_date_time", "is_canceled", "canceled_date_time") VALUES
('3467bd9c-b676-428e-96e2-398b96c6ad24', 'dfffbad3-0cad-493e-a66d-cf3161616323', 'd0a76ab3-93a6-4c3c-bb80-7aad85fa071d', '2022-08-07 12:00:00+00', 'https://meet.google.com/test', NULL, '2022-08-28 12:00:00+00', 't', NULL),
('9764988e-e6e5-4407-8310-335388f547a8', 'd4c98320-22ee-4b77-9c2f-81337b94e885', 'ef1e8355-7abe-457a-93e5-ca877d133c20', '2022-04-05 15:00:00+00', 'https://meet.google.com/rga-brfa-pwc', NULL, '2022-04-19 15:00:00+00', 't', NULL),
('e655ba1f-00e6-49e9-8798-8b2ecd408b0d', 'eab5a0d4-3fc0-4915-8a7e-df771c9a9975', 'ef1e8355-7abe-457a-93e5-ca877d133c20', '2023-05-01 15:00:00+00', 'https://meet.google.com/test', NULL, '2023-05-15 15:00:00+00', 't', NULL);

INSERT INTO "public"."users_lessons_availabilities" ("id", "user_id", "min_interval_in_days", "min_interval_unit", "max_students") VALUES
('1dcde698-90df-4edb-9da1-96f542b74e67', 'b2e9059b-fb54-41d6-ae28-18162073787a', NULL, NULL, 2),
('519cbf15-d34b-4ed4-b12b-89bcaef43519', '725a0e8d-d712-4542-affb-e66a93cb16c5', 7, 'week', 2),
('5a28ab05-8b32-401a-a1a7-2545a5fefcae', 'd8827495-376a-4bf1-93f5-6f93e1b38453', 7, 'week', 2),
('6e4f725f-f447-4e91-8fa0-67c4b60da617', '9590839b-b450-40f2-b1cc-b9a677711489', 7, 'week', 2),
('84feb980-5798-4ecb-8dc2-3db6b9fb520a', 'dfffbad3-0cad-493e-a66d-cf3161616323', NULL, NULL, 2),
('b40a534e-4492-4e9a-9147-ee332ecd2b69', 'a67df461-e05b-42fc-ba70-1e79a8a25a40', 7, 'week', 2),
('e587f7bd-7f1c-4312-b5e0-ee289ff59c77', 'd4c98320-22ee-4b77-9c2f-81337b94e885', NULL, NULL, 3),
('f6635630-20f8-44ae-813b-106afff56711', 'eab5a0d4-3fc0-4915-8a7e-df771c9a9975', NULL, NULL, 2);

INSERT INTO "public"."users_lessons_canceled" ("id", "user_id", "lesson_id", "lesson_date_time", "canceled_date_time") VALUES
('28a66591-d0d9-4a5b-b039-8ec5694c9e9b', 'eab5a0d4-3fc0-4915-8a7e-df771c9a9975', 'e655ba1f-00e6-49e9-8798-8b2ecd408b0d', '2023-05-15 15:00:00+00', '2023-05-07 01:07:28+00'),
('31af41b1-bb14-40f1-9e8a-c0a27309d78d', 'eab5a0d4-3fc0-4915-8a7e-df771c9a9975', 'e655ba1f-00e6-49e9-8798-8b2ecd408b0d', '2023-05-08 15:00:00+00', '2023-05-07 01:07:16+00'),
('4c32dd2d-7c03-4b13-be4c-46d0629c676c', '16648dec-350e-4091-8256-9b78788a4a90', 'e655ba1f-00e6-49e9-8798-8b2ecd408b0d', '2023-05-15 15:00:00+00', '2023-05-07 01:07:28+00'),
('822b3b23-0294-46e2-b487-8e3826a48335', '16648dec-350e-4091-8256-9b78788a4a90', 'e655ba1f-00e6-49e9-8798-8b2ecd408b0d', '2023-05-08 15:00:00+00', '2023-05-07 01:07:16+00');

INSERT INTO "public"."users_lessons_students" ("id", "lesson_id", "student_id", "is_canceled", "canceled_date_time") VALUES
('8bb24774-45d6-4c43-9fa4-78c250dc212a', 'e655ba1f-00e6-49e9-8798-8b2ecd408b0d', '16648dec-350e-4091-8256-9b78788a4a90', NULL, NULL);

INSERT INTO "public"."users_notifications_settings" ("id", "user_id", "training_reminders_enabled", "training_reminders_time", "start_course_reminders_enabled", "start_course_reminders_date", "enabled", "time") VALUES
('15ba583b-83c2-40bb-a21d-fe89042ca9e7', '16648dec-350e-4091-8256-9b78788a4a90', 't', '21:00:00', NULL, NULL, NULL, NULL),
('42c2d030-3e2a-4645-9074-98591513276e', '725a0e8d-d712-4542-affb-e66a93cb16c5', 't', '21:00:00', 't', '2023-07-13', NULL, NULL),
('43da954d-4900-4760-aaae-8c641e002b1a', 'b2e9059b-fb54-41d6-ae28-18162073787a', 't', '21:10:00', 't', '2023-06-12', 't', '21:10:00'),
('6c0f56d7-8c3f-465f-ba7e-107457d6e304', '24f7f19c-5262-45bb-8ab5-bae9df67ab66', 't', '21:00:00', NULL, NULL, NULL, NULL),
('6f5eafbf-f3c7-4373-947b-3033b9093398', 'dfffbad3-0cad-493e-a66d-cf3161616323', 't', '21:00:00', NULL, NULL, NULL, NULL),
('7855fc74-50e5-4cb8-be10-b485c14a8747', 'eab5a0d4-3fc0-4915-8a7e-df771c9a9975', 't', '21:00:00', 't', '2023-05-07', NULL, NULL),
('7a697c87-b1a0-4b27-b15e-8f4f63be374c', 'd4c98320-22ee-4b77-9c2f-81337b94e885', 't', '16:08:00', 't', '2023-09-18', NULL, NULL),
('a4f1bd1b-4773-4f33-8b55-ff7374ee958b', 'a67df461-e05b-42fc-ba70-1e79a8a25a40', 't', '21:00:00', 't', '2023-07-16', NULL, NULL),
('bfa821b1-7415-4adc-87ed-d5a0e6a3ca18', 'c9682d5f-a104-4229-b8b1-0ccfef35e5f6', 't', '09:34:00', NULL, NULL, 't', '09:34:00'),
('c772594c-5f48-4562-ad2e-9baa8abe7cf2', 'd8827495-376a-4bf1-93f5-6f93e1b38453', 't', '21:00:00', 't', '2023-07-16', NULL, NULL),
('d893218a-f96e-46e7-9beb-a21af3694069', '9590839b-b450-40f2-b1cc-b9a677711489', 't', '21:00:00', 't', '2023-04-28', NULL, NULL),
('e862e4f0-56b7-439a-bd3f-f4a7877a3997', '063842ae-799b-4171-990f-397029d2647f', 't', '21:02:00', NULL, NULL, NULL, NULL),
('ecfede03-5a20-4f05-8da9-dcb5ead83b53', '04e7ec49-bfbe-425b-8c58-e4f1f60e1735', 't', '20:00:00', NULL, NULL, NULL, NULL),
('f0027e90-df0c-4586-9eeb-5b20ef72ef48', '7af316a9-ce4b-4036-9b9e-d7f127b6b252', 't', '21:00:00', NULL, NULL, NULL, NULL);

INSERT INTO "public"."users_quizzes" ("id", "user_id", "number", "is_correct", "is_closed", "date_time") VALUES
('035cdf3d-ac78-46b2-953d-ef64732d1125', 'c9682d5f-a104-4229-b8b1-0ccfef35e5f6', 1, 't', NULL, '2023-04-09 22:19:08.562+00'),
('11f53658-157e-4ddb-9ab5-76a4c3c461ed', 'c9682d5f-a104-4229-b8b1-0ccfef35e5f6', 8, 't', NULL, '2023-04-23 22:21:38.247+00'),
('1e47c69d-b5c9-41f3-844a-13d2931b5142', 'c9682d5f-a104-4229-b8b1-0ccfef35e5f6', 4, 't', NULL, '2023-04-16 22:20:26.121+00'),
('2e7f1cd8-69dc-42a0-9bec-785e9200415f', 'c9682d5f-a104-4229-b8b1-0ccfef35e5f6', 3, 't', NULL, '2023-04-09 22:19:20.534+00'),
('72212b29-173c-4348-ba04-abfcded2d159', 'c9682d5f-a104-4229-b8b1-0ccfef35e5f6', 10, 't', NULL, '2023-04-30 22:23:17.153+00'),
('74b92515-8540-4d1e-8c89-924eeaa4c000', 'c9682d5f-a104-4229-b8b1-0ccfef35e5f6', 5, 't', NULL, '2023-04-16 22:20:31.13+00'),
('8f7ab781-192f-4a72-83c6-b3cc3d1299d8', 'c9682d5f-a104-4229-b8b1-0ccfef35e5f6', 7, 't', NULL, '2023-04-23 22:21:32.737+00'),
('bbc4d802-7c38-448a-a1a7-8f84079c9419', '7af316a9-ce4b-4036-9b9e-d7f127b6b252', 1, NULL, 't', '2023-05-06 17:05:32.093+00'),
('c28b310a-058d-4217-a03c-c1ba4363432a', 'c9682d5f-a104-4229-b8b1-0ccfef35e5f6', 9, 't', NULL, '2023-04-23 22:22:14.086+00'),
('c584f482-8629-46f3-b736-66e2cff7ed43', '7af316a9-ce4b-4036-9b9e-d7f127b6b252', 1, NULL, 't', '2023-05-06 22:00:28.947+00'),
('db6cfb47-9c12-493b-99b7-cbfd4157a5ab', 'c9682d5f-a104-4229-b8b1-0ccfef35e5f6', 12, 't', NULL, '2023-04-30 22:24:07.327+00'),
('dcf7ee2a-c26a-4c0f-982f-c6fb1315fb36', 'c9682d5f-a104-4229-b8b1-0ccfef35e5f6', 2, 't', NULL, '2023-04-09 22:19:13.534+00'),
('e3b941dc-1a4c-4fcc-900f-5a3410efc14e', 'c9682d5f-a104-4229-b8b1-0ccfef35e5f6', 11, 't', NULL, '2023-04-30 22:23:20.632+00'),
('fc2bdca6-dccb-4e15-80ea-5e47a97868c0', 'c9682d5f-a104-4229-b8b1-0ccfef35e5f6', 6, 't', NULL, '2023-04-16 22:20:50.766+00');

INSERT INTO "public"."users_refresh_tokens" ("id", "user_id", "refresh_token") VALUES
('163c1853-feea-44ba-826f-7a6134750111', 'dfffbad3-0cad-493e-a66d-cf3161616323', '798ef304-538a-4457-b6e4-c04c35e484e5'),
('21c1f421-0280-4afa-b2ff-3fe61cd7d4e1', 'c9682d5f-a104-4229-b8b1-0ccfef35e5f6', 'e24c9852-808e-4cad-b808-073e9c3b2bbf'),
('53cd4643-3b8a-4bd5-a92c-ddf51ffe233f', 'a67df461-e05b-42fc-ba70-1e79a8a25a40', '2089b9be-15dc-4cc2-ac12-fd8f45b4df11'),
('63a82dcb-3b7e-47c4-975e-c4f76255fcb7', '063842ae-799b-4171-990f-397029d2647f', '3476f259-831c-417b-9260-68ca81fafaf5'),
('6faddc46-b403-4eeb-8e62-d45fa9e54b1c', '9590839b-b450-40f2-b1cc-b9a677711489', 'dafe5acd-f37b-4c34-b634-382e7658c467'),
('93b7d830-6c3e-4f2b-8b5e-ec43b4e51c0c', '725a0e8d-d712-4542-affb-e66a93cb16c5', 'eb91d01a-4a18-4edb-b9d1-e46e6e284878'),
('a003fc6c-56a0-4aa1-a8f0-30a1fe46a5ed', '24f7f19c-5262-45bb-8ab5-bae9df67ab66', 'c0e3aead-b4e8-4879-a1fa-22c3544c9b3f'),
('afa850ca-a102-4b26-8ff8-fcfac15ac949', '7af316a9-ce4b-4036-9b9e-d7f127b6b252', '39415e7d-7ac6-4ca9-a346-612d2fca33b9'),
('cf6a0e71-6af2-4323-863d-ab2b724387aa', 'd8827495-376a-4bf1-93f5-6f93e1b38453', 'cd6a441e-ea8f-4451-9509-bb253dee9753'),
('d81a616f-2df5-412f-bd2d-58ed5e2b7a68', 'd4c98320-22ee-4b77-9c2f-81337b94e885', '732387e1-6404-4911-afd2-57c1f0638078'),
('de1bf7a3-e270-446a-998f-5cfb8dcb7e66', '04e7ec49-bfbe-425b-8c58-e4f1f60e1735', '2c80601f-0354-44ed-b7fb-a5e3132f50f2');

INSERT INTO "public"."users_reset_password" ("id", "email", "date_time") VALUES
('53b2670f-051f-4579-aaa0-83eb180c57bd', 'edmondpr@gmail.com', '2021-08-21 15:46:41.069+00'),
('aef33d5c-bc20-4b95-88a1-309137fa7649', 'edmond@mentorswithoutborders.net', '2021-10-30 11:37:24.128+00');

INSERT INTO "public"."users_skills" ("id", "user_id", "subfield_id", "skill_index", "skill_id") VALUES
('2764a4e9-3861-443a-ae2e-16bbda415da9', 'dfffbad3-0cad-493e-a66d-cf3161616323', '94734828-d235-44bd-860f-9948562bd4bc', 1, '044e2dd5-8569-4196-bdc7-be48f1148fc3'),
('3311d880-e66c-4807-8eb7-485ff02d9b6d', 'eab5a0d4-3fc0-4915-8a7e-df771c9a9975', '94734828-d235-44bd-860f-9948562bd4bc', 2, 'ac8e6491-0d1b-4420-adbd-e8804fbeb13d'),
('40ac01f6-2b85-4e6e-b589-f90def5cf822', 'dfffbad3-0cad-493e-a66d-cf3161616323', '71ffadb3-4115-41c6-8599-f73ca94072d8', 1, 'ac8e6491-0d1b-4420-adbd-e8804fbeb13d'),
('58ca1da8-9300-401c-9832-4c3a21542593', 'dfffbad3-0cad-493e-a66d-cf3161616323', '94734828-d235-44bd-860f-9948562bd4bc', 2, 'ac8e6491-0d1b-4420-adbd-e8804fbeb13d'),
('674d45fa-0e32-41b9-ba14-a118400cb935', 'eab5a0d4-3fc0-4915-8a7e-df771c9a9975', '94734828-d235-44bd-860f-9948562bd4bc', 1, '044e2dd5-8569-4196-bdc7-be48f1148fc3');

INSERT INTO "public"."users_steps" ("id", "user_id", "goal_id", "text", "index", "level", "parent_id", "date_time") VALUES
('05253945-bc94-4051-b2ee-72710168dae4', 'c9682d5f-a104-4229-b8b1-0ccfef35e5f6', 'e3475418-46f2-43b8-b235-300913d308da', 'S1', 0, 0, NULL, '2022-09-02 18:00:54.054365+00'),
('91debe3f-d8a6-4f40-98fd-30660dca10ee', 'd4c98320-22ee-4b77-9c2f-81337b94e885', 'b192b53b-7157-4aea-9a86-c2544b162a44', 'S1', 0, 0, NULL, '2023-04-30 09:01:01.481+00'),
('ba7e3583-8d88-48bf-ad4f-79c270e3bd1c', 'c9682d5f-a104-4229-b8b1-0ccfef35e5f6', 'e3475418-46f2-43b8-b235-300913d308da', 'S11', 0, 1, '05253945-bc94-4051-b2ee-72710168dae4', '2022-09-02 18:01:16.956102+00'),
('d2d9e72d-208b-4960-8d04-4224ad1e8de5', 'c9682d5f-a104-4229-b8b1-0ccfef35e5f6', 'e3475418-46f2-43b8-b235-300913d308da', 'S2', 0, 0, NULL, '2022-09-02 18:01:54.054365+00');

INSERT INTO "public"."users_subfields" ("id", "user_id", "subfield_index", "subfield_id") VALUES
('0a7132a3-2409-4840-9ce6-7d605d36e427', 'dfffbad3-0cad-493e-a66d-cf3161616323', 1, '94734828-d235-44bd-860f-9948562bd4bc'),
('559e6345-ab55-42ec-b29b-3bf701d69e6b', 'dfffbad3-0cad-493e-a66d-cf3161616323', 2, '71ffadb3-4115-41c6-8599-f73ca94072d8'),
('7b9f01c0-ea90-47e3-b093-b4f763cff1b6', 'c9682d5f-a104-4229-b8b1-0ccfef35e5f6', NULL, 'ef1e8355-7abe-457a-93e5-ca877d133c20'),
('c0ee9ac6-04f8-484c-9139-603117f4d8de', 'd4c98320-22ee-4b77-9c2f-81337b94e885', 2, '4c962a78-c253-440d-89e0-faf7be7187e6'),
('c4ce1229-0cab-47df-9f83-7c02446e8a87', 'd4c98320-22ee-4b77-9c2f-81337b94e885', 1, '51b0d446-ac2c-4c96-bd4c-a9b72fe6ba7b'),
('db0c8f96-385a-4b54-a7dc-4dcdc9e2bb18', 'eab5a0d4-3fc0-4915-8a7e-df771c9a9975', 1, '94734828-d235-44bd-860f-9948562bd4bc'),
('fe8705bb-303d-4e9b-931d-5d217704ff10', '04e7ec49-bfbe-425b-8c58-e4f1f60e1735', NULL, 'ef1e8355-7abe-457a-93e5-ca877d133c20');

INSERT INTO "public"."users_timezones" ("id", "user_id", "name", "abbreviation", "utc_offset") VALUES
('2e5fc756-dd6d-4d92-88b5-f01cc9e62070', 'dfffbad3-0cad-493e-a66d-cf3161616323', 'Europe/Bucharest', 'EEST', '3:00'),
('4c574909-fac1-4917-a73f-4cccbfdcbca6', '04e7ec49-bfbe-425b-8c58-e4f1f60e1735', 'Europe/Bucharest', 'EEST', '3:00'),
('58a03d1e-bc50-47ff-9df0-21ced742a42e', '725a0e8d-d712-4542-affb-e66a93cb16c5', 'Asia/Kolkata', 'IST', '5:30'),
('60835f26-952f-414e-a0df-1d171a5ccfb3', 'd4c98320-22ee-4b77-9c2f-81337b94e885', 'Europe/Bucharest', 'EEST', '3:00'),
('6f2fde26-445c-4c82-8df7-b7f219440981', '063842ae-799b-4171-990f-397029d2647f', 'Europe/Bucharest', 'EEST', '3:00'),
('8f7f955d-c300-4941-b9dc-6cf73b8864e4', '7af316a9-ce4b-4036-9b9e-d7f127b6b252', 'Europe/Bucharest', 'EEST', '3:00'),
('a274c807-f3db-460c-94b8-0e8afba39f38', 'b2e9059b-fb54-41d6-ae28-18162073787a', 'Europe/Bucharest', 'EEST', '3:00'),
('a4094961-9d65-4608-88f7-fd13a47130cb', 'a67df461-e05b-42fc-ba70-1e79a8a25a40', 'Asia/Kolkata', 'IST', '5:30'),
('b359a0fa-c5e1-4c6a-8b66-62088ae4afb5', '24f7f19c-5262-45bb-8ab5-bae9df67ab66', 'Europe/Bucharest', 'EEST', '3:00'),
('b7375ac8-fe30-42e4-8919-f1dc746c1e2c', '16648dec-350e-4091-8256-9b78788a4a90', 'Europe/Bucharest', 'EEST', '3:00'),
('c86dd174-0d04-4d57-87b3-23b1597c2f3a', 'd8827495-376a-4bf1-93f5-6f93e1b38453', 'Asia/Kolkata', 'IST', '5:30'),
('d637072c-fbc6-43d8-8c70-fbeb994b0db1', 'c9682d5f-a104-4229-b8b1-0ccfef35e5f6', 'Europe/Bucharest', 'EEST', '3:00'),
('e1579c8d-3a17-45de-b77b-43988ccadda0', '9590839b-b450-40f2-b1cc-b9a677711489', 'Europe/Bucharest', 'EEST', '3:00'),
('ec806bb8-a64d-436b-a339-191f019f7cf4', 'eab5a0d4-3fc0-4915-8a7e-df771c9a9975', 'Europe/Bucharest', 'EEST', '3:00');

ALTER TABLE "public"."admin_assigned_users" ADD FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."admin_assigned_users" ADD FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."admin_available_users" ADD FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."admin_conversations" ADD FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."admin_permissions" ADD FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."admin_students_certificates" ADD FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."admin_trainers_workdays" ADD FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."admin_training_reminders" ADD FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."approved_users" ADD FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");
ALTER TABLE "public"."approved_users" ADD FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id");
ALTER TABLE "public"."fields_subfields" ADD FOREIGN KEY ("subfield_id") REFERENCES "public"."subfields"("id");
ALTER TABLE "public"."fields_subfields" ADD FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id");
ALTER TABLE "public"."fields_tutorials" ADD FOREIGN KEY ("tutorial_id") REFERENCES "public"."tutorials_lessons"("id");
ALTER TABLE "public"."fields_tutorials" ADD FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id");
ALTER TABLE "public"."guides_recommendations" ADD FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id");
ALTER TABLE "public"."guides_recommendations" ADD FOREIGN KEY ("subfield_id") REFERENCES "public"."subfields"("id");
ALTER TABLE "public"."guides_skills_tutorials" ADD FOREIGN KEY ("tutorial_id") REFERENCES "public"."guides_tutorials"("id");
ALTER TABLE "public"."guides_skills_tutorials" ADD FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id");
ALTER TABLE "public"."logger" ADD FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."mentors_partnership_requests" ADD FOREIGN KEY ("partner_subfield_id") REFERENCES "public"."subfields"("id");
ALTER TABLE "public"."mentors_partnership_requests" ADD FOREIGN KEY ("subfield_id") REFERENCES "public"."subfields"("id");
ALTER TABLE "public"."mentors_partnership_requests" ADD FOREIGN KEY ("partner_mentor_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."mentors_partnership_requests" ADD FOREIGN KEY ("course_type_id") REFERENCES "public"."course_types"("id");
ALTER TABLE "public"."mentors_partnership_requests" ADD FOREIGN KEY ("mentor_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."mentors_waiting_requests" ADD FOREIGN KEY ("mentor_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."organizations_centres" ADD FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");
ALTER TABLE "public"."projects" ADD FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");
ALTER TABLE "public"."projects_courses" ADD FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id");
ALTER TABLE "public"."projects_courses" ADD FOREIGN KEY ("course_id") REFERENCES "public"."users_courses"("id");
ALTER TABLE "public"."skills_tutorials" ADD FOREIGN KEY ("tutorial_id") REFERENCES "public"."tutorials_lessons"("id");
ALTER TABLE "public"."skills_tutorials" ADD FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id");
ALTER TABLE "public"."subfields_skills" ADD FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id");
ALTER TABLE "public"."subfields_skills" ADD FOREIGN KEY ("subfield_id") REFERENCES "public"."subfields"("id");
ALTER TABLE "public"."subfields_tutorials" ADD FOREIGN KEY ("tutorial_id") REFERENCES "public"."tutorials_lessons"("id");
ALTER TABLE "public"."subfields_tutorials" ADD FOREIGN KEY ("subfield_id") REFERENCES "public"."subfields"("id");
ALTER TABLE "public"."tutorials_sections" ADD FOREIGN KEY ("tutorial_id") REFERENCES "public"."tutorials"("id");
ALTER TABLE "public"."users" ADD FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id");
ALTER TABLE "public"."users" ADD FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");
ALTER TABLE "public"."users_app_flags" ADD FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."users_app_versions" ADD FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."users_availabilities" ADD FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."users_certificates_pauses" ADD FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."users_courses" ADD FOREIGN KEY ("course_type_id") REFERENCES "public"."course_types"("id");
ALTER TABLE "public"."users_courses_lessons_canceled" ADD FOREIGN KEY ("course_id") REFERENCES "public"."users_courses"("id");
ALTER TABLE "public"."users_courses_mentors" ADD FOREIGN KEY ("subfield_id") REFERENCES "public"."subfields"("id");
ALTER TABLE "public"."users_courses_mentors" ADD FOREIGN KEY ("course_id") REFERENCES "public"."users_courses"("id");
ALTER TABLE "public"."users_courses_mentors" ADD FOREIGN KEY ("mentor_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."users_courses_partnership_schedule" ADD FOREIGN KEY ("course_id") REFERENCES "public"."users_courses"("id");
ALTER TABLE "public"."users_courses_partnership_schedule" ADD FOREIGN KEY ("mentor_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."users_courses_students" ADD FOREIGN KEY ("student_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."users_courses_students" ADD FOREIGN KEY ("course_id") REFERENCES "public"."users_courses"("id");
ALTER TABLE "public"."users_fcm_tokens" ADD FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."users_goals" ADD FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."users_in_app_messages" ADD FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."users_lesson_requests" ADD FOREIGN KEY ("student_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."users_lesson_requests" ADD FOREIGN KEY ("subfield_id") REFERENCES "public"."subfields"("id");
ALTER TABLE "public"."users_lesson_requests" ADD FOREIGN KEY ("mentor_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."users_lessons" ADD FOREIGN KEY ("subfield_id") REFERENCES "public"."subfields"("id");
ALTER TABLE "public"."users_lessons" ADD FOREIGN KEY ("mentor_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."users_lessons_availabilities" ADD FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."users_lessons_canceled" ADD FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."users_lessons_canceled" ADD FOREIGN KEY ("lesson_id") REFERENCES "public"."users_lessons"("id");
ALTER TABLE "public"."users_lessons_notes" ADD FOREIGN KEY ("student_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."users_lessons_notes" ADD FOREIGN KEY ("lesson_id") REFERENCES "public"."users_lessons"("id");
ALTER TABLE "public"."users_lessons_stopped" ADD FOREIGN KEY ("student_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."users_lessons_students" ADD FOREIGN KEY ("lesson_id") REFERENCES "public"."users_lessons"("id");
ALTER TABLE "public"."users_lessons_students" ADD FOREIGN KEY ("student_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."users_notifications_settings" ADD FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."users_quizzes" ADD FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."users_refresh_tokens" ADD FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."users_skills" ADD FOREIGN KEY ("subfield_id") REFERENCES "public"."subfields"("id");
ALTER TABLE "public"."users_skills" ADD FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id");
ALTER TABLE "public"."users_skills" ADD FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."users_steps" ADD FOREIGN KEY ("goal_id") REFERENCES "public"."users_goals"("id");
ALTER TABLE "public"."users_steps" ADD FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."users_subfields" ADD FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."users_subfields" ADD FOREIGN KEY ("subfield_id") REFERENCES "public"."subfields"("id");
ALTER TABLE "public"."users_support_requests" ADD FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");
ALTER TABLE "public"."users_timezones" ADD FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");