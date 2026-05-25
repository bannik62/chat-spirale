-- Pseudo global par participant (réutilisé dans tous les salons)
ALTER TABLE "Participant" ADD COLUMN "displayName" TEXT;

-- Reprendre un pseudo déjà saisi dans un salon
UPDATE "Participant" p
SET "displayName" = sub.name
FROM (
  SELECT DISTINCT ON ("participantId") "participantId", "displayName" AS name
  FROM "RoomMembership"
  WHERE "displayName" IS NOT NULL AND length(trim("displayName")) >= 2
  ORDER BY "participantId", "createdAt" DESC
) sub
WHERE p.id = sub."participantId";

UPDATE "RoomMembership" m
SET "displayName" = p."displayName"
FROM "Participant" p
WHERE m."participantId" = p.id AND p."displayName" IS NOT NULL;
