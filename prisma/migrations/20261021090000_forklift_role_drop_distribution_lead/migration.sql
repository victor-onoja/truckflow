-- Yard operators become forklift operators.
UPDATE "User" SET "role" = 'FORKLIFT_OPERATOR' WHERE "role" = 'YARD_OPERATOR';
UPDATE "User" SET "fullName" = 'Forklift Operator Demo'
  WHERE "phone" = '08010000002' AND "fullName" = 'Yard Operator Demo';

-- Distribution lead role is retired. Drop the untouched demo account (and its
-- notifications) if it never recorded a stage; any other distribution leads
-- keep their accounts as supervisors.
DELETE FROM "Notification" WHERE "userId" IN (
  SELECT "id" FROM "User"
  WHERE "phone" = '08010000005' AND "fullName" = 'Distribution Lead Demo'
    AND "id" NOT IN (SELECT "triggeredById" FROM "StageEvent")
);
DELETE FROM "User"
  WHERE "phone" = '08010000005' AND "fullName" = 'Distribution Lead Demo'
    AND "id" NOT IN (SELECT "triggeredById" FROM "StageEvent");
UPDATE "User" SET "role" = 'SUPERVISOR' WHERE "role" = 'DISTRIBUTION_LEAD';
