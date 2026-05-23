-- CreateTable
CREATE TABLE `StreamSession` (
    `session_id` INTEGER NOT NULL AUTO_INCREMENT,
    `camera_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `protocol` VARCHAR(191) NOT NULL,
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ended_at` DATETIME(3) NULL,
    `duration_sec` INTEGER NULL,

    PRIMARY KEY (`session_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `StreamSession` ADD CONSTRAINT `StreamSession_camera_id_fkey` FOREIGN KEY (`camera_id`) REFERENCES `Camera`(`camera_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StreamSession` ADD CONSTRAINT `StreamSession_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
