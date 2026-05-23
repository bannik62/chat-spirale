-- DropForeignKey
ALTER TABLE "AccessToken" DROP CONSTRAINT IF EXISTS "AccessToken_chatRoomId_fkey";
ALTER TABLE "Message" DROP CONSTRAINT IF EXISTS "Message_chatRoomId_fkey";

-- DropTable
DROP TABLE IF EXISTS "AccessToken";

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accessCode" TEXT NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomMembership" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "chatRoomId" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Participant_email_key" ON "Participant"("email");
CREATE UNIQUE INDEX "Participant_accessCode_key" ON "Participant"("accessCode");
CREATE UNIQUE INDEX "RoomMembership_participantId_chatRoomId_key" ON "RoomMembership"("participantId", "chatRoomId");

-- AddForeignKey
ALTER TABLE "RoomMembership" ADD CONSTRAINT "RoomMembership_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomMembership" ADD CONSTRAINT "RoomMembership_chatRoomId_fkey" FOREIGN KEY ("chatRoomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
