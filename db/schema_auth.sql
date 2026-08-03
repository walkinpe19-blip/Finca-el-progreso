-- Script adicional para autenticación y usuarios
-- Ejecuta este archivo por separado si deseas agregar la funcionalidad de login/registro.

CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    correo VARCHAR(150) NOT NULL UNIQUE,
    telefono VARCHAR(20),
    contraseña VARCHAR(255) NOT NULL,
    rol VARCHAR(20) NOT NULL DEFAULT 'usuario' CHECK (rol IN ('usuario', 'admin'))
);

INSERT INTO usuarios (nombre, apellido, correo, telefono, contraseña, rol)
SELECT 'Admin', 'Sistema', 'admin@finca.com', NULL, '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 'admin'
WHERE NOT EXISTS (
    SELECT 1 FROM usuarios WHERE LOWER(correo) = LOWER('admin@finca.com')
);
