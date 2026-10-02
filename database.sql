CREATE DATABASE IF NOT EXISTS barbershop;

USE barbershop;

CREATE TABLE IF NOT EXISTS appointments (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  customer_name    VARCHAR(100) NOT NULL,
  contact_number   VARCHAR(11)  NOT NULL,
  service          VARCHAR(30)  NOT NULL,
  appointment_date DATE         NOT NULL,
  appointment_time TIME         NOT NULL,
  status           VARCHAR(20)  NOT NULL DEFAULT 'booked'
);
