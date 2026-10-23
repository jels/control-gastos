import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToolbarModule } from '@openng/optimus-ui/toolbar';
import { ButtonModule } from '@openng/optimus-ui/button';
import { CardModule } from '@openng/optimus-ui/card';
import { DialogModule } from '@openng/optimus-ui/dialog';
import { DatePickerModule } from '@openng/optimus-ui/datepicker';
import { SelectModule } from '@openng/optimus-ui/select';
import { InputNumberModule } from '@openng/optimus-ui/inputnumber';
import type { InputNumber } from '@openng/optimus-ui/inputnumber';
import { TableModule } from '@openng/optimus-ui/table';
import { ToastModule } from '@openng/optimus-ui/toast';
import { ConfirmDialogModule } from '@openng/optimus-ui/confirmdialog';
import { FileUploadModule } from '@openng/optimus-ui/fileupload';
import { TooltipModule } from '@openng/optimus-ui/tooltip';
import { MessageService, ConfirmationService } from '@openng/optimus-ui/api';
import type { FileUpload } from '@openng/optimus-ui/fileupload';
import { AuthService } from '../../services/auth.service';
import { StorageService } from '../../services/storage.service';
import {
  HouseholdAccessError,
  HouseholdService,
} from '../../services/household.service';
import { environment } from '../../../environments/environment';
import {
  CATEGORIAS_ENTRADA,
  CATEGORIAS_SALIDA,
} from '../../models/gasto.model';
import type { Gasto, NuevoGasto } from '../../models/gasto.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ToolbarModule,
    ButtonModule,
    CardModule,
    DialogModule,
    DatePickerModule,
    SelectModule,
    InputNumberModule,
    TableModule,
    ToastModule,
    ConfirmDialogModule,
    FileUploadModule,
    TooltipModule,
  ],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast></p-toast>
    <p-confirmdialog></p-confirmdialog>

    <p-toolbar class="mb-3">
      <ng-template #start>
        <h3 class="m-0">Control de Gastos - {{ currentUser }}</h3>
      </ng-template>

      <ng-template #end>
        <div class="flex flex-wrap gap-2">
          @if (!accessDenied) {
            <button
              pButton
              type="button"
              rounded
              iconOnly
              severity="success"
              pTooltip="Agregar gasto"
              tooltipPosition="bottom"
              aria-label="Agregar gasto"
              (click)="showDialog()"
            >
              <i class="pi pi-plus"></i>
            </button>

            <button
              pButton
              type="button"
              rounded
              iconOnly
              severity="info"
              pTooltip="Importar JSON (backup o migración)"
              tooltipPosition="bottom"
              aria-label="Importar JSON"
              (click)="elegirArchivo()"
            >
              <i class="pi pi-upload"></i>
            </button>

            <button
              pButton
              type="button"
              rounded
              iconOnly
              severity="help"
              pTooltip="Descargar JSON"
              tooltipPosition="bottom"
              aria-label="Descargar JSON"
              (click)="descargarJSON()"
            >
              <i class="pi pi-file"></i>
            </button>

            <button
              pButton
              type="button"
              rounded
              severity="secondary"
              pTooltip="Descargar CSV"
              tooltipPosition="bottom"
              (click)="descargarCSV()"
            >
              <i class="pi pi-download"></i>
              .CSV
            </button>

            <button
              pButton
              type="button"
              rounded
              iconOnly
              variant="outlined"
              [disabled]="loading"
              pTooltip="Recargar datos"
              tooltipPosition="bottom"
              aria-label="Recargar datos"
              (click)="cargarGastos()"
            >
              <i class="pi pi-refresh" [class.pi-spin]="loading"></i>
            </button>

            <button
              pButton
              type="button"
              rounded
              iconOnly
              severity="warn"
              [disabled]="gastos.length === 0"
              pTooltip="Limpiar datos"
              tooltipPosition="bottom"
              aria-label="Limpiar datos"
              (click)="confirmarLimpiar()"
            >
              <i class="pi pi-trash"></i>
            </button>
          }

          <button
            pButton
            type="button"
            rounded
            iconOnly
            severity="danger"
            pTooltip="Salir"
            tooltipPosition="bottom"
            aria-label="Salir"
            (click)="logout()"
          >
            <i class="pi pi-sign-out"></i>
          </button>
        </div>
      </ng-template>
    </p-toolbar>

    <p-fileupload
      #fileUpload
      mode="basic"
      name="file"
      accept="application/json"
      [auto]="true"
      [customUpload]="true"
      (uploadHandler)="onFileUpload($event)"
      [style]="{ display: 'none' }"
    ></p-fileupload>

    <p-card *ngIf="accessDenied" class="mb-3">
      <div class="flex flex-column gap-3">
        <div class="flex align-items-center gap-2">
          <i class="pi pi-lock text-2xl text-orange-500"></i>
          <h3 class="m-0">Tu cuenta no tiene acceso al hogar</h3>
        </div>

        <p class="m-0 text-600">
          Iniciaste sesión como <strong>{{ accessEmail }}</strong
          >. Tu email está autorizado para usar la app, pero todavía no
          pertenece a este hogar. Si el hogar tiene menos de 2 miembros, la app
          intenta sumarte automáticamente. Si ves esta pantalla, pedile al
          administrador que agregue tu email a
          <code>households/{{ householdId }}/memberEmails</code> o tu UID a
          <code>members</code>.
        </p>

        <div class="flex flex-column gap-1">
          <span class="text-sm text-500">Tu UID</span>
          <code class="text-sm">{{ accessUid }}</code>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            pButton
            type="button"
            variant="outlined"
            (click)="copiar(accessUid, 'UID')"
          >
            <i class="pi pi-copy"></i>
            Copiar UID
          </button>
          <button
            pButton
            type="button"
            variant="outlined"
            (click)="copiar(accessEmail, 'email')"
          >
            <i class="pi pi-envelope"></i>
            Copiar email
          </button>
          <button pButton type="button" severity="danger" (click)="logout()">
            <i class="pi pi-sign-out"></i>
            Cerrar sesión
          </button>
        </div>

        <small class="text-500">
          Si el hogar todavía no existe y tu email está en
          <code>config/access.allowedEmails</code>, la app lo crea
          automáticamente. Si el hogar ya tiene 2 miembros, el administrador
          debe liberar un lugar o agregarte manualmente. Si ya te agregaron,
          verificá que las reglas estén publicadas.
        </small>
      </div>
    </p-card>

    <div class="grid" *ngIf="!accessDenied">
      <div class="col-12 md:col-4">
        <p-card class="h-full">
          <div class="flex justify-content-between align-items-center">
            <div>
              <div class="text-500 font-medium mb-2">Total Entradas</div>
              <div class="text-2xl font-bold text-green-500">
                ₲ {{ totalEntradas | number: '1.0-0' }}
              </div>
            </div>
            <div
              class="flex align-items-center justify-content-center bg-green-100 border-circle"
              style="width:3rem;height:3rem"
            >
              <i class="pi pi-arrow-up text-green-500 text-xl"></i>
            </div>
          </div>
        </p-card>
      </div>

      <div class="col-12 md:col-4">
        <p-card class="h-full">
          <div class="flex justify-content-between align-items-center">
            <div>
              <div class="text-500 font-medium mb-2">Total Salidas</div>
              <div class="text-2xl font-bold text-red-500">
                ₲ {{ totalSalidas | number: '1.0-0' }}
              </div>
            </div>
            <div
              class="flex align-items-center justify-content-center bg-red-100 border-circle"
              style="width:3rem;height:3rem"
            >
              <i class="pi pi-arrow-down text-red-500 text-xl"></i>
            </div>
          </div>
        </p-card>
      </div>

      <div class="col-12 md:col-4">
        <p-card class="h-full">
          <div class="flex justify-content-between align-items-center">
            <div>
              <div class="text-500 font-medium mb-2">Balance</div>
              <div
                class="text-2xl font-bold"
                [ngClass]="balance >= 0 ? 'text-green-500' : 'text-red-500'"
              >
                ₲ {{ balance | number: '1.0-0' }}
              </div>
            </div>
            <div
              class="flex align-items-center justify-content-center bg-blue-100 border-circle"
              style="width:3rem;height:3rem"
            >
              <i class="pi pi-wallet text-blue-500 text-xl"></i>
            </div>
          </div>
        </p-card>
      </div>

      <div class="col-12">
        <p-card>
          <div class="flex justify-content-between align-items-center">
            <div class="flex align-items-center gap-3">
              <i class="pi pi-database text-2xl text-primary"></i>
              <div>
                <div class="text-sm text-500">Total Registros</div>
                <div class="text-xl font-bold">{{ gastos.length }}</div>
              </div>
            </div>
            <div class="flex align-items-center gap-3">
              <i class="pi pi-chart-bar text-2xl text-orange-500"></i>
              <div>
                <div class="text-sm text-500">Tamaño de datos</div>
                <div class="text-xl font-bold">{{ storageSize }}</div>
              </div>
            </div>
          </div>
        </p-card>
      </div>

      <div class="col-12">
        <p-card>
          <ng-template #header>
            <div class="px-3 pt-3">
              <h4 class="m-0 text-900">Historial de Movimientos</h4>
            </div>
          </ng-template>

          <p-table
            [value]="gastos"
            [paginator]="true"
            [rows]="10"
            [showCurrentPageReport]="true"
            currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} registros"
            [rowsPerPageOptions]="[5, 10, 25, 50]"
            [loading]="loading"
            size="small"
            [stripedRows]="true"
          >
            <ng-template #header>
              <tr>
                <th pSortableColumn="fecha">
                  <div class="flex align-items-center gap-2">
                    Fecha
                    <p-sortIcon field="fecha"></p-sortIcon>
                  </div>
                </th>
                <th>Tipo</th>
                <th pSortableColumn="categoria">
                  <div class="flex align-items-center gap-2">
                    Categoría
                    <p-sortIcon field="categoria"></p-sortIcon>
                  </div>
                </th>
                <th pSortableColumn="monto" class="text-right">
                  <div
                    class="flex align-items-center justify-content-end gap-2"
                  >
                    Monto
                    <p-sortIcon field="monto"></p-sortIcon>
                  </div>
                </th>
                <th pSortableColumn="usuario">
                  <div class="flex align-items-center gap-2">
                    Usuario
                    <p-sortIcon field="usuario"></p-sortIcon>
                  </div>
                </th>
              </tr>
            </ng-template>

            <ng-template #body let-gasto>
              <tr>
                <td>
                  <div class="flex align-items-center gap-2">
                    <i class="pi pi-calendar text-500"></i>
                    <span>{{ gasto.fecha | date: 'dd/MM/yyyy' }}</span>
                  </div>
                </td>
                <td>
                  <span
                    class="inline-flex align-items-center gap-2 px-2 py-1 border-round"
                    [ngClass]="
                      gasto.tipoOperacion === 'entrada'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    "
                  >
                    <i
                      [class]="
                        gasto.tipoOperacion === 'entrada'
                          ? 'pi pi-arrow-up'
                          : 'pi pi-arrow-down'
                      "
                    ></i>
                    <span class="font-medium">{{
                      gasto.tipoOperacion === 'entrada' ? 'Entrada' : 'Salida'
                    }}</span>
                  </span>
                </td>
                <td>
                  <span class="text-900 font-medium">{{
                    gasto.categoria
                  }}</span>
                </td>
                <td class="text-right">
                  <span class="font-bold text-900"
                    >₲ {{ gasto.monto | number: '1.0-0' }}</span
                  >
                </td>
                <td>
                  <span
                    class="inline-flex align-items-center gap-2 px-2 py-1 bg-primary-100 text-primary-700 border-round"
                  >
                    <i class="pi pi-user"></i>
                    <span>{{ gasto.usuario }}</span>
                  </span>
                </td>
              </tr>
            </ng-template>

            <ng-template #emptymessage>
              <tr>
                <td colspan="5" class="text-center py-6">
                  <i class="pi pi-inbox text-4xl text-400 mb-3"></i>
                  <div class="text-500">No hay registros disponibles</div>
                </td>
              </tr>
            </ng-template>
          </p-table>
        </p-card>
      </div>
    </div>

    <p-dialog
      *ngIf="!accessDenied"
      header="Nuevo Movimiento"
      [(visible)]="displayDialog"
      [modal]="true"
      [style]="{ width: '90vw', 'max-width': '500px' }"
      [draggable]="false"
      [resizable]="false"
      [focusOnShow]="false"
      (onShow)="focusMonto()"
    >
      <div class="flex flex-column gap-4 pt-3">
        <div class="flex flex-column gap-2">
          <label class="font-semibold">
            <i class="pi pi-money-bill mr-2"></i>Monto (₲)
          </label>
          <p-inputnumber
            #montoInput
            [(ngModel)]="nuevoGasto.monto"
            [min]="0"
            mode="decimal"
            [minFractionDigits]="0"
            [maxFractionDigits]="0"
            class="w-full"
          ></p-inputnumber>
        </div>

        <div class="flex flex-column gap-2">
          <label class="font-semibold">
            <i class="pi pi-tags mr-2"></i>Tipo de Operación
          </label>
          <p-select
            [(ngModel)]="nuevoGasto.tipoOperacion"
            [options]="tiposOperacion"
            optionLabel="label"
            optionValue="value"
            placeholder="Seleccionar"
            class="w-full"
            (onChange)="onTipoChange()"
            appendTo="body"
          ></p-select>
        </div>

        <div class="flex flex-column gap-2">
          <label class="font-semibold">
            <i class="pi pi-bookmark mr-2"></i>Categoría
          </label>
          <p-select
            [(ngModel)]="nuevoGasto.categoria"
            [options]="categoriasDisponibles"
            placeholder="Seleccionar"
            class="w-full"
            appendTo="body"
          ></p-select>
        </div>

        <div class="flex flex-column gap-2">
          <label class="font-semibold">
            <i class="pi pi-calendar mr-2"></i>Fecha
          </label>
          <p-datepicker
            [(ngModel)]="nuevoGasto.fecha"
            dateFormat="dd/mm/yy"
            [showIcon]="true"
            [autofocus]="false"
            class="w-full"
            appendTo="body"
          ></p-datepicker>
        </div>
      </div>

      <ng-template #footer>
        <div class="flex justify-content-end gap-2">
          <button
            pButton
            type="button"
            variant="outlined"
            severity="secondary"
            (click)="displayDialog = false"
          >
            <i class="pi pi-times"></i>
            Cancelar
          </button>
          <button
            pButton
            type="button"
            [disabled]="saving"
            (click)="guardarGasto()"
          >
            @if (saving) {
              <i class="pi pi-spin pi-spinner"></i>
            } @else {
              <i class="pi pi-check"></i>
            }
            Guardar
          </button>
        </div>
      </ng-template>
    </p-dialog>
  `,
  styles: [
    `
      :host ::ng-deep {
        .p-datatable .p-datatable-tbody > tr > td {
          padding: 1rem;
        }

        .p-card .p-card-body {
          padding: 1.5rem;
        }

        .p-toolbar {
          padding: 1rem 1.5rem;
          border-radius: 0.5rem;
        }
      }
    `,
  ],
})
export class DashboardComponent implements OnInit {
  @ViewChild('fileUpload') fileUpload?: FileUpload;
  @ViewChild('montoInput') montoInput?: InputNumber;

  displayDialog = false;
  loading = false;
  saving = false;
  currentUser = '';
  accessDenied = false;
  accessEmail = '';
  accessUid = '';
  readonly householdId = environment.householdId;
  gastos: Gasto[] = [];
  totalEntradas = 0;
  totalSalidas = 0;
  balance = 0;
  storageSize = '';

  nuevoGasto: NuevoGasto = {
    fecha: new Date(),
    tipoOperacion: 'salida',
    categoria: '',
    monto: 0,
    usuario: '',
  };

  tiposOperacion = [
    { label: '💰 Entrada', value: 'entrada' },
    { label: '💸 Salida', value: 'salida' },
  ];

  categoriasDisponibles: string[] = CATEGORIAS_SALIDA;

  constructor(
    private authService: AuthService,
    private storageService: StorageService,
    private householdService: HouseholdService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.currentUser = this.authService.getCurrentUser();

    const identity = this.householdService.getCurrentIdentity();
    this.accessEmail = identity.email;
    this.accessUid = identity.uid;

    try {
      await this.householdService.ensureHousehold();
      await this.cargarGastos();
    } catch (error) {
      if (error instanceof HouseholdAccessError) {
        this.accessDenied = true;
        this.accessEmail = error.email || this.accessEmail;
        this.accessUid = error.uid || this.accessUid;
        return;
      }

      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: this.errorDetail(error, 'No se pudo inicializar el hogar.'),
        life: 6000,
      });
    }
  }

  elegirArchivo(): void {
    this.fileUpload?.choose();
  }

  focusMonto(): void {
    setTimeout(() => {
      const input = this.montoInput?.input?.nativeElement;

      if (!input) {
        return;
      }

      input.focus();
      input.select();
    }, 100);
  }

  async cargarGastos(): Promise<void> {
    this.loading = true;
    try {
      this.gastos = await this.storageService.getGastos();
      this.gastos.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
      this.calcularTotales();
      this.storageSize = this.storageService.getStorageSizeFormatted(
        this.gastos,
      );
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: this.errorDetail(
          error,
          'No se pudieron cargar los datos desde Firestore.',
        ),
        life: 5000,
      });
    } finally {
      this.loading = false;
    }
  }

  calcularTotales(): void {
    this.totalEntradas = this.gastos
      .filter((g) => g.tipoOperacion === 'entrada')
      .reduce((sum, g) => sum + g.monto, 0);

    this.totalSalidas = this.gastos
      .filter((g) => g.tipoOperacion === 'salida')
      .reduce((sum, g) => sum + g.monto, 0);

    this.balance = this.totalEntradas - this.totalSalidas;
  }

  showDialog(): void {
    this.nuevoGasto = {
      fecha: new Date(),
      tipoOperacion: 'salida',
      categoria: '',
      monto: 0,
      usuario: this.currentUser,
    };
    this.categoriasDisponibles = CATEGORIAS_SALIDA;
    this.displayDialog = true;
  }

  onTipoChange(): void {
    this.categoriasDisponibles =
      this.nuevoGasto.tipoOperacion === 'entrada'
        ? CATEGORIAS_ENTRADA
        : CATEGORIAS_SALIDA;
    this.nuevoGasto.categoria = '';
  }

  async guardarGasto(): Promise<void> {
    if (!this.nuevoGasto.categoria || this.nuevoGasto.monto <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'Seleccioná una categoría e ingresá un monto mayor a cero.',
        life: 3000,
      });
      return;
    }

    this.saving = true;
    try {
      await this.storageService.addGasto(this.nuevoGasto);
      this.messageService.add({
        severity: 'success',
        summary: 'Éxito',
        detail: 'Movimiento guardado correctamente',
        life: 3000,
      });
      this.displayDialog = false;
      await this.cargarGastos();
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: this.errorDetail(error, 'No se pudo guardar el movimiento.'),
        life: 5000,
      });
    } finally {
      this.saving = false;
    }
  }

  descargarCSV(): void {
    if (this.gastos.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'No hay datos para descargar',
        life: 3000,
      });
      return;
    }

    this.storageService.downloadCSV(this.gastos);
    this.messageService.add({
      severity: 'success',
      summary: 'Éxito',
      detail: 'Archivo CSV descargado',
      life: 3000,
    });
  }

  descargarJSON(): void {
    if (this.gastos.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'No hay datos para descargar',
        life: 3000,
      });
      return;
    }

    this.storageService.downloadJSON(this.gastos);
    this.messageService.add({
      severity: 'success',
      summary: 'Éxito',
      detail: 'Archivo JSON descargado',
      life: 3000,
    });
  }

  async onFileUpload(event: { files?: File[] }): Promise<void> {
    const file = event.files?.[0];

    if (!file) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'No se seleccionó ningún archivo.',
        life: 3000,
      });
      return;
    }

    try {
      const gastosImportados = await this.storageService.parseJSONFile(file);

      if (gastosImportados.length === 0) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Advertencia',
          detail: 'El archivo no contiene gastos válidos para importar.',
          life: 4000,
        });
        return;
      }

      const count = await this.storageService.importFromJSON(gastosImportados);
      await this.cargarGastos();
      this.messageService.add({
        severity: 'success',
        summary: 'Éxito',
        detail: `${count} registros importados correctamente`,
        life: 3000,
      });
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: this.errorDetail(error, 'No se pudo importar el archivo JSON.'),
        life: 5000,
      });
    }
  }

  confirmarLimpiar(): void {
    if (this.gastos.length === 0) {
      this.messageService.add({
        severity: 'info',
        summary: 'Información',
        detail: 'No hay datos para eliminar',
        life: 3000,
      });
      return;
    }

    this.confirmationService.confirm({
      message:
        '¿Está seguro de eliminar TODOS los registros? Esta acción no se puede deshacer.',
      header: 'Confirmar Eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar todo',
      rejectLabel: 'Cancelar',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', variant: 'outlined' },
      accept: async () => {
        await this.limpiarDatos();
      },
    });
  }

  async limpiarDatos(): Promise<void> {
    try {
      await this.storageService.deleteAllGastos();
      await this.cargarGastos();
      this.messageService.add({
        severity: 'success',
        summary: 'Éxito',
        detail: 'Todos los datos han sido eliminados',
        life: 3000,
      });
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: this.errorDetail(error, 'No se pudieron eliminar los datos.'),
        life: 5000,
      });
    }
  }

  async copiar(texto: string, etiqueta: string): Promise<void> {
    if (!texto) {
      return;
    }

    try {
      await navigator.clipboard.writeText(texto);
      this.messageService.add({
        severity: 'success',
        summary: 'Copiado',
        detail: `${etiqueta} copiado al portapapeles`,
        life: 2000,
      });
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo copiar al portapapeles.',
        life: 3000,
      });
    }
  }

  async logout(): Promise<void> {
    await this.authService.logout();
  }

  private errorDetail(error: unknown, fallback: string): string {
    const code = (error as { code?: string } | null)?.code ?? '';

    if (code === 'permission-denied') {
      return 'Sin permiso para acceder al hogar. Verificá que firestore.rules esté publicado y que tu email o UID esté autorizado en households/casa.';
    }

    if (code === 'unavailable') {
      return 'Sin conexión con Firestore. Los cambios se sincronizarán cuando vuelvas a estar online.';
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return fallback;
  }
}
