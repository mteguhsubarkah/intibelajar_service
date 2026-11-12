-- Kelas tempat inti diajarkan (7–12). Aplikasi mengelompokkan bab per kelas; bab yang intinya tersebar di beberapa kelas
-- muncul di tiap kelas dengan inti kelas itu saja. Kosong = belum ditetapkan (aplikasi kembali ke pengelompokan per fase).
ALTER TABLE concept ADD COLUMN grade smallint CHECK (grade BETWEEN 7 AND 12);
