-- Reset leads and related data
DELETE FROM lead_tags;
DELETE FROM notes;
DELETE FROM reminders;
DELETE FROM leads;

-- Reset sequences
ALTER SEQUENCE leads_id_seq RESTART WITH 1;
ALTER SEQUENCE notes_id_seq RESTART WITH 1;
ALTER SEQUENCE reminders_id_seq RESTART WITH 1;

SELECT 'Leads data reset successfully' as message;
