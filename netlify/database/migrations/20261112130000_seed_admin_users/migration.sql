-- Optional manager logins from the ADMIN_USERS_SEED env var.
-- Usernames are stored in the existing admin_users.email column.
-- db:migrate:apply runs data.ts after this statement, before the migration
-- is marked applied. data.ts inserts a user only when that username is new.
-- This statement does not read or write schedule data.
-- Safe to run again: an existing username is not updated, so its password stays as it is.
SELECT 1;
