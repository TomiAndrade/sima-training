import { api } from './client'

export const resumenApi = {
  // Agregados de SIMA CHECK para la pantalla Resumen, en un solo request:
  // habilitación de la nómina, % de aprobación, aprobación por módulo y las
  // últimas rendiciones. Es lectura pura y no pide token, igual que el resto
  // de los GET.
  simaCheck: () => api.get('/resumen/sima-check'),
}
