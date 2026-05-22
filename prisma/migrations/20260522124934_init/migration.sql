-- CreateTable
CREATE TABLE `Camera` (
    `camera_id` INTEGER NOT NULL AUTO_INCREMENT,
    `camera_name` VARCHAR(191) NOT NULL,
    `camera_type` VARCHAR(191) NOT NULL,
    `ip_address` VARCHAR(191) NOT NULL,
    `port` INTEGER NOT NULL,
    `rtsp_url` VARCHAR(191) NOT NULL,
    `rtsp_username` VARCHAR(191) NOT NULL,
    `rtsp_password` VARCHAR(191) NOT NULL,
    `zone_id` INTEGER NOT NULL,
    `resolution` VARCHAR(191) NOT NULL,
    `fps` INTEGER NOT NULL,
    `codec` VARCHAR(191) NOT NULL,
    `ptz_enabled` BOOLEAN NOT NULL,
    `ir_enabled` BOOLEAN NOT NULL,
    `installed_at` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ONLINE',
    `last_health_check` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Camera_rtsp_url_key`(`rtsp_url`),
    PRIMARY KEY (`camera_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SystemLog` (
    `log_id` INTEGER NOT NULL AUTO_INCREMENT,
    `camera_id` INTEGER NOT NULL,
    `event` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`log_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SystemLog` ADD CONSTRAINT `SystemLog_camera_id_fkey` FOREIGN KEY (`camera_id`) REFERENCES `Camera`(`camera_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
