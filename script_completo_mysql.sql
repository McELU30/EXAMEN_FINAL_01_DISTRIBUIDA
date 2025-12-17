-- ############################################################
-- SCRIPT COMPLETO PARA CREAR BASES DE DATOS Y USUARIOS
-- Copia y pega TODO esto en MySQL Workbench y ejecútalo
-- ############################################################

-- 1. CREAR BASE DE DATOS DE CLIENTES
CREATE DATABASE IF NOT EXISTS Barberia_Clientes
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE Barberia_Clientes;

-- Eliminar tabla si existe (para empezar limpio)
DROP TABLE IF EXISTS Usuarios;

-- Crear tabla Usuarios
CREATE TABLE Usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    telefono VARCHAR(15),
    token_sesion VARCHAR(255),
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. INSERTAR USUARIOS DE PRUEBA CON CONTRASEÑAS HASH
-- Cliente normal
INSERT INTO Usuarios (nombre, email, password_hash, telefono) VALUES
('Cliente Prueba', 'cliente1@test.com', '$2b$10$88Y5m0YwjBJw30cFHnoJnu86TzJeNCydQ3mhkOGaBP6iZcGMa3f86', '999999999');

-- Administrador
INSERT INTO Usuarios (nombre, email, password_hash, telefono) VALUES
('Administrador', 'admin@barberia.com', '$2b$10$0n1FQpiyDrAf/6MUy0pbqu7EtzzLKgNtTWmjv0Bmgd0M30aWmFPGy', '888888888');

-- Verificar que se insertaron correctamente
SELECT id, nombre, email, telefono FROM Usuarios;

-- ############################################################
-- 3. CREAR BASE DE DATOS DE RESERVAS
-- ############################################################
CREATE DATABASE IF NOT EXISTS Barberia_Reservas
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE Barberia_Reservas;

-- Eliminar tablas si existen
DROP TABLE IF EXISTS Reservas;
DROP TABLE IF EXISTS Disponibilidad;
DROP TABLE IF EXISTS Barberos;

-- Crear tabla Barberos
CREATE TABLE Barberos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    especialidad VARCHAR(100) NOT NULL
);

-- Crear tabla Disponibilidad
CREATE TABLE Disponibilidad (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fecha_hora DATETIME UNIQUE NOT NULL,
    cupos_totales INT NOT NULL,
    cupos_reservados INT DEFAULT 0
);

-- Crear tabla Reservas
CREATE TABLE Reservas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_barbero INT NOT NULL,
    fecha_hora_cita DATETIME NOT NULL,
    codigo_atencion VARCHAR(50) UNIQUE NOT NULL,
    estado_pdf ENUM('PENDIENTE', 'GENERANDO', 'LISTO') NOT NULL,
    FOREIGN KEY (id_barbero) REFERENCES Barberos(id)
);

-- 4. INSERTAR DATOS DE EJEMPLO
INSERT INTO Barberos (nombre, especialidad) VALUES
('Lucas', 'Cortes clásicos'),
('Renzo', 'Fade y degradados'),
('Saul', 'Barba y diseño');

INSERT INTO Disponibilidad (fecha_hora, cupos_totales) VALUES
('2025-12-20 10:00:00', 5),
('2025-12-20 11:00:00', 5),
('2025-12-20 15:00:00', 3);

-- Verificar datos insertados
SELECT * FROM Barberos;
SELECT * FROM Disponibilidad;

