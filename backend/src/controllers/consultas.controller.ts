import { Request, Response } from 'express';

export const consultarDni = async (req: Request, res: Response): Promise<void> => {
    try {
        const { dni } = req.query;
        if (!dni || typeof dni !== 'string') {
            res.status(400).json({ error: 'Debe ingresar un número de DNI válido.' });
            return;
        }

        const cleanDoc = dni.trim().replace(/\D/g, '');
        if (cleanDoc.length !== 8) {
            res.status(400).json({ error: 'El DNI debe contener exactamente 8 dígitos.' });
            return;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`https://okfac.pe/api/consult/nro_doc/${cleanDoc}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            res.status(404).json({ error: 'No se pudo consultar el DNI ingresado.' });
            return;
        }

        const data: any = await response.json();

        if (data?.successful && data?.client) {
            const c = data.client;
            let rawName = (c.name || '').trim();
            if (rawName.includes(',')) {
                const parts = rawName.split(',');
                rawName = `${parts[1].trim()} ${parts[0].trim()}`;
            }
            const cleanName = rawName.replace(/,/g, '').replace(/\s+/g, ' ').trim();

            res.json({
                success: true,
                docNumber: cleanDoc,
                name: cleanName,
                address: (c.address || '').trim(),
                district: (c.district || '').trim(),
                department: (c.department || '').trim(),
                province: (c.province || '').trim(),
                ubigeo: c.ubigeo || '',
                source: 'OKFAC_API',
            });
            return;
        }

        res.status(404).json({ error: 'No se encontraron datos para el DNI ingresado.' });
    } catch (error: any) {
        if (error.name === 'AbortError') {
            res.status(504).json({ error: 'La consulta a OkFac API sobrepasó el tiempo de espera (5s).' });
            return;
        }
        console.error('Error al consultar DNI:', error);
        res.status(500).json({ error: 'Error al procesar la consulta del DNI.' });
    }
};
