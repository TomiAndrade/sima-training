export const trainingModules = [
  {
    id: 1,
    // Uuid del Modulo real en el backend (ver prisma/seed.ts), usado por
    // Questions.jsx / BancoAcciones para operar preguntas contra la API real.
    // Las preguntas ya NO viven acá: este archivo solo aporta metadata de módulo.
    backendId: '15e3d3b9-858c-44d2-8f8e-10b9be3b2c3a',
    name: 'SIMA Básico',
    active: true,
    questions: [],
  },
  {
    id: 2,
    backendId: '0372fc38-1092-4f3c-87d2-ae1be3bb2981',
    name: 'SIMA Intermedio',
    active: true,
    questions: [],
  },
  {
    id: 3,
    backendId: 'ca6d4904-af84-4691-bea9-692cc8e22084',
    name: 'SIMA Avanzado',
    active: true,
    questions: [],
  },
  {
    id: 4,
    backendId: '2d902814-e83a-4c8d-9f1e-5b1239ec8d76',
    name: 'Reglas de Oro Industria Petrolera',
    active: true,
    questions: [],
  },
]
