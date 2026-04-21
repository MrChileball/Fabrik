import type { PageServerLoad } from './$types';

// TODO: Será reemplazado con llamadas a FastAPI backend
// En Ciclo 1 usaremos POST /auth/login y GET /printers desde el backend

export const load: PageServerLoad = async () => {
  return {
    message: 'Ciclo 0 - PrintRobot inicializando...'
  };
};
