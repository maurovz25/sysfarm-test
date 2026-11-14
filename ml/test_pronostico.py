import unittest
from datetime import date
import numpy as np
from pronostico import serie_diaria, ventanas, ajustar, predecir, reposicion, riesgo_vencimiento, evaluar


class TestPronostico(unittest.TestCase):
    def test_serie_diaria_cuenta_ceros(self):
        sal = [('A', date(2026, 9, 1), 3), ('A', date(2026, 9, 3), 2), ('B', date(2026, 9, 2), 5)]
        D = serie_diaria(sal, ['A', 'B'], date(2026, 9, 1), date(2026, 9, 4))
        self.assertEqual(D.tolist(), [[3, 0, 2, 0], [0, 5, 0, 0]])

    def test_ventanas_sin_fuga(self):
        D = np.arange(40, dtype=float).reshape(1, 40)
        X, y, p = ventanas(D, [28], np.array([1.0]))
        self.assertEqual(X[0, 1], D[0, 21:28].sum())          # últimos 7 días
        self.assertAlmostEqual(X[0, 2], D[0, 0:28].sum() / 4)  # promedio semanal de 28 días
        self.assertEqual(y[0], D[0, 28:35].sum())              # 7 días siguientes, sin incluir el origen anterior
        self.assertEqual(X[0, 4], 1.0)

    def test_ajuste_recupera_coeficientes(self):
        rng = np.random.default_rng(0); X = np.c_[np.ones(200), rng.normal(size=(200, 2))]
        beta = np.array([2.0, 0.5, -1.0]); b = ajustar(X, X @ beta)
        np.testing.assert_allclose(b, beta, atol=1e-9)

    def test_prediccion_no_negativa(self):
        self.assertTrue((predecir(np.array([-5.0, 1.0]), np.array([[1.0, 0.0], [1.0, 2.0]])) >= 0).all())

    def test_reposicion_formula_y_cero(self):
        # demanda diaria 2 × 10 días = 20; seguridad 1.65 × 7 × sqrt(10/7) = 13.80; 20 + 13.80 − 5 = 28.80 → 29
        self.assertEqual(reposicion(14.0, 7.0, 5), 29)
        self.assertEqual(reposicion(14.0, 7.0, 500), 0)

    def test_riesgo_vencimiento_fefo_y_vencido(self):
        hoy = date(2026, 10, 14)
        lotes = [('B', date(2026, 12, 13), 100), ('A', date(2026, 11, 13), 40), ('V', date(2026, 10, 1), 6)]
        r = {l: (c, k) for l, c, k in riesgo_vencimiento(lotes, 1.0, hoy)}
        self.assertEqual(r['V'], (0, 6))      # vencido: todo en riesgo
        self.assertEqual(r['A'], (30, 10))    # 30 días hasta vencer a 1 unidad/día
        self.assertEqual(r['B'], (30, 70))    # 60 días − 30 ya consumidos por A

    def test_evaluar_devuelve_metricas_de_las_tres_politicas(self):
        rng = np.random.default_rng(1); D = rng.poisson(1.0, size=(30, 70)).astype(float)
        m = evaluar(D, np.ones(30), list(range(56, 63)), 28)
        for k in ('regresion', 'ultima_semana', 'promedio_4_semanas'):
            self.assertIn('MAE', m[k]); self.assertIn('WAPE', m[k])


if __name__ == '__main__':
    unittest.main()
