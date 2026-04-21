import type { PageServerLoad } from './$types';

// TODO: Será reemplazado con datos desde FastAPI backend
// En Ciclo 1 usaremos GET /printers/{id} desde el backend

export const load: PageServerLoad = async ({ params }) => {
  return {
    printerId: params.printerId,
    message: 'Detalles de impresora (próximamente)'
  };
};
