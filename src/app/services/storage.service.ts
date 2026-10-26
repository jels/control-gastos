import { Injectable, inject } from '@angular/core';
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import type { DocumentData, Firestore } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';
import { FIREBASE_AUTH, FIRESTORE } from '../firebase.providers';
import type { Gasto, NuevoGasto } from '../models/gasto.model';

/** Firestore permite hasta 500 operaciones por batch. */
const BATCH_SIZE = 500;

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private readonly firestore: Firestore = inject(FIRESTORE);
  private readonly auth: Auth = inject(FIREBASE_AUTH);

  /**
   * Datos privados de la cuenta. La ruta usa el UID del usuario:
   * `households/{uid}/gastos`. Las reglas de Firestore impiden que una
   * cuenta lea o escriba la casa de otra.
   */
  private get gastosCollection() {
    return collection(
      this.firestore,
      'households',
      this.currentUid(),
      'gastos'
    );
  }

  private currentUid(): string {
    const user = this.auth.currentUser;

    if (!user) {
      throw new Error('NOT_AUTHENTICATED');
    }

    return user.uid;
  }

  private currentIdentity(): { uid: string; email: string; name: string } {
    const user = this.auth.currentUser;

    if (!user) {
      throw new Error('NOT_AUTHENTICATED');
    }

    return {
      uid: user.uid,
      email: (user.email ?? '').trim().toLowerCase(),
      name:
        user.displayName?.trim() ||
        this.nameFromEmail(user.email ?? '') ||
        user.email ||
        'Usuario',
    };
  }

  private nameFromEmail(email: string): string {
    const local = email.split('@')[0]?.trim() ?? '';

    if (!local) {
      return '';
    }

    return local
      .replace(/[._-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  async getGastos(): Promise<Gasto[]> {
    const snapshot = await getDocs(
      query(this.gastosCollection, orderBy('fecha', 'desc'))
    );

    return snapshot.docs.map((document) =>
      this.toGasto(document.id, document.data())
    );
  }

  async addGasto(gasto: NuevoGasto): Promise<Gasto> {
    const identity = this.currentIdentity();
    const fecha = this.parseDate(gasto.fecha);
    const categoria = gasto.categoria.trim().slice(0, 100);
    const usuario = (gasto.usuario.trim() || identity.name).slice(0, 100);
    const monto = Number(gasto.monto);

    if (!categoria || !usuario || !Number.isFinite(monto) || monto <= 0) {
      throw new Error('Los datos del movimiento no son válidos.');
    }

    const documentRef = await addDoc(this.gastosCollection, {
      fecha: Timestamp.fromDate(fecha),
      tipoOperacion: gasto.tipoOperacion,
      categoria,
      monto,
      usuario,
      usuarioUid: identity.uid,
      usuarioEmail: identity.email,
      fechaRegistro: serverTimestamp(),
    });

    return {
      ...gasto,
      id: documentRef.id,
      fecha,
      categoria,
      monto,
      usuario,
      usuarioUid: identity.uid,
      usuarioEmail: identity.email,
      fechaRegistro: new Date(),
    };
  }

  async deleteAllGastos(): Promise<void> {
    const snapshot = await getDocs(this.gastosCollection);
    const documents = snapshot.docs;

    for (let index = 0; index < documents.length; index += BATCH_SIZE) {
      const batch = writeBatch(this.firestore);

      for (const document of documents.slice(index, index + BATCH_SIZE)) {
        batch.delete(document.ref);
      }

      await batch.commit();
    }
  }

  /**
   * Importa un backup JSON. Si el registro trae un ID válido se reutiliza,
   * por lo que volver a importar el mismo archivo actualiza en vez de duplicar.
   */
  async importFromJSON(gastos: Gasto[]): Promise<number> {
    const validos = gastos.filter((gasto) => {
      const monto = Number(gasto.monto);

      return (
        !!gasto &&
        (gasto.tipoOperacion === 'entrada' ||
          gasto.tipoOperacion === 'salida') &&
        typeof gasto.categoria === 'string' &&
        gasto.categoria.trim().length > 0 &&
        Number.isFinite(monto) &&
        monto > 0
      );
    });

    const identity = this.currentIdentity();

    for (let index = 0; index < validos.length; index += BATCH_SIZE) {
      const batch = writeBatch(this.firestore);

      for (const gasto of validos.slice(index, index + BATCH_SIZE)) {
        const fecha = this.parseDate(gasto.fecha);
        const fechaRegistro = gasto.fechaRegistro
          ? this.parseDate(gasto.fechaRegistro)
          : fecha;
        const documentId =
          this.safeDocumentId(gasto.id) ?? doc(this.gastosCollection).id;

        batch.set(doc(this.gastosCollection, documentId), {
          fecha: Timestamp.fromDate(fecha),
          tipoOperacion: gasto.tipoOperacion,
          categoria: gasto.categoria.trim().slice(0, 100),
          monto: Number(gasto.monto),
          usuario: (gasto.usuario || identity.name || 'Importado')
            .trim()
            .slice(0, 100),
          usuarioUid: identity.uid,
          usuarioEmail: identity.email,
          fechaRegistro: Timestamp.fromDate(fechaRegistro),
        });
      }

      await batch.commit();
    }

    return validos.length;
  }

  exportToJSON(gastos: Gasto[]): string {
    return JSON.stringify(
      gastos.map((gasto) => ({
        ...gasto,
        fecha: gasto.fecha.toISOString(),
        fechaRegistro: gasto.fechaRegistro.toISOString(),
      })),
      null,
      2
    );
  }

  downloadJSON(gastos: Gasto[]): void {
    const json = this.exportToJSON(gastos);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `gastos_backup_${this.fileStamp()}.json`;
    link.style.display = 'none';
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
      'Email usuario',
      'Fecha Registro',
    ];

    const rows = gastos.map((gasto) => [
      gasto.id,
      this.formatDate(gasto.fecha),
      gasto.tipoOperacion === 'entrada' ? 'Entrada' : 'Salida',
      gasto.categoria,
      gasto.monto.toString(),
      gasto.usuario,
      gasto.usuarioEmail ?? '',
      this.formatDateTime(gasto.fechaRegistro),
    ]);

    return [headers, ...rows]
      .map((row) => row.map((cell) => this.csvCell(cell)).join(','))
      .join('\r\n');
  }

  downloadCSV(gastos: Gasto[]): void {
    const csv = this.exportToCSV(gastos);
    if (!csv) return;

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `gastos_${this.fileStamp()}.csv`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  parseJSONFile(file: File): Promise<Gasto[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const content = String(event.target?.result ?? '');
          const data: unknown = JSON.parse(content);

          if (!Array.isArray(data)) {
            reject(new Error('El archivo JSON debe contener un arreglo de gastos.'));
            return;
          }

          const gastos = data
            .filter(
              (item): item is Record<string, unknown> =>
                typeof item === 'object' && item !== null
            )
            .map((item) =>
              this.toGasto(
                typeof item['id'] === 'string' ? item['id'] : '',
                item
              )
            )
            .filter(
              (gasto) => gasto.categoria.trim().length > 0 && gasto.monto > 0
            );

          resolve(gastos);
        } catch (error) {
          reject(
            error instanceof Error
              ? error
              : new Error('El archivo JSON no es válido.')
          );
        }
      };

      reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
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
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const index = Math.floor(Math.log(bytes) / Math.log(k));

    return `${Math.round((bytes / Math.pow(k, index)) * 100) / 100} ${
      sizes[index]
    }`;
  }

  private toGasto(id: string, data: DocumentData): Gasto {
    const fecha = this.parseDate(data['fecha']);
    const tipoOperacion: Gasto['tipoOperacion'] =
      data['tipoOperacion'] === 'entrada' ? 'entrada' : 'salida';
    const categoria =
      typeof data['categoria'] === 'string' ? data['categoria'] : '';
    const montoValue = data['monto'];
    const monto =
      typeof montoValue === 'number' ? montoValue : Number(montoValue);
    const usuario =
      typeof data['usuario'] === 'string' ? data['usuario'] : '';
    const usuarioUid =
      typeof data['usuarioUid'] === 'string' ? data['usuarioUid'] : '';
    const usuarioEmail =
      typeof data['usuarioEmail'] === 'string' ? data['usuarioEmail'] : '';
    const fechaRegistro = data['fechaRegistro']
      ? this.parseDate(data['fechaRegistro'])
      : fecha;

    return {
      id,
      fecha,
      tipoOperacion,
      categoria,
      monto: Number.isFinite(monto) ? monto : 0,
      usuario,
      usuarioUid,
      usuarioEmail,
      fechaRegistro,
    };
  }

  /**
   * Convierte Timestamp de Firestore, ISO strings y fechas "yyyy-MM-dd".
   * Las fechas sin hora se interpretan como medianoche local para evitar
   * el clásico corrimiento de un día por UTC.
   */
  private parseDate(value: unknown): Date {
    if (value instanceof Date) return value;
    if (value instanceof Timestamp) return value.toDate();
    if (typeof value === 'number') return new Date(value);

    if (typeof value === 'string') {
      const trimmed = value.trim();
      const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);

      if (dateOnly) {
        return new Date(
          Number(dateOnly[1]),
          Number(dateOnly[2]) - 1,
          Number(dateOnly[3])
        );
      }

      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    if (value && typeof value === 'object') {
      const timestampLike = value as {
        seconds?: unknown;
        toDate?: unknown;
      };

      if (typeof timestampLike.toDate === 'function') {
        return (timestampLike.toDate as () => Date)();
      }

      if (typeof timestampLike.seconds === 'number') {
        return new Date(timestampLike.seconds * 1000);
      }
    }

    return new Date();
  }

  private safeDocumentId(id: string | undefined): string | null {
    const value = typeof id === 'string' ? id.trim() : '';

    if (
      !value ||
      value.includes('/') ||
      value === '.' ||
      value === '..' ||
      /^__.*__$/.test(value)
    ) {
      return null;
    }

    return new TextEncoder().encode(value).length <= 1500 ? value : null;
  }

  private csvCell(value: unknown): string {
    let text = String(value ?? '');

    // Evita inyección de fórmulas al abrir el CSV en Excel/Sheets.
    if (/^[=+\-@\t\r]/.test(text)) {
      text = `'${text}`;
    }

    return `"${text.replace(/"/g, '""')}"`;
  }

  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('es-PY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  }

  private formatDateTime(date: Date): string {
    return new Intl.DateTimeFormat('es-PY', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
  }

  private fileStamp(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
