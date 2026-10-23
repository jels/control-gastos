export interface Gasto {
  id: string;
  fecha: Date;
  tipoOperacion: 'entrada' | 'salida';
  categoria: string;
  monto: number;
  usuario: string;
  fechaRegistro: Date;
}

/** Datos que envía la UI; Firestore genera el ID y la fecha de registro. */
export type NuevoGasto = Omit<Gasto, 'id' | 'fechaRegistro'>;

export const CATEGORIAS_ENTRADA = [
  'Sueldo',
  'Trabajo Extra',
  'Bonificación',
  'Otros Ingresos',
];
export const CATEGORIAS_SALIDA = [
  'Alimentación',
  'Recreación',
  'Transporte',
  'Servicios',
  'Salud',
  'Educación',
  'Otros Gastos',
];
