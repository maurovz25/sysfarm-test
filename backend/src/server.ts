import app from './app';
import dotenv from 'dotenv';
import prisma from './prisma';
import { computeDashboardSummary } from './controllers/dashboard.controller';

dotenv.config();

const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, '0.0.0.0', () => {
    console.log('SERVIDOR INICIADO CORRECTAMENTE');
    console.log(`PUERTO: ${PORT}`);

    // Pre-calentamiento en Startup (Warm-up): inicializa sockets TCP/TLS y memoria de Dashboard
    computeDashboardSummary()
        .then(() => {
            console.log('✓ Dashboard precargado en memoria RAM (Warm-up completado)');
        })
        .catch((err) => {
            console.warn('Aviso durante warm-up de Dashboard:', err.message);
        });

    // Heartbeat Keep-Alive cada 4 minutos: mantiene despierta la conexión con Supabase PgBouncer
    setInterval(async () => {
        try {
            await prisma.$queryRaw`SELECT 1`;
        } catch (e) {
            // Silencioso, reintenta en el siguiente ciclo
        }
    }, 4 * 60 * 1000);
});
