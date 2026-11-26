/**
 * Entorno aislado de QA: nunca toca la base real ni el servidor de desarrollo.
 *  - Backend de pruebas en :3100 con una COPIA de la base y de las fotos (carpeta temporal).
 *  - Frontend compilado en :4400 apuntando a ese backend, con un WhatsApp falso.
 *  - Frontend en :4401 apuntando a una API apagada (:3199) para la prueba «backend caído».
 */
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = fileURLToPath(new URL('../../../', import.meta.url));
export const QA_DIR = path.join(os.tmpdir(), 'integratech-qa');
export const DB_QA = path.join(QA_DIR, 'siie-qa.db');
export const ADMIN_QA = path.join(QA_DIR, 'admin.json');
export const PUERTO_API = 3100;
export const PUERTO_WEB = 4400;
export const PUERTO_WEB_SIN_API = 4401;
export const PUERTO_API_MUERTA = 3199;
export const API = `http://localhost:${PUERTO_API}`;
export const WEB = `http://localhost:${PUERTO_WEB}`;
export const WEB_SIN_API = `http://localhost:${PUERTO_WEB_SIN_API}`;
export const WHATSAPP_QA = '50300000000'; // número inventado: nunca se abre
