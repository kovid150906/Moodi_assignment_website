-- Migration: Allow same user to register for same competition in different cities
-- Run this against your database to update the unique constraint

-- Step 1: Drop the old constraint (user can only register once per competition)
ALTER TABLE participations DROP INDEX uk_user_competition;

-- Step 2: Add new constraint (user can register once per competition+city)
ALTER TABLE participations ADD UNIQUE KEY uk_user_competition_city (user_id, competition_id, city_id);

SELECT 'Migration completed: Users can now register for same competition in different cities' AS status;
