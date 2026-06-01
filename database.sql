-- --------------------------------------------------------------------------
-- RSAI - CHAT INTERACTION LOGS TABLE STRUCTURE
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `chat_interactions` (
    `uuid` VARCHAR(36) NOT NULL COMMENT 'Unique identifier generated on insertion',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Timestamp row creation',
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Timestamp row update',
    `session_id` VARCHAR(255) NOT NULL COMMENT 'Ties exchanges to a single conversation session',
    `channel` VARCHAR(50) DEFAULT 'Web' COMMENT 'Origin channel of communication',
    `user_message` TEXT DEFAULT NULL COMMENT 'Message text sent by the user',
    `user_account_id` VARCHAR(255) DEFAULT NULL COMMENT 'Unique identifier/email of the user account',
    `agent_message` TEXT DEFAULT NULL COMMENT 'Response text sent by the virtual assistant',
    `agent_id` VARCHAR(255) DEFAULT 'RSAI_Bot' COMMENT 'Unique identifier of the virtual assistant bot',
    `incoming_date` DATETIME DEFAULT NULL COMMENT 'Datetime user message was received',
    `outgoing_date` DATETIME DEFAULT NULL COMMENT 'Datetime bot response was sent',
    `is_handover` TINYINT(1) DEFAULT 0 COMMENT 'Flag representing human agent handover status',
    `total_handling_time_in_seconds` INT DEFAULT 0 COMMENT 'Total seconds elapsed from incoming_date to response_date',
    `end_date` DATETIME DEFAULT NULL COMMENT 'Datetime the session was ended/reset/timeout',
    `channel_account_id` VARCHAR(255) DEFAULT NULL COMMENT 'Phone number of the user',
    `user_name` VARCHAR(255) DEFAULT NULL COMMENT 'Full name of the user',
    `response_date` DATETIME DEFAULT NULL COMMENT 'Datetime of bot response',
    `end_reason` VARCHAR(255) DEFAULT NULL COMMENT 'Reason for ending session (e.g. User Close, Timeout)',
    PRIMARY KEY (`uuid`),
    KEY `idx_session_id` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
