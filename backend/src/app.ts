import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import productsRouter from './routes/products.routes';
import inventoryRouter from './routes/inventory.routes';
import usersRouter from './routes/users.routes';
import presenceRouter from './routes/presence.routes';
import batchesRouter from './routes/batches.routes';
import iaRouter from './routes/ia.routes';
import requerimientosRouter from './routes/requerimientos.routes';
import plantillasRouter from './routes/plantillas.routes';
import areasRouter from './routes/areas.routes';
import guiasRouter from './routes/guias.routes';
import consultasRouter from './routes/consultas.routes';
import dashboardRouter from './routes/dashboard.routes';

const app = express();

// Rate Limiters
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    limit: 500, // Limitar cada IP a 500 solicitudes por ventana de 15 minutos (aumentado para evitar bloqueos)
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // El heartbeat de presencia (1 ping/min por usuario) no debe consumir el cupo de la IP compartida
    skip: (req) => req.path.startsWith('/presence'),
    message: { error: 'Demasiadas solicitudes desde esta IP, por favor intente de nuevo más tarde.' }
});

const iaLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    limit: 15, // Máximo 15 consultas por minuto
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: '⏳ Se ha superado el límite de consultas por minuto. Espera un momento e intenta de nuevo.' }
});

// Middlewares globales de rendimiento y seguridad
app.use(compression());
app.use(helmet());

const allowedOrigins = [
    'https://sysfarm-frontend.kazetech.cloud', 
    'http://localhost:3000'
];
if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('No permitido por CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));

// Rutas
app.get('/', (req, res) => {
    res.json({ message: 'SysFarm Backend API is running' });
});

app.use('/api', generalLimiter); // Aplicar rate limiter general a toda la API

app.use('/api/products', productsRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/users', usersRouter);
app.use('/api/presence', presenceRouter);
app.use('/api/batches', batchesRouter);
app.use('/api/requerimientos', requerimientosRouter);
app.use('/api/plantillas', plantillasRouter);
app.use('/api/areas', areasRouter);
app.use('/api/guias', guiasRouter);
app.use('/api/consultas', consultasRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/ia', iaLimiter, iaRouter); // Aplicar limitador estricto para IA

export default app;
