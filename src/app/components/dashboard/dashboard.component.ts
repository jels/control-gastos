import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToolbarModule } from 'primeng/toolbar';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { FileUploadModule } from 'primeng/fileupload';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, ConfirmationService } from 'primeng/api';
import { AuthService } from '../../services/auth.service';
import { StorageService } from '../../services/storage.service';
import {
  Gasto,
  CATEGORIAS_ENTRADA,
  CATEGORIAS_SALIDA,
} from '../../models/gasto.model';

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
    CalendarModule,
    DropdownModule,
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
    <p-confirmDialog></p-confirmDialog>

    <p-toolbar class="mb-3">
      <div class="p-toolbar-group-start">
        <h3 class="m-0">Control de Gastos - {{ currentUser }}</h3>
      </div>
      <div class="p-toolbar-group-end flex gap-2">
        <p-button
          icon="pi pi-plus"
          (onClick)="showDialog()"
          [rounded]="true"
          severity="success"
          pTooltip="Agregar gasto"
          tooltipPosition="bottom"
        ></p-button>

        <!-- <p-button icon="pi pi-upload" (onClick)="fileUpload.choose()" 
                  [rounded]="true" severity="info"
                  pTooltip="Importar JSON" tooltipPosition="bottom"></p-button>
        
        <p-button icon="pi pi-file" (onClick)="descargarJSON()" 
                  [rounded]="true" severity="help"
                  pTooltip="Descargar JSON" tooltipPosition="bottom"></p-button> -->

        <p-button
          label=".CSV"
          icon="pi pi-download"
          (onClick)="descargarCSV()"
          [rounded]="true"
          severity="secondary"
          pTooltip="Descargar CSV"
          tooltipPosition="bottom"
        ></p-button>

        <p-button
          icon="pi pi-refresh"
          (onClick)="cargarGastos()"
          [rounded]="true"
          [outlined]="true"
          pTooltip="Recargar datos"
          tooltipPosition="bottom"
        ></p-button>

        <p-button
          icon="pi pi-trash"
          (onClick)="confirmarLimpiar()"
          [rounded]="true"
          severity="warning"
          pTooltip="Limpiar datos"
          tooltipPosition="bottom"
        ></p-button>

        <p-button
          icon="pi pi-sign-out"
          (onClick)="logout()"
          [rounded]="true"
          severity="danger"
          pTooltip="Salir"
          tooltipPosition="bottom"
        ></p-button>
      </div>
    </p-toolbar>

    <p-fileUpload
      #fileUpload
      mode="basic"
      name="file"
      accept="application/json"
      [auto]="true"
      [customUpload]="true"
      (uploadHandler)="onFileUpload($event)"
      [style]="{ display: 'none' }"
    >
    </p-fileUpload>

    <div class="grid">
      <div class="col-12 md:col-4">
        <p-card styleClass="h-full">
          <div class="flex justify-content-between align-items-center">
            <div>
              <div class="text-500 font-medium mb-2">Total Entradas</div>
              <div class="text-2xl font-bold text-green-500">
                ₲ {{ totalEntradas | number : '1.0-0' }}
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
        <p-card styleClass="h-full">
          <div class="flex justify-content-between align-items-center">
            <div>
              <div class="text-500 font-medium mb-2">Total Salidas</div>
              <div class="text-2xl font-bold text-red-500">
                ₲ {{ totalSalidas | number : '1.0-0' }}
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
        <p-card styleClass="h-full">
          <div class="flex justify-content-between align-items-center">
            <div>
              <div class="text-500 font-medium mb-2">Balance</div>
              <div
                class="text-2xl font-bold"
                [ngClass]="balance >= 0 ? 'text-green-500' : 'text-red-500'"
              >
                ₲ {{ balance | number : '1.0-0' }}
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
                <div class="text-sm text-500">Espacio Usado</div>
                <div class="text-xl font-bold">{{ storageSize }}</div>
              </div>
            </div>
          </div>
        </p-card>
      </div>

      <div class="col-12">
        <p-card>
          <ng-template pTemplate="header">
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
            styleClass="p-datatable-sm p-datatable-striped"
          >
            <ng-template pTemplate="header">
              <tr>
                <th pSortableColumn="fecha">
                  Fecha <p-sortIcon field="fecha"></p-sortIcon>
                </th>
                <th>Tipo</th>
                <th pSortableColumn="categoria">
                  Categoría <p-sortIcon field="categoria"></p-sortIcon>
                </th>
                <th pSortableColumn="monto" class="text-right">
                  Monto <p-sortIcon field="monto"></p-sortIcon>
                </th>
                <th pSortableColumn="usuario">
                  Usuario <p-sortIcon field="usuario"></p-sortIcon>
                </th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-gasto>
              <tr>
                <td>
                  <div class="flex align-items-center gap-2">
                    <i class="pi pi-calendar text-500"></i>
                    <span>{{ gasto.fecha | date : 'dd/MM/yyyy' }}</span>
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
                    >₲ {{ gasto.monto | number : '1.0-0' }}</span
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
            <ng-template pTemplate="emptymessage">
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
      header="Nuevo Movimiento"
      [(visible)]="displayDialog"
      [modal]="true"
      [style]="{ width: '90vw', 'max-width': '500px' }"
      [draggable]="false"
      [resizable]="false"
    >
      <div class="flex flex-column gap-4 pt-3">
        <div class="flex flex-column gap-2">
          <label class="font-semibold">
            <i class="pi pi-calendar mr-2"></i>Fecha
          </label>
          <p-calendar
            [(ngModel)]="nuevoGasto.fecha"
            dateFormat="dd/mm/yy"
            [showIcon]="true"
            styleClass="w-full"
          ></p-calendar>
        </div>

        <div class="flex flex-column gap-2">
          <label class="font-semibold">
            <i class="pi pi-tags mr-2"></i>Tipo de Operación
          </label>
          <p-dropdown
            [(ngModel)]="nuevoGasto.tipoOperacion"
            [options]="tiposOperacion"
            optionLabel="label"
            optionValue="value"
            placeholder="Seleccionar"
            (onChange)="onTipoChange()"
            styleClass="w-full"
          ></p-dropdown>
        </div>

        <div class="flex flex-column gap-2">
          <label class="font-semibold">
            <i class="pi pi-bookmark mr-2"></i>Categoría
          </label>
          <p-dropdown
            [(ngModel)]="nuevoGasto.categoria"
            [options]="categoriasDisponibles"
            placeholder="Seleccionar"
            styleClass="w-full"
          ></p-dropdown>
        </div>

        <div class="flex flex-column gap-2">
          <label class="font-semibold">
            <i class="pi pi-money-bill mr-2"></i>Monto (₲)
          </label>
          <p-inputNumber
            [(ngModel)]="nuevoGasto.monto"
            [min]="0"
            mode="decimal"
            [minFractionDigits]="0"
            [maxFractionDigits]="0"
            styleClass="w-full"
          ></p-inputNumber>
        </div>
      </div>

      <ng-template pTemplate="footer">
        <p-button
          label="Cancelar"
          icon="pi pi-times"
          (onClick)="displayDialog = false"
          severity="secondary"
          [outlined]="true"
        ></p-button>
        <p-button
          label="Guardar"
          icon="pi pi-check"
          (onClick)="guardarGasto()"
          [loading]="saving"
        ></p-button>
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
  displayDialog = false;
  loading = false;
  saving = false;
  currentUser = '';
  gastos: Gasto[] = [];
  totalEntradas = 0;
  totalSalidas = 0;
  balance = 0;
  storageSize = '';

  nuevoGasto = {
    fecha: new Date(),
    tipoOperacion: 'salida' as 'entrada' | 'salida',
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
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {}

  async ngOnInit(): Promise<void> {
    this.currentUser = this.authService.getCurrentUser();
    await this.cargarGastos();
  }

  async cargarGastos(): Promise<void> {
    this.loading = true;
    try {
      this.gastos = await this.storageService.getGastos();
      this.gastos.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
      this.calcularTotales();
      this.storageSize = this.storageService.getStorageSizeFormatted(
        this.gastos
      );
      console.log('✅ Gastos cargados:', this.gastos.length);
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Error al cargar datos del servidor',
        life: 3000,
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
    if (!this.nuevoGasto.categoria || !this.nuevoGasto.monto) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'Complete todos los campos',
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
        detail: 'Error al guardar el movimiento',
        life: 3000,
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

  async onFileUpload(event: any): Promise<void> {
    const file = event.files[0];

    try {
      const gastosImportados = await this.storageService.parseJSONFile(file);
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
        detail: 'Error al importar archivo JSON',
        life: 3000,
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
      acceptButtonStyleClass: 'p-button-danger',
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
        detail: 'Error al eliminar datos',
        life: 3000,
      });
    }
  }

  logout(): void {
    this.authService.logout();
  }
}
