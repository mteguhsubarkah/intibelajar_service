-- Inti tuntas: siswa menyelesaikan latihan satu inti dengan semua soal benar.
-- Disimpan sebagai progress_event supaya jumlah "inti dikuasai" sama di semua perangkat.
-- Bukan bukti mastery-v1 (DEMONSTRATED tetap butuh soal transfer) dan tidak memberi XP.
ALTER TABLE progress_event DROP CONSTRAINT progress_event_type_check;
ALTER TABLE progress_event ADD CONSTRAINT progress_event_type_check
  CHECK (type IN ('CONCEPT_VISITED','ATTEMPT_GRADED','LESSON_COMPLETED','SESSION_COMPLETED','MASTERY_CHANGED','TIER_CHANGED','XP_AWARDED','STREAK_EXTENDED','STREAK_FREEZE_USED','MISSION_COMPLETED','DEVICE_HISTORY_IMPORTED','CORE_COMPLETED'));
