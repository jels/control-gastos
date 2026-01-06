export interface Gasto {
  id: string;
  fecha: Date;
  tipoOperacion: 'entrada' | 'salida';
  categoria: string;
  monto: number;
  usuario: string;
  fechaRegistro: Date;
}

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
