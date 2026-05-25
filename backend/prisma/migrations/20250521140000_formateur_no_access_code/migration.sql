-- Formateur : pas de code participant (connexion admin par mot de passe uniquement).
ALTER TABLE "Participant" ALTER COLUMN "accessCode" DROP NOT NULL;
