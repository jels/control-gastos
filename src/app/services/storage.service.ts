import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Gasto } from '../models/gasto.model';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private readonly API_URL = environment.apiUrl;

  constructor(private http: HttpClient) {}

  async getGastos(): Promise<Gasto[]> {
    try {
      const data: any[] = await firstValueFrom(
        this.http.get<any[]>(`${this.API_URL}/gastos`)
      );

      return data.map((g: any) => ({
        ...g,
        fecha: new Date(g.fecha),
        fechaRegistro: new Date(g.fechaRegistro),
      }));
    } catch (error) {
      console.error('❌ Error al cargar gastos:', error);
      return [];
    }
  }

  async addGasto(gasto: Omit<Gasto, 'id' | 'fechaRegistro'>): Promise<Gasto> {
    const nuevoGasto: Gasto = {
      ...gasto,
      id: this.generateId(),
      fechaRegistro: new Date(),
    };

    try {
      const response = await firstValueFrom(
        this.http.post<Gasto>(`${this.API_URL}/gastos`, nuevoGasto)
      );
      console.log('✅ Gasto guardado:', response);
      return response;
    } catch (error) {
      console.error('❌ Error al guardar gasto:', error);
      throw error;
    }
  }

  async deleteAllGastos(): Promise<void> {
    try {
      await firstValueFrom(this.http.delete(`${this.API_URL}/gastos`));
      console.log('✅ Todos los gastos eliminados');
    } catch (error) {
      console.error('❌ Error al eliminar gastos:', error);
      throw error;
    }
  }

  async importFromJSON(gastos: Gasto[]): Promise<number> {
    try {
      const response: any = await firstValueFrom(
        this.http.put(`${this.API_URL}/gastos`, gastos)
      );
      console.log('✅ Datos importados:', response.count, 'registros');
      return response.count;
    } catch (error) {
      console.error('❌ Error al importar gastos:', error);
      throw error;
    }
  }

  exportToJSON(gastos: Gasto[]): string {
    return JSON.stringify(gastos, null, 2);
  }

  downloadJSON(gastos: Gasto[]): void {
    const json = this.exportToJSON(gastos);
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `gastos_backup_${new Date().getTime()}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  exportToCSV(gastos: Gasto[]): string {
    if (gastos.length === 0) return '';

    const headers = [
      'ID',
      'Fecha',
      'Tipo',
      'Categoría',
      'Monto',
      'Usuario',
      'Fecha Registro',
    ];
    const rows = gastos.map((g) => [
      g.id,
      new Date(g.fecha).toLocaleDateString('es-PY'),
      g.tipoOperacion === 'entrada' ? 'Entrada' : 'Salida',
      g.categoria,
      g.monto.toString(),
      g.usuario,
      new Date(g.fechaRegistro).toLocaleString('es-PY'),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    return csvContent;
  }

  downloadCSV(gastos: Gasto[]): void {
    const csv = this.exportToCSV(gastos);
    if (!csv) return;

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `gastos_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  parseJSONFile(file: File): Promise<Gasto[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);

          if (!Array.isArray(data)) {
            reject(new Error('El archivo JSON debe contener un array'));
            return;
          }

          const gastosImportados = data.map((g: any) => ({
            ...g,
            fecha: new Date(g.fecha),
            fechaRegistro: new Date(g.fechaRegistro),
          }));

          resolve(gastosImportados);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  getStorageSize(gastos: Gasto[]): number {
    const data = JSON.stringify(gastos);
    return new Blob([data]).size;
  }

  getStorageSizeFormatted(gastos: Gasto[]): string {
    const bytes = this.getStorageSize(gastos);
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}
